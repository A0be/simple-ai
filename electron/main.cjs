const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execSync } = require('child_process')
const fg = require('fast-glob')

let pty = null
try { pty = require('node-pty') } catch { /* node-pty not available */ }

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Single instance lock — prevent duplicate windows
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); return }

let mainWindow = null
let workspace = null

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

app.whenReady().then(() => {
  createWindow()
  setupClaudeOnce()
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
