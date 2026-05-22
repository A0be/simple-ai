# SimpleAI Toolbox — 项目交接文档

> 本文件供 Claude Code / AI 助手在**新会话**中快速理解项目全貌。
> 最后更新：**v1.0.7**（2026-05-22）
> 同步阅读：[CHANGELOG.md](docs/CHANGELOG.md) / [ARCHITECTURE.md](docs/ARCHITECTURE.md) / [FEATURE_STATUS.md](docs/FEATURE_STATUS.md)

---

## 0. 新会话快速索引

| 你想做 | 看这里 |
|---|---|
| 5 分钟了解项目 | 本文件 §1 + §2 + §10 |
| 跑起来开发 | [docs/DEV_SETUP.md](docs/DEV_SETUP.md) |
| 加一个工具 / 页面 / IPC | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| 完整架构图 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 现有功能清单 | [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md) |
| 未来计划 | [docs/ROADMAP.md](docs/ROADMAP.md) |
| 工具参考 | [docs/TOOLS.md](docs/TOOLS.md) |
| 历史改动 | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| 跟 Claude Code 对照 | [docs/TOOLS_COMPARISON.md](docs/TOOLS_COMPARISON.md) |

---

## 1. 项目一句话

**简易 AI 工具箱**（SimpleAI Toolbox）— 一站式 AI 工具桌面应用（Electron 优先），兼容所有 OpenAI Chat Completions API。一个 API Key 通用 184 个 Agent 角色 / 42 个开发者工具 / 75 个 HTML 模板 / 命理 / Claude Code 终端 / MCP / 插件市场。

- **GitHub**：https://github.com/A0be/simple-ai
- **当前版本**：1.0.7（持续迭代）
- **平台主目标**：Windows 10/11 x64（Electron NSIS）；备选 Tauri / Web+Companion / PWA
- **存储**：localStorage（配置/对话/收藏/MCP/profiles/历史/marketplace 等）
- **不上传任何服务器**：仅与用户配置的 API 端点通信

---

## 2. 技术栈速览

| 层 | 选型 |
|---|---|
| UI | React 18 + TypeScript 5 + Tailwind 3（自定义 `ink` 色阶） |
| 构建 | Vite 5（`@` → `src/`） |
| 桌面 | Electron 42（main.cjs + preload.cjs + contextBridge） |
| 终端 | xterm.js 6 + node-pty 1.x |
| 打包 | electron-builder（NSIS，输出到 `out/`） |
| API 协议 | OpenAI Chat Completions SSE + MCP JSON-RPC 2.0 |
| 第三方 UI 组件依赖 | **零**（Markdown / 图标 / 模态都项目内实现） |

---

## 3. 目录结构

