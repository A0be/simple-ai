# 模块化架构文档

本文档描述 SimpleAI 的模块划分、依赖关系和扩展方式。

## 模块总览

项目按功能划分为 **8 大模块**，总计 11000+ 行源码、80+ 文件。

```
┌─────────────────────────────────────────────────────┐
│                    Pages (路由页面)                     │
│  Home / Settings / Agents / AgentChat / Feature      │
│  History / HtmlAnything / Mcp / Skills / Tools       │
│  ClaudeTerminal                                      │
├──────────────┬──────────────┬───────────────────────┤
│  Components  │  Divination  │    MiniToken Panel     │
│  ChatView    │  BaziIntro   │    CompanionStatus     │
│  Layout      │  TarotIntro  │    AskUserQuestion     │
│  Markdown    │  ZiweiIntro  │    ToolCallBlock       │
│  TodoPanel   │  LiuyaoIntro │    PlanBanner          │
│              │  DreamIntro  │                        │
│              │  MbtiIntro   │                        │
├──────────────┴──────────────┴───────────────────────┤
│                    Core Lib (核心库)                    │
│ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ │
│ │ AI 通信   │ │ Agent 系统 │ │ 工具系统  │ │多模态 API│ │
│ │ ai.ts    │ │ agentLoop │ │ tools/*  │ │multimodal│ │
│ │          │ │ agents.ts │ │ 36 tools │ │ 图/音/视频│ │
│ │          │ │ prompts   │ │          │ │          │ │
│ └──────────┘ └───────────┘ └──────────┘ └─────────┘ │
│ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ │
│ │ MCP 协议  │ │ 技能系统   │ │ 存储层   │ │平台抽象层│ │
│ │ mcp/*    │ │ skills.ts │ │storage.ts│ │localBack-│ │
│ │          │ │ slash.ts  │ │favorites │ │end/tauri │ │
│ │          │ │htmlSkills │ │workspace │ │/electron │ │
│ └──────────┘ └───────────┘ └──────────┘ └─────────┘ │
├─────────────────────────────────────────────────────┤
│              Platform Layer (平台层)                   │
│  Electron IPC  │  Tauri IPC  │  Companion HTTP      │
└─────────────────────────────────────────────────────┘
```

---

## 模块 1: AI 通信层

**文件**: `src/lib/ai.ts` (257 行)

职责：与 OpenAI 兼容 API 通信，处理 SSE 流式输出和 tool_calls 组装。

```
ai.ts
├── streamChat(options)    → 核心：发送对话请求，返回流式/非流式结果
│   ├── SSE 解析：逐行 data: 解析 delta
│   ├── tool_calls 组装：从流式 delta 中拼接完整 tool_calls
│   └── 非流式回退：disableStreaming=true 时走普通 POST
├── testConnection(config) → 测试 API 连通性
└── ApiError               → 携带 HTTP status 的错误类
```

**关键设计**:
- `normalizeBaseUrl()` 兼容多种 API 地址格式（`/v1`、`/api`、`/api/v1`、裸域名）
- `toWireMessage()` 将 `Attachment[]` 转为 OpenAI vision 格式的 multipart content
- 支持 `image_url` 类型的附件（base64 内嵌）

**依赖**: `@/types` (类型定义)

---

## 模块 2: Agent 系统

**文件**:
- `src/lib/agentLoop.ts` (238 行) — 多轮工具调度循环（支持并行执行只读工具）
- `src/lib/agents.ts` (265 行) — 184 个角色定义
- `src/lib/agentCapabilities.ts` (74 行) — 能力检测
- `src/lib/agentHistory.ts` (40 行) — 子代理历史
- `src/lib/prompts.ts` (456 行) — Prompt 模板

### Agent Loop (核心调度)

```
runAgent(options)
  │
  ├── 发送对话 → streamChat()
  │
  ├── 收到 tool_calls?
  │   ├── 是 → 分类工具调用
  │   │   ├── 只读工具（FileRead/Glob/Grep/WebFetch/WebSearch/ImageGenerate/VideoGenerate/LSP/MCP）
  │   │   │   └── 2+ 个并行 → Promise.all()；1 个 → 降级为顺序
  │   │   └── 写入工具（FileWrite/FileEdit/Bash 等）→ 严格顺序执行
  │   ├── 结果追加到 messages → 重新发送（循环）
  │   └── 否 → 结束
  │
  ├── plan 模式过滤：planMode=true 时只允许 planSafe 工具
  │
  └── 最多 maxTurns=12 轮
```

