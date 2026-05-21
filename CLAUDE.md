# SimpleAI Toolbox — 项目交接文档

> 本文件供 Claude Code / AI 助手在新会话中快速理解项目全貌。最后更新：v1.0.1 (2026-05-21)

---

## 一、项目概述

**简易 AI 工具箱** — 一站式 AI 工具桌面应用（Electron），兼容所有 OpenAI Chat Completions API。

- **GitHub**: https://github.com/A0be/simple-ai
- **版本**: 1.0.1
- **许可**: MIT
- **平台**: Windows 10/11 x64（Electron 主打），也支持 Tauri 桌面版、Web+Companion、纯 Web/PWA

核心卖点：配置一个 API Key 即可使用 184 个 Agent 角色、36 个开发者工具、75 个 HTML 模板、命理解读、Claude Code 终端、MCP 服务器。所有数据仅存本地（localStorage）。

---

## 二、技术栈

| 层 | 技术 |
|----|------|
| UI | React 18 + TypeScript 5 |
| 构建 | Vite 5（`@` → `/src`） |
| 样式 | Tailwind CSS 3（自定义 `ink` 色阶） |
| 桌面 | Electron 42（main.cjs + preload.cjs + contextBridge） |
| 终端 | xterm.js 6 + node-pty 1.x |
| 打包 | electron-builder（NSIS，输出到 `out/`） |
| PWA | vite-plugin-pwa（非 Electron 模式） |
| API | OpenAI Chat Completions SSE + MCP JSON-RPC 2.0 |
| 存储 | localStorage（配置、对话、收藏、MCP 服务器） |

零外部 UI 组件依赖——Markdown 渲染器、图标组件均为项目内实现。

---

## 三、目录结构

```
simple-ai/                      # 项目根目录
├── electron/                   # Electron 主进程
│   ├── main.cjs                #   IPC 通道 + PTY + Claude CLI + MiniToken 代理
│   └── preload.cjs             #   contextBridge 暴露 electronAPI
├── scripts/
│   ├── bundle-claude.mjs       #   构建时封装 Claude CLI（跨平台 where/which）
│   └── gen-icons.mjs           #   图标生成
├── src/
│   ├── App.tsx                 # 路由定义（react-router-dom v6）
│   ├── main.tsx                # 入口：Electron → HashRouter / Web → BrowserRouter
│   ├── index.css               # Tailwind + 自定义样式
│   ├── types/index.ts          # 全局类型：ApiConfig, ChatMessage, ToolCall, AgentTask...
│   │
│   ├── components/             # UI 组件（14 个 .tsx + divination/）
│   │   ├── ChatView.tsx        #   核心：消息管理、流式渲染、工具执行、附件、Slash 命令
│   │   ├── Layout.tsx          #   应用布局 + 5 标签底部导航
│   │   ├── ToolCallBlock.tsx   #   工具结果展示（含图片/视频内联渲染）
│   │   ├── MiniTokenPanel.tsx  #   MiniToken 登录/余额/Key 管理/自动获取 Key
│   │   ├── CompanionStatus.tsx #   连接状态 + 工作目录选择 + CLI 切换
│   │   ├── Markdown.tsx        #   纯 JS Markdown 渲染（无外部依赖）
│   │   ├── TerminalPanel.tsx   #   xterm.js 终端封装
│   │   └── divination/         #   命理组件（Bazi/Tarot/Ziwei/Liuyao/Dream/Mbti）
│   │
│   ├── pages/                  # 路由页面（13 个）
│   │   ├── Home.tsx            #   首页：快捷对话 + 功能入口卡片
│   │   ├── Agents.tsx          #   角色库：14 分类、搜索、收藏
│   │   ├── AgentChat.tsx       #   角色对话（复用 ChatView）
│   │   ├── Feature.tsx         #   功能页（对话/写作/翻译/命理）
│   │   ├── HtmlAnything.tsx    #   HTML 万物生成（75 模板 + 实时预览）
│   │   ├── ClaudeTerminal.tsx  #   Claude Code 终端
│   │   ├── Settings.tsx        #   API 配置 + 多模态端点 + 模型搜索/筛选
│   │   ├── History.tsx         #   对话记录
│   │   ├── Mcp.tsx             #   MCP 服务器管理
│   │   ├── Skills.tsx          #   Skill 管理
│   │   └── Tools.tsx           #   工具清单
│   │
│   └── lib/                    # 核心库
│       ├── ai.ts               #   streamChat() SSE 流式 + 工具调用组装
│       ├── agentLoop.ts        #   多轮工具调度（只读并行 / 写入顺序）
│       ├── agents.ts           #   184 个 Agent 定义（14 个分类）
│       ├── agentCapabilities.ts#   能力检测 + 动态 prompt 注入
│       ├── prompts.ts          #   系统提示词模板（10 种场景）
│       ├── multimodal.ts       #   图片/视频/音频/Embedding API
│       ├── htmlSkills.ts       #   75 个 HTML 模板元数据 + 共享设计指令
│       ├── features.ts         #   功能卡片定义
│       ├── skills.ts           #   Skill 系统（6 个内置 + 自定义）
│       ├── slash.ts            #   9 个 Slash 命令
│       ├── storage.ts          #   localStorage 持久化
│       ├── minitoken.ts        #   MiniToken API 封装
│       ├── cliDetector.ts      #   CLI 自动检测（claude/codex/aider）
│       ├── localBackend.ts     #   平台路由：Electron → Tauri → Companion → 报错
│       ├── electron.ts         #   Electron IPC 封装
│       ├── tauri.ts            #   Tauri invoke 封装
│       ├── companion.ts        #   Companion HTTP 封装
│       ├── tools/              #   工具系统
│       │   ├── types.ts        #     ToolDef / ToolRegistry / ToolContext / SessionState
│       │   ├── index.ts        #     buildRegistry() 注册 36 个工具 + MCP 动态工具
│       │   └── builtin/        #     16 个工具实现文件
│       ├── mcp/                #   MCP 协议（client.ts / transport.ts / types.ts）
│       └── lsp/                #   LSP 语言服务客户端
│
├── companion/                  # Rust 本地助手（Web 版用，独立 Cargo 项目）
├── src-tauri/                  # Tauri 后端（备选桌面方案）
├── docs/                       # 文档
│   ├── API.md                  #   API 接口文档
│   ├── ARCHITECTURE.md         #   模块架构文档
│   └── TOOLS.md                #   工具参考手册
├── public/icons/               # 应用图标
├── package.json                # 依赖 + electron-builder 配置
├── vite.config.ts              # Vite 构建（Electron 时 base='./'）
├── tailwind.config.js          # Tailwind 主题
└── tsconfig.json               # TypeScript 配置
```

