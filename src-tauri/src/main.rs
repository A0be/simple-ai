// 简易 AI 工具箱 - Tauri 主入口
// 这是一个纯前端应用，Tauri 只负责把网页打包成桌面应用，不需要复杂的后端逻辑。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    simple_ai_lib::run()
}