```
simple-ai/
├── electron/                   # Electron 主进程
│   ├── main.cjs                # IPC + PTY + Claude CLI + 代理 + html_export + marketplace_fetch
│   └── preload.cjs             # contextBridge → window.electronAPI
├── scripts/
│   ├── bundle-claude.mjs       # 封装 Claude CLI 到 resources/
│   └── gen-icons.mjs
├── src/
│   ├── App.tsx                 # 路由（react-router-dom v6）
│   ├── main.tsx                # 入口：Electron→HashRouter / Web→BrowserRouter
│   ├── types/index.ts          # ApiConfig / ChatMessage / ToolCall / AgentTask…
│   │
│   ├── components/             # 17 个组件 + divination/
│   │   ├── ChatView.tsx        # 核心对话（624 LOC，v1.0.8 模块化）
│   │   ├── MessageRender.tsx   # 消息渲染（v1.0.8 抽出）
│   │   ├── ModelEndpointEditor.tsx # 多模态端点编辑器（v1.0.8 抽出）
│   │   ├── ThinkingIndicator.tsx   # 思考状态 SVG（v1.0.4）
│   │   ├── TerminalHistoryDrawer.tsx # 终端历史抽屉（v1.0.2）
│   │   ├── MarketplaceManager.tsx  # 插件市场 UI（v1.0.6）
│   │   ├── MiniTokenPanel.tsx / CompanionStatus.tsx / Layout.tsx
│   │   ├── TerminalPanel.tsx / ToolCallBlock.tsx / Markdown.tsx
│   │   ├── TodoPanel.tsx / PlanBanner.tsx / AskUserQuestionModal.tsx / Icons.tsx
│   │   └── divination/         # 命理：Bazi / Tarot / Ziwei / Liuyao / Dream / Mbti
│   │
│   ├── pages/                  # 11 个路由页
│   │   ├── Home / Settings(575) / Agents / AgentChat / Feature
│   │   ├── HtmlAnything / ClaudeTerminal / History / Mcp / Skills / Tools
│   │
│   └── lib/                    # 28 个核心模块
│       ├── ai.ts               # SSE 流式 + 走 retry
│       ├── retry.ts            # withRetry: 5 次 / 60s / 4xx 立停（v1.0.4）
│       ├── agentLoop.ts        # 多轮工具调度（只读并行 / 写入顺序）
│       ├── agents.ts           # 184 角色
│       ├── multimodal.ts       # 图/音/视频/Embedding；留空走 MiniToken（v1.0.3+）
│       ├── modelHelpers.ts     # PRESETS / FALLBACK_MODELS / fetchModels（v1.0.8）
│       ├── profiles.ts         # 多 API 档案 + SOCKS5 代理（v1.0.2）
│       ├── terminalHistory.ts  # 终端会话历史（v1.0.2）
│       ├── marketplace.ts      # Claude Code 兼容插件市场（v1.0.6）
│       ├── htmlSkills.ts       # 75 模板元数据
│       ├── minitoken.ts        # MiniToken 账户/令牌/日志 API
│       ├── localBackend.ts     # 平台抽象：Electron / Tauri / Companion 路由
│       ├── tools/              # 42 个内置工具（builtin/ 22 文件）
│       ├── mcp/                # MCP client + tools/resources（v1.0.7+ 加 resources）
│       └── lsp/                # LSP 客户端
│
├── docs/
│   ├── CHANGELOG.md / ARCHITECTURE.md / FEATURE_STATUS.md / ROADMAP.md
│   ├── TOOLS.md / TOOLS_COMPARISON.md / API.md
│   ├── DEV_SETUP.md / CONTRIBUTING.md（v1.0.8 新增）
│   └── screenshots/
├── companion/                  # Rust 旁路 HTTP API（Web 模式用）
├── src-tauri/                  # Tauri 后端（备选）
├── public/icons/               # 应用图标
└── package.json                # 依赖 + electron-builder 配置
```

---

## 4. 核心数据流

### 4.1 一次 Agent 对话

```
ChatView.handleSend()
   ↓
composeSystemPrompt()  + buildRegistry()
   ↓
runAgent({ config, messages, registry, session, ui, signal, onRetry, … })
   ↓ for turn in maxTurns(12):
   ├─ streamChat({…}) → withRetry → fetch SSE
   │     onRetry → ChatView.retryInfo → ThinkingIndicator(retry variant)
   ├─ if tool_calls:
   │    ├─ READ_ONLY_TOOLS: Promise.all 并行
   │    └─ 其他：顺序执行
   │    → append tool messages → 下一轮
   └─ else: 对话结束 → onFinish
   ↓
saveConversation(meta) → localStorage
```

### 4.2 平台抽象（[localBackend.ts](src/lib/localBackend.ts)）

```
isElectron() → window.electronAPI（IPC）
isTauri()    → @tauri-apps/api invoke
companion()  → fetch('http://localhost:173xx/...')
否则         → throw NoBackendError
```

### 4.3 SOCKS5 代理（v1.0.2+）

每个 [ApiProfile](src/lib/profiles.ts) 可独立配置代理。切换 profile 时：

```
ChatView.applyProfile(p)
  → electronAPI.proxySet({ url: p.proxy })
  → [main.cjs] session.defaultSession.setProxy({ proxyRules })
                + (有 user:pass 时) on('login') 监听器按需挂卸
  → 后续所有 fetch、所有窗口、所有 IPC 自动走代理
```

---

## 5. 关键类型