---

## 四、核心架构

### 4.1 数据流（一次完整的 Agent 对话）

```
用户输入 → ChatView.handleSend()
  → composeSystemPrompt()（项目上下文 + 功能 prompt + 能力注入）
  → runAgent()（agentLoop.ts）
    → streamChat()（ai.ts）→ SSE 流式响应
    → 收到 tool_calls?
      → 分类：只读工具并行（Promise.all） / 写入工具顺序执行
      → 结果追加到 messages → 下一轮
    → 无 tool_calls → 对话结束
```

### 4.2 平台抽象层

所有文件/Shell 操作通过 `localBackend.ts` 路由：
```
isElectron() → window.electronAPI（IPC）
isTauri()    → @tauri-apps/api invoke
companion()  → fetch('http://localhost:173xx/...')
否则         → throw NoBackendError
```

### 4.3 Electron IPC 通道（main.cjs ↔ preload.cjs）

| 通道 | 说明 |
|------|------|
| `fs_read/write/glob/grep` | 文件操作 |
| `shell_exec` | Shell 命令（shell: true） |
| `workspace_pick/set/get` | 工作目录 |
| `minitoken_open/extract_session/api` | MiniToken 代理 |
| `minitoken-session` | main→renderer 推送 session |
| `terminal:create/input/resize/kill` | PTY 终端 |
| `terminal:data:{id}` / `terminal:exit:{id}` | PTY 事件 |
| `claude:info/setup` | Claude CLI 管理 |

### 4.4 工具系统

36 个内置工具，通过 `ToolRegistry` 注册，按 `ToolDef` 接口定义：

```typescript
interface ToolDef {
  name: string
  description: string        // 给模型看
  parameters: JSONSchema     // 参数定义
  env?: 'web' | 'tauri' | 'both'
  planSafe?: boolean         // plan 模式下是否可执行
  run(args, ctx: ToolContext): Promise<ToolResult>
}
```

**工具分类：**
- 文件 (6): FileRead/FileWrite/FileEdit/Glob/Grep/Bash
- Web (2): WebFetch/WebSearch
- 多模态 (2): ImageGenerate/VideoGenerate
- 任务 (7): TodoWrite + Task 系列
- 计划 (2): EnterPlanMode/ExitPlanMode
- Agent (2): Agent（子代理，支持 allow_write/model/max_turns）/ SendMessage
- 技能 (1): Skill
- 定时 (4): Cron 系列 + ScheduleWakeup
- Worktree (2): EnterWorktree/ExitWorktree
- LSP (6): LspStart/Stop/Definition/References/Hover/List
- Notebook (1): NotebookEdit
- 交互 (1): AskUserQuestion

