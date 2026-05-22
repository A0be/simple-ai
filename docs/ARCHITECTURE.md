# 架构文档

本文档描述 SimpleAI 的模块划分、依赖关系、数据流和扩展方式。最后更新：v1.0.7（2026-05-22）。

> 项目规模：~15300 行源码 / 90+ 文件 / 42 个内置工具 / 184 个 Agent 角色 / 75 个 HTML 模板。

---

## 1. 总览（分层）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Pages（路由页面，11 个）                       │
│ Home  Settings  Agents  AgentChat  Feature  History  HtmlAnything   │
│ Mcp   Skills   Tools   ClaudeTerminal                               │
├─────────────────────────────────────────────────────────────────────┤
│                        Components（14 个 + 命理 6 个）                  │
│  ChatView (核心交互, 733 LOC)  ToolCallBlock  Markdown  Layout       │
│  MiniTokenPanel  CompanionStatus  TerminalPanel  TerminalHistory…   │
│  ThinkingIndicator (v1.0.4)  MarketplaceManager (v1.0.6)            │
│  divination/ Bazi Tarot Ziwei Liuyao Dream Mbti                     │
├─────────────────────────────────────────────────────────────────────┤
│                          Core Lib（28 模块）                            │
│  ┌─ 对话编排 ─────────────────┐  ┌─ 数据持久化 ──────────────────┐    │
│  │ ai.ts   streamChat SSE     │  │ storage.ts  config/conv/mcp │    │
│  │ agentLoop.ts  多轮调度      │  │ profiles.ts  v1.0.2+         │    │
│  │ prompts.ts  系统提示词      │  │ terminalHistory.ts v1.0.2+   │    │
│  │ retry.ts (v1.0.4)  重试    │  │ marketplace.ts  v1.0.6+      │    │
│  └────────────────────────────┘  │ workspaceStore / favorites   │    │
│  ┌─ 工具系统 ─────────────────┐  └──────────────────────────────┘    │
│  │ tools/index.ts  registry  │  ┌─ 平台抽象 ────────────────────┐    │
│  │ tools/builtin/* (22 文件) │  │ localBackend.ts  路由         │    │
│  │ mcp/ 动态工具              │  │ electron.ts / tauri.ts        │    │
│  │ lsp/ 语言服务              │  │ companion.ts (Web fallback)   │    │
│  └────────────────────────────┘  └──────────────────────────────┘    │
│  ┌─ 多模态 ─────────────────-┐  ┌─ 业务模块 ─────────────────-┐    │
│  │ multimodal.ts             │  │ agents.ts   184 角色         │    │
│  │  图像 / 音频 / 视频         │  │ skills.ts   内置 6 + 自定义  │    │
│  │  Embedding                │  │ htmlSkills.ts  75 模板       │    │
│  │  统一走 MiniToken 兜底      │  │ slash.ts    9 个 Slash 命令  │    │
│  └────────────────────────────┘  └──────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                       Electron Main / Tauri / Companion              │
│  electron/main.cjs  IPC + PTY + Claude CLI + MiniToken proxy +      │
│                      代理 + html_export + marketplace_fetch          │
│  electron/preload.cjs  contextBridge                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 关键数据流

### 2.1 一次完整 Agent 对话

```
用户输入 (ChatView.handleSend)
   │
   ├─ composeSystemPrompt()      ← prompts.ts + projectContext + agentCapabilities
   │
   ├─ buildRegistry()             ← tools/index.ts + activeMcpClients()
   │
   ├─ runAgent(opts)              ← agentLoop.ts
   │    │
   │    └─ for turn in maxTurns:
   │         ├─ streamChat({...})    ← ai.ts → withRetry → fetch SSE
   │         │    (onRetry callback → ChatView.retryInfo → ThinkingIndicator)
   │         │
   │         ├─ if tool_calls:
   │         │    ├─ 只读工具：Promise.all 并行
   │         │    └─ 写入工具：顺序执行
   │         │    → append tool messages → 下一轮
   │         │
   │         └─ else: 对话结束（onFinish）
   │
   └─ saveConversation(meta)      ← storage.ts → localStorage
```

### 2.2 平台抽象路由

所有文件/Shell/网络操作都通过 [localBackend.ts](../src/lib/localBackend.ts) 路由：

```
isElectron()    → window.electronAPI  (IPC: fs_read/write/glob/grep/shell_exec/…)
isTauri()       → @tauri-apps/api invoke
companion()     → fetch('http://localhost:173xx/...')
否则             → throw NoBackendError
```

### 2.3 SOCKS5 代理（v1.0.2+）

每个 [ApiProfile](../src/lib/profiles.ts) 可独立配置代理 URL：

```
ChatView.applyProfile(p)
   ↓
electronAPI.proxySet({ url: p.proxy })
   ↓
[main.cjs] parseProxyUrl()
   ↓
session.defaultSession.setProxy({ proxyRules: 'socks5://host:port' })
   + (含认证时) on('login') 监听器 attach
   ↓
后续所有 fetch、所有窗口、所有 multimodal/marketplace IPC 自动走代理
```

---

## 3. 模块依赖矩阵

```
                    ai  agentLoop  retry  tools  mcp  multi  prof  market  termHist
ChatView             ✓     ✓                ✓    ·    ·      ·       ·       ·
agentLoop            ✓             ✓        ✓    ·    ·      ·       ·       ·
ai                   ✗               ✓       ·    ·    ·      ·       ·       ·
tools/imageGen       ·                       ✗    ·    ✓     ·       ·       ·
tools/listMcpRes     ·                       ✗    ✓    ·      ·       ·       ·
tools/builtin/*      ·                       ✗    ·    ·      ·       ·       ·
Settings.tsx         ✓     ·        ·        ✓    ·    ✓     ✓       ·       ·
ClaudeTerminal       ·     ·        ·        ·    ·    ·      ·       ·       ✓
MarketplaceManager   ·     ·        ·        ·    ·    ·      ·       ✓       ·
MiniTokenPanel       ·     ·        ·        ·    ·    ·      ✓       ·       ·
```

✓ = 直接依赖；✗ = 自身核心；· = 无关；`prof` = profiles，`market` = marketplace，`termHist` = terminalHistory。

---

## 4. 核心模块职责（按字母序）

| 模块 | LOC | 引入版本 | 职责 |
|---|---:|---|---|
| [ai.ts](../src/lib/ai.ts) | 280 | v1.0.0 | OpenAI Chat Completions SSE + tool_calls 拼装；走 [retry](../src/lib/retry.ts) |
| [agentCapabilities.ts](../src/lib/agentCapabilities.ts) | 250 | v1.0.0 | 能力检测 + 动态 prompt 注入 |
| [agentHistory.ts](../src/lib/agentHistory.ts) | 80 | v1.0.0 | sub-agent 历史持久化 |
| [agentLoop.ts](../src/lib/agentLoop.ts) | 240 | v1.0.0 | 多轮 tool dispatch；只读并行 / 写入顺序；transparent retry |
| [agents.ts](../src/lib/agents.ts) | 200 | v1.0.0 | 184 角色定义 + 14 分类 |
| [cliDetector.ts](../src/lib/cliDetector.ts) | 100 | v1.0.0 | claude/codex/aider CLI 自动探测 |
| [companion.ts](../src/lib/companion.ts) | 80 | v1.0.0 | Rust 旁路 HTTP API（Web 模式） |
| [electron.ts](../src/lib/electron.ts) | 30 | v1.0.0 | isElectron() + electronAPI 封装 |
| [favorites.ts](../src/lib/favorites.ts) | 50 | v1.0.0 | 收藏角色 ID |
| [features.ts](../src/lib/features.ts) | 150 | v1.0.0 | 10 个功能卡片定义 |
| [htmlSkills.ts](../src/lib/htmlSkills.ts) | 250 | v1.0.1 | 75 HTML 模板元数据 + 共享设计指令 |
| [localBackend.ts](../src/lib/localBackend.ts) | 200 | v1.0.0 | Electron/Tauri/Companion 平台路由 |
| [lsp/](../src/lib/lsp/) | - | v1.0.0 | LSP 客户端（拆 6 个工具） |
| [marketplace.ts](../src/lib/marketplace.ts) | 383 | v1.0.6 | Claude Code 兼容插件市场：解析 manifest、安装、卸载 |
| [mcp/](../src/lib/mcp/) | - | v1.0.0 | MCP JSON-RPC 2.0 client；v1.0.7 加 resources/list+read |
| [minitoken.ts](../src/lib/minitoken.ts) | 130 | v1.0.0 | MiniToken 账户/令牌/日志 API |
| [multimodal.ts](../src/lib/multimodal.ts) | 330 | v1.0.1 | 图像/音频/视频/Embedding；v1.0.3 留空走 MiniToken；v1.0.4 withRetry+超时延长 |
| [profiles.ts](../src/lib/profiles.ts) | 130 | v1.0.2 | 多 API 配置档案 + SOCKS5 代理字段 |
| [prompts.ts](../src/lib/prompts.ts) | 455 | v1.0.0 | 10 种场景系统提示词 |
| [retry.ts](../src/lib/retry.ts) | 130 | v1.0.4 | 通用 withRetry：5 次重试 / 60s 超时 / 4xx 立停 |
| [scheduler.ts](../src/lib/scheduler.ts) | 100 | v1.0.0 | Cron 解析 + 调度引擎 |
| [skills.ts](../src/lib/skills.ts) | 200 | v1.0.0 | Skill 系统（6 内置 + 自定义） |
| [slash.ts](../src/lib/slash.ts) | 180 | v1.0.0 | 9 个 Slash 命令 |
| [storage.ts](../src/lib/storage.ts) | 113 | v1.0.0 | localStorage 持久化：config/conversations/mcpServers |
| [tauri.ts](../src/lib/tauri.ts) | 20 | v1.0.0 | Tauri invoke 封装 |
| [terminalHistory.ts](../src/lib/terminalHistory.ts) | 80 | v1.0.2 | Claude 终端会话历史保存（含 ANSI） |
| [tools/](../src/lib/tools/) | - | v1.0.0 | ToolRegistry + 42 个内置工具 |
| [workspaceStore.ts](../src/lib/workspaceStore.ts) | 30 | v1.0.0 | 当前工作目录持久化 |

---

## 5. 大文件分布（>250 LOC）

| 文件 | LOC | 性质 | 是否抽模块 |
|---|---:|---|---|
| [pages/Settings.tsx](../src/pages/Settings.tsx) | 755 | 集成多区块的设置页 | v1.0.7 抽出 ModelEndpointEditor + modelHelpers |
| [components/ChatView.tsx](../src/components/ChatView.tsx) | 733 | 核心对话交互+状态管理 | v1.0.7 抽出 MessageRender |
| [lib/prompts.ts](../src/lib/prompts.ts) | 455 | 多场景系统提示词 | 否（提示词集中维护） |
| [components/CompanionStatus.tsx](../src/components/CompanionStatus.tsx) | 433 | Companion 连接面板 | 否（功能集中） |
| [lib/marketplace.ts](../src/lib/marketplace.ts) | 383 | 插件市场协议 | 否（单一关注点） |
| [lib/tools/builtin/tauriFs.ts](../src/lib/tools/builtin/tauriFs.ts) | 357 | 6 个文件操作工具 | 否（同类工具集合） |

---

## 6. 扩展点

### 6.1 新增工具
1. 在 `src/lib/tools/builtin/` 创建 `.ts` 文件，导出 `ToolDef`
2. 在 [tools/index.ts](../src/lib/tools/index.ts) 的 `buildRegistry()` 注册
3. 自动出现在 Tools 页 + Agent 工具链

### 6.2 新增页面
1. 在 `src/pages/` 创建 `.tsx`
2. 在 [App.tsx](../src/App.tsx) 加 `<Route>`
3. 在 [features.ts](../src/lib/features.ts) 加 FeatureCard 让首页可见

### 6.3 新增 Skill
1. 用户自定义 → `src/lib/skills.ts` 的 `customSkills` localStorage
2. 内置 → 修改 [skills.ts](../src/lib/skills.ts) 的 `BUILTIN_SKILLS`
3. 通过 marketplace 安装 → 自动注入 customSkills

### 6.4 新增 IPC 通道
1. 在 [electron/main.cjs](../electron/main.cjs) 加 `ipcMain.handle('xxx', ...)`
2. 在 [electron/preload.cjs](../electron/preload.cjs) 暴露到 `electronAPI`
3. 渲染进程通过 `window.electronAPI.xxx()` 调用

---

## 7. 设计决策记录（关键 trade-off）

| 决策 | 选择 | 不选择 | 理由 |
|---|---|---|---|
| 状态管理 | useState + localStorage | Redux / Zustand | 单页交互简单，避免外部依赖 |
| Markdown 渲染 | 项目内 [Markdown.tsx](../src/components/Markdown.tsx) | react-markdown | 0 外部 UI 依赖，包体积可控 |
| 图标 | 项目内 SVG | lucide-react / heroicons | 同上 |
| 代理协议 | session.setProxy 全局 | per-request agent | Electron 网络栈天然支持，复用 |
| 工具调用 | OpenAI tool_calls | Anthropic native tool_use | 主流 API 兼容性更广 |
| 终端历史 | localStorage（raw ANSI） | 文件落盘 | 桌面 Web 一致；带宽小 |
| MCP 资源读取 | 主进程 net.request | 渲染进程 fetch | 自动复用代理；不受 CORS 限 |
| 重试机制 | 通用 withRetry 包装 fetch | 在每个调用点写 | DRY + 一致行为 |

---

## 8. 相关文档

- [功能完成度](FEATURE_STATUS.md) — 每个功能的状态/版本/限制
- [后期优化路线](ROADMAP.md) — v1.1+ 规划
- [工具参考手册](TOOLS.md) — 42 个工具的参数、用例
- [与 Claude Code 对照](TOOLS_COMPARISON.md) — 已实现/不复刻清单
- [API 接口文档](API.md) — 外部 API 调用细节
- [变更日志](CHANGELOG.md) — 历史版本
