/**
 * Workspace store — shared across CompanionStatus, ChatView, and tools.
 * In Electron: set via file picker. In companion mode: set via companion API.
 */

const STORAGE_KEY = 'simple-ai:workspace'

let workspace: string | null = localStorage.getItem(STORAGE_KEY)
const listeners = new Set<(ws: string | null) => void>()

function emit() {
  for (const l of listeners) l(workspace)
}

export function getWorkspace(): string | null {
  return workspace
}

export function setWorkspaceStore(ws: string | null): void {
  workspace = ws
  if (ws) localStorage.setItem(STORAGE_KEY, ws)
  else localStorage.removeItem(STORAGE_KEY)
  emit()
}

export function subscribeWorkspace(fn: (ws: string | null) => void): () => void {
  listeners.add(fn)
  fn(workspace)
  return () => listeners.delete(fn)
}
