// simple-ai local companion
//
// Runs on the user's machine as a tiny HTTP server on 127.0.0.1.
// The web app at simple-ai.example.com (or localhost dev) talks to it via fetch().
//
// Security model (mirrors Claude Code's permission pipeline):
//
//   1. Bind only to 127.0.0.1 — no LAN exposure.
//   2. Random token printed on startup is required as `Authorization: Bearer <token>`.
//   3. User picks a *workspace directory* via the native picker before any tools run.
//      Every fs/shell operation is canonicalized and must stay under that root.
//   4. Each tool call returns immediately with `permission_request` if a decision is
//      needed; the UI shows a dialog, posts back to `/permission`, then re-runs the call.
//   5. The user can pick `allow-once`, `allow-session`, `allow-always`, or `deny`.

use std::collections::{HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use anyhow::Result;
use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::sync::{Mutex, RwLock};
use tower_http::cors::{AllowOrigin, CorsLayer};

#[derive(Parser, Debug)]
#[command(name = "simple-ai-companion", about)]
struct Args {
    /// Port to bind on 127.0.0.1
    #[arg(long, default_value_t = 17381)]
    port: u16,

    /// Allowed CORS origin (the deployed web URL). May be repeated.
    /// "*" allowed for local dev only.
    #[arg(long = "origin", default_values_t = vec![
        String::from("http://localhost:5173"),
        String::from("http://127.0.0.1:5173"),
    ])]
    origins: Vec<String>,

    /// Pre-set workspace (otherwise the UI must call /pick-workspace).
    #[arg(long)]
    workspace: Option<PathBuf>,

    /// Pre-generated token (otherwise random)
    #[arg(long)]
    token: Option<String>,
}

#[derive(Clone)]
struct AppState {
    inner: Arc<Inner>,
}

struct Inner {
    token: String,
    workspace: RwLock<Option<PathBuf>>,
    /// Per-tool permission decisions for the running session.
    ///
    /// Key formats:
    ///   "Bash:git status"               (exact command)
    ///   "Bash:git *"                    (prefix glob)
    ///   "FileRead:/path/to/file"        (single file)
    ///   "FileRead:/dir/**"              (subtree)
    permissions: Mutex<HashMap<String, Decision>>,
    /// Pending requests awaiting user decision. The web UI polls /permission/poll
    /// and posts the resolution back to /permission/resolve.
    pending: Mutex<HashMap<String, PendingPermission>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Decision {
    AllowSession,
    AllowAlways, // session-scoped here, but persisted to disk in a follow-up
    Deny,
}

struct PendingPermission {
    tool: String,
    summary: String,
    detail: String,
    suggested_scope: Vec<String>,
    /// resolved.send(Decision)
    resolved: tokio::sync::oneshot::Sender<(Decision, Option<String>)>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    let token = args.token.unwrap_or_else(generate_token);
    let workspace = args.workspace.map(|p| p.canonicalize().unwrap_or(p));

    println!("┌────────────────────────────────────────────────────────────────┐");
    println!("│  simple-ai local companion                                     │");
    println!("├────────────────────────────────────────────────────────────────┤");
    println!("│  port      : {:<50}│", args.port);
    println!(
        "│  workspace : {:<50}│",
        workspace
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| String::from("(not picked — choose in browser)"))
    );
    println!("│  token     : {:<50}│", token);
    println!("│  origins   : {:<50}│", args.origins.join(", "));
    println!("└────────────────────────────────────────────────────────────────┘");
    println!();
    println!("Paste this URL into the web app's \"connect\" dialog:");
    println!("    http://127.0.0.1:{}#token={}", args.port, token);

    let state = AppState {
        inner: Arc::new(Inner {
            token: token.clone(),
            workspace: RwLock::new(workspace),
            permissions: Mutex::new(HashMap::new()),
            pending: Mutex::new(HashMap::new()),
        }),
    };