### 角色系统

```
agents.ts
├── AGENT_CATEGORIES (14 个分类)
│   ├── writing      写作创意
│   ├── coding       编程开发
│   ├── data         数据分析
│   ├── business     商业办公
│   ├── education    教育学习
│   ├── language     语言翻译
│   ├── life         生活助手
│   ├── health       健康医疗
│   ├── legal        法律咨询
│   ├── finance      财经理财
│   ├── media        媒体运营
│   ├── design       设计创意
│   ├── game         游戏娱乐
│   └── research     学术研究
│
└── AGENTS (184 个角色定义)
    每个角色: { id, name, nameEn, emoji, category, desc, expertise, whenToUse }
```

### Prompt 系统

```
prompts.ts
├── PROMPTS 对象（10 种 system prompt）
│   ├── chat / writing / translate / developer — 通用场景
│   └── bazi / ziwei / tarot / liuyao / dream / mbti — 命理场景
│
├── COMMON_TOOL_NOTE — 所有 prompt 共享的工具说明
├── getAgentPrompt(agent) — 根据角色生成完整 prompt（含工具链说明）
└── composeSystemPrompt(feature, projectCtx) — 组合：项目上下文 + 功能 prompt + 能力注入
```

### 能力检测

```
agentCapabilities.ts
├── buildAgentProfile() — 检测当前可用能力（chat/tool-use/multimodal/multi-agent/...）
├── getCapabilityPrompt() — 生成动态 prompt 片段（多模态说明、CLI 信息、模型建议）
└── checkModelAvailability(type) — 检查图像/音频/视频模型是否可用
```

**依赖**: `ai.ts` → `tools/*` → `localBackend.ts` → 平台层

---

## 模块 3: 工具系统

**文件**: `src/lib/tools/` (18 个文件，2700+ 行)

### 架构

```
tools/
├── types.ts        → ToolDef、ToolRegistry、ToolContext、SessionState 定义
├── index.ts        → buildRegistry() 注册所有工具 + MCP 动态工具
└── builtin/        → 36 个内置工具实现
    ├── 文件操作 (6)    FileRead/FileWrite/FileEdit/Glob/Grep/Bash
    ├── Web 操作 (2)    WebFetch/WebSearch
    ├── 多模态 (2)      ImageGenerate/VideoGenerate
    ├── 任务管理 (7)    TodoWrite + TaskCreate/List/Get/Update/Output/Stop
    ├── 计划模式 (2)    EnterPlanMode/ExitPlanMode
    ├── Agent (2)      Agent/SendMessage
    ├── 技能 (1)       Skill
    ├── 定时器 (4)      CronCreate/CronList/CronDelete/ScheduleWakeup
    ├── Worktree (2)   EnterWorktree/ExitWorktree
    ├── LSP (6)        LspStart/Stop/Definition/References/Hover/List
    ├── Notebook (1)   NotebookEdit
    └── UI 交互 (1)    AskUserQuestion
```

### ToolDef 接口

```typescript
interface ToolDef {
  name: string                    // 工具名
  description: string             // 给模型看的描述
  parameters: JSONSchema           // JSON Schema 参数定义
  env?: 'web' | 'tauri' | 'both'  // 可用环境
  planSafe?: boolean               // plan 模式下是否允许执行
  execute(args, ctx): ToolResult   // 执行函数
}
```

### ToolContext (执行上下文)

```typescript
interface ToolContext {
  config: ApiConfig           // 当前 API 配置
  session: SessionState       // 会话状态（todos/tasks/planMode/cwd）
  ui: ToolUiBridge            // UI 回调（显示结果/提问/通知）
  messages: ChatMessage[]     // 当前对话历史
  systemPrompt: string        // 当前 system prompt
  isDesktop: boolean          // 是否桌面环境
}
```

### 工具注册流程

```
buildRegistry(isDesktop)
  │
  ├── 注册所有 builtin 工具（过滤 env 不匹配的）
  │   ├── env='both' → 始终注册
  │   ├── env='tauri' + !isDesktop → 跳过
  │   └── env='web' + isDesktop → 跳过
  │
  └── 注册 MCP 动态工具
      └── 遍历 activeMcpClients() → client.asToolDefs()
          └── 工具名格式: mcp__{serverId}__{toolName}
```

