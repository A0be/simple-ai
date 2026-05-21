# 变更记录 / CHANGELOG

每次发布前在此追加一段 `## v<版本号>`，按下面格式列变更。Release notes 直接引用这里。

---

## v1.0.6 — 2026-05-22

### 新增
- **🧩 插件市场（Claude Code 兼容）**：Settings 新增「插件市场」折叠区
  - 粘 GitHub 仓库 URL → 自动拉 `.claude-plugin/marketplace.json` → 列出可装 plugin
  - 每个 plugin 点「安装」会解析其 `plugin.json#skills[]` → 拉所有 `.md` / `SKILL.md` → 注入到 `customSkills`
  - 支持卸载（移除对应 customSkills 条目）
  - 已测试格式：[`affaan-m/everything-claude-code`](https://github.com/affaan-m/everything-claude-code) 风格的 manifest
  - **命令 / MCP servers 暂不支持**（plugin.json 含 commands/mcpServers 时会跳过并提示）
- 新增 `lib/marketplace.ts`：Marketplace / InstalledPlugin 类型、CRUD、GitHub raw/contents API helper、frontmatter parser
- 新增 `components/MarketplaceManager.tsx`：UI 组件嵌入 Settings 页

### Electron 主进程
- 新增 `marketplace:fetch_text` IPC：用 `net.request` 走 `session.defaultSession`，**自动复用现有 SOCKS5/HTTP 代理**配置；用户在某 profile 配的代理对 marketplace 拉取同样生效

### 变更
- 生图默认型号 `gpt-image-1` → **`gpt-image-2-all`**（MiniToken 网站推荐型号）
- imageGen 工具描述同步更新

---

## v1.0.5 — 2026-05-22

### 新增工具（3 个，对齐 Anthropic Claude Code 高优先级清单）
- **`PowerShellTool`** ([powerShell.ts](../src/lib/tools/builtin/powerShell.ts))：Windows 上通过 `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command` 执行命令。在 macOS/Linux 上立即拒绝并提示用 Bash。复用 Bash 的 `shellExec` 路径，含 plan-mode 阻断
- **`SleepTool`** ([sleep.ts](../src/lib/tools/builtin/sleep.ts))：让 Agent 暂停 N 秒（cap 300s）。响应 `ctx.signal` 中止；用于轮询外部状态/等待远程任务
- **`ToolSearchTool`** ([toolSearch.ts](../src/lib/tools/builtin/toolSearch.ts))：按关键字模糊搜索已注册工具（name 100/40 分、description 5 分），返回 top N（默认 10、最多 30）。读时安全，plan mode 允许

### 文档
- **README 嵌入功能截图**：首页 / 设置 / 终端 / HTML 万物生成 / 多模态 / 对话历史 6 张图入对应小节
- README 末尾新增「文档与变更」区，跳转 CHANGELOG / TOOLS_COMPARISON / screenshots/
- [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md) 标记三个新工具已实现，剩余高优先级未做：`TaskOutputTool` / `TaskStopTool`（已在 v1.0.0 实现）/ `BriefTool` / `ConfigTool`

### 工具数变化
- 36 → **39 个内置工具**

---

## v1.0.4 — 2026-05-22

### 新增
- **思考状态 SVG 动效** ([ThinkingIndicator](../src/components/ThinkingIndicator.tsx))：assistant 消息流开始前显示三圆点呼吸 SVG，含思考/图像/视频/重试 4 套调色与文案
- **请求重试机制** ([retry.ts](../src/lib/retry.ts))：通用 `withRetry(fn, opts)` 包装
  - 默认最多 **5** 次重试、每次 **60s** 超时
  - 网络错误 / 408 / 429 / 5xx 自动重试
  - 4xx 业务错误（400/401/403/413 等）立即停止
  - 通过 `onRetry` 回调把 `{ attempt, total, reason }` 透传到 UI
  - `streamChat` 与全部多模态 API 已接入；多模态超时延长（图像 120s / 视频 600s / 音频 90s / Embedding 60s），多模态调用重试次数降为 2 避免昂贵的重发
- **图像/视频生成中占位动画**：ToolCallBlock 在 `isRunning && !media` 时显示对应 variant 的 ThinkingIndicator
- **图像附件 size 预警**：超过 1MB 的图像附件在 ChatView 输入区显示 ⚠️ 标签提醒 token 风险（按用户要求不自动压缩）

### 文档
- 新增 [docs/TOOLS_COMPARISON.md](TOOLS_COMPARISON.md)：simple-ai vs Anthropic Claude Code 工具对照表（41 ↔ 36），后续迭代依据
- 新增本文件 [docs/CHANGELOG.md](CHANGELOG.md)

### 已知未做
- Anthropic Claude Code 中 PowerShellTool / SleepTool / TaskOutputTool / TaskStopTool / ToolSearchTool / BriefTool / ConfigTool 等约 13 个工具未复刻 — 见 [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md) 列表

---

## v1.0.3 — 2026-05-22

### 修复
- 终端历史抽屉：点击会话条目后右侧 player 空白（xterm 初始化 useEffect 缺少 `sessions.length` 依赖）
- 多模态 URL 拼接：原 `normalizeBase` 留了无效的 `.replace(/\/v\d+$/, (m) => m)`，导致 `https://minitoken.top/v1` + `/v1/...` 拼出 `/v1/v1/...`

### 变更
- **多模态端点默认走 MiniToken**：`imageModel/audioModel/videoModel` 留空时不再回退到主 baseUrl，而是用 `https://minitoken.top/v1` + 主 apiKey
- **接口返回格式自适应**：generateImage / generateVideo 兼容多种字段（`url` / `image_url` / `uri` / `output_url` / `b64_json` / `b64` / `base64` 等），顶层兼容 `data`/`images`/`output`/`results` 容器
- **生成媒体下载**：图像 hover 右上角 💾 下载按钮；视频独立 💾 下载视频 + 在新标签打开。HTTP URL 走 `fetch → blob → a[download]` 规避跨域 download 抑制

---

## v1.0.2 — 2026-05-22

### 修复（紧急）
- **MiniToken 子窗口登录卡死**：原 `app.whenReady` 内无条件注册 `session.on('login')` 监听器，导致任何非代理 401 challenge 也被监听器拦截但不应答，请求被取消。改为按需挂卸：仅在带认证代理生效时注册

---

## v1.0.2 (代码 / 同次发布) — 2026-05-22

### 新增（代理与档案）
- **API 配置档案管理** ([profiles.ts](../src/lib/profiles.ts))：保存 / 测试 / MiniToken 应用后自动入档；同 baseUrl+apiKey 视为同档案
- **每条档案独立 SOCKS5 代理**：支持 `socks5://user:pass@host:port` 含认证；切换档案自动应用对应代理；代理对整个 app 所有网络请求生效（`session.defaultSession.setProxy`）
- **MiniToken 🔁 刷新 API 按钮**：重置 `autoKeyApplied` 哨兵后重新拉取 + 应用 key/baseUrl

### 新增（终端）
- **Claude Code 终端会话历史** ([terminalHistory.ts](../src/lib/terminalHistory.ts))：会话结束（PTY 真退出 / 用户终止 / 路由切换）自动保存原始 ANSI 输出；最多 20 条，单条 1MB 上限
- **历史抽屉** ([TerminalHistoryDrawer.tsx](../src/components/TerminalHistoryDrawer.tsx))：列表 + 只读 xterm 彩色重放

### 新增（HTML 生成）
- **左侧大卡片侧边栏**：原顶部模板云改为 256px 侧边栏，每个模板 emoji + 名称 + 2 行描述
- **导出到本地**：Electron 弹原生 saveDialog 选位置 → 写文件 → `shell.openPath` 用默认浏览器打开 file://

---

## v1.0.1 — 2026-05-21

初始公开版本相关功能见上一次提交描述。

---

## v1.0.0 — 2026-05-21

首发：184 角色 / 28 工具 / 命理 / Claude 终端 / MCP / HTML 生成（28 模板）