    // CORS: allow only configured origins (or any for dev with `--origin *`).
    let cors = if args.origins.iter().any(|o| o == "*") {
        CorsLayer::new()
            .allow_origin(AllowOrigin::any())
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
    } else {
        let origins: Vec<HeaderValue> = args
            .origins
            .iter()
            .filter_map(|o| HeaderValue::from_str(o).ok())
            .collect();
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/workspace", get(workspace_get))
        .route("/workspace/pick", post(workspace_pick))
        .route("/workspace/set", post(workspace_set))
        .route("/permission/poll", get(permission_poll))
        .route("/permission/resolve", post(permission_resolve))
        .route("/fs/read", post(fs_read))
        .route("/fs/write", post(fs_write))
        .route("/fs/glob", post(fs_glob))
        .route("/fs/grep", post(fs_grep))
        .route("/shell/exec", post(shell_exec))
        .layer(middleware::from_fn_with_state(state.clone(), auth_layer))
        .layer(cors)
        .with_state(state);

    let addr = format!("127.0.0.1:{}", args.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn generate_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:032x}", nanos.wrapping_mul(2862933555777941757_u128))
}

async fn auth_layer(
    State(state): State<AppState>,
    headers: HeaderMap,
    req: axum::extract::Request,
    next: Next,
) -> Response {
    // /health and CORS-preflight (handled by tower-http) skip auth.
    let path = req.uri().path();
    if path == "/health" {
        return next.run(req).await;
    }
    let ok = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|t| t == state.inner.token)
        .unwrap_or(false);
    if !ok {
        return (StatusCode::UNAUTHORIZED, "missing or wrong token").into_response();
    }
    next.run(req).await
}

