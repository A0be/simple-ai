# 工具参考手册

SimpleAI 内置 **42 个工具**，全部通过 OpenAI `tool_calls` 格式调用。最后更新：v1.0.7（2026-05-22）。

> 工具按类别分组。每个工具列：用途 / 参数 / 调用示例。`env` 列标记可用环境（both = 全平台；tauri = 仅 Tauri+Electron 桌面）；`planSafe` = plan mode 中是否允许。

---

## 文件操作（6）

### FileRead — 读文件

- **用途**：读完整文本文件或指定行范围
- **env**：`both`（需本机后端）  **planSafe**：✓
- **参数**：`file_path` (string, 必填) / `offset` (number) / `limit` (number)

```json
{ "file_path": "/path/to/foo.ts", "offset": 0, "limit": 100 }
```

### FileWrite — 写文件

- **用途**：写入或覆盖文件
- **env**：`both`  **planSafe**：✗
- **参数**：`file_path` (string, 必填) / `content` (string, 必填)

### FileEdit — 精确替换编辑

- **用途**：在文件中做 `old_string → new_string` 替换；`replace_all=true` 可全局替换
- **env**：`both`  **planSafe**：✗
- **参数**：`file_path` / `old_string` / `new_string` / `replace_all` (boolean)

### Glob — 文件模式匹配

- **用途**：按 glob 找文件路径列表
- **env**：`both`  **planSafe**：✓
- **参数**：`pattern` (string, 必填) / `base` (string)

```json
{ "pattern": "**/*.{ts,tsx}", "base": "src" }
```

### Grep — 文本搜索

- **用途**：跨文件正则搜索
- **env**：`both`  **planSafe**：✓
- **参数**：`pattern` / `base` / `glob` / `mode` (paths|content|count) / `ci`

### NotebookEdit — Jupyter 笔记本编辑

- **用途**：替换 / 插入 / 删除 .ipynb 文件的某个 cell
- **env**：`both`  **planSafe**：✗
- **参数**：`notebook_path` / `cell_id` / `cell_type` / `new_source` / `edit_mode`

---

## Shell（2）

### Bash — Shell 命令

- **用途**：在本机跑 shell 命令（Windows 走 `shell:true`）
- **env**：`both`  **planSafe**：✗
- **参数**：`command` (必填) / `cwd` / `timeout` (毫秒)

### PowerShell *(v1.0.5+)* — Windows PowerShell

- **用途**：Windows 上跑 `powershell.exe -NoProfile -Command`；非 Windows 立即拒绝
- **env**：`both`  **planSafe**：✗
- **参数**：`command` / `cwd` / `timeout`

---

## Web（2）

### WebFetch — 抓 URL 内容

- **用途**：GET HTML 并简单提取文本
- **env**：`both`  **planSafe**：✓
- **参数**：`url` (必填) / `prompt` (string，提示提取目标)

### WebSearch — 网络搜索

- **用途**：返回搜索结果（使用搜索 API 转发）
- **env**：`both`  **planSafe**：✓
- **参数**：`query` (必填) / `allowed_domains` / `blocked_domains`

---

## 多模态（2）

### ImageGenerate — AI 图片生成

- **用途**：根据 prompt 生成图片（默认 `gpt-image-2-all`，v1.0.6+）
- **env**：`both`（OpenAI API 兼容）  **planSafe**：✓
- **参数**：`prompt` (必填) / `size` (默认 1024x1024) / `quality` / `n` (1-4) / `model`
- **返回**：图片 URL 或 base64 data URL，含 revised_prompt
- **超时**：120s（v1.0.4+）

### VideoGenerate — AI 视频生成

- **用途**：从 prompt 或 image_url 生成视频（veo / sora / kling / seedance）
- **env**：`both`  **planSafe**：✓
- **参数**：`prompt` / `model` / `duration` / `size` / `image_url`
- **返回**：task id + status + 可能的 video URL
- **超时**：600s

---

## Agent / 子代理（2）

### Agent — 派遣子代理

- **用途**：把子任务交给独立的子代理处理；支持并行（只读子代理）
- **env**：`both`  **planSafe**：✓
- **参数**：`subagent_type` / `description` / `prompt` / `run_in_background` / `isolation`

### SendMessage — 子代理通信

- **用途**：向运行中的子代理发消息（继续会话）
- **env**：`both`  **planSafe**：✓
- **参数**：`to` (agent id/name) / `message`

---

## 计划模式（2）

### EnterPlanMode — 进入只读规划

- **用途**：仅执行只读工具，制定计划后用户审核
- **env**：`both`  **planSafe**：—
- **参数**：—