**并行调度**（agentLoop.ts）：
- 只读工具（FileRead/Glob/Grep/Web*/ImageGenerate/VideoGenerate/LSP/MCP）：≥2 个时 Promise.all
- 写入工具：严格顺序

### 4.5 多模态

`multimodal.ts` 封装 5 种 API：
- `generateImage()` → POST /v1/images/generations（gpt-image-1/2, dall-e-3, midjourney, flux）
- `generateVideo()` → POST /v1/videos/text（veo-2/3, sora-2, kling-video, seedance）
- `generateSpeech()` → POST /v1/audio/speech
- `transcribeAudio()` → POST /v1/audio/transcriptions
- `createEmbedding()` → POST /v1/embeddings

每种 API 优先使用 `ApiConfig` 中的专用端点（`imageModel`/`audioModel`/`videoModel`），否则回退到主 API。

### 4.6 MiniToken 集成

通过 Electron 子窗口打开 minitoken.top → 轮询提取 session cookie → 代理 API 请求：
- 用户信息: `GET /api/user/self`
- Key 列表: `GET /api/token/?p=0&size=10`（登录后自动获取首个可用 Key）
- 使用日志: `GET /api/log/self?p=0&size=20`
- 高消费分组预警 + 无限额度令牌提醒

---

## 五、关键类型

```typescript
interface ApiConfig {
  baseUrl: string; apiKey: string; model: string
  helperModel?: string          // 子代理模型
  imageModel?: ModelEndpoint    // 图像端点
  audioModel?: ModelEndpoint    // 音频端点
  videoModel?: ModelEndpoint    // 视频端点
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]       // assistant 发出
  tool_call_id?: string         // tool 响应
  display?: 'normal' | 'thinking' | 'plan'
  attachments?: Attachment[]    // user 消息附件
}

interface ToolCall { id: string; name: string; arguments: string }
```

---

## 六、构建命令

```bash
npm run dev              # Web 开发 http://localhost:5173
npm run electron:dev     # Electron 开发（需先开 Vite dev server）
npm run electron:build   # 打包 → out/SimpleAI-x.x.x-Setup.exe
npm run electron:pack    # 免安装版 → out/win-unpacked/
npm run tauri:dev        # Tauri 开发（备选方案）
npm run tauri:build      # Tauri 打包
```

`electron:build` 流程：`bundle-claude.mjs`（封装 CLI）→ `vite build --base ./` → `electron-builder --win`

---

## 七、localStorage 键表

| 键 | 内容 |
|----|------|
| `simple-ai:config` | API 配置 |
| `simple-ai:conversations` | 对话列表（最多 50 条） |
| `simple-ai:mcp-servers` | MCP 服务器配置 |
| `simple-ai:favorites` | 收藏角色 ID |
| `simple-ai:workspace` | 当前工作目录 |
| `simple-ai:minitoken` | MiniToken session |
| `simple-ai:skills` | 自定义技能 |
| `simple-ai:active-cli` | 用户选择的 CLI |

---

## 八、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-05-21 | 初始发布：184 角色、28 工具、命理、Claude 终端、MCP |
| v1.0.1 | 2026-05-21 | +ImageGenerate/VideoGenerate 工具、HTML 万物生成(75 模板)、并行工具调度、MiniToken 自动 Key 获取、多模态配置搜索、Windows 兼容修复(shell:true/路径/转义)、目录清理 |

---

## 九、开发约定

- **中文回复**：所有交互使用中文
- **最小改动**：只改需要改的，不"顺手"重构
- **匹配风格**：项目无注释风格，组件用函数式 + hooks，工具用 `ToolDef` 接口
- **验证流程**：改完跑 `npx tsc --noEmit`（零错误）+ `npx vite build`（构建通过）
- **路径别名**：`@/` → `src/`
- **工具扩展**：新建 `builtin/xxx.ts` → 在 `index.ts` 的 `buildRegistry()` 注册 → 自动可用
- **Electron IPC**：main.cjs 用 CommonJS，preload.cjs 用 contextBridge
- **Windows 注意**：所有 `exec`/`execSync` 需要 `shell: true`；npm 是 `.cmd` 文件；路径用 `/` 统一