```ts
interface ApiConfig {
  baseUrl: string; apiKey: string; model: string
  helperModel?: string
  disableStreaming?: boolean
  projectContext?: string
  customSkills?: CustomSkill[]
  skillsDir?: string
  imageModel?: ModelEndpoint     // 留空走 MiniToken
  audioModel?: ModelEndpoint
  videoModel?: ModelEndpoint
}

interface ApiProfile {
  id: string; name: string
  baseUrl: string; apiKey: string; model: string
  source: 'manual' | 'minitoken'
  proxy?: string                 // socks5://user:pass@host:port (v1.0.2+)
  createdAt: number; updatedAt: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]        // assistant 发出
  tool_call_id?: string          // tool 响应
  display?: 'normal' | 'thinking' | 'plan'
  attachments?: Attachment[]     // user 消息附件
}

interface ToolDef {
  name: string
  description: string
  parameters: JSONSchema
  env?: 'web' | 'tauri' | 'both'
  category?: 'core' | 'fs' | 'shell' | 'web' | 'agent' | 'plan' | 'task' | 'memory' | 'misc'
  planSafe?: boolean
  run(input, ctx: ToolContext): Promise<ToolResult>
}
```

---

## 6. 构建命令

```bash
npm run dev              # Web 开发  http://localhost:5173
npm run electron:dev     # Electron 开发（先开 Vite dev server）
npm run electron:build   # 打包  → out/SimpleAI-x.x.x-Setup.exe (149 MB)
npm run electron:pack    # 免安装 → out/win-unpacked/
npm run tauri:dev / tauri:build    # 备选

npx tsc --noEmit         # 类型检查（提交前必跑）
```

`electron:build` 流程：`bundle-claude.mjs`（封装 CLI）→ `vite build --base ./` → `electron-builder --win`

---

## 7. localStorage 键表（最新）

| 键 | 内容 | 引入 |
|---|---|---|
| `simple-ai:config` | API 配置（ApiConfig） | v1.0.0 |
| `simple-ai:conversations` | 对话列表（最多 50 条） | v1.0.0 |
| `simple-ai:mcp-servers` | MCP 服务器配置 | v1.0.0 |
| `simple-ai:favorites` | 收藏角色 ID | v1.0.0 |
| `simple-ai:workspace` | 当前工作目录 | v1.0.0 |
| `simple-ai:minitoken` | MiniToken session | v1.0.0 |
| `simple-ai:skills` | 自定义技能 | v1.0.0 |
| `simple-ai:active-cli` | 用户选择的 CLI | v1.0.0 |
| **`simple-ai:api-profiles`** | 多 API 配置档案 + 代理 | v1.0.2 |
| **`simple-ai:terminal-history`** | Claude 终端会话历史（含 ANSI） | v1.0.2 |
| **`simple-ai:marketplaces`** | 已添加的插件市场仓库 | v1.0.6 |
| **`simple-ai:installed-plugins`** | 已安装的 plugin 记录 | v1.0.6 |

---

## 8. Electron IPC 通道

| 通道 | 用途 | 引入 |
|---|---|---|
| `fs_read / fs_write / fs_glob / fs_grep` | 文件操作 | v1.0.0 |
| `shell_exec` | Shell 命令 | v1.0.0 |
| `workspace_pick / set / get` | 工作目录 | v1.0.0 |
| `minitoken_open / extract_session / api` | MiniToken 代理 | v1.0.0 |
| `minitoken-session` (main→renderer) | session 推送 | v1.0.0 |
| `terminal:create / input / resize / kill` | PTY 终端 | v1.0.0 |
| `terminal:data:{id} / exit:{id}` | PTY 事件 | v1.0.0 |
| `claude:info / setup` | Claude CLI 管理 | v1.0.0 |
| **`html_export`** | HTML 万物生成另存对话框 + 打开 | v1.0.2 |
| **`proxy:set / get`** | SOCKS5 代理切换 | v1.0.2 |
| **`marketplace:fetch_text`** | 走 session.defaultSession（含代理）的 HTTP GET | v1.0.6 |

---

## 9. 版本历史（精简对照 [CHANGELOG.md](docs/CHANGELOG.md) 完整版）