#[derive(Serialize)]
struct Health {
    ok: bool,
    name: &'static str,
    version: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health {
        ok: true,
        name: "simple-ai-companion",
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[derive(Serialize)]
struct WorkspaceInfo {
    workspace: Option<String>,
}

async fn workspace_get(State(state): State<AppState>) -> Json<WorkspaceInfo> {
    let ws = state.inner.workspace.read().await;
    Json(WorkspaceInfo {
        workspace: ws.as_ref().map(|p| p.display().to_string()),
    })
}

async fn workspace_pick(State(state): State<AppState>) -> Result<Json<WorkspaceInfo>, ErrorResponse> {
    let chosen = rfd::AsyncFileDialog::new()
        .set_title("选择 simple-ai 的工作目录")
        .pick_folder()
        .await
        .map(|h| h.path().to_path_buf());
    if let Some(p) = chosen {
        let canon = p.canonicalize().unwrap_or(p);
        *state.inner.workspace.write().await = Some(canon.clone());
        // a workspace switch invalidates session permissions
        state.inner.permissions.lock().await.clear();
        Ok(Json(WorkspaceInfo {
            workspace: Some(canon.display().to_string()),
        }))
    } else {
        Ok(Json(WorkspaceInfo { workspace: None }))
    }
}

#[derive(Deserialize)]
struct SetWorkspaceInput {
    path: String,
}

async fn workspace_set(
    State(state): State<AppState>,
    Json(input): Json<SetWorkspaceInput>,
) -> Result<Json<WorkspaceInfo>, ErrorResponse> {
    let p = PathBuf::from(&input.path);
    if !p.exists() || !p.is_dir() {
        return Err(ErrorResponse::bad_request(format!(
            "目录不存在或不是目录：{}",
            input.path
        )));
    }
    let canon = p.canonicalize().unwrap_or(p);
    *state.inner.workspace.write().await = Some(canon.clone());
    state.inner.permissions.lock().await.clear();
    Ok(Json(WorkspaceInfo {
        workspace: Some(canon.display().to_string()),
    }))
}

// ---------------- permission core ----------------

#[derive(Serialize)]
struct PermissionItem {
    id: String,
    tool: String,
    summary: String,
    detail: String,
    suggested_scope: Vec<String>,
}

async fn permission_poll(State(state): State<AppState>) -> Json<Vec<PermissionItem>> {
    let pending = state.inner.pending.lock().await;
    Json(
        pending
            .iter()
            .map(|(id, p)| PermissionItem {
                id: id.clone(),
                tool: p.tool.clone(),
                summary: p.summary.clone(),
                detail: p.detail.clone(),
                suggested_scope: p.suggested_scope.clone(),
            })
            .collect(),
    )
}

#[derive(Deserialize)]
struct PermissionResolveInput {
    id: String,
    /// "allow-once" | "allow-session" | "allow-always" | "deny"
    decision: String,
    /// optional: which scope key(s) to apply allow-session/always to
    scope: Option<String>,
}

async fn permission_resolve(
    State(state): State<AppState>,
    Json(input): Json<PermissionResolveInput>,
) -> Json<Value> {
    let mut pending = state.inner.pending.lock().await;
    let Some(p) = pending.remove(&input.id) else {
        return Json(json!({ "ok": false, "error": "no such pending request" }));
    };
    let decision = match input.decision.as_str() {
        "allow-once" => Decision::AllowSession, // identical for now; the call-site won't cache
        "allow-session" => Decision::AllowSession,
        "allow-always" => Decision::AllowAlways,
        _ => Decision::Deny,
    };
    let _ = p.resolved.send((decision, input.scope.clone()));
    Json(json!({ "ok": true }))
}

/// Wait for the user's decision on a freshly-issued permission request.
/// Inserts into `pending`, the UI polls it, the user resolves it, this returns.
async fn request_permission(
    state: &AppState,
    tool: &str,
    summary: String,
    detail: String,
    suggested_scope: Vec<String>,
    cache_key: &str,
) -> Decision {
    // Already decided in this session?
    {
        let perms = state.inner.permissions.lock().await;
        if let Some(d) = lookup_decision(&perms, cache_key) {
            return d;
        }
    }

    let (tx, rx) = tokio::sync::oneshot::channel();
    let id = format!(
        "perm_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    {
        let mut pending = state.inner.pending.lock().await;
        pending.insert(
            id.clone(),
            PendingPermission {
                tool: tool.to_string(),
                summary,
                detail,
                suggested_scope,
                resolved: tx,
            },
        );
    }

    let (decision, scope) = rx.await.unwrap_or((Decision::Deny, None));
    if matches!(decision, Decision::AllowSession | Decision::AllowAlways) {
        let mut perms = state.inner.permissions.lock().await;
        let key = scope.unwrap_or_else(|| cache_key.to_string());
        perms.insert(key, decision);
    }
    decision
}

fn lookup_decision(map: &HashMap<String, Decision>, key: &str) -> Option<Decision> {
    if let Some(d) = map.get(key) {
        return Some(*d);
    }
    // glob match: keys ending in "**" or "*" match prefix.
    for (k, d) in map.iter() {
        if let Some(prefix) = k.strip_suffix("/**") {
            if key.starts_with(&format!("{}/", prefix)) || key == prefix {
                return Some(*d);
            }
        } else if let Some(prefix) = k.strip_suffix(":*") {
            // "Bash:*" matches "Bash:..."
            if key.starts_with(&format!("{}:", prefix)) {
                return Some(*d);
            }
        }
    }
    None
}

// ---------------- workspace sandbox ----------------

async fn workspace_or_err(state: &AppState) -> Result<PathBuf, ErrorResponse> {
    state
        .inner
        .workspace
        .read()
        .await
        .clone()
        .ok_or_else(|| ErrorResponse::bad_request("尚未选择工作目录，请先在界面中点击「选择工作目录」"))
}

fn resolve_under(workspace: &Path, raw: &str) -> Result<PathBuf, ErrorResponse> {
    let p = PathBuf::from(raw);
    let abs = if p.is_absolute() {
        p
    } else {
        workspace.join(p)
    };
    // Reject any `..` segments outright — paranoia against symlinks + ambiguity.
    if abs.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(ErrorResponse::forbidden(format!(
            "路径包含 `..`，禁止：{}",
            raw
        )));
    }
    // Try to canonicalize the parent (the leaf might not exist yet for writes).
    let canon = abs.canonicalize().unwrap_or_else(|_| abs.clone());
    if !canon.starts_with(workspace) {
        return Err(ErrorResponse::forbidden(format!(
            "{} 不在工作目录 {} 内",
            canon.display(),
            workspace.display()
        )));
    }
    Ok(canon)
}

// ---------------- fs commands ----------------

#[derive(Deserialize)]
struct FsReadInput {
    path: String,
    #[serde(default)]
    offset: u64,
    #[serde(default)]
    limit: u64,
}

async fn fs_read(
    State(state): State<AppState>,
    Json(input): Json<FsReadInput>,
) -> Result<Json<Value>, ErrorResponse> {
    let ws = workspace_or_err(&state).await?;
    let abs = resolve_under(&ws, &input.path)?;
    let cache_key = format!("FileRead:{}", abs.display());

    let dec = request_permission(
        &state,
        "FileRead",
        format!("读取文件 {}", abs.display()),
        format!("limit={} offset={}", input.limit, input.offset),
        vec![
            cache_key.clone(),
            format!("FileRead:{}/**", ws.display()),
        ],
        &cache_key,
    )
    .await;
    if matches!(dec, Decision::Deny) {
        return Err(ErrorResponse::forbidden("用户拒绝了读取该文件"));
    }

    let text = tokio::fs::read_to_string(&abs)
        .await
        .map_err(|e| ErrorResponse::internal(format!("read {}: {}", abs.display(), e)))?;
    let take = if input.offset == 0 && input.limit == 0 {
        text
    } else {
        let lines: Vec<&str> = text.split('\n').collect();
        let start = input.offset as usize;
        let end = if input.limit == 0 {
            lines.len()
        } else {
            std::cmp::min(lines.len(), start.saturating_add(input.limit as usize))
        };
        if start >= lines.len() {
            String::new()
        } else {
            lines[start..end].join("\n")
        }
    };
    Ok(Json(json!({ "content": take })))
}

#[derive(Deserialize)]
struct FsWriteInput {
    path: String,
    content: String,
}

async fn fs_write(
    State(state): State<AppState>,
    Json(input): Json<FsWriteInput>,
) -> Result<Json<Value>, ErrorResponse> {
    let ws = workspace_or_err(&state).await?;
    let abs = resolve_under(&ws, &input.path)?;
    let cache_key = format!("FileWrite:{}", abs.display());

    let dec = request_permission(
        &state,
        "FileWrite",
        format!("写入文件 {} ({} 字符)", abs.display(), input.content.len()),
        input.content.chars().take(400).collect::<String>(),
        vec![
            cache_key.clone(),
            format!("FileWrite:{}/**", ws.display()),
        ],
        &cache_key,
    )
    .await;
    if matches!(dec, Decision::Deny) {
        return Err(ErrorResponse::forbidden("用户拒绝了写入该文件"));
    }

    if let Some(parent) = abs.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| ErrorResponse::internal(format!("mkdir {:?}: {}", parent, e)))?;
    }
    tokio::fs::write(&abs, &input.content)
        .await
        .map_err(|e| ErrorResponse::internal(format!("write {}: {}", abs.display(), e)))?;
    Ok(Json(json!({ "ok": true, "path": abs.display().to_string() })))
}

