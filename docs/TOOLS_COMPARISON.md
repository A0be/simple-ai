# 工具对照表：simple-ai vs Anthropic Claude Code (`D:/obs/AItest/ai/code`)

最后更新：2026-05-22（v1.0.5）

参考实现位于 `D:/obs/AItest/ai/code/tools/`（共 41 个工具目录）。`simple-ai` 当前在 `src/lib/tools/builtin/` 实现 **39 个工具**，由 [tools/index.ts](../src/lib/tools/index.ts) 的 `buildRegistry()` 注册。两者并非完全对齐——本文档记录差异，作为后续迭代依据。

## 已实现（功能等价）

| Claude Code 工具 | simple-ai 实现 | 说明 |
|---|---|---|
| AgentTool | Agent | 子代理调度 |
| AskUserQuestionTool | AskUserQuestion | 交互式问询 |
| BashTool | Bash | Shell 命令执行 |
| **PowerShellTool** | **PowerShell** *(v1.0.5+)* | Windows PowerShell 命令执行；其他平台拒绝 |
| **SleepTool** | **Sleep** *(v1.0.5+)* | 同步暂停（cap 300s）；响应 abort signal |
| **ToolSearchTool** | **ToolSearch** *(v1.0.5+)* | 关键字模糊搜索注册工具 |
| EnterPlanModeTool | EnterPlanMode | 进入 plan 模式 |
| ExitPlanModeTool | ExitPlanMode | 退出 plan 模式 |
| EnterWorktreeTool | EnterWorktree | git 工作树 |
| ExitWorktreeTool | ExitWorktree | 退出工作树 |
| FileEditTool | FileEdit | 文件编辑 |
| FileReadTool | FileRead | 文件读取 |
| FileWriteTool | FileWrite | 文件写入 |
| GlobTool | Glob | 文件模式匹配 |
| GrepTool | Grep | 文本搜索 |
| LSPTool | LspStart/Stop/Definition/References/Hover/List | 语言服务（拆为 6 个细粒度工具） |
| NotebookEditTool | NotebookEdit | Jupyter 笔记本编辑 |
| ScheduleCronTool | CronCreate/CronDelete/CronList | 定时任务（拆为 3 个工具） |
| SendMessageTool | SendMessage | 子代理通信 |
| SkillTool | Skill | Skill 调用 |
| TaskCreateTool | TaskCreate | 任务创建 |
| TaskGetTool | TaskGet | 获取任务详情 |
| TaskListTool | TaskList | 任务列表 |
| TaskOutputTool | TaskOutput | 读取后台任务输出 |
| TaskStopTool | TaskStop | 终止后台任务 |
| TaskUpdateTool | TaskUpdate | 更新任务 |
| TodoWriteTool | TodoWrite | TODO 列表 |
| WebFetchTool | WebFetch | URL 抓取 |
| WebSearchTool | WebSearch | 网络搜索 |
| (各种 MCP) | MCP 动态工具 | 通过 `mcp__*` 前缀动态注册 |
| (无对应) | ScheduleWakeup | simple-ai 独有：自唤醒调度 |
| (无对应) | ImageGenerate | simple-ai 独有：图像生成 |
| (无对应) | VideoGenerate | simple-ai 独有：视频生成 |

## 尚未实现（中优先级）

| Claude Code 工具 | 复刻可行性 | 备注 |
|---|---|---|
| **BriefTool** | 中 | 文档/代码片段压缩摘要 |
| **ConfigTool** | 中 | 运行时读/写 settings 文件 |
| **REPLTool** | 中 | 类似 Bash 但保持交互会话，需要持久化 PTY |
| **ListMcpResourcesTool** | 中 | 列出 MCP 服务器暴露的资源（区别于 MCP 工具） |
| **ReadMcpResourceTool** | 中 | 读取 MCP 资源内容 |
| **McpAuthTool** | 高 | MCP OAuth 流程触发 |
| **SyntheticOutputTool** | 中 | 合成输出（用于测试 / 演示） |

## 尚未实现（暂不计划）

| Claude Code 工具 | 原因 |
|---|---|
| TeamCreateTool / TeamDeleteTool | 依赖 Anthropic 团队协作云服务 |
| RemoteTriggerTool | 依赖 Anthropic 远程触发云服务 |

## 后续迭代建议

1. **下一版 (v1.0.6+)**: BriefTool / ConfigTool（文档摘要 + 运行时设置）
2. **MCP 增强**: ListMcpResources / ReadMcpResource / McpAuth（已有 MCP 基础设施）
3. **暂不复刻**: REPLTool（PTY 持久化复杂）、TeamCreate/Delete、RemoteTrigger 等依赖 Anthropic 闭源云服务的工具

## 关于 code 项目的说明

`D:/obs/AItest/ai/code/` 看起来包含 Anthropic Claude Code 的源码片段，含大量内部 service（GrowthBook flags / Statsig analytics / Claude OAuth / Bedrock 集成）。复刻时应：
- 仅参考工具**接口与功能语义**，避免直接复制实现细节
- 内部 service / 鉴权代码不适合移植到 simple-ai 这种纯本地工具箱
- simple-ai 的定位是「极简通用 AI 工具箱」，不必追求一比一覆盖每个 Anthropic 内部工具
