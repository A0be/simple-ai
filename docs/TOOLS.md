# 工具参考手册

SimpleAI 内置 36 个工具，全部通过 OpenAI tool_calls 格式调用。

## 工具列表

### 文件操作 (6 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **FileRead** | `path`, `offset?`, `limit?` | 读取文件内容 | 桌面 |
| **FileWrite** | `path`, `content` | 写入文件（自动创建目录） | 桌面 |
| **FileEdit** | `path`, `old_string`, `new_string`, `replace_all?` | 精确字符串替换 | 桌面 |
| **Glob** | `pattern`, `path?` | 文件名模式搜索 | 桌面 |
| **Grep** | `pattern`, `path?`, `glob?`, `mode?`, `ci?` | 文件内容正则搜索 | 桌面 |
| **Bash** | `command`, `cwd?`, `timeoutMs?` | 执行 Shell 命令 | 桌面 |

### Web 操作 (2 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **WebFetch** | `url`, `maxLength?` | 抓取网页内容（15 分钟缓存） | 全部 |
| **WebSearch** | `query`, `maxResults?` | DuckDuckGo 搜索 | 全部 |

### 多模态 (2 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **ImageGenerate** | `prompt`, `size?`, `quality?`, `n?`, `model?` | AI 图片生成（gpt-image-1/2、dall-e-3、midjourney、flux） | 全部 |
| **VideoGenerate** | `prompt`, `model?`, `duration?`, `size?`, `image_url?` | AI 视频生成（veo-2/3、sora-2、kling-video、seedance） | 全部 |

### 任务管理 (7 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **TodoWrite** | `todos[]` | 创建/更新待办清单 | 全部 |
| **TaskCreate** | `name`, `description?` | 创建后台任务 | 全部 |
| **TaskList** | — | 列出所有任务 | 全部 |
| **TaskGet** | `id` | 获取任务详情 | 全部 |
| **TaskUpdate** | `id`, `status`, `output?` | 更新任务状态 | 全部 |
| **TaskOutput** | `id`, `output` | 追加任务输出 | 全部 |
| **TaskStop** | `id` | 停止任务 | 全部 |

### 计划模式 (2 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **EnterPlanMode** | — | 进入计划模式（仅允许 planSafe 工具） | 全部 |
| **ExitPlanMode** | `plan` | 提交计划文本，退出计划模式 | 全部 |

### Agent (2 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **Agent** | `prompt`, `allow_write?`, `model?`, `max_turns?` | 派遣子代理（默认只读，allow_write 开启写权限，最多 12 轮） | 全部 |
| **SendMessage** | `to`, `message` | 给已有子代理发送消息（续接上下文） | 全部 |

### 技能 (1 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **Skill** | `skill`, `args?` | 加载 Skill prompt 注入对话 | 全部 |

### 定时器 (4 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **CronCreate** | `name`, `cron`, `message` | 创建定时任务（5 字段 cron） | 全部 |
| **CronList** | — | 列出定时任务 | 全部 |
| **CronDelete** | `id` | 删除定时任务 | 全部 |
| **ScheduleWakeup** | `afterSeconds`, `message` | 延时唤醒（一次性） | 全部 |

### UI 交互 (1 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **AskUserQuestion** | `question`, `options[]`, `allowMulti?`, `freeText?` | 弹窗询问用户 | 全部 |

### Git Worktree (2 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **EnterWorktree** | `name?`, `repo_path?`, `base_branch?`, `path?` | 创建或进入 Git worktree 隔离工作区 | Tauri |
| **ExitWorktree** | `action`, `discard_changes?` | 退出 worktree（keep 保留 / remove 删除） | Tauri |

### LSP 语言服务 (6 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **LspStart** | `language`, `command`, `args?` | 启动 LSP 服务器 | Tauri |
| **LspStop** | `id` | 停止 LSP 服务器 | Tauri |
| **LspDefinition** | `id`, `file`, `line`, `character` | 跳转到定义 | Tauri |
| **LspReferences** | `id`, `file`, `line`, `character` | 查找引用 | Tauri |
| **LspHover** | `id`, `file`, `line`, `character` | 悬停信息 | Tauri |
| **LspList** | — | 列出运行中的 LSP | Tauri |

### Notebook (1 个)

| 工具 | 参数 | 说明 | 环境 |
|------|------|------|------|
| **NotebookEdit** | `path`, `command`, `cell_number?`, `new_source?`, `cell_type?` | 编辑 Jupyter 笔记本 | Tauri |

---

## 环境说明

- **全部**: Web / Electron / Tauri 均可用
- **桌面**: 需要 Electron 或 Tauri 或 Companion 连接
- **Tauri**: 仅 Tauri 桌面版可用

## planSafe 工具

计划模式（EnterPlanMode）下只允许执行标记为 `planSafe: true` 的工具：

`TodoWrite`, `AskUserQuestion`, `WebFetch`, `WebSearch`, `Skill`, `EnterPlanMode`, `ExitPlanMode`, `ImageGenerate`, `VideoGenerate`

## 并行工具调度

Agent loop 将工具分为只读和写入两类：

- **只读工具**（FileRead、Glob、Grep、WebFetch、WebSearch、TaskList、TaskGet、TaskOutput、TodoWrite、LSP 系列、ImageGenerate、VideoGenerate、所有 MCP 工具）：多个同时调用时自动并行执行（Promise.all）
- **写入工具**（FileWrite、FileEdit、Bash、NotebookEdit 等）：严格顺序执行

## MCP 动态工具

MCP 服务器连接后，其工具自动注册，名称格式：`mcp__{serverId}__{toolName}`

调用方式与内置工具完全一致，通过 tool_calls 协议。