| 版本 | 日期 | 关键变更 |
|---|---|---|
| v1.0.0 | 2026-05-21 | 初始发布：184 角色、28 工具、命理、Claude 终端、MCP |
| v1.0.1 | 2026-05-21 | +ImageGenerate/VideoGenerate、HTML 万物生成(75 模板)、并行工具调度、MiniToken 自动 Key、Windows 兼容修复 |
| v1.0.2 | 2026-05-22 | API 配置档案 + SOCKS5 代理（每档独立）；MiniToken 🔁 刷新 API；终端会话历史 + 抽屉重放；HTML 侧边栏 + 💾 导出到本地；**修复 MiniToken 登录卡死**（login 监听器按需挂卸） |
| v1.0.3 | 2026-05-22 | 终端历史 player 修复；多模态留空走 MiniToken（之前回退主 baseUrl）；返回格式自适应；图像/视频下载 |
| v1.0.4 | 2026-05-22 | 思考状态 SVG 动效（4 variant）；通用 withRetry（5 次/60s/4xx 立停）；多模态超时延长；大图 ⚠️ 预警；TOOLS_COMPARISON / CHANGELOG 入档 |
| v1.0.5 | 2026-05-22 | +PowerShell / Sleep / ToolSearch 三工具（36→39）；README 嵌截图 |
| v1.0.6 | 2026-05-22 | **🧩 Claude Code 兼容插件市场**；默认生图改 `gpt-image-2-all` |
| v1.0.7 | 2026-05-22 | +Config / ListMcpResources / ReadMcpResource（39→42）；MCP client 加 resources/list+read；明确不复刻 7 个云依赖工具 |
| _v1.0.8 草案_ | _未发布_ | 已 commit：ARCHITECTURE/TOOLS 文档完整化；新增 FEATURE_STATUS / ROADMAP；Settings/ChatView 模块化抽取（-180/-109 LOC） |

---

## 10. 开发约定（重要）

| 约定 | 细节 |
|---|---|
| **中文回复** | 所有交互使用中文 |
| **最小改动** | 只改需要改的，不"顺手"重构 |
| **匹配风格** | 项目无注释风格；组件函数式 + hooks；工具用 `ToolDef` 接口 |
| **验证流程** | 改完跑 `npx tsc --noEmit`（零错误） |
| **路径别名** | `@/` → `src/` |
| **打包前升版** | 跑 electron:build 前先 patch+1（见 memory: bump-version-before-packaging） |
| **代理 push** | GitHub 直连失败时用 `git -c http.proxy=socks5://127.0.0.1:7983 ...`（见 memory: github-via-socks5-proxy）— **不改全局 git config** |
| **Windows 注意** | `exec/execSync` 必须 `shell: true`；npm 是 `.cmd`；路径用 `/` 统一 |
| **不要污染 git config** | 用 `-c key=value` 一次性传值 |
| **不打包除非用户要** | 改完代码默认不自动 build；用户说"打包"才跑 electron:build |

---

## 11. 扩展指南速查

详见 [CONTRIBUTING.md](docs/CONTRIBUTING.md)，要点：

- **加工具** → `src/lib/tools/builtin/xxx.ts` 导出 `ToolDef` → 在 `tools/index.ts` 注册
- **加页面** → `src/pages/Xxx.tsx` → `App.tsx` 加 `<Route>` → `lib/features.ts` 加卡片
- **加 IPC** → `electron/main.cjs` 加 `ipcMain.handle(...)` → `preload.cjs` 暴露
- **加 Skill** → 内置改 `lib/skills.ts`；用户从 marketplace 装走 customSkills

---

## 12. 现在的「未发布」状态

仓库当前 HEAD `b54b950` 含 v1.0.8 草案改动：
- 文档完善（ARCHITECTURE / TOOLS / FEATURE_STATUS / ROADMAP 全部就位）
- Settings.tsx (-180 LOC) / ChatView.tsx (-109 LOC) 抽出 3 个新文件
- **未升版本号 / 未打包**：等用户决定下一批一起发

如果你打算继续开发：
1. 看 [FEATURE_STATUS.md](docs/FEATURE_STATUS.md) 找当前能用什么 / 有什么限制
2. 看 [ROADMAP.md](docs/ROADMAP.md) 找下一步该做什么
3. 看 [CONTRIBUTING.md](docs/CONTRIBUTING.md) 找怎么动手
4. 改完跑 `npx tsc --noEmit`；commit；问用户要不要打包发版
