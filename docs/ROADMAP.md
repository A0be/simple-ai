# 后期开发路线图（ROADMAP）

最后更新：v1.0.7（2026-05-22）

按时间线分 **v1.1 / v1.2 / Future** 三档。优先级标记：🔥 关键 / ⭐ 重要 / 💡 锦上添花。

> 这是滚动规划，不是承诺。每次发布前会更新这里 + [CHANGELOG.md](CHANGELOG.md)。

---

## v1.1（下个 minor，未排期）

### 🔥 跨平台打包

- **macOS 安装包**：electron-builder 加 `--mac` target；签名/公证流程
- **Linux AppImage**：`--linux AppImage` target
- **影响文件**：[package.json](../package.json) build 区
- **阻塞**：Apple Developer 证书 / macOS 公证流程

### 🔥 测试覆盖

- 引入 Vitest（Vite 友好）
- 先覆盖关键模块：[retry.ts](../src/lib/retry.ts) / [marketplace.ts](../src/lib/marketplace.ts) / [profiles.ts](../src/lib/profiles.ts) / [terminalHistory.ts](../src/lib/terminalHistory.ts)
- 目标：核心模块 70% 行覆盖

### ⭐ 插件市场增强

- 支持 plugin.json 的 **commands[]**：把 .md 命令注入 [slash.ts](../src/lib/slash.ts) 的自定义命令
- 支持 plugin.json 的 **mcpServers**：弹窗询问是否添加到 MCP 列表
- 收藏 marketplace（star/取消 star）
- **影响文件**：[marketplace.ts](../src/lib/marketplace.ts) [MarketplaceManager.tsx](../src/components/MarketplaceManager.tsx)

### ⭐ MCP 完整能力

- **stdio 传输在 Electron**：用 child_process 而不仅 Tauri
- **prompts/list + prompts/get**：列 MCP 暴露的提示词，供 ChatView 选择
- **resources/templates**：动态资源模板
- **影响文件**：[mcp/transport.ts](../src/lib/mcp/transport.ts) [mcp/client.ts](../src/lib/mcp/client.ts)

### ⭐ 性能优化

- **路由级 code splitting**：每个 page 独立 chunk，首屏只载 Home + ChatView
- **目标**：主 chunk 768 KB → 250 KB
- **影响文件**：[App.tsx](../src/App.tsx) + Vite config

### 💡 视频生成任务轮询

- 现状：`generateVideo` 返回 task id + 状态但不轮询
- 增强：自动 poll `GET /v1/videos/{id}` 直到完成或超时
- **影响文件**：[multimodal.ts](../src/lib/multimodal.ts) [videoGen.ts](../src/lib/tools/builtin/videoGen.ts)

---

## v1.2（更远）

### ⭐ ChatView 进一步模块化

- 已抽：MessageRender（v1.0.7）
- 待抽：input area（attachments + send + slash menu）、conversation list sidebar
- 目标：ChatView.tsx < 400 LOC

### ⭐ 对话历史持久化到文件

- 当前 localStorage 50 条上限，~5MB
- 桌面版改用 `userData/conversations.jsonl` 文件，无上限
- 保留 localStorage 作为元数据索引
- **影响文件**：[storage.ts](../src/lib/storage.ts) [main.cjs](../electron/main.cjs)

### ⭐ 国际化（I18N）

- 184 个 Agent 角色 / 75 HTML 模板 / 命理 / UI 文本目前全中文
- 引入 [i18next](https://www.i18next.com/) + locale 检测
- 至少支持 zh-CN / en-US
- **影响文件**：全 UI 组件 + lib/agents.ts + lib/htmlSkills.ts

### ⭐ 自动更新（auto-updater）

- electron-builder 已生成 `latest.yml`，但 main.cjs 未集成 `electron-updater`
- 增加：启动时检查 release feed → 提示用户更新 → 后台下载 → 重启应用
- **影响文件**：[main.cjs](../electron/main.cjs) + package.json publish config

### 💡 主题切换

- 全局浅色（默认）/ 深色 / 跟随系统
- Tailwind dark: 已经支持，需要 toggle 与持久化
- **影响文件**：[index.css](../src/index.css) + Layout 加 toggle

### 💡 命令面板（Cmd+K）

- 全局快捷搜索：跳转页面 / 切换 profile / 触发 action / 调起 ToolSearch
- 类似 VS Code 命令面板
- **影响文件**：新增 [components/CommandPalette.tsx](../src/components/) + Layout 监听 hotkey

---

## Future（无承诺）

| 项 | 价值 | 难度 | 备注 |
|---|---|---|---|
| Browser extension 模式 | 浏览器内即用 | 高 | 替代 PWA，可注入页面 |
| Voice mode（实时语音对话） | 大 | 高 | 依赖 WebRTC + 实时 TTS/ASR |
| 本地 LLM 后端（llama.cpp） | 离线可用 | 中 | OpenAI 兼容服务可直接接入 |
| 协作模式（多人共享 Agent） | 大 | 高 | 需要后端服务 |
| 插件市场上传（贡献回 marketplace） | 中 | 中 | 需要 OAuth / 审核流程 |
| Skills 编辑器（GUI 编辑 customSkill） | 中 | 低 | 当前只能粘文本 |
| HTML 生成结果保存到历史 | 小 | 低 | 跟对话历史合并 |
| MCP OAuth 流（McpAuthTool） | 中 | 高 | 需要外部回调 server |

---

## 明确不计划做（trade-off 已记录在 [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md)）

- BriefTool 复刻 — 语义重复
- REPLTool 复刻 — 别名集合非新工具
- SyntheticOutputTool 复刻 — 仅非交互场景
- TeamCreate/Delete 复刻 — 依赖 Anthropic agentSwarms 云服务
- RemoteTriggerTool 复刻 — 依赖 OAuth + 组织云服务
- 自研 Markdown 高级渲染（数学公式 / Mermaid） — 当前轻量足够；如需可加 KaTeX/mermaid 但会增包体

---

## 反馈

发现 bug / 想要某功能：去 [Issues](https://github.com/A0be/simple-ai/issues) 提单。本路线图会根据使用反馈调整。

相关：[FEATURE_STATUS.md](FEATURE_STATUS.md) 看现在能用什么，[CHANGELOG.md](CHANGELOG.md) 看已经做了什么。
