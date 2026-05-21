/**
 * CLI Detector — auto-detect local Claude Code, Codex, and other CLI tools.
 *
 * Detection flow:
 * 1. On app load (or companion connect), probe for known CLIs via shell.
 * 2. Cache results and expose a subscribe-able store.
 * 3. Tools / system prompt can check what's available.
 *
 * When no external CLI is found, the built-in agent loop is used as fallback.
 */

import { shellExec, localBackendAvailable } from './localBackend'

export interface CliInfo {
  id: string
  name: string
  command: string
  version: string | null
  available: boolean
}

export interface CliDetectorState {
  detected: boolean
  probing: boolean
  clis: CliInfo[]
  /** the "best" CLI to use: claude > codex > built-in */
  activeCli: CliInfo | null
}

const KNOWN_CLIS = [
  { id: 'claude', name: 'Claude Code', commands: ['claude'] },
  { id: 'codex', name: 'OpenAI Codex CLI', commands: ['codex'] },
  { id: 'aider', name: 'Aider', commands: ['aider'] },
  { id: 'cursor', name: 'Cursor CLI', commands: ['cursor'] },
]

let state: CliDetectorState = {
  detected: false,
  probing: false,
  clis: [],
  activeCli: null,
}
const listeners = new Set<(s: CliDetectorState) => void>()

function emit() {
  for (const l of listeners) l(state)
}

function setState(patch: Partial<CliDetectorState>) {
  state = { ...state, ...patch }
  emit()
}

export function subscribeCliDetector(fn: (s: CliDetectorState) => void): () => void {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

export function getCliDetectorState(): CliDetectorState {
  return state
}

async function probeOne(cmd: string): Promise<{ available: boolean; version: string | null }> {
  try {
    const r = await shellExec(`${cmd} --version`, { timeoutMs: 8000 })
    if (r.code === 0) {
      const ver = (r.stdout || r.stderr).trim().split('\n')[0].slice(0, 80)
      return { available: true, version: ver }
    }
    return { available: false, version: null }
  } catch {
    return { available: false, version: null }
  }
}

export async function detectClis(): Promise<CliDetectorState> {
  if (!localBackendAvailable()) {
    // No shell access — mark as detected with built-in fallback
    setState({ detected: true, probing: false, clis: [], activeCli: null })
    return state
  }

  setState({ probing: true })

  const results: CliInfo[] = []
  for (const known of KNOWN_CLIS) {
    for (const cmd of known.commands) {
      const r = await probeOne(cmd)
      results.push({
        id: known.id,
        name: known.name,
        command: cmd,
        version: r.version,
        available: r.available,
      })
      if (r.available) break
    }
  }

  const activeCli = results.find((c) => c.available && c.id === 'claude')
    || results.find((c) => c.available && c.id === 'codex')
    || results.find((c) => c.available)
    || null

  // Restore user's manual selection if it exists and is still available
  const savedId = localStorage.getItem('simple-ai:active-cli')
  const preferred = savedId ? results.find((c) => c.available && c.id === savedId) : null

  setState({ detected: true, probing: false, clis: results, activeCli: preferred || activeCli })
  return state
}

/** Manually select which CLI to use (null = built-in agent). Persisted to localStorage. */
export function setActiveCli(cliId: string | null): void {
  if (cliId) {
    const cli = state.clis.find((c) => c.id === cliId && c.available)
    if (cli) {
      localStorage.setItem('simple-ai:active-cli', cliId)
      setState({ activeCli: cli })
      return
    }
  }
  localStorage.removeItem('simple-ai:active-cli')
  setState({ activeCli: null })
}

/**
 * Run a prompt through the detected CLI in non-interactive / pipe mode.
 * Falls back to null if no CLI is available (caller should use built-in agent loop).
 */
export async function runViaCli(
  prompt: string,
  opts?: { cwd?: string; timeoutMs?: number; model?: string }
): Promise<{ stdout: string; stderr: string; code: number } | null> {
  const cli = state.activeCli
  if (!cli?.available || !localBackendAvailable()) return null

  let cmd: string
  if (cli.id === 'claude') {
    cmd = `${cli.command} -p ${escapeShellArg(prompt)}`
    if (opts?.model) cmd += ` --model ${escapeShellArg(opts.model)}`
  } else if (cli.id === 'codex') {
    cmd = `${cli.command} -q ${escapeShellArg(prompt)}`
  } else {
    cmd = `${cli.command} --message ${escapeShellArg(prompt)}`
  }

  try {
    return await shellExec(cmd, {
      cwd: opts?.cwd,
      timeoutMs: opts?.timeoutMs || 300_000,
    })
  } catch (e) {
    return { stdout: '', stderr: (e as Error).message, code: 1 }
  }
}

function escapeShellArg(s: string): string {
  // Simple heuristic: in a browser context we don't have process.platform,
  // so check navigator.userAgent for Windows instead.
  const isWin = typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '')
  if (isWin) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return `'${s.replace(/'/g, "'\\''")}'`
}

/**
 * Generate a system prompt fragment describing available CLI tools.
 */
export function cliCapabilitiesPrompt(): string {
  if (!state.detected || !state.activeCli) return ''

  const available = state.clis.filter((c) => c.available)
  if (!available.length) return ''

  const lines = available.map((c) => `- **${c.name}** (\`${c.command}\`) ${c.version || ''}`)
  return `\n## 本机可用 CLI 工具（已自动检测）\n${lines.join('\n')}\n\n当前优先使用：**${state.activeCli.name}**。你可以通过 Bash 工具直接调用它来执行复杂的开发任务。\n`
}
