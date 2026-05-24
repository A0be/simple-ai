const { app, BrowserWindow, ipcMain, dialog, shell, session, net, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url')
const { exec, execSync } = require('child_process')
const fg = require('fast-glob')

let pty = null
try { pty = require('node-pty') } catch { /* node-pty not available */ }

// electron-updater is optional at dev time (needs a real installed app with code-sign metadata).
// We swallow the import error so `npm run electron:dev` still boots if updater deps are unhappy.
let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch { /* updater disabled */ }

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Single instance lock — prevent duplicate windows
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); return }

let mainWindow = null
let workspace = null
let currentProxyAuth = null // { user, pass } when active proxy needs auth
let currentProxyUrl = '' // last-applied proxy URL (informational only)

function getIconPath() {
  if (isDev) return path.join(__dirname, '../public/icons/icon-512.png')
  return path.join(process.resourcesPath, 'icon.png')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
    title: '简易 AI 工具箱',
    autoHideMenuBar: true,
    icon: getIconPath(),
    show: false,
  })

  // Show when ready to avoid white flash
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// Register app-media:// protocol for serving locally saved media files
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

app.whenReady().then(() => {
  // Handle app-media:// URLs → userData/media/<filename>
  protocol.handle('app-media', (req) => {
    const fileName = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '')
    const filePath = path.join(app.getPath('userData'), 'media', fileName)
    return net.fetch(url.pathToFileURL(filePath).href)
  })
  createWindow()
  setupClaudeOnce()
  setupAutoUpdater()
})
app.on('window-all-closed', () => app.quit())
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// --- IPC: File Read ---
ipcMain.handle('fs_read', async (_, { path: filePath, offset, limit }) => {
  const content = await fs.promises.readFile(filePath, 'utf-8')
  if (!offset && !limit) return content
  const lines = content.split('\n')
  const start = offset || 0
  const end = limit ? start + limit : lines.length
  return lines.slice(start, end).join('\n')
})

// --- IPC: File Write ---
ipcMain.handle('fs_write', async (_, { path: filePath, content }) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, content, 'utf-8')
})

// --- IPC: Glob ---
ipcMain.handle('fs_glob', async (_, { pattern, base }) => {
  const cwd = base || workspace || process.cwd()
  return await fg(pattern, {
    cwd,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  })
})

// --- IPC: Grep ---
ipcMain.handle('fs_grep', async (_, { pattern, base, glob: globPattern, mode, ci }) => {
  const cwd = base || workspace || process.cwd()
  const files = await fg(globPattern || '**/*', {
    cwd,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
  })

  const rgx = new RegExp(pattern, ci ? 'i' : '')
  const matches = []
  const MAX_RESULTS = 500
  const MAX_FILE_SIZE = 2 * 1024 * 1024

  for (const file of files) {
    if (matches.length >= MAX_RESULTS) break
    try {
      const stat = await fs.promises.stat(file)
      if (stat.size > MAX_FILE_SIZE) continue
      const content = await fs.promises.readFile(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (rgx.test(lines[i])) {
          matches.push({ file, line: i + 1, text: lines[i] })
          if (matches.length >= MAX_RESULTS) break
        }
      }
    } catch {
      // skip binary/unreadable files
    }
  }

  switch (mode) {
    case 'count': return String(matches.length)
    case 'content': return matches.map(m => `${m.file}:${m.line}: ${m.text}`).join('\n')
    default: return [...new Set(matches.map(m => m.file))].join('\n')
  }
})

// --- IPC: Shell Exec ---
ipcMain.handle('shell_exec', (_, { command, cwd, timeoutMs }) => {
  return new Promise((resolve) => {
    exec(command, {
      cwd: cwd || workspace || undefined,
      timeout: timeoutMs || 120_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      shell: true,
    }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? (error.code ?? 1) : 0,
      })
    })
  })
})