### 扩展工具

新增一个工具只需 3 步：

1. 在 `src/lib/tools/builtin/` 新建文件，导出 `ToolDef` 数组
2. 在 `src/lib/tools/index.ts` 中 import 并在 `buildRegistry()` 里注册
3. 工具会自动出现在模型的 tool_calls 列表中

---

## 模块 4: 多模态 API

**文件**: `src/lib/multimodal.ts` (208 行)

```
multimodal.ts
├── generateImage(opts)      → POST /v1/images/generations
├── generateSpeech(opts)     → POST /v1/audio/speech      → 返回 Blob
├── transcribeAudio(file)    → POST /v1/audio/transcriptions (FormData)
├── generateVideo(opts)      → POST /v1/videos/text
├── createEmbedding(input)   → POST /v1/embeddings
│
├── hasImageModel()          → 检查图像模型是否可用
├── hasAudioModel()          → 检查音频模型是否可用
├── hasVideoModel()          → 检查视频模型是否可用
│
└── 模型列表常量
    ├── IMAGE_MODELS: gpt-image-1, gpt-image-2, dall-e-3, midjourney, flux-1, seedream-3 ...
    ├── AUDIO_MODELS: tts-1, tts-1-hd, whisper-1, gpt-4o-audio
    └── VIDEO_MODELS: veo-2, veo-3, sora-2, kling-video, seedance-1-6 ...
```

**端点路由**：每个 API 函数优先使用 `ApiConfig` 中的专用端点（`imageModel`/`audioModel`/`videoModel`），否则回退到主 API 端点。

```typescript
// 端点解析逻辑
function getEndpoint(override?: ModelEndpoint, fallback?: ApiConfig) {
  if (override?.baseUrl && override?.apiKey && override?.model) return override
  return { baseUrl: fallback.baseUrl, apiKey: fallback.apiKey, model: fallback.model }
}
```

---

## 模块 5: MCP 协议

**文件**: `src/lib/mcp/` (3 个文件，375 行)

```
mcp/
├── types.ts      → JSON-RPC 2.0 + MCP 协议类型定义
├── transport.ts  → 传输层
│   ├── HttpTransport   → 浏览器 fetch（SSE streamable）
│   └── StdioTransport  → Tauri 进程通信（spawn + events）
└── client.ts     → McpClient
    ├── connect()           → initialize 握手
    ├── listTools()         → tools/list
    ├── callTool(name, args)→ tools/call
    ├── asToolDefs()        → 转换为 ToolDef[] 注入工具注册表
    ├── disconnect()
    └── 全局管理
        ├── activateMcp(config)     → 创建并连接客户端
        ├── deactivateMcp(id)       → 断开并销毁
        ├── activeMcpClients()      → 获取所有活跃客户端
        └── getActiveMcp(id)
```

**工具名映射**：MCP 工具注册到本地时，名称格式为 `mcp__{serverId}__{toolName}`，避免与内置工具冲突。

---

## 模块 6: 平台抽象层

**文件**:
- `src/lib/localBackend.ts` (119 行) — 统一路由
- `src/lib/electron.ts` (72 行) — Electron IPC
- `src/lib/tauri.ts` (53 行) — Tauri invoke
- `src/lib/companion.ts` (273 行) — Companion HTTP

### 优先级路由

```
localBackend.ts — 每个操作（fsRead/fsWrite/shellExec 等）按优先级选择后端：

  isElectron() ? → electronFsRead(...)
  isTauri()    ? → tauriInvoke('fs_read', ...)
  companion()  ? → companionFsRead(...)
  否则         → throw NoBackendError
```

### Electron IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `fs_read` | renderer → main | 读取文件，支持 offset/limit |
| `fs_write` | renderer → main | 写入文件（自动创建目录） |
| `fs_glob` | renderer → main | fast-glob 文件搜索 |
| `fs_grep` | renderer → main | 正则内容搜索 |
| `shell_exec` | renderer → main | 执行 Shell 命令（120s 超时） |
| `workspace_pick` | renderer → main | 弹出目录选择器 |
| `workspace_set/get` | renderer → main | 工作目录读写 |
| `minitoken_open` | renderer → main | 打开 MiniToken 子窗口 |
| `minitoken_extract_session` | renderer → main | 提取登录 session |
| `minitoken_api` | renderer → main | 代理 API 请求 |
| `minitoken-session` | main → renderer | 推送自动获取的 session |

