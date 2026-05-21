/** Saved API configuration profiles for quick switching. */

const PROFILES_KEY = 'simple-ai:api-profiles'

export interface ApiProfile {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  source: 'manual' | 'minitoken'
  /** SOCKS5 proxy URL, e.g. socks5://127.0.0.1:1080 or socks5://user:pass@host:port. Empty = direct. */
  proxy?: string
  createdAt: number
  updatedAt: number
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadProfiles(): ApiProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ApiProfile[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persist(list: ApiProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list))
}

/**
 * Save a profile. If an existing profile shares the same baseUrl + apiKey,
 * update it in place (keep id, refresh updatedAt) — otherwise prepend a new one.
 */
export function upsertProfile(input: Omit<ApiProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ApiProfile[] {
  const list = loadProfiles()
  const now = Date.now()
  const idx = list.findIndex(p =>
    p.baseUrl === input.baseUrl && p.apiKey === input.apiKey
  )
  if (idx >= 0) {
    const existing = list[idx]
    list[idx] = {
      ...existing,
      name: input.name || existing.name,
      model: input.model || existing.model,
      source: input.source,
      // Only overwrite proxy when caller explicitly passed it; preserves the
      // user-configured proxy across re-applies of the same key from MiniToken.
      proxy: input.proxy !== undefined ? input.proxy : existing.proxy,
      updatedAt: now,
    }
  } else {
    list.unshift({
      id: input.id || genId(),
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      model: input.model,
      source: input.source,
      proxy: input.proxy,
      createdAt: now,
      updatedAt: now,
    })
  }
  const trimmed = list.slice(0, 30)
  persist(trimmed)
  return trimmed
}

/** Update only the proxy field on a profile. Returns the new list. */
export function setProfileProxy(id: string, proxy: string): ApiProfile[] {
  const list = loadProfiles()
  const p = list.find(x => x.id === id)
  if (p) {
    p.proxy = proxy || undefined
    p.updatedAt = Date.now()
    persist(list)
  }
  return list
}

/** Find the profile whose baseUrl+apiKey match the given config. */
export function findProfileForConfig(baseUrl: string, apiKey: string): ApiProfile | undefined {
  return loadProfiles().find(p => p.baseUrl === baseUrl && p.apiKey === apiKey)
}

export function deleteProfile(id: string): ApiProfile[] {
  const list = loadProfiles().filter(p => p.id !== id)
  persist(list)
  return list
}

export function renameProfile(id: string, name: string): ApiProfile[] {
  const list = loadProfiles()
  const p = list.find(x => x.id === id)
  if (p) { p.name = name; p.updatedAt = Date.now(); persist(list) }
  return list
}

/** Build a default profile name from URL + key tail. */
export function suggestProfileName(baseUrl: string, apiKey: string, source: ApiProfile['source']): string {
  try {
    const host = new URL(baseUrl).hostname.replace(/^www\./, '')
    const tail = apiKey.slice(-4)
    const tag = source === 'minitoken' ? 'MT' : ''
    return [tag, host, tail].filter(Boolean).join(' · ')
  } catch {
    return `${source} · ${apiKey.slice(-4)}`
  }
}
