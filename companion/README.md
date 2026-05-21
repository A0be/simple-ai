# simple-ai-companion

> 本机助手 — 把 web 版的 simple-ai 桥接到你的本地文件系统和 shell。
> 没有这个 exe，web 版只能在浏览器沙箱里运行；启动后，网页就能在你选的目录里读写文件、跑命令，每一步都会向你弹窗求授权（和 Claude Code 的权限流一致）。

## 安全模型

1. **只监听 127.0.0.1** — 任何外网都无法连接。
2. **随机 token** — 每次启动生成一个新的 token，必须靠粘贴 URL 才能连上。
3. **工作目录沙箱** — 启动后必须先选一个工作目录；之后所有 fs / shell 操作都被限制在这个目录下，包含 `..` 的路径直接拒绝。
4. **逐次授权** — 每个 FileRead / FileWrite / Bash 调用都会通过 `/permission/poll` 提示 UI，用户选 "仅此一次 / 本次会话 / 始终允许 / 拒绝"，结果通过 `/permission/resolve` 回传。

## 用法

```bash
# 1. 编译
cd companion
cargo build --release

# 2. 运行
./target/release/simple-ai-companion

# 输出示例：
#   port      : 17381
#   workspace : (not picked — choose in browser)
#   token     : a1b2c3...
#   Paste this URL into the web app's "connect" dialog:
#       http://127.0.0.1:17381#token=a1b2c3...
```

3. 打开 web 版 simple-ai → 右上角点「🔌 连接本机」→ 粘贴上面那条 URL。
4. 在出现的对话框里点「📁 选择工作目录」，弹出系统文件选择框选定一个目录。
5. 之后所有 FileRead / FileWrite / Bash / Glob / Grep 工具调用都会先弹授权框。

## 部署到云端 web 时怎么用？

服务器只托管静态 web 资源 + 你自己的 OpenAI 代理（如果有）。companion 永远只在 **用户自己的电脑** 上跑：

- 用户在你的网站 `https://simple-ai.your-domain.com` 上看到 chat UI；
- 网站要做文件操作时，前端 `fetch('http://127.0.0.1:17381/...')`；
- 浏览器允许 https → 127.0.0.1 的请求（chromium 把 localhost 视为安全上下文）；
- 在 companion 启动时通过 `--origin https://simple-ai.your-domain.com` 把你的域名加入 CORS 白名单：

```bash
./simple-ai-companion --origin https://simple-ai.your-domain.com
```

## CLI 参数

| flag | 默认 | 说明 |
|---|---|---|
| `--port` | 17381 | 监听端口 |
| `--origin` | `http://localhost:5173`, `http://127.0.0.1:5173` | 允许的 CORS origin，可重复 |
| `--workspace` | 无 | 预设工作目录（跳过浏览器选择步骤） |
| `--token` | 随机 | 预设授权 token（一般用随机的更安全） |

## HTTP API

| 路径 | 方法 | 用途 |
|---|---|---|
| `/health` | GET | 探活 |
| `/workspace` | GET | 当前工作目录 |
| `/workspace/pick` | POST | 弹出系统文件选择框 |
| `/workspace/set` | POST `{path}` | 手动设定 |
| `/permission/poll` | GET | UI 轮询待处理授权请求 |
| `/permission/resolve` | POST `{id, decision, scope?}` | UI 回传决定 |
| `/fs/read` | POST `{path, offset, limit}` | 读文件 |
| `/fs/write` | POST `{path, content}` | 写文件 |
| `/fs/glob` | POST `{pattern, base}` | 通配 |
| `/fs/grep` | POST `{pattern, path, glob}` | 正则搜文件内容 |
| `/shell/exec` | POST `{command, cwd, timeout_ms}` | 跑命令 |

所有请求需带 `Authorization: Bearer <token>` header。
