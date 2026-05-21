use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

fn expand_base(base: &str) -> PathBuf {
    if base.is_empty() {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    } else {
        PathBuf::from(base)
    }
}

#[tauri::command]
pub fn fs_read(path: String, offset: u64, limit: u64) -> Result<String, String> {
    let mut file = fs::File::open(&path).map_err(|e| format!("open {}: {}", path, e))?;
    let mut buf = String::new();
    file.read_to_string(&mut buf)
        .map_err(|e| format!("read {}: {}", path, e))?;
    if offset == 0 && limit == 0 {
        return Ok(buf);
    }
    let lines: Vec<&str> = buf.split('\n').collect();
    let start = offset as usize;
    let end = std::cmp::min(lines.len(), start.saturating_add(limit as usize));
    if start >= lines.len() {
        return Ok(String::new());
    }
    let take = if limit == 0 {
        &lines[start..]
    } else {
        &lines[start..end]
    };
    Ok(take.join("\n"))
}

#[tauri::command]
pub fn fs_write(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir -p {:?}: {}", parent, e))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("write {}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
pub fn fs_glob(pattern: String, base: String) -> Result<Vec<String>, String> {
    let base_path = expand_base(&base);
    let full = if Path::new(&pattern).is_absolute() {
        pattern.clone()
    } else {
        base_path.join(&pattern).to_string_lossy().to_string()
    };
    let mut out = Vec::new();
    for entry in glob::glob(&full).map_err(|e| format!("glob: {}", e))? {
        match entry {
            Ok(p) => {
                if let Ok(meta) = fs::metadata(&p) {
                    if meta.is_file() {
                        out.push((p.to_string_lossy().to_string(), meta.modified().ok()));
                    }
                }
            }
            Err(_) => continue,
        }
    }
    out.sort_by(|a, b| b.1.cmp(&a.1));
    Ok(out.into_iter().map(|(p, _)| p).collect())
}

#[tauri::command]
pub fn fs_grep(
    pattern: String,
    base: String,
    glob: String,
    mode: String,
    ci: bool,
) -> Result<String, String> {
    let base_path = expand_base(&base);
    let mut re_builder = regex::RegexBuilder::new(&pattern);
    re_builder.case_insensitive(ci);
    let re = re_builder.build().map_err(|e| format!("regex: {}", e))?;

    let glob_pat = if glob.is_empty() {
        None
    } else {
        Some(glob::Pattern::new(&glob).map_err(|e| format!("glob: {}", e))?)
    };

    let mut files_with_matches: Vec<String> = Vec::new();
    let mut content_lines: Vec<String> = Vec::new();
    let mut total_count: usize = 0;

    let walker = if base_path.is_file() {
        let mut v = Vec::new();
        v.push(base_path.clone());
        v
    } else {
        WalkDir::new(&base_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.into_path())
            .collect::<Vec<_>>()
    };

    for path in walker {
        if let Some(g) = &glob_pat {
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if !g.matches(&name) {
                continue;
            }
        }
        // Skip binary-ish files (>5MB or non-utf8) cheaply
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() > 5 * 1024 * 1024 {
                continue;
            }
        }
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let mut found_in_file = false;
        for (i, line) in text.lines().enumerate() {
            if re.is_match(line) {
                found_in_file = true;
                total_count += 1;
                if mode == "content" {
                    content_lines.push(format!("{}:{}:{}", path.display(), i + 1, line));
                    if content_lines.len() >= 500 {
                        break;
                    }
                }
            }
        }
        if found_in_file && mode == "files_with_matches" {
            files_with_matches.push(path.to_string_lossy().to_string());
            if files_with_matches.len() >= 500 {
                break;
            }
        }
    }

    match mode.as_str() {
        "content" => Ok(content_lines.join("\n")),
        "count" => Ok(total_count.to_string()),
        _ => Ok(files_with_matches.join("\n")),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn shell_exec(
    command: String,
    cwd: String,
    timeout_ms: u64,
) -> Result<ShellResult, String> {
    #[cfg(target_os = "windows")]
    let (sh, flag) = ("cmd", "/C");
    #[cfg(not(target_os = "windows"))]
    let (sh, flag) = ("sh", "-c");

    let mut cmd = Command::new(sh);
    cmd.arg(flag).arg(&command);
    if !cwd.is_empty() {
        cmd.current_dir(&cwd);
    }

    let mut child = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn: {}", e))?;

    let timeout = if timeout_ms == 0 {
        Duration::from_secs(120)
    } else {
        Duration::from_millis(timeout_ms)
    };

    let start = std::time::Instant::now();
    let exit = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return Err(format!("Timeout after {:?}", timeout));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("wait: {}", e)),
        }
    };

    let mut stdout = String::new();
    let mut stderr = String::new();
    if let Some(mut s) = child.stdout.take() {
        let _ = s.read_to_string(&mut stdout);
    }
    if let Some(mut s) = child.stderr.take() {
        let _ = s.read_to_string(&mut stderr);
    }
    Ok(ShellResult {
        stdout,
        stderr,
        code: exit.code().unwrap_or(-1),
    })
}
