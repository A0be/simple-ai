# 系统功能详细状态

最后更新：v1.0.7（2026-05-22）

按表格列每个功能的**引入版本 / 状态 / 关键文件 / 已知限制 / 后续 TODO**。状态符号：✅ 已稳定 / 🟡 可用但有限制 / 🔧 仅 Electron / 🚧 进行中。

---

## 1. 对话与 Agent 系统

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 | 后续 TODO |
|---|---|---|---|---|---|
| OpenAI 兼容 SSE 流式对话 | v1.0.0 | ✅ | [ai.ts](../src/lib/ai.ts) | — | — |
| 多轮 tool_calls 调度（只读并行/写入顺序） | v1.0.0 | ✅ | [agentLoop.ts](../src/lib/agentLoop.ts) | maxTurns=12 上限 | 可配置 |
| 184 个 Agent 角色（14 分类） | v1.0.0 | ✅ | [agents.ts](../src/lib/agents.ts) | 角色说明国际化缺 | I18N |
| Agent 能力动态注入 | v1.0.0 | ✅ | [agentCapabilities.ts](../src/lib/agentCapabilities.ts) | — | — |
| 思维链（thinking）展示 | v1.0.0 | ✅ | [ChatView.tsx](../src/components/ChatView.tsx) | — | — |
| 思考状态 SVG 动效 | v1.0.4 | ✅ | [ThinkingIndicator.tsx](../src/components/ThinkingIndicator.tsx) | — | — |
| 请求超时 + 重试（5 次 / 60s） | v1.0.4 | ✅ | [retry.ts](../src/lib/retry.ts) | SSE 进入流式后不重试（避免内容重复） | — |
| 重试状态 UI | v1.0.4 | ✅ | [ChatView.tsx](../src/components/ChatView.tsx) `retryInfo` | — | — |
| Slash 命令（9 个） | v1.0.0 | ✅ | [slash.ts](../src/lib/slash.ts) | — | — |
| 对话历史保存（最多 50 条） | v1.0.0 | ✅ | [storage.ts](../src/lib/storage.ts) | localStorage 上限~5MB | 持久化到文件（桌面） |

---

## 2. API 配置 & 多模态

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 | 后续 TODO |
|---|---|---|---|---|---|
| OpenAI 兼容 API 配置 | v1.0.0 | ✅ | [Settings.tsx](../src/pages/Settings.tsx) | — | — |
| 实时拉取模型列表 + 类型筛选 | v1.0.0 | ✅ | [modelHelpers.ts](../src/lib/modelHelpers.ts) | 部分非标 API 路径不兼容 | — |
| 多 API 配置档案管理 | v1.0.2 | ✅ | [profiles.ts](../src/lib/profiles.ts) | 最多 30 个档案 | — |
| 档案级 SOCKS5/HTTP 代理 | v1.0.2 | 🔧 | [profiles.ts](../src/lib/profiles.ts) + [main.cjs](../electron/main.cjs) | 仅 Electron；Web 模式 UI 提示不可用 | Companion 转发支持 |
| 代理认证（user:pass） | v1.0.2 | 🔧 | [main.cjs:proxy:set](../electron/main.cjs) | 监听器按需挂卸避免误拦截 | — |
| MiniToken 自动 Key 获取 | v1.0.1 | 🔧 | [MiniTokenPanel.tsx](../src/components/MiniTokenPanel.tsx) | 需要 Electron BrowserWindow 嵌登录 | — |
| MiniToken 🔁 刷新 API | v1.0.2 | 🔧 | [MiniTokenPanel.tsx](../src/components/MiniTokenPanel.tsx) | — | — |
| 图像生成（默认 gpt-image-2-all） | v1.0.1 / v1.0.6 改默认 | ✅ | [multimodal.ts](../src/lib/multimodal.ts) | 120s 超时 | — |
| 视频生成 | v1.0.1 | ✅ | [multimodal.ts](../src/lib/multimodal.ts) | 600s 超时；不支持轮询查询 task 状态 | 轮询任务状态 |
| 音频 TTS / 语音识别 | v1.0.1 | ✅ | [multimodal.ts](../src/lib/multimodal.ts) | 90s 超时 | — |
| Embedding | v1.0.0 | ✅ | [multimodal.ts](../src/lib/multimodal.ts) | — | — |
| 多模态留空走 MiniToken | v1.0.3 | ✅ | [multimodal.ts:getEndpoint](../src/lib/multimodal.ts) | 主 apiKey 必须对 MiniToken 有效 | — |
| 返回格式自适应（url/base64 等） | v1.0.3 | ✅ | [multimodal.ts:normalizeImageItem](../src/lib/multimodal.ts) | — | — |
| 图像/视频下载（HTTP + data URL） | v1.0.3 | ✅ | [ToolCallBlock.tsx:downloadMedia](../src/components/ToolCallBlock.tsx) | — | — |
| 大图附件 ⚠️ 预警（>1MB） | v1.0.4 | ✅ | [ChatView.tsx](../src/components/ChatView.tsx) | 不自动压缩（按需求） | 可选压缩 |