---

## 模块 7: 存储层

**文件**:
- `src/lib/storage.ts` (113 行) — 主存储
- `src/lib/favorites.ts` (39 行) — 收藏
- `src/lib/workspaceStore.ts` (31 行) — 工作目录

### localStorage 键表

| 键 | 内容 | 管理文件 |
|----|------|---------|
| `simple-ai:config` | API 配置（baseUrl/apiKey/model/多模态端点） | storage.ts |
| `simple-ai:conversations` | 对话列表（最多 50 条） | storage.ts |
| `simple-ai:mcp-servers` | MCP 服务器配置 | storage.ts |
| `simple-ai:favorites` | 收藏的角色 ID 列表 | favorites.ts |
| `simple-ai:workspace` | 当前工作目录路径 | workspaceStore.ts |
| `simple-ai:minitoken` | MiniToken 登录 session | minitoken.ts |
| `simple-ai:skills` | 自定义技能列表 | skills.ts |
| `simple-ai:cli-active` | 用户手动选择的 CLI | cliDetector.ts |

---

## 模块 8: UI 组件层

### 核心组件

| 组件 | 行数 | 职责 |
|------|------|------|
| **ChatView** | 651 | 对话引擎：消息管理、流式渲染、工具执行、附件、Slash 命令 |
| **Layout** | 110 | 顶栏 + 5 标签底部导航 + 未配置提示横幅 |
| **CompanionStatus** | 433 | 连接状态、工作目录选择器、CLI 切换下拉 |
| **Settings** | 441 | API 配置表单、模型筛选、多模态端点编辑器 |
| **Markdown** | 179 | 纯 JS 实现（无外部依赖），支持表格/代码/列表 |
| **MiniTokenPanel** | 225 | MiniToken 仪表盘：余额/Key/日志，30s 自动刷新 |

### ChatView 内部状态

```
ChatView 状态管理：
├── messages[]          ← 对话消息列表
├── streaming           ← 是否正在流式输出
├── todos[]             ← TodoWrite 清单
├── tasks[]             ← TaskCreate 任务
├── planMode/planDraft  ← 计划模式状态
├── cwd                 ← 当前工作目录（来自 workspaceStore）
├── askRequest          ← AskUserQuestion 弹窗状态
├── toolResults{}       ← 工具执行结果缓存
├── runningCalls Set    ← 正在执行的工具 ID
├── attachments[]       ← 文件/图片附件
└── worktreeName        ← Git worktree 分支名
```

---

## 数据流

### 一次完整的 Agent 对话流程

```
用户输入
  │
  ▼
ChatView.handleSend()
  ├── 检查 Slash 命令 → 直接处理
  ├── 构建 messages（含 attachments → vision format）
  └── 调用 runAgent()
        │
        ▼
      agentLoop.runAgent()
        ├── composeSystemPrompt() 组装 system prompt
        │   ├── projectContext（CLAUDE.md）
        │   ├── 功能/角色 prompt
        │   ├── cliCapabilitiesPrompt()
        │   └── getCapabilityPrompt()（多模态/模型建议）
        │
        ├── streamChat() → SSE 流式请求
        │   └── onText callback → ChatView 实时更新 UI
        │
        ├── 收到 tool_calls?
        │   ├── registry.get(toolName) → 找到工具定义
        │   ├── 分类：只读 → 并行执行 / 写入 → 顺序执行
        │   │   ├── 文件工具 → localBackend → Electron/Tauri/Companion
        │   │   ├── Web 工具 → fetch
        │   │   ├── 多模态工具 → multimodal API（图片/视频生成）
        │   │   ├── Agent 工具 → 递归 runAgent（子代理）
        │   │   └── MCP 工具 → mcpClient.callTool()
        │   ├── 结果追加到 messages（role: 'tool'）
        │   └── 回到 streamChat()（下一轮）
        │
        └── 无 tool_calls → 对话结束 → onFinish callback
```

### 平台检测与路由

