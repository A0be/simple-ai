/** Persisted Claude Code / shell terminal session history. */

const HISTORY_KEY = 'simple-ai:terminal-history'

export interface TerminalSession {
  id: string
  startedAt: number
  endedAt: number
  cwd: string
  mode: 'claude' | 'shell'
  /** Raw stdout buffer including ANSI escape sequences. */
  rawOutput: string
  /** Process exit code, null when killed by user. */
  exitCode: number | null
}

const MAX_SESSIONS = 20
const MAX_SIZE_PER_SESSION = 1024 * 1024 // 1MB per session
const TRUNCATE_MARKER = '\r\n\x1b[33m[…earlier output truncated due to size limit…]\x1b[0m\r\n\r\n'

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadSessions(): TerminalSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as TerminalSession[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persist(list: TerminalSession[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    // quota exceeded — drop the oldest half and retry once
    const half = list.slice(0, Math.max(1, Math.floor(list.length / 2)))
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(half)) } catch { /* give up */ }
  }
}

function truncate(raw: string): string {
  if (raw.length <= MAX_SIZE_PER_SESSION) return raw
  const tail = raw.slice(raw.length - MAX_SIZE_PER_SESSION + TRUNCATE_MARKER.length)
  return TRUNCATE_MARKER + tail
}

/**
 * Save a finished terminal session. Skips empty outputs.
 * Returns the new session list.
 */
export function saveSession(input: Omit<TerminalSession, 'id'>): TerminalSession[] {
  if (!input.rawOutput.trim()) return loadSessions()
  const list = loadSessions()
  list.unshift({
    id: genId(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    cwd: input.cwd,
    mode: input.mode,
    rawOutput: truncate(input.rawOutput),
    exitCode: input.exitCode,
  })
  const trimmed = list.slice(0, MAX_SESSIONS)
  persist(trimmed)
  return trimmed
}

export function deleteSession(id: string): TerminalSession[] {
  const list = loadSessions().filter(s => s.id !== id)
  persist(list)
  return list
}

export function clearSessions(): void {
  localStorage.removeItem(HISTORY_KEY)
}
