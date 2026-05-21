/* eslint-disable @typescript-eslint/no-explicit-any */

let detected: boolean | null = null

export function isElectron(): boolean {
  if (detected !== null) return detected
  if (typeof window === 'undefined') {
    detected = false
    return false
  }
  detected = Boolean((window as any).electronAPI)
  return detected
}

function api(): any {
  return (window as any).electronAPI
}

export async function electronFsRead(path: string, offset = 0, limit = 0): Promise<string> {
  return api().fsRead({ path, offset, limit })
}

export async function electronFsWrite(path: string, content: string): Promise<void> {
  return api().fsWrite({ path, content })
}

export async function electronFsGlob(pattern: string, base?: string): Promise<string[]> {
  return api().fsGlob({ pattern, base })
}

export async function electronFsGrep(
  pattern: string,
  opts?: { path?: string; glob?: string; mode?: string; ci?: boolean }
): Promise<string> {
  return api().fsGrep({
    pattern,
    base: opts?.path,
    glob: opts?.glob,
    mode: opts?.mode || 'files_with_matches',
    ci: !!opts?.ci,
  })
}

export interface ShellResult {
  stdout: string
  stderr: string
  code: number
}

export async function electronShellExec(
  command: string,
  opts?: { cwd?: string; timeoutMs?: number }
): Promise<ShellResult> {
  return api().shellExec({
    command,
    cwd: opts?.cwd,
    timeoutMs: opts?.timeoutMs || 120_000,
  })
}

export async function electronPickWorkspace(): Promise<string | null> {
  return api().pickWorkspace()
}

export async function electronSetWorkspace(path: string): Promise<string | null> {
  return api().setWorkspace(path)
}

export async function electronGetWorkspace(): Promise<string | null> {
  return api().getWorkspace()
}
