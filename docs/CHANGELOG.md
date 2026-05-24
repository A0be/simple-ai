# 变更记录 / CHANGELOG

每次发布前在此追加一段 `## v<版本号>`，按下面格式列变更。Release notes 直接引用这里。

---

## v1.0.11 — 2026-05-24

### 🎬 视频生成修复
- 视频端点修正为 `/v1/video/create`
- **新增轮询机制**：POST 创建后每 5 秒查询 `/v1/video/query` 直到拿到 URL 或 10 分钟超时

### 🎨 多模态修复
- **模型选择优先级**：用户设置 > AI 参数 > 默认值（之前 AI 自带 model 会覆盖用户设置）
- 图片 / 音频 / 视频超时统一 **10 分钟**
- 下一轮 API 请求不再回传 MB 级 base64（`stripInlineMedia` 出向裁剪）

### 💾 媒体本地持久化
- 注册 `app-media://` Electron 自定义协议，映射 `userData/media/`
- 图片/视频生成后自动保存到本地
- 历史对话恢复时图片和视频永久可查看，不再依赖临时 URL
- localStorage 不再存 MB 级 base64

### 🖥 UI 布局重构
- 修复高度链断裂：Layout main 加 `flex flex-col`；聊天页面用 `flex-1 min-h-0`
- 输入框独立控制面板（`border-t` + `shadow-md`）
- 顶栏模式切换按钮（📋 计划 / 🔧 执行）
- streaming 期间 200ms interval 保底滚底
- ChatView 顶栏加 `shrink-0`

### 新增文件
- `src/lib/api/stripInlineMedia.ts` — 出向 base64 裁剪
- Electron IPC `media:save` + preload `mediaSave`
- `src/lib/electron.ts` + `electronMediaSave()`

---

## v1.0.10 — 2026-05-22

### ✨ 多协议适配（Adapter 架构）

**simple-ai 现在可以直接对接 3 种 API 协议**，根据 baseUrl **自动识别**走哪一个：

| 协议 | 触发 URL 规则 | 关键差异 |
|---|---|---|
| OpenAI Chat Completions（默认） | 其他 baseUrl | 历史协议，`messages: [...]` + `tool_calls` |
| **Anthropic Messages** | `api.anthropic.com` 关键字 | `system` 顶层；`tool_use`/`tool_result` content blocks；`x-api-key` header；命名 SSE events |
| **OpenAI Responses** | URL 路径含 `/responses` | `input`/`instructions` 字段；`response.output_text.delta` 事件；function_call items |

Settings 页 baseUrl 输入框下方自动显示识别结果（紫色 = Anthropic / 绿色 = Responses / 蓝色 = Chat Completions）。

### 架构改造
- 抽 `src/lib/api/adapter.ts` 定义 `ChatAdapter` 接口
- `src/lib/api/openai-chat.ts` 把原 ai.ts 逻辑搬入
- 新增 `src/lib/api/anthropic.ts` 完整 Anthropic Messages 实现（message 转换 / tool_use ↔ tool_result / SSE 事件）
- 新增 `src/lib/api/openai-responses.ts` OpenAI Responses 实现
- ai.ts 简化为 dispatcher（detectAdapter + streamChat）

### Anthropic adapter 覆盖
- system / messages 转换（user/assistant，工具结果折叠到下一条 user message）
- tools 转换：`function.parameters` ↔ `input_schema`
- streaming：`message_start` / `content_block_start/delta/stop` / `message_delta` / `message_stop`
- vision：data URL 自动转 base64 image block
- 同时携带 `x-api-key` 和 `Authorization: Bearer ...`（适配某些代理）

### Responses adapter 覆盖
- input/instructions 转换；message + function_call + function_call_output items
- 流式 `response.output_text.delta` 主路径
- function_call 工具调用（best-effort）
- reasoning summary delta 映射到 thinking 通道（实验性）

### 未实现（标注）
- Anthropic extended thinking blocks / prompt caching / computer use / bash tools
- Responses reasoning controls / 高级 output_item 类型

### Anthropic preset 状态更新
- 「Anthropic 原生」preset hint 改为 ✓ 已支持，去掉「暂不支持」警示
- 用户可直接填入 Anthropic API Key（`sk-ant-...` 类型）

---

## v1.0.9 — 2026-05-22

### 🐛 紧急修复
- **修复 thinking 模型 400 报错** `reasoning_content in the thinking mode must be passed back to the API`
  - 根因：原实现把模型返回的 reasoning_content 作为独立 assistant message 插入，content 字段塞 thinking 文本；下一轮请求时违反 DeepSeek-R1 / o1 等模型的协议——它们要求 `reasoning_content` 字段必须在 **同一条 assistant message** 上原样回传
  - 修复：
    - `ChatMessage` 类型新增 `reasoning_content?: string` 字段
    - `ai.ts:toWireMessage` 在 assistant 消息附加 `reasoning_content` 字段
    - `agentLoop` 不再插入独立 thinking message，直接写入当前 liveAssistant 的 `reasoning_content`
    - `MessageRender` 新增折叠 UI 渲染 `message.reasoning_content`；保留旧 `display==='thinking'` 路径向后兼容旧对话历史

