/**
 * Tauri bridge: detects Tauri runtime and exposes a thin wrapper around
 * `invoke` that's safe to import from web code (no-op when not in Tauri).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

let cachedInvoke: InvokeFn | null = null
let detectedTauri: boolean | null = null

export function isTauri(): boolean {
  if (detectedTauri !== null) return detectedTauri
  if (typeof window === 'undefined') {
    detectedTauri = false
    return false
  }
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  detectedTauri = Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__)
  return detectedTauri
}

/** Lazy-load tauri invoke; returns null if not in Tauri. */
export async function getInvoke(): Promise<InvokeFn | null> {
  if (!isTauri()) return null
  if (cachedInvoke) return cachedInvoke
  try {
    const mod = await import(
      /* @vite-ignore */
      '@tauri-apps/api/core'
    )
    cachedInvoke = (mod as unknown as { invoke: InvokeFn }).invoke
    return cachedInvoke
  } catch {
    // @tauri-apps/api not bundled; some hosts inject a global instead
    const w = window as unknown as { __TAURI__?: { core?: { invoke?: InvokeFn } } }
    if (w.__TAURI__?.core?.invoke) {
      cachedInvoke = w.__TAURI__.core.invoke
      return cachedInvoke
    }
    return null
  }
}

export async function tauriInvoke<T = unknown>(
  cmd: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const inv = await getInvoke()
  if (!inv) throw new Error('Not running in Tauri — this command requires the desktop app.')
  return (await inv(cmd, args)) as T
}