---

## 3. 工具系统（42 个内置工具）

| 类别 | 工具 | 版本 | 状态 | 关键文件 |
|---|---|---|---|---|
| 文件 | FileRead / FileWrite / FileEdit / Glob / Grep | v1.0.0 | 🔧 | [tauriFs.ts](../src/lib/tools/builtin/tauriFs.ts) |
| 文件 | NotebookEdit | v1.0.0 | 🔧 | [notebookEdit.ts](../src/lib/tools/builtin/notebookEdit.ts) |
| Shell | Bash | v1.0.0 | 🔧 | [tauriFs.ts](../src/lib/tools/builtin/tauriFs.ts) |
| Shell | PowerShell | v1.0.5 | 🔧 | [powerShell.ts](../src/lib/tools/builtin/powerShell.ts) |
| Web | WebFetch / WebSearch | v1.0.0 | ✅ | [webFetch.ts](../src/lib/tools/builtin/webFetch.ts) [webSearch.ts](../src/lib/tools/builtin/webSearch.ts) |
| 多模态 | ImageGenerate / VideoGenerate | v1.0.1 | ✅ | [imageGen.ts](../src/lib/tools/builtin/imageGen.ts) [videoGen.ts](../src/lib/tools/builtin/videoGen.ts) |
| Agent | Agent / SendMessage | v1.0.0 | ✅ | [agent.ts](../src/lib/tools/builtin/agent.ts) [sendMessage.ts](../src/lib/tools/builtin/sendMessage.ts) |
| Plan | EnterPlanMode / ExitPlanMode | v1.0.0 | ✅ | [planMode.ts](../src/lib/tools/builtin/planMode.ts) |
| Task | TaskCreate/List/Get/Update/Output/Stop | v1.0.0 | ✅ | [tasks.ts](../src/lib/tools/builtin/tasks.ts) |
| Todo | TodoWrite | v1.0.0 | ✅ | [todoWrite.ts](../src/lib/tools/builtin/todoWrite.ts) |
| 定时 | CronCreate / CronList / CronDelete / ScheduleWakeup | v1.0.0 | ✅ | [schedule.ts](../src/lib/tools/builtin/schedule.ts) |
| 等待 | Sleep | v1.0.5 | ✅ | [sleep.ts](../src/lib/tools/builtin/sleep.ts) |
| LSP | LspStart/Stop/Definition/References/Hover/List | v1.0.0 | 🔧 | [lsp.ts](../src/lib/tools/builtin/lsp.ts) |
| 工作树 | EnterWorktree / ExitWorktree | v1.0.0 | 🔧 | [worktree.ts](../src/lib/tools/builtin/worktree.ts) |
| 交互 | AskUserQuestion | v1.0.0 | ✅ | [askUserQuestion.ts](../src/lib/tools/builtin/askUserQuestion.ts) |
| 技能 | Skill | v1.0.0 | ✅ | [skill.ts](../src/lib/tools/builtin/skill.ts) |
| 发现 | ToolSearch | v1.0.5 | ✅ | [toolSearch.ts](../src/lib/tools/builtin/toolSearch.ts) |
| 配置 | Config | v1.0.7 | ✅ | [configTool.ts](../src/lib/tools/builtin/configTool.ts) |
| MCP | ListMcpResources / ReadMcpResource | v1.0.7 | ✅ | [listMcpResources.ts](../src/lib/tools/builtin/listMcpResources.ts) [readMcpResource.ts](../src/lib/tools/builtin/readMcpResource.ts) |
| MCP | 动态 `mcp__<server>__<tool>` | v1.0.0 | ✅ | [mcp/client.ts](../src/lib/mcp/client.ts) |

详见 [TOOLS.md](TOOLS.md) 与 [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md)。

---

## 4. HTML 万物生成

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 | 后续 TODO |
|---|---|---|---|---|---|
| 75 个 HTML 模板 | v1.0.1 | ✅ | [htmlSkills.ts](../src/lib/htmlSkills.ts) | — | — |
| 左侧大卡片侧边栏 | v1.0.2 | ✅ | [HtmlAnything.tsx](../src/pages/HtmlAnything.tsx) | — | — |
| 实时预览（sandboxed iframe） | v1.0.1 | ✅ | [HtmlAnything.tsx](../src/pages/HtmlAnything.tsx) | — | — |
| 一键下载 .html | v1.0.1 | ✅ | [HtmlAnything.tsx](../src/pages/HtmlAnything.tsx) | — | — |
| 导出到本地（saveDialog + 浏览器打开） | v1.0.2 | 🔧 | [main.cjs:html_export](../electron/main.cjs) | 仅 Electron | — |

