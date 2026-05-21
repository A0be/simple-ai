/**
 * Unified file/shell backend. Picks Tauri commands when running as a Tauri
 * desktop app, or the local companion HTTP server when the user has connected
 * one from the web build. Both backends accept the same arguments.
 *
 * Tools (FileRead, FileWrite, …) can call these helpers without caring which
 * runtime is active.
 */
import { isElectron, electronFsRead, electronFsWrite, electronFsGlob, electronFsGrep, electronShellExec } from '@/lib/electron'
import { isTauri, tauriInvoke } from '@/lib/tauri'
import {
  companionConnected,
  companionFsRead,
  companionFsWrite,
  companionFsGlob,
  companionFsGrep,
  companionShellExec
} from '@/lib/companion'

export class NoBackendError extends Error {
  constructor() {
    super(
      '本地工具不可用。请使用 Tauri 桌面版，或在 Web 版中点击右上角「连接本机」启动并连接 simple-ai 本地助手。'
    )
  }
}

function hasLocal(): boolean {
  return isElectron() || isTauri() || companionConnected()
}

function ensureLocal() {
  if (!hasLocal()) throw new NoBackendError()
}

export async function fsRead(path: string, offset = 0, limit = 0): Promise<string> {
  ensureLocal()
  if (isElectron()) return await electronFsRead(path, offset, limit)
  if (isTauri()) {
    return await tauriInvoke<string>('fs_read', { path, offset, limit })
  }
  return await companionFsRead({ path, offset, limit })
}

export async function fsWrite(path: string, content: string): Promise<void> {
  ensureLocal()
  if (isElectron()) return await electronFsWrite(path, content)
  if (isTauri()) {
    await tauriInvoke('fs_write', { path, content })
    return
  }
  await companionFsWrite(path, content)
}

export async function fsGlob(pattern: string, base = ''): Promise<string[]> {
  ensureLocal()
  if (isElectron()) return await electronFsGlob(pattern, base || undefined)
  if (isTauri()) {
    return await tauriInvoke<string[]>('fs_glob', { pattern, base })
  }
  return await companionFsGlob(pattern, base || undefined)
}

export async function fsGrep(
  pattern: string,
  opts?: { path?: string; glob?: string; mode?: 'files_with_matches' | 'content' | 'count'; ci?: boolean }
): Promise<string> {
  ensureLocal()
  if (isElectron()) return await electronFsGrep(pattern, opts)
  if (isTauri()) {
    return await tauriInvoke<string>('fs_grep', {
      pattern,
      base: opts?.path || '',
      glob: opts?.glob || '',
      mode: opts?.mode || 'files_with_matches',
      ci: !!opts?.ci
    })
  }
  const matches = await companionFsGrep(pattern, opts)
  if (!matches.length) return ''
  switch (opts?.mode || 'files_with_matches') {
    case 'count':
      return String(matches.length)
    case 'content':
      return matches.map((m) => `${m.file}:${m.line}: ${m.text}`).join('\n')
    case 'files_with_matches':
    default: {
      const files = Array.from(new Set(matches.map((m) => m.file)))
      return files.join('\n')
    }
  }
}

export interface ShellResult {
  stdout: string
  stderr: string
  code: number
}

export async function shellExec(
  command: string,
  opts?: { cwd?: string; timeoutMs?: number }
): Promise<ShellResult> {
  ensureLocal()
  if (isElectron()) return await electronShellExec(command, opts)
  if (isTauri()) {
    return await tauriInvoke<ShellResult>('shell_exec', {
      command,
      cwd: opts?.cwd || '',
      timeoutMs: opts?.timeoutMs || 120_000
    })
  }
  return await companionShellExec(command, { cwd: opts?.cwd, timeoutMs: opts?.timeoutMs })
}

export function localBackendAvailable(): boolean {
  return hasLocal()
}