// --- IPC: Workspace ---
ipcMain.handle('workspace_pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择工作目录',
  })
  if (!result.canceled && result.filePaths[0]) {
    workspace = result.filePaths[0]
    return workspace
  }
  return null
})

ipcMain.handle('workspace_set', (_, { path: p }) => {
  workspace = p
  return workspace
})

ipcMain.handle('workspace_get', () => workspace)

// --- IPC: Export HTML to a user-picked path and open in default browser ---
ipcMain.handle('html_export', async (_, { content, defaultName }) => {
  try {
    const safeName = String(defaultName || 'output').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 HTML',
      defaultPath: `${safeName}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await fs.promises.writeFile(result.filePath, content, 'utf-8')
    const openErr = await shell.openPath(result.filePath)
    return { ok: true, path: result.filePath, openError: openErr || null }
  } catch (e) {
    return { ok: false, message: e.message }
  }
})

// --- IPC: SOCKS/HTTP proxy switch (applies to default session = all windows) ---
function parseProxyUrl(raw) {
  if (!raw || !String(raw).trim()) return null
  try {
    const u = new URL(String(raw).trim())
    const protocol = u.protocol.replace(':', '').toLowerCase()
    if (!['socks5', 'socks4', 'http', 'https'].includes(protocol)) return null
    if (!u.hostname || !u.port) return null
    const user = u.username ? decodeURIComponent(u.username) : ''
    const pass = u.password ? decodeURIComponent(u.password) : ''
    return {
      rules: `${protocol}://${u.hostname}:${u.port}`,
      auth: (user || pass) ? { user, pass } : null,
    }
  } catch {
    return null
  }
}

// Login handler is registered on demand. Why: once a 'login' listener is attached
// to a session, Electron stops falling back to the OS / Chromium default behavior,
// so any unrelated HTTP 401 (e.g. inside the MiniToken popup) would be silently
// cancelled. We only attach it while a proxy with credentials is active.
let proxyLoginHandler = null
function attachProxyLoginHandler() {
  if (proxyLoginHandler) return
  proxyLoginHandler = (event, _details, authInfo, callback) => {
    if (authInfo.isProxy && currentProxyAuth) {
      event.preventDefault()
      callback(currentProxyAuth.user, currentProxyAuth.pass)
    }
  }
  session.defaultSession.on('login', proxyLoginHandler)
}
function detachProxyLoginHandler() {
  if (!proxyLoginHandler) return
  session.defaultSession.removeListener('login', proxyLoginHandler)
  proxyLoginHandler = null
}

ipcMain.handle('proxy:set', async (_, { url }) => {
  try {
    const parsed = parseProxyUrl(url)
    if (!parsed) {
      currentProxyAuth = null
      currentProxyUrl = ''
      detachProxyLoginHandler()
      await session.defaultSession.setProxy({ mode: 'direct' })
      return { ok: true, mode: 'direct' }
    }
    currentProxyAuth = parsed.auth
    currentProxyUrl = url
    if (parsed.auth) attachProxyLoginHandler()
    else detachProxyLoginHandler()
    await session.defaultSession.setProxy({ proxyRules: parsed.rules })
    return { ok: true, rules: parsed.rules, hasAuth: !!parsed.auth }
  } catch (e) {
    return { ok: false, message: e.message }
  }
})

ipcMain.handle('proxy:get', () => ({
  url: currentProxyUrl,
  hasAuth: !!currentProxyAuth,
}))

// --- Auto-updater (electron-updater + GitHub releases) ---
// State surface to the renderer is intentionally small: a UpdaterState string and
// optional version/progress numbers. The renderer polls or subscribes via IPC.
let updaterState = 'idle' // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
let updaterVersion = null
let updaterProgress = 0
let updaterError = null

function broadcastUpdaterState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:state', {
      state: updaterState,
      version: updaterVersion,
      progress: updaterProgress,
      error: updaterError,
    })
  }
}