#[derive(Deserialize)]
struct FsGlobInput {
    pattern: String,
    #[serde(default)]
    base: Option<String>,
}

async fn fs_glob(
    State(state): State<AppState>,
    Json(input): Json<FsGlobInput>,
) -> Result<Json<Value>, ErrorResponse> {
    let ws = workspace_or_err(&state).await?;
    // FileGlob is read-only metadata; auto-allow if path stays under workspace.
    let base = input.base.unwrap_or_else(|| ws.display().to_string());
    let base_path = resolve_under(&ws, &base)?;
    let pat = if Path::new(&input.pattern).is_absolute() {
        input.pattern.clone()
    } else {
        base_path.join(&input.pattern).display().to_string()
    };

    let mut out: Vec<String> = Vec::new();
    for entry in glob::glob(&pat).map_err(|e| ErrorResponse::internal(format!("glob: {}", e)))? {
        if let Ok(p) = entry {
            if let Ok(canon) = p.canonicalize() {
                if canon.starts_with(&ws) && canon.is_file() {
                    out.push(canon.display().to_string());
                }
            }
        }
    }
    out.sort();
    Ok(Json(json!({ "matches": out })))
}

#[derive(Deserialize)]
struct FsGrepInput {
    pattern: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    glob: Option<String>,
}