### 新增
- **endpoint preset 扩充**：MiniToken 之外加入 OpenRouter / Anthropic 原生（占位待 v1.0.10 适配）/ 字节豆包 / 腾讯混元 / 百度文心；所有 preset 加详细 hint 说明用途
  - **Anthropic 原生**：暂不支持（待 v1.0.10 加 adapter），建议先通过 MiniToken / OpenRouter 走 OpenAI 兼容协议调用 Claude
- 所有已有 preset 补充更准确的 hint（标注 thinking 支持 / coder 模型 / 直连情况）

### 已知未做
- Anthropic 原生 Messages API adapter — 排在 [ROADMAP.md](ROADMAP.md) v1.0.10：协议差异较大（system 顶层 / tool_use/tool_result / x-api-key header / SSE event 不同），需要独立 adapter 层

---

## v1.0.8 — 2026-05-22

### 新增
- **🔄 自动更新（electron-updater）**：从 GitHub Releases 检查并安装新版本
  - 启动后约 5s 自动检查（仅打包后的安装版生效）
  - Settings 新增「自动更新」卡：状态 / 版本 / 进度 / 下载 / 安装按钮
  - 用户确认后下载，下载完弹「重启并安装」按钮
  - electron-builder `publish: github` 配置生成 `latest.yml`
  - 新增 IPC: `updater:status / check / download / install` + 推送通道 `updater:state`

### 文档
- 新增 [docs/DEV_SETUP.md](DEV_SETUP.md)：本地开发环境从零到跑起来 + 11 项报错对照
- 新增 [docs/CONTRIBUTING.md](CONTRIBUTING.md)：常见任务 cheat sheet（加工具/页面/IPC/Skill + 发布流程）
- 重写 [CLAUDE.md](../CLAUDE.md)：v1.0.1 → v1.0.7 全貌；新会话快速索引；v1.0.8 草案标注
- 重写 [docs/ARCHITECTURE.md](ARCHITECTURE.md)：v1.0.7 分层图 + 28 模块职责矩阵
- 重写 [docs/TOOLS.md](TOOLS.md)：42 个工具完整参数与示例
- 新增 [docs/FEATURE_STATUS.md](FEATURE_STATUS.md)：功能状态表（版本/限制/TODO）
- 新增 [docs/ROADMAP.md](ROADMAP.md)：v1.1 / v1.2 / Future 三档

### 代码模块化
- 抽 [src/lib/modelHelpers.ts](../src/lib/modelHelpers.ts)：PRESETS / FALLBACK_MODELS / fetchModels
- 抽 [src/components/ModelEndpointEditor.tsx](../src/components/ModelEndpointEditor.tsx) 独立组件
- 抽 [src/components/MessageRender.tsx](../src/components/MessageRender.tsx) 独立组件
- [Settings.tsx](../src/pages/Settings.tsx)：755 → 575 LOC (-180)
- [ChatView.tsx](../src/components/ChatView.tsx)：733 → 624 LOC (-109)

### 配置
- [package.json](../package.json) 增 `electron-builder.publish` GitHub provider 配置；electron-updater 6.x 入 deps

---

## v1.0.7 — 2026-05-22

### 新增工具（3 个，对齐 Claude Code 剩余可复刻清单）
- **`ConfigTool`** — model 读/写 simple-ai 的 ApiConfig：baseUrl / apiKey / model / helperModel / disableStreaming / projectContext；apiKey 读取自动 mask；写入弹 AskUserQuestion 确认
- **`ListMcpResourcesTool`** — 列出每个已连 MCP 服务器的资源（按 `resources/list`）；服务器无该能力时静默跳过
- **`ReadMcpResourceTool`** — 按 URI 读单个 MCP 资源（`resources/read`），合并 text/blob contents 返回；不指定 server 时遍历所有连接尝试

### MCP client 扩展
- [`mcp/client.ts`](../src/lib/mcp/client.ts) 新增 `listResources()` / `readResource(uri)` 方法；服务器无 capability 时 `listResources` 返回空数组而不抛
- [`mcp/types.ts`](../src/lib/mcp/types.ts) 加 `McpResource` / `McpResourcesListResult` / `McpResourceContent` / `McpResourcesReadResult` 类型

### 工具数变化
- 39 → **42 个内置工具**

### 明确不复刻
- **BriefTool**（含 GrowthBook + analytics + 文件上传云服务，语义与 simple-ai chat text 重复）
- **REPLTool**（仅是基础工具的别名集合）
- **SyntheticOutputTool**（仅非交互式 session）
- **McpAuthTool / TeamCreateTool / TeamDeleteTool / RemoteTriggerTool**（依赖 Anthropic OAuth / 团队 / 远程云服务）

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
