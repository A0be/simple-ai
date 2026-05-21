/**
 * Local companion client.
 *
 * The companion is a tiny native HTTP server (simple-ai-companion.exe) running
 * on 127.0.0.1 with a bearer token. When connected, web users get the same
 * file / shell tools as the Tauri desktop build, but every operation goes
 * through a permission dialog (mirrors Claude Code's `useCanUseTool` flow).
 *
 * The user pastes a URL like
 *   http://127.0.0.1:17381#token=abcdef...
 * into the connect dialog. We store {baseUrl, token} in localStorage.
 *
 * Health / workspace state is exposed as a small subscribe-able store.
 */

const STORAGE_KEY = 'simple-ai:companion'

export interface CompanionConfig {
  baseUrl: string
  token: string
}

export interface CompanionState {
  config: CompanionConfig | null
  connected: boolean
  workspace: string | null
  /** human-readable error from last call */
  lastError: string | null
}

let state: CompanionState = {
  config: null,
  connected: false,
  workspace: null,
  lastError: null
}
const listeners = new Set<(s: CompanionState) => void>()

function emit() {
  for (const l of listeners) l(state)
}

function setState(patch: Partial<CompanionState>) {
  state = { ...state, ...patch }
  emit()
}

export function subscribeCompanion(fn: (s: CompanionState) => void): () => void {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

export function getCompanionState(): CompanionState {
  return state
}

/** Save / load config from localStorage. */
export function loadCompanionConfig(): CompanionConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CompanionConfig) : null
  } catch {
    return null
  }
}

export function saveCompanionConfig(cfg: CompanionConfig | null): void {
  if (cfg) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  else localStorage.removeItem(STORAGE_KEY)
  setState({ config: cfg })
}

/**
 * Parse a companion connect URL.
 * Accepts:
 *   http://127.0.0.1:17381#token=abc
 *   http://127.0.0.1:17381?token=abc
 *   http://127.0.0.1:17381  + token field
 */
export function parseConnectUrl(raw: string): CompanionConfig | null {
  try {
    const u = new URL(raw.trim())
    const hash = new URLSearchParams(u.hash.startsWith('#') ? u.hash.slice(1) : u.hash)
    const token = hash.get('token') || u.searchParams.get('token') || ''
    if (!token) return null
    const baseUrl = `${u.protocol}//${u.host}`
    return { baseUrl, token }
  } catch {
    return null
  }
}

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const cfg = state.config ?? loadCompanionConfig()
  if (!cfg) throw new Error('companion not connected')
  const init: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`
    },
    signal
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const resp = await fetch(`${cfg.baseUrl}${path}`, init)
  if (!resp.ok) {
    let msg = `${resp.status} ${resp.statusText}`
    try {
      const j = await resp.json()
      if (j?.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return (await resp.json()) as T
}

export async function connectCompanion(cfg: CompanionConfig): Promise<void> {
  saveCompanionConfig(cfg)
  await refreshCompanion()
  startPermissionPoll()
}

export function disconnectCompanion(): void {
  saveCompanionConfig(null)
  stopPermissionPoll()
  setState({ connected: false, workspace: null })
}

export async function refreshCompanion(): Promise<void> {
  try {
    await call<{ ok: boolean }>('/health')
    const ws = await call<{ workspace: string | null }>('/workspace')
    setState({ connected: true, workspace: ws.workspace, lastError: null })
  } catch (e) {
    setState({ connected: false, lastError: (e as Error).message })
  }
}

export async function pickWorkspace(): Promise<string | null> {
  const r = await call<{ workspace: string | null }>('/workspace/pick', {})
  setState({ workspace: r.workspace })
  return r.workspace
}

export async function setWorkspace(path: string): Promise<string | null> {
  const r = await call<{ workspace: string | null }>('/workspace/set', { path })
  setState({ workspace: r.workspace })
  return r.workspace
}

// -------- permission polling --------

export interface PermissionItem {
  id: string
  tool: string
  summary: string
  detail: string
  suggested_scope: string[]
}

type PermissionListener = (items: PermissionItem[]) => void
const permListeners = new Set<PermissionListener>()
let pollTimer: ReturnType<typeof setInterval> | null = null

export function subscribePermissions(fn: PermissionListener): () => void {
  permListeners.add(fn)
  return () => permListeners.delete(fn)
}

function startPermissionPoll() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!state.connected) return
    try {
      const items = await call<PermissionItem[]>('/permission/poll')
      if (items.length) for (const l of permListeners) l(items)
    } catch {
      /* network blip — ignore */
    }
  }, 500)
}

function stopPermissionPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export type Decision = 'allow-once' | 'allow-session' | 'allow-always' | 'deny'

export async function resolvePermission(
  id: string,
  decision: Decision,
  scope?: string
): Promise<void> {
  await call('/permission/resolve', { id, decision, scope })
}

// -------- file / shell wrappers --------

export interface FsReadParams {
  path: string
  offset?: number
  limit?: number
}
export async function companionFsRead(p: FsReadParams): Promise<string> {
  const r = await call<{ content: string }>('/fs/read', p)
  return r.content
}

export async function companionFsWrite(path: string, content: string): Promise<string> {
  const r = await call<{ ok: boolean; path: string }>('/fs/write', { path, content })
  return r.path
}

export async function companionFsGlob(pattern: string, base?: string): Promise<string[]> {
  const r = await call<{ matches: string[] }>('/fs/glob', { pattern, base })
  return r.matches
}

export interface GrepMatch {
  file: string
  line: number
  text: string
}
export async function companionFsGrep(
  pattern: string,
  opts?: { path?: string; glob?: string }
): Promise<GrepMatch[]> {
  const r = await call<{ matches: GrepMatch[] }>('/fs/grep', {
    pattern,
    path: opts?.path,
    glob: opts?.glob
  })
  return r.matches
}

export interface ShellResult {
  stdout: string
  stderr: string
  code: number
}
export async function companionShellExec(
  command: string,
  opts?: { timeoutMs?: number; cwd?: string }
): Promise<ShellResult> {
  return await call<ShellResult>('/shell/exec', {
    command,
    timeout_ms: opts?.timeoutMs,
    cwd: opts?.cwd
  })
}

/** Is the companion currently connected? */
export function companionConnected(): boolean {
  return state.connected
}

/** Bootstrap on app load — read saved config + try health check. */
export function initCompanion(): void {
  const cfg = loadCompanionConfig()
  if (!cfg) return
  state.config = cfg
  emit()
  refreshCompanion().then(() => {
    if (state.connected) startPermissionPoll()
  })
}