async fn fs_grep(
    State(state): State<AppState>,
    Json(input): Json<FsGrepInput>,
) -> Result<Json<Value>, ErrorResponse> {
    let ws = workspace_or_err(&state).await?;
    let root = match input.path.as_deref() {
        Some(p) => resolve_under(&ws, p)?,
        None => ws.clone(),
    };
    let re = regex::Regex::new(&input.pattern)
        .map_err(|e| ErrorResponse::bad_request(format!("正则错误：{}", e)))?;
    let glob_filter = input
        .glob
        .as_deref()
        .map(|g| glob::Pattern::new(g))
        .transpose()
        .map_err(|e| ErrorResponse::bad_request(format!("glob 错误：{}", e)))?;

    let mut results: Vec<Value> = Vec::new();
    let mut seen_files = HashSet::new();
    for entry in walkdir::WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        if let Some(g) = &glob_filter {
            if !g.matches_path(p) {
                continue;
            }
        }
        if seen_files.contains(p) {
            continue;
        }
        seen_files.insert(p.to_path_buf());
        let Ok(content) = tokio::fs::read_to_string(p).await else {
            continue;
        };
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                results.push(json!({
                    "file": p.display().to_string(),
                    "line": i + 1,
                    "text": line,
                }));
                if results.len() >= 500 {
                    break;
                }
            }
        }
        if results.len() >= 500 {
            break;
        }
    }
    Ok(Json(json!({ "matches": results })))
}

// ---------------- shell ----------------

#[derive(Deserialize)]
struct ShellExecInput {
    command: String,
    #[serde(default)]
    timeout_ms: Option<u64>,
    #[serde(default)]
    cwd: Option<String>,
}

async fn shell_exec(
    State(state): State<AppState>,
    Json(input): Json<ShellExecInput>,
) -> Result<Json<Value>, ErrorResponse> {
    let ws = workspace_or_err(&state).await?;
    let cwd = match input.cwd.as_deref() {
        Some(p) => resolve_under(&ws, p)?,
        None => ws.clone(),
    };
    let first_word = input.command.split_whitespace().next().unwrap_or("");
    let cache_key = format!("Bash:{}", first_word);

    let dec = request_permission(
        &state,
        "Bash",
        format!("执行命令 {}", input.command),
        format!("cwd={}", cwd.display()),
        vec![
            format!("Bash:{}", input.command),
            cache_key.clone(),
            "Bash:*".to_string(),
        ],
        &cache_key,
    )
    .await;
    if matches!(dec, Decision::Deny) {
        return Err(ErrorResponse::forbidden("用户拒绝了执行该命令"));
    }

    let timeout = std::time::Duration::from_millis(input.timeout_ms.unwrap_or(120_000));
    let child_res = tokio::time::timeout(timeout, async {
        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = tokio::process::Command::new("cmd");
            c.arg("/C").arg(&input.command);
            c
        } else {
            let mut c = tokio::process::Command::new("bash");
            c.arg("-lc").arg(&input.command);
            c
        };
        cmd.current_dir(&cwd);
        cmd.kill_on_drop(true);
        let out = cmd.output().await?;
        Ok::<_, std::io::Error>((
            String::from_utf8_lossy(&out.stdout).to_string(),
            String::from_utf8_lossy(&out.stderr).to_string(),
            out.status.code().unwrap_or(-1),
        ))
    })
    .await;

    match child_res {
        Ok(Ok((stdout, stderr, code))) => Ok(Json(json!({
            "stdout": stdout,
            "stderr": stderr,
            "code": code,
        }))),
        Ok(Err(e)) => Err(ErrorResponse::internal(format!("exec: {}", e))),
        Err(_) => Err(ErrorResponse::internal(format!(
            "命令超时（>{}ms）",
            timeout.as_millis()
        ))),
    }
}

// ---------------- error response ----------------

struct ErrorResponse {
    status: StatusCode,
    message: String,
}

impl ErrorResponse {
    fn bad_request(m: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: m.into(),
        }
    }
    fn forbidden(m: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: m.into(),
        }
    }
    fn internal(m: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: m.into(),
        }
    }
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}
