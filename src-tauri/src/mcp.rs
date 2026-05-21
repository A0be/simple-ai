use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
pub struct ProcessHandle {
    pub id: String,
}

pub struct McpState {
    inner: Mutex<HashMap<String, McpProc>>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

pub struct McpProc {
    child: Child,
    stdin: Option<ChildStdin>,
}

fn gen_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("mcp_{:x}", nanos)
}

#[tauri::command]
pub fn mcp_stdio_spawn(
    app: AppHandle,
    state: State<'_, McpState>,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<String, String> {
    let id = gen_id();
    let mut cmd = std::process::Command::new(&command);
    cmd.args(&args);
    for (k, v) in &env {
        cmd.env(k, v);
    }
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("spawn: {}", e))?;

    let stdin = child.stdin.take();
    let stdout = child.stdout.take();

    if let Some(stdout) = stdout {
        let id_clone = id.clone();
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = app_clone.emit(&format!("mcp:{}:line", id_clone), l);
                    }
                    Err(_) => break,
                }
            }
            let _ = app_clone.emit(&format!("mcp:{}:closed", id_clone), ());
        });
    }

    let proc = McpProc { child, stdin };
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    map.insert(id.clone(), proc);
    Ok(id)
}

#[tauri::command]
pub fn mcp_stdio_send(
    state: State<'_, McpState>,
    id: String,
    line: String,
) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    let proc = map.get_mut(&id).ok_or_else(|| format!("no mcp proc {}", id))?;
    let stdin = proc
        .stdin
        .as_mut()
        .ok_or_else(|| "stdin unavailable".to_string())?;
    stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("write: {}", e))?;
    stdin.flush().map_err(|e| format!("flush: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn mcp_stdio_close(
    state: State<'_, McpState>,
    id: String,
) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut proc) = map.remove(&id) {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}