function setupAutoUpdater() {
  // electron-updater requires the app to be packaged. In dev (Vite server),
  // skip silently so devs don't see noisy errors.
  if (!autoUpdater || isDev) return
  // Use the publish entry from package.json (GitHub provider).
  autoUpdater.autoDownload = false // wait for user confirmation
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    updaterState = 'checking'; updaterError = null
    broadcastUpdaterState()
  })
  autoUpdater.on('update-available', (info) => {
    updaterState = 'available'; updaterVersion = info?.version || null
    broadcastUpdaterState()
  })
  autoUpdater.on('update-not-available', () => {
    updaterState = 'not-available'
    broadcastUpdaterState()
  })
  autoUpdater.on('download-progress', (p) => {
    updaterState = 'downloading'; updaterProgress = Math.round(p?.percent || 0)
    broadcastUpdaterState()
  })
  autoUpdater.on('update-downloaded', (info) => {
    updaterState = 'downloaded'; updaterVersion = info?.version || updaterVersion
    broadcastUpdaterState()
  })
  autoUpdater.on('error', (e) => {
    updaterState = 'error'; updaterError = e?.message || String(e)
    broadcastUpdaterState()
  })

  // Kick off the first check ~5s after launch so it doesn't compete with cold-start I/O.
  setTimeout(() => {
    try { autoUpdater.checkForUpdates() } catch (e) { /* ignore */ }
  }, 5000)
}

ipcMain.handle('updater:status', () => ({
  state: updaterState,
  version: updaterVersion,
  progress: updaterProgress,
  error: updaterError,
  available: !!autoUpdater && !isDev,
}))

ipcMain.handle('updater:check', async () => {
  if (!autoUpdater || isDev) {
    return { ok: false, message: '自动更新仅在打包后的安装版可用（开发模式跳过）' }
  }
  try {
    const r = await autoUpdater.checkForUpdates()
    return { ok: true, version: r?.updateInfo?.version || null }
  } catch (e) {
    return { ok: false, message: e.message }
  }
})

ipcMain.handle('updater:download', async () => {
  if (!autoUpdater || isDev) return { ok: false, message: '不可用（开发模式）' }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e.message }
  }
})

ipcMain.handle('updater:install', () => {
  if (!autoUpdater || isDev) return { ok: false }
  // quitAndInstall: closes the app and runs the NSIS installer
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true }
})

// --- IPC: Marketplace fetch (Claude Code plugin marketplace) ---
// Uses Electron `net.request` so requests go through the default session,
// which means the active SOCKS/HTTP proxy applies transparently.
ipcMain.handle('marketplace:fetch_text', async (_, { url, accept }) => {
  return new Promise((resolve) => {
    let body = ''
    try {
      const req = net.request({
        method: 'GET',
        url,
        session: session.defaultSession,
        useSessionCookies: false,
      })
      if (accept) req.setHeader('Accept', accept)
      req.setHeader('User-Agent', 'simple-ai-marketplace/1.0')
      req.on('response', (resp) => {
        resp.on('data', (chunk) => { body += chunk.toString('utf-8') })
        resp.on('end', () => {
          resolve({
            ok: resp.statusCode >= 200 && resp.statusCode < 300,
            status: resp.statusCode,
            body,
          })
        })
        resp.on('error', (e) => resolve({ ok: false, error: e.message, body }))
      })
      req.on('error', (e) => resolve({ ok: false, error: e.message }))
      req.end()
    } catch (e) {
      resolve({ ok: false, error: e.message })
    }
  })
})

