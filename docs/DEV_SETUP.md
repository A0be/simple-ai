# 开发环境部署 / DEV_SETUP

> 从零到能跑 `npm run electron:dev` 的全过程。Windows 10/11 x64 主目标平台。

---

## 1. 基础环境

| 工具 | 版本要求 | 安装方式 |
|---|---|---|
| **Node.js** | 18.x 或 20.x（推荐 20 LTS） | [nodejs.org](https://nodejs.org) 或 nvm-windows |
| **npm** | 9.x+ | 随 Node 自带 |
| **Git** | 任意现代版本 | [git-scm.com](https://git-scm.com) |
| **Python** | 3.x（**仅 Windows native 模块需要**） | [python.org](https://python.org) 或 `winget install Python.Python.3.11` |
| **Visual Studio Build Tools** | 2022 | [下载](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选「使用 C++ 的桌面开发」 |

> Visual Studio Build Tools 是 **node-pty** 等 native 模块编译的必备项。没装的话 `npm install` 会失败，且 Claude Code 终端无法工作。

验证：

```bash
node -v          # 应显示 v18+ 或 v20+
npm -v           # 9+
git --version
python --version # 3.x
where cl.exe     # 应找到 MSVC 编译器（Build Tools 装好后）
```

---

## 2. 克隆 + 安装依赖

```bash
git clone https://github.com/A0be/simple-ai.git
cd simple-ai
npm install
```

`npm install` 期间会编译 node-pty。如果失败：

- 报「**找不到 Python**」→ 装 Python 3 并加 PATH
- 报「**找不到 cl.exe / MSBuild**」→ 装 VS Build Tools
- 报「**MSB8020 找不到 Windows SDK**」→ Build Tools 安装时勾选最新 Windows SDK
- 反复失败？最后手段：`npm install --ignore-scripts`（终端功能不可用，但其他开发可继续）

---

## 3. 跑起来

### 3.1 纯 Web 模式（最快上手，不带本地工具）

```bash
npm run dev
# 浏览器打开 http://localhost:5173
```

不需要 Electron、没有 PTY、文件操作走 Companion 旁路（或报错）。

### 3.2 Electron 桌面版（**推荐**）

需要两个终端：

```bash
# 终端 A：启动 Vite dev server
npm run dev

# 终端 B：启动 Electron（连到 Vite）
npm run electron:dev
```

如果 Electron 卡死 / 闪退：

- 看终端 B 控制台输出（应有错误堆栈）
- 在 Electron 窗口里按 `Ctrl+Shift+I` 打开 DevTools
- main 进程日志：项目里 `console.log` 会进终端 B；renderer 日志进 DevTools

### 3.3 Tauri 桌面版（备选）

```bash
npm run tauri:dev
```

需要额外装 Rust toolchain。终端功能不集成。

---

## 4. 关键脚本

```bash
# 类型检查（**提交前必跑**）
npx tsc --noEmit

# Vite 生产构建（验证打包能过）
npm run build

# 打 Windows 安装包
npm run electron:build      # 输出 out/SimpleAI-x.x.x-Setup.exe (149 MB, 5-15 min)

# 打免安装版（验证更快）
npm run electron:pack       # 输出 out/win-unpacked/

# Tauri 打包
npm run tauri:build

# 图标重新生成
npm run icons
```

打包前规则（[memory 记录](file://C:/Users/26338/.claude/projects/D--obs-AItest-ai/memory/bump-version-before-packaging.md)）：**先把 `package.json` 的 patch 版本号 +1，不然安装包覆盖上一版同名文件**。

---

## 5. 常见报错对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| `Cannot find module '@/lib/xxx'` | 路径别名没解析 | 看 `tsconfig.json` 是否有 `"paths": { "@/*": ["src/*"] }` |
| node-pty 不可用 / Claude 终端打不开 | VS Build Tools 未装或编译失败 | 装 Build Tools，重跑 `npm install node-pty` |
| Electron 窗口白屏 | Vite dev server 未启动 | 先跑 `npm run dev` 再 `npm run electron:dev` |
| 跑 `git push` 失败 `Connection reset` | GitHub 直连不通 | 用代理：`git -c http.proxy=socks5://127.0.0.1:7983 -c https.proxy=socks5://127.0.0.1:7983 push origin main`（见 [memory 记录](file://C:/Users/26338/.claude/projects/D--obs-AItest-ai/memory/github-via-socks5-proxy.md)） |
| 打包成功但应用启动崩 | preload 引用了不存在的模块 | 检查 `electron/preload.cjs` 的 `require()` |
| MiniToken 登录窗口空白 | login 监听器拦截了 401 | v1.0.2 已修，按需挂卸；如复发查 [`main.cjs:proxy:set`](../electron/main.cjs) |
| 多模态调用 `/v1/v1/...` 404 | 旧版 normalizeBase bug | v1.0.3 已修；确认 `multimodal.ts` 是最新 |
| 安装包覆盖旧版本同名 | 没升版本号 | 改 `package.json#version` 再 build |
| tsc 报 `'X' is declared but never used` | 抽模块后留下死 import | 删掉 import 行；运行 `npx tsc --noEmit` 验证 |

---

## 6. 调试技巧

### 6.1 main 进程

```js
// electron/main.cjs 里直接 console.log
// 日志显示在跑 npm run electron:dev 的终端
```

启动时加 `--inspect`：

```bash
# 一次性
electron --inspect=9229 .
# 然后 chrome://inspect 连
```

### 6.2 renderer

- DevTools：`Ctrl+Shift+I`
- React DevTools：可装 Electron 版浏览器扩展，或直接在 DevTools 看组件树
- localStorage：DevTools Application 标签

### 6.3 IPC

- 主进程 `ipcMain.handle('x', ...)` 里的 throw 会作为 promise reject 传回 renderer
- 渲染进程错误：`window.electronAPI.xxx().catch(...)` 抓
- IPC 调用看不到 → 检查 `preload.cjs` 是否暴露

### 6.4 类型检查 vs 构建

- `npx tsc --noEmit` 只查类型，**不**生成 dist；快
- `npx vite build` 完整构建产物到 `dist/`；包体警告时会输出 chunk 信息
- `npm run electron:build` 包含 vite build，错误首先看 vite 输出

---

## 7. 项目结构入口

新会话进项目，**按这个顺序读**最高效：

1. [CLAUDE.md](../CLAUDE.md) — 项目交接（10 分钟）
2. [docs/ARCHITECTURE.md](ARCHITECTURE.md) — 分层架构 + 数据流（20 分钟）
3. [docs/FEATURE_STATUS.md](FEATURE_STATUS.md) — 现在能用什么（5 分钟）
4. [src/components/ChatView.tsx](../src/components/ChatView.tsx) — 核心交互入口（30 分钟）
5. [src/lib/agentLoop.ts](../src/lib/agentLoop.ts) — Agent 调度（20 分钟）
6. [src/lib/tools/index.ts](../src/lib/tools/index.ts) — 工具注册表（5 分钟）

接下来按 [CONTRIBUTING.md](CONTRIBUTING.md) 的「常见任务」cheat sheet 动手。

---

## 8. macOS / Linux 现状

- **未官方支持打包**：[package.json](../package.json) `build.win` 只配 NSIS
- **可以开发**：跑 `npm run dev` 和 `npm run electron:dev` 都行
- node-pty 在 macOS/Linux 编译需要 `make` / `xcode-select --install`
- 想打包 macOS/Linux：加 `build.mac` / `build.linux` 配置 + electron-builder 跑 `--mac` / `--linux`
- 跨平台路线见 [ROADMAP.md#v1.1](ROADMAP.md)

---

## 9. 进入后台开发

修代码 → `npx tsc --noEmit` → commit → 等用户说要不要打包发版。**不要默认打包发布**：

- 打包耗时 5-15 分钟
- 占 GitHub Release 流量
- 每次发版要升版本号

详见 [CONTRIBUTING.md#发布流程](CONTRIBUTING.md#发布流程)。
