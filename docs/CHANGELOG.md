# 变更记录 / CHANGELOG

每次发布前在此追加一段 `## v<版本号>`，按下面格式列变更。Release notes 直接引用这里。

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
