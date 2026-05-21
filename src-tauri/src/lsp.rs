use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, State};

pub struct LspState {
    inner: Mutex<HashMap<String, LspProc>>,
}

impl LspState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

pub struct LspProc {
    child: Child,
    stdin: Option<ChildStdin>,
}

fn gen_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("lsp_{:x}", nanos)
}

/// Read LSP messages (Content-Length framed) from the given reader and emit
/// `lsp:<id>:message` events with the JSON body.
fn spawn_lsp_reader<R: Read + Send + 'static>(reader: R, id: String, app: AppHandle) {
    std::thread::spawn(move || {
        let mut r = BufReader::new(reader);
        loop {
            let mut content_length: usize = 0;
            let mut header_done = false;
            // read headers line-by-line until empty
            loop {
                let mut line = String::new();
                match r.read_line(&mut line) {
                    Ok(0) => {
                        let _ = app.emit(&format!("lsp:{}:closed", id), ());
                        return;
                    }
                    Ok(_) => {}
                    Err(_) => return,
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    header_done = true;
                    break;
                }
                if let Some(v) = trimmed.strip_prefix("Content-Length:") {
                    content_length = v.trim().parse().unwrap_or(0);
                }
            }
            if !header_done || content_length == 0 {
                continue;
            }
            let mut body = vec![0u8; content_length];
            if r.read_exact(&mut body).is_err() {
                let _ = app.emit(&format!("lsp:{}:closed", id), ());
                return;
            }
            let s = match String::from_utf8(body) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let _ = app.emit(&format!("lsp:{}:message", id), s);
        }
    });
}

#[tauri::command]
pub fn lsp_spawn(
    app: AppHandle,
    state: State<'_, LspState>,
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
    if let Some(stdout) = child.stdout.take() {
        spawn_lsp_reader(stdout, id.clone(), app);
    }
    let proc = LspProc { child, stdin };
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    map.insert(id.clone(), proc);
    Ok(id)
}

#[tauri::command]
pub fn lsp_send(
    state: State<'_, LspState>,
    id: String,
    body: String,
) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    let proc = map
        .get_mut(&id)
        .ok_or_else(|| format!("no lsp proc {}", id))?;
    let stdin = proc
        .stdin
        .as_mut()
        .ok_or_else(|| "stdin unavailable".to_string())?;
    let header = format!("Content-Length: {}\r\n\r\n", body.len());
    stdin.write_all(header.as_bytes()).map_err(|e| e.to_string())?;
    stdin.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn lsp_close(state: State<'_, LspState>, id: String) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut proc) = map.remove(&id) {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}
