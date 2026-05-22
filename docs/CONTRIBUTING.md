# 贡献指南 / CONTRIBUTING

> 常见任务的「**怎么做**」cheat sheet。新开发者或新会话 Claude 按需查表。

---

## 0. 提交前清单（每次都要走）

```bash
# 1. 类型检查必过
npx tsc --noEmit

# 2. 改完文件用 git diff 自检
git status --short
git diff src/lib/<changed-file>.ts

# 3. commit（不打包，不push 除非用户要）
git add <specific-files>     # 不要 git add -A，避免意外带上 .env
git commit -m "..."
```

**默认不打包发版**。用户说「打包」/「发布」时再跑 [electron:build / push / release](#发布流程)。

---

## 1. 加一个工具

### 1.1 单文件工具

1. 创建 `src/lib/tools/builtin/myTool.ts`：

```ts
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

const MY_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    foo: { type: 'string', description: 'what foo means' },
    bar: { type: 'number', description: 'count of bars' },
  },
  required: ['foo'],
}

export const MyTool: ToolDef = {
  name: 'MyTool',
  description: 'A 1-line model-facing description; be specific about when to call.',
  category: 'misc',
  env: 'both',           // 'web' / 'tauri' / 'both'
  planSafe: true,        // 读时安全才 true
  parameters: MY_TOOL_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { foo, bar } = parseToolArgs<{ foo: string; bar?: number }>(ctx.call.arguments)
    if (!foo) return { content: 'MyTool: missing `foo`.', isError: true }
    try {
      const result = await doSomething(foo, bar ?? 1)
      return { content: result }
    } catch (e) {
      return { content: `MyTool failed: ${(e as Error).message}`, isError: true }
    }
  },
}
```

2. 在 `src/lib/tools/index.ts` 加 import + 注册到 `buildRegistry()`
3. 用 `npx tsc --noEmit` 验证
4. 更新 [TOOLS.md](TOOLS.md) 表格、[TOOLS_COMPARISON.md](TOOLS_COMPARISON.md) 标记、[FEATURE_STATUS.md](FEATURE_STATUS.md) 工具数 +1
5. 在 [CHANGELOG.md](CHANGELOG.md) 下一版段写一行

**常见坑**：
- 工具描述要写**何时调用**而不是「做什么」。模型靠 description 决定要不要用
- 写入类工具 **必须** `planSafe: false`
- 长时间运行（>5s）：用 `withRetry` 或自己加 abort signal 监听 `ctx.signal`

### 1.2 跨平台 shell 类工具

参考 [powerShell.ts](../src/lib/tools/builtin/powerShell.ts)（Windows 拒绝）和 [tauriFs.ts:BashTool](../src/lib/tools/builtin/tauriFs.ts)。要点：

- 走 `shellExec` from `@/lib/localBackend`
- 自己 escape 特殊字符（Windows 上引号、反斜杠都坑）
- Plan mode 必须阻断（`ctx.session.planMode`）

---

## 2. 加一个页面

1. 创建 `src/pages/MyPage.tsx`：

```tsx
import { useNavigate } from 'react-router-dom'

export default function MyPage() {
  const navigate = useNavigate()
  return (
    <div className="max-w-2xl mx-auto pt-4 space-y-5">
      <h1 className="text-2xl font-semibold text-ink-900">我的功能</h1>
      <p className="text-sm text-ink-500">...</p>
    </div>
  )
}
```

2. 在 [src/App.tsx](../src/App.tsx) 加路由：

```tsx
import MyPage from './pages/MyPage'
...
<Route path="/my" element={<MyPage />} />
```

3. 在 [src/lib/features.ts](../src/lib/features.ts) 加 FeatureCard 让 Home 可见：

```ts
{ id: 'my', title: '我的功能', description: '...', path: '/my', emoji: '✨', category: 'tool' }
```

---

## 3. 加一个 Electron IPC

1. `electron/main.cjs` 加 handler：

```js
ipcMain.handle('my:do_thing', async (_, { foo }) => {
  try {
    const result = await doSomething(foo)
    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, message: e.message }
  }
})
```

2. `electron/preload.cjs` 暴露：

```js
contextBridge.exposeInMainWorld('electronAPI', {
  ...
  myDoThing: (args) => ipcRenderer.invoke('my:do_thing', args),
})
```

3. 渲染进程调：

```ts
const r = await (window as any).electronAPI?.myDoThing({ foo: 'bar' })
if (r?.ok) { /* use r.data */ }
```

**坑**：preload 是 CommonJS（`.cjs`），不能用 ES import；main 也是 CommonJS。

---

## 4. 加一个 Skill

### 4.1 内置 Skill（与发版绑定）

修改 [src/lib/skills.ts](../src/lib/skills.ts) 的 `BUILTIN_SKILLS` 数组：

```ts
{
  name: 'my-skill',
  description: '一句话说何时用',
  content: `<Skill body — 详细 markdown 指令>`,
  // builtin 不需要 source 字段
}
```

### 4.2 用户自定义 Skill

- 用户在 Skills 页粘贴 markdown → 自动写入 `config.customSkills`
- 或从 marketplace 安装：见 [marketplace.ts](../src/lib/marketplace.ts)

---

## 5. 加一个 MCP 工具

不需要手动加。用户在 Mcp 页配置 server → 连接 → `client.listTools()` 自动注入到 registry，命名 `mcp__<serverId>__<toolName>`。

如果要扩展 MCP 协议本身（新方法）：

1. [src/lib/mcp/types.ts](../src/lib/mcp/types.ts) 加 result 类型
2. [src/lib/mcp/client.ts](../src/lib/mcp/client.ts) 加方法（参考 `listResources()` / `readResource()`）

---

## 6. 加一个 Agent 角色

修改 [src/lib/agents.ts](../src/lib/agents.ts)：

```ts
{
  id: 'my-agent',
  name: '我的角色',
  category: 'software',  // 14 个分类之一
  description: '...',
  systemPrompt: '...',
  emoji: '🤖',
}
```

ID 必须全局唯一。新角色自动出现在 Agents 页。

---

## 7. 改 Settings 字段

加一个新配置项（如 `myFlag: boolean`）：

1. [src/types/index.ts](../src/types/index.ts) 的 `ApiConfig` 加字段
2. [src/lib/storage.ts](../src/lib/storage.ts) 的 `DEFAULT_CONFIG` + `loadConfig` 加默认值与读取
3. [src/pages/Settings.tsx](../src/pages/Settings.tsx) 加 UI（建议放进既有的折叠区）
4. 用到的地方 `loadConfig().myFlag`
5. （可选）让 `ConfigTool` 也能读写：[configTool.ts](../src/lib/tools/builtin/configTool.ts) 的 `SUPPORTED` 加键

---

## 8. 处理大文件依赖

```ts
// ❌ 不要 in renderer
import fs from 'fs'

// ✅ 走 localBackend
import { fsRead, fsWrite } from '@/lib/localBackend'
const text = await fsRead('/path/to/file')
```

localBackend 自动路由到 Electron IPC / Tauri / Companion。

---

## 9. 发布流程

只在用户明确要求时跑：

```bash
# 0. 升 patch 版本号（按 memory 规则）
# 改 package.json#version: 1.0.7 → 1.0.8

# 1. 在 docs/CHANGELOG.md 顶部加 v1.0.8 段
# - 列出本版所有变更

# 2. 类型检查
npx tsc --noEmit

# 3. 打包（5-15 min）
npm run electron:build

# 4. commit + push
git add -- <changed-files>     # 显式列文件
git commit -m "v1.0.8: ..."

# 直连试一次
git push origin main
# 失败用代理
git -c http.proxy=socks5://127.0.0.1:7983 \
    -c https.proxy=socks5://127.0.0.1:7983 \
    push origin main

# 5. 发 release（**不要修 .gitconfig**）
HTTPS_PROXY=socks5://127.0.0.1:7983 HTTP_PROXY=socks5://127.0.0.1:7983 \
gh release create v1.0.8 \
  --target main \
  --title "v1.0.8 — ..." \
  --notes "..." \
  ./out/SimpleAI-1.0.8-Setup.exe \
  ./out/SimpleAI-1.0.8-Setup.exe.blockmap \
  ./out/latest.yml
```

代理用法见 [memory: github-via-socks5-proxy](file://C:/Users/26338/.claude/projects/D--obs-AItest-ai/memory/github-via-socks5-proxy.md)。

---

## 10. Git 与提交风格

- **不要 `git add -A`** — 显式列文件，避免意外提交 `.env` / `out/` / `node_modules/`
- 提交信息格式：`<动词>: <简述>`（vXxx 段用 `v1.0.x: ...`）
- co-author 标签是约定，可保留：`Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- **不动全局 git config**（CLAUDE.md 硬规则）

---

## 11. 调试与排错

| 现象 | 检查 |
|---|---|
| 工具不被调用 | description 是否说清「何时调用」；模型见到的 description 是否过短 |
| 工具调用失败 | `ctx.call.arguments` 是 JSON 字符串还是对象？用 `parseToolArgs` 安全解析 |
| Plan mode 报阻断 | 该工具 `planSafe: false`？业务上应允许的话改 true |
| Electron 改了没生效 | preload/main 改完要重启整个 electron 进程，热重载不管用 |
| 多模态报 404 | `normalizeBase()` 是否吃掉了 `/v1` 又加回来；看 [multimodal.ts](../src/lib/multimodal.ts) |
| 代理后 MCP 拉不到 | marketplace IPC 走 `session.defaultSession`，自动用代理；其他渠道（直接 fetch）要么 web 模式 CORS，要么手动 IPC |
| 重试无限循环 | [retry.ts](../src/lib/retry.ts) 的 `shouldRetry`：4xx 应该立即停 |

---

## 12. 文档维护

每次发版前要更新：

- [CHANGELOG.md](CHANGELOG.md) — 新版段
- [FEATURE_STATUS.md](FEATURE_STATUS.md) — 状态变化
- [TOOLS.md](TOOLS.md) / [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md) — 新工具
- [ARCHITECTURE.md](ARCHITECTURE.md) — 新模块（数量变了 / 关键决策变了）
- [README.md](../README.md) — 顶部计数（工具数 / 角色数）+ 截图小节
- [CLAUDE.md](../CLAUDE.md) §9 版本历史 + §3 目录结构 + §7 localStorage + §8 IPC

不需要每次都更新：
- ROADMAP 只在路线变化时改
- API.md / DEV_SETUP.md / 本文件 — 基本稳定

---

## 13. 不要做的事（项目硬规则）

- ❌ 修改全局 git config（一次性传 `-c` 没问题）
- ❌ 跳过 hooks（`--no-verify` / `--no-gpg-sign`）
- ❌ 改 patch 版本号之外的版本号位（minor/major）— 除非用户明说
- ❌ 自动 push / 自动发 release（不通过用户）
- ❌ 默认压缩用户上传的图像 — v1.0.4 已明确用户偏好保留原图
- ❌ 复刻 Claude Code 依赖云服务的工具（BriefTool / TeamCreate / RemoteTrigger 等，见 [TOOLS_COMPARISON.md](TOOLS_COMPARISON.md)）