---

## 5. 终端 & Claude Code 集成

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 | 后续 TODO |
|---|---|---|---|---|---|
| Claude Code CLI 封装（236 MB） | v1.0.0 | 🔧 | [bundle-claude.mjs](../scripts/bundle-claude.mjs) [main.cjs:claude](../electron/main.cjs) | 仅 Windows | macOS/Linux 封装 |
| xterm.js 终端 | v1.0.0 | 🔧 | [TerminalPanel.tsx](../src/components/TerminalPanel.tsx) | 需要 node-pty | — |
| 在线 CLI 更新 | v1.0.0 | 🔧 | [main.cjs:claudeSetup](../electron/main.cjs) | 需要 npm 全局 | — |
| 终端会话历史 | v1.0.2 | 🔧 | [terminalHistory.ts](../src/lib/terminalHistory.ts) | 20 条 / 1MB 单条上限 | — |
| 历史抽屉 + 只读 xterm 重放 | v1.0.2 | 🔧 | [TerminalHistoryDrawer.tsx](../src/components/TerminalHistoryDrawer.tsx) | v1.0.3 修复 init 时序 bug | — |

---

## 6. MCP & 插件市场

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 | 后续 TODO |
|---|---|---|---|---|---|
| MCP 服务器配置 + 连接 | v1.0.0 | ✅ | [Mcp.tsx](../src/pages/Mcp.tsx) [mcp/](../src/lib/mcp/) | — | — |
| HTTP/SSE 传输 | v1.0.0 | ✅ | [mcp/transport.ts](../src/lib/mcp/transport.ts) | — | — |
| stdio 传输 | v1.0.0 | 🔧 | [mcp/transport.ts](../src/lib/mcp/transport.ts) | 仅 Tauri | Electron stdio |
| 动态工具注入 | v1.0.0 | ✅ | [mcp/client.ts](../src/lib/mcp/client.ts) | — | — |
| resources/list + resources/read | v1.0.7 | ✅ | [client.ts:listResources/readResource](../src/lib/mcp/client.ts) | — | prompts/list |
| Claude Code 兼容插件市场 | v1.0.6 | 🔧 | [marketplace.ts](../src/lib/marketplace.ts) [MarketplaceManager.tsx](../src/components/MarketplaceManager.tsx) | 仅 skills 安装；commands / mcpServers 跳过；走 marketplace_fetch IPC（Electron） | 支持 commands + mcpServers 自动注册 |

---

## 7. 命理（Divination）

| 功能 | 版本 | 状态 | 关键文件 | 已知限制 |
|---|---|---|---|---|
| 八字排盘 | v1.0.0 | ✅ | [divination/Bazi](../src/components/divination/) | — |
| 紫微斗数 | v1.0.0 | ✅ | [divination/Ziwei](../src/components/divination/) | — |
| 塔罗（洗牌+扇形展开+翻牌动画） | v1.0.0 | ✅ | [divination/Tarot](../src/components/divination/) | — |
| 六爻起卦 | v1.0.0 | ✅ | [divination/Liuyao](../src/components/divination/) | — |
| 周公解梦 | v1.0.0 | ✅ | [divination/Dream](../src/components/divination/) | — |
| MBTI 性格分析 | v1.0.0 | ✅ | [divination/Mbti](../src/components/divination/) | — |

---

## 8. 平台 & 部署

| 模式 | 状态 | 启动方式 | 限制 |
|---|---|---|---|
| Electron 桌面版 (Windows x64) | ✅ 主目标 | `npm run electron:dev` / Setup.exe | — |
| Tauri 桌面版 | 🟡 备选 | `npm run tauri:dev` | 终端未集成 |
| Web + Companion | 🟡 | `npm run dev` + companion | 需要本地 Rust 旁路 |
| 纯 Web / PWA | 🟡 | `npm run dev` | 仅在线工具可用 |

---

## 9. 已知技术债

| 项 | 影响 | 建议 |
|---|---|---|
| [Settings.tsx](../src/pages/Settings.tsx) 755 LOC | 维护成本 | v1.0.7 已抽 ModelEndpointEditor；后续可拆 Profile 列表/MultiModal 区 |
| [ChatView.tsx](../src/components/ChatView.tsx) 733 LOC | 状态分散 | v1.0.7 已抽 MessageRender；后续抽 input area |
| 缺单元/集成测试 | 回归风险 | 引入 Vitest，先覆盖 retry / marketplace / profiles |
| Vite 主 chunk 768 KB | 首屏加载 | route-level code splitting |
| 仅 Windows 打包 | 跨平台 | electron-builder 加 mac/linux target |
| 国际化未做 | 中文用户为主，OK | future |
| MCP stdio 仅 Tauri | 桌面 Web 不一致 | Electron 加 child_process |

更详细规划见 [ROADMAP.md](ROADMAP.md)。
