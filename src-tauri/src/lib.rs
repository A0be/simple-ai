mod commands;
mod mcp;
mod lsp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(mcp::McpState::new())
        .manage(lsp::LspState::new())
        .invoke_handler(tauri::generate_handler![
            commands::fs_read,
            commands::fs_write,
            commands::fs_glob,
            commands::fs_grep,
            commands::shell_exec,
            mcp::mcp_stdio_spawn,
            mcp::mcp_stdio_send,
            mcp::mcp_stdio_close,
            lsp::lsp_spawn,
            lsp::lsp_send,
            lsp::lsp_close,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