### ExitPlanMode — 退出规划

- **用途**：拟好计划后请求批准，进入执行
- **env**：`both`  **planSafe**：—
- **参数**：可选 `allowedPrompts`

---

## 任务系统（6）

| 工具 | 用途 |
|---|---|
| TaskCreate | 创建任务 `{subject, description, activeForm?}` |
| TaskList | 列出全部任务 |
| TaskGet | 按 taskId 取详情 |
| TaskUpdate | 改 status / subject / description / addBlockedBy / addBlocks / metadata |
| TaskOutput | 读后台任务（agent / bash background）输出 |
| TaskStop | 终止后台任务 |

planSafe：TaskList / TaskGet / TaskOutput ✓；其他 ✗。

---

## TodoWrite

- **用途**：写入当前对话的 todo 列表（UI 顶部展示）
- **env**：`both`  **planSafe**：✓
- **参数**：`todos: [{ id, content, activeForm, status }]`

---

## 定时 & 等待（5）

| 工具 | 用途 | 版本 |
|---|---|---|
| Sleep | 暂停 N 秒（max 300）；响应 abort | v1.0.5 |
| CronCreate | 5-field 本地时区 cron / 一次性 fireAt | v1.0.0 |
| CronList | 列已注册任务 | v1.0.0 |
| CronDelete | 删除任务 | v1.0.0 |
| ScheduleWakeup | /loop 动态间隔自唤醒 | v1.0.0 |

---

## LSP（6, Tauri-only）

| 工具 | 用途 |
|---|---|
| LspStart | 在工作树启动 LSP 服务（按语言） |
| LspStop | 停止 |
| LspDefinition | 跳转定义 |
| LspReferences | 查引用 |
| LspHover | 鼠标悬停信息 |
| LspList | 当前活跃 LSP 列表 |

---

## 工作树（2, 桌面）

### EnterWorktree

- **用途**：从当前分支创建 `.claude/worktrees/<name>` 隔离工作副本
- **planSafe**：✗
- **参数**：`name?` / `path?`（进入已有 worktree）

### ExitWorktree

- **用途**：离开 worktree；`action: "keep"` 保留 / `"remove"` 删除分支与目录
- **planSafe**：✗
- **参数**：`action` / `discard_changes`

---

## 交互（3）

### AskUserQuestion

- **用途**：弹窗让用户从 2-4 个选项中选；可 multiSelect
- **planSafe**：✓
- **参数**：`questions: [{ question, header, options, multiSelect }]`

### Skill

- **用途**：调用一个 Skill（内置 / 自定义 / marketplace 安装的）
- **planSafe**：取决于 skill
- **参数**：`skill` (name) / `args`

### ToolSearch *(v1.0.5+)*

- **用途**：按关键字模糊搜索注册工具
- **planSafe**：✓
- **参数**：`query` / `limit` (1-30, 默认 10)
- **评分**：name 完全匹配 100 / name 子串 40 / description 子串 5

---

## 配置（1，v1.0.7+）

### Config

- **用途**：读 / 写 simple-ai 自己的 ApiConfig
- **env**：`both`  **planSafe**：✓（读时）
- **参数**：`setting` (枚举：baseUrl/apiKey/model/helperModel/disableStreaming/projectContext) / `value`
- **安全**：`apiKey` 读取自动 mask（仅前 5 后 4）；写入弹 AskUserQuestion 确认

---

## MCP（2 + 动态）

### ListMcpResources *(v1.0.7+)*

- **用途**：列出每个已连 MCP 服务器的资源
- **planSafe**：✓
- **参数**：`server?` (id 或 name 过滤)
- **行为**：无 capability 的服务器静默跳过

### ReadMcpResource *(v1.0.7+)*

- **用途**：按 URI 读取 MCP 资源
- **planSafe**：✓
- **参数**：`uri` (必填) / `server?`
- **行为**：不指定 server 时遍历所有连接尝试

### 动态 MCP 工具

- 每个连接的 MCP 服务器注册的工具自动以 `mcp__<serverId>__<toolName>` 注入到 registry
- 工具 description 前缀 `[MCP/<serverName>]`

---

## 相关文档

- [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md) — 与 Anthropic Claude Code 工具对照（已实现 / 不复刻）
- [ARCHITECTURE.md](ARCHITECTURE.md) — 工具系统在整体架构中的位置
- [FEATURE_STATUS.md](FEATURE_STATUS.md) — 每个工具的状态摘要
- [CHANGELOG.md](CHANGELOG.md) — 各版本新增的工具
