const STORAGE_KEY = 'simple-ai:favorites'

let favorites: Set<string> = new Set()

try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) favorites = new Set(JSON.parse(raw))
} catch { /* ignore */ }

const listeners = new Set<() => void>()

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  for (const l of listeners) l()
}

export function isFavorite(id: string): boolean {
  return favorites.has(id)
}

export function toggleFavorite(id: string): boolean {
  if (favorites.has(id)) {
    favorites.delete(id)
  } else {
    favorites.add(id)
  }
  save()
  return favorites.has(id)
}

export function getFavorites(): string[] {
  return [...favorites]
}

export function subscribeFavorites(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