// --- IPC: Media Save (persist generated images/videos to userData/media/) ---
ipcMain.handle('media:save', async (_, { base64, downloadUrl, ext }) => {
  const dir = path.join(app.getPath('userData'), 'media')
  await fs.promises.mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'bin'}`
  const dest = path.join(dir, name)
  if (base64) {
    await fs.promises.writeFile(dest, Buffer.from(base64, 'base64'))
  } else if (downloadUrl) {
    const resp = await net.fetch(downloadUrl, { session: session.defaultSession })
    const buf = Buffer.from(await resp.arrayBuffer())
    await fs.promises.writeFile(dest, buf)
  } else {
    throw new Error('media:save requires base64 or downloadUrl')
  }
  return { fileName: name, src: `app-media:///${name}` }
})

// --- IPC: MiniToken Integration ---
let minitokenWin = null
let minitokenPollTimer = null

async function tryExtractMiniTokenSession() {
  if (!minitokenWin || minitokenWin.isDestroyed()) return null
  try {
    const cookies = await minitokenWin.webContents.session.cookies.get({ url: 'https://minitoken.top' })
    const sessionCookie = cookies.find(c => c.name === 'session')
    if (!sessionCookie) return null
    const userData = await minitokenWin.webContents.executeJavaScript(
      '(() => { try { const u = localStorage.getItem("user"); return u ? JSON.parse(u) : null } catch { return null } })()', true
    )
    if (!userData?.id) return null
    return {
      session: sessionCookie.value,
      userId: String(userData.id),
      username: userData.username || userData.display_name || null,
    }
  } catch { return null }
}

function startMiniTokenPoll() {
  if (minitokenPollTimer) return
  let sent = false
  minitokenPollTimer = setInterval(async () => {
    if (sent || !minitokenWin || minitokenWin.isDestroyed()) return
    const result = await tryExtractMiniTokenSession()
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      sent = true
      mainWindow.webContents.send('minitoken-session', result)
    }
  }, 1500)
}

function stopMiniTokenPoll() {
  if (minitokenPollTimer) { clearInterval(minitokenPollTimer); minitokenPollTimer = null }
}

ipcMain.handle('minitoken_open', (_, { url }) => {
  if (minitokenWin && !minitokenWin.isDestroyed()) {
    minitokenWin.focus()
    return
  }
  minitokenWin = new BrowserWindow({
    width: 1200,
    height: 820,
    parent: mainWindow,
    title: 'MiniToken 云算',
    autoHideMenuBar: true,
  })
  minitokenWin.loadURL(url || 'https://minitoken.top')
  startMiniTokenPoll()
  minitokenWin.webContents.on('did-navigate', () => { startMiniTokenPoll() })
  minitokenWin.on('closed', () => { minitokenWin = null; stopMiniTokenPoll() })
})

ipcMain.handle('minitoken_extract_session', tryExtractMiniTokenSession)

ipcMain.handle('minitoken_api', async (_, { apiPath, session, userId }) => {
  const https = require('https')
  return new Promise((resolve) => {
    const url = new URL(`https://minitoken.top${apiPath}`)
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Cookie': `session=${session}`,
        'new-api-user': userId || '',
        'Accept': 'application/json',
        'Cache-Control': 'no-store',
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ success: false, message: data }) }
      })
    })
    req.on('error', () => resolve({ success: false, message: 'network error' }))
    req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, message: 'timeout' }) })
    req.end()
  })
})

// ── Claude CLI management ──────────────────────────────────────
const CLAUDE_LOCAL_DIR = path.join(app.getPath('userData'), 'claude-code')
const CLAUDE_LOCAL_EXE = path.join(CLAUDE_LOCAL_DIR, 'claude.exe')

function findClaudeGlobal() {
  try {
    const out = execSync('where claude', { windowsHide: true, encoding: 'utf-8' }).trim()
    return out.split(/\r?\n/)[0] || null
  } catch { return null }
}

function findClaudeBundled() {
  if (!process.resourcesPath) return null
  const p = path.join(process.resourcesPath, 'claude', 'claude.exe')
  return fs.existsSync(p) ? p : null
}

function findClaudeLocal() {
  return fs.existsSync(CLAUDE_LOCAL_EXE) ? CLAUDE_LOCAL_EXE : null
}