```
应用启动 (main.tsx)
  │
  ├── isElectron()? → HashRouter + 恢复 workspace + 检测 CLI
  ├── isTauri()?    → BrowserRouter + Tauri invoke
  └── Web?          → BrowserRouter + initCompanion() + 自动扫描端口
        │
        ▼
localBackend.ts — 每次文件/Shell 操作：
  ├── isElectron() → window.electronAPI.fsRead(...)
  ├── isTauri()    → invoke('fs_read', ...)
  ├── companion()  → fetch('http://localhost:173xx/fs/read', ...)
  └── 无后端      → throw NoBackendError("需要桌面版或连接 Companion")
```

---

## 类型系统

**文件**: `src/types/index.ts` (136 行)

### 核心类型

```typescript
// API 配置
interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  helperModel?: string          // 子代理模型
  disableStreaming?: boolean
  projectContext?: string       // CLAUDE.md 内容
  customSkills?: CustomSkill[]
  skillsDir?: string
  imageModel?: ModelEndpoint    // 图像模型专用端点
  audioModel?: ModelEndpoint    // 音频模型专用端点
  videoModel?: ModelEndpoint    // 视频模型专用端点
}

// 多模态端点
interface ModelEndpoint {
  baseUrl: string
  apiKey: string
  model: string
}

// 对话消息
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  display?: 'normal' | 'thinking' | 'plan'
  attachments?: Attachment[]
}

// 文件附件
interface Attachment {
  type: 'image' | 'file'
  name: string
  data: string               // base64 或文本
  mimeType: string
}
```

---

## 扩展指南

### 添加新角色

在 `src/lib/agents.ts` 的 `AGENTS` 数组中添加：

```typescript
{ id: 'my-agent', name: '我的角色', nameEn: 'My Agent',
  emoji: '🤖', category: 'coding',
  desc: '一句话描述',
  expertise: '详细专业领域',
  whenToUse: '使用场景' }
```

角色自动获得完整工具链（文件操作、Shell、Web 搜索等），无需额外配置。

### 添加新工具

1. 新建 `src/lib/tools/builtin/myTool.ts`：

```typescript
import type { ToolDef } from '../types'

export const MyTool: ToolDef = {
  name: 'MyTool',
  description: '工具描述（给模型看）',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: '输入参数' }
    },
    required: ['input']
  },
  env: 'both',      // 'web' | 'tauri' | 'both'
  planSafe: false,   // plan 模式下是否可执行
  async execute(args, ctx) {
    const { input } = args as { input: string }
    return { content: `处理结果: ${input}`, ui: { kind: 'generic', data: {} } }
  }
}
```

2. 在 `src/lib/tools/index.ts` 注册：

```typescript
import { MyTool } from './builtin/myTool'
// 在 buildRegistry() 中添加:
reg.register(MyTool)
```

### 添加新功能页

1. 在 `src/lib/features.ts` 添加 FeatureCard
2. 在 `src/lib/prompts.ts` 添加同名 prompt
3. 可选：在 `src/pages/Feature.tsx` 添加自定义 Intro 组件

### 添加 MCP 服务器（用户侧）

设置 → MCP 服务器 → 添加：
- **HTTP**: 填入 URL（如 `http://localhost:8080/mcp`）
- **Stdio**: 填入命令和参数（如 `npx @modelcontextprotocol/server-filesystem /path`）

连接后，MCP 服务器的工具自动注册到工具列表。

### 添加多模态端点

设置 → 多模态模型配置 → 展开对应类型（图像/音频/视频）→ 填入：
- Base URL（留空使用主 API 地址）
- API Key（留空使用主 Key）
- 模型名称

---

## 构建配置

### Vite

```typescript
// vite.config.ts 关键配置
{
  base: isElectron ? './' : '/',     // Electron 需要相对路径
  plugins: [react(), !isElectron && VitePWA(...)],
  resolve: { alias: { '@': '/src' } },
  build: { outDir: 'dist', sourcemap: false }
}
```

### Electron Builder

```json
// package.json > build
{
  "appId": "com.simple-ai.toolbox",
  "productName": "简易AI工具箱",
  "asar": true,
  "compression": "maximum",
  "win": { "target": "nsis", "arch": ["x64"] },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true
  }
}
```

### Tailwind

自定义 `ink` 色阶（基于 slate）替代默认灰色，确保中文排版舒适：

```javascript
// tailwind.config.js
{
  theme: {
    extend: {
      colors: { ink: { 50: '#f8fafc', ..., 900: '#0f172a' } },
      fontFamily: { sans: ['-apple-system', 'PingFang SC', 'Microsoft YaHei', ...] }
    }
  }
}
```