function findClaude() {
  return findClaudeGlobal() || findClaudeLocal() || findClaudeBundled()
}

function getClaudeVersion(claudePath) {
  if (!claudePath) return null
  try {
    return execSync(`"${claudePath}" --version`, { windowsHide: true, encoding: 'utf-8', timeout: 10000 }).trim()
  } catch { return null }
}

function extractBundledClaude() {
  const bundled = findClaudeBundled()
  if (!bundled) return { ok: false, message: '封装版不存在' }
  try {
    fs.mkdirSync(CLAUDE_LOCAL_DIR, { recursive: true })
    fs.copyFileSync(bundled, CLAUDE_LOCAL_EXE)
    return { ok: true, path: CLAUDE_LOCAL_EXE }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}

let claudeSetupDone = false

async function setupClaudeOnce() {
  if (claudeSetupDone) return
  claudeSetupDone = true
  if (findClaudeGlobal() || findClaudeLocal()) return
  extractBundledClaude()
}

ipcMain.handle('claude:setup', async (_, { mode }) => {
  if (mode === 'update') {
    try {
      const out = execSync('npm install -g @anthropic-ai/claude-code@latest', {
        windowsHide: true, timeout: 120000, encoding: 'utf-8', shell: true,
      })
      const p = findClaudeGlobal()
      return { ok: true, path: p, version: getClaudeVersion(p), output: out }
    } catch (e) {
      return { ok: false, message: e.stderr || e.message }
    }
  }
  if (mode === 'extract') {
    return extractBundledClaude()
  }
  // auto: try online first, fallback to bundled
  try {
    execSync('npm install -g @anthropic-ai/claude-code@latest', {
      windowsHide: true, timeout: 120000, encoding: 'utf-8', shell: true,
    })
    const p = findClaudeGlobal()
    if (p) return { ok: true, path: p, version: getClaudeVersion(p), source: 'online' }
  } catch { /* fall through */ }
  const result = extractBundledClaude()
  if (result.ok) result.source = 'bundled'
  return result
})

ipcMain.handle('claude:info', () => {
  const p = findClaude()
  return {
    path: p,
    version: getClaudeVersion(p),
    hasGlobal: !!findClaudeGlobal(),
    hasLocal: !!findClaudeLocal(),
    hasBundled: !!findClaudeBundled(),
  }
})

// ── Terminal / PTY ──────────────────────────────────────────────
const terminals = new Map()

ipcMain.handle('terminal:info', () => ({
  hasPty: !!pty,
  claudePath: findClaude(),
}))

ipcMain.handle('terminal:create', (_, { id, cmd, args, cwd, env }) => {
  if (!pty) return { error: 'node-pty 不可用，请安装 Visual Studio Build Tools 后重新 npm install node-pty' }
  const shell = cmd || process.env.COMSPEC || 'cmd.exe'
  const shellArgs = args || []
  try {
    const term = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd || workspace || process.env.USERPROFILE || process.env.HOME,
      env: { ...process.env, ...env, FORCE_COLOR: '3' },
    })
    terminals.set(id, term)
    term.onData(data => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:data:${id}`, data)
      }
    })
    term.onExit(({ exitCode }) => {
      terminals.delete(id)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:exit:${id}`, exitCode)
      }
    })
    return { pid: term.pid }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('terminal:input', (_, { id, data }) => {
  const t = terminals.get(id); if (t) t.write(data)
})

ipcMain.handle('terminal:resize', (_, { id, cols, rows }) => {
  const t = terminals.get(id); if (t) try { t.resize(cols, rows) } catch {}
})

ipcMain.handle('terminal:kill', (_, { id }) => {
  const t = terminals.get(id)
  if (t) { t.kill(); terminals.delete(id) }
})

app.on('before-quit', () => {
  for (const t of terminals.values()) try { t.kill() } catch {}
})
