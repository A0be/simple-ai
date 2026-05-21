/* eslint-disable @typescript-eslint/no-explicit-any */
import { isElectron } from './electron'

const STORAGE_KEY = 'simple-ai:minitoken'

export interface MiniTokenSession {
  session: string
  userId: string | null
  username: string | null
}

export interface MiniTokenUserInfo {
  quota: number
  usedQuota: number
  requestCount: number
  username: string
  group: string
}

export interface MiniTokenLogEntry {
  created_at: number
  model_name: string
  token_name: string
  quota: number
  prompt_tokens: number
  completion_tokens: number
  content: string
}

export interface MiniTokenToken {
  id: number
  key: string
  name: string
  status: number
  remain_quota: number
  used_quota: number
}

function api(): any {
  return (window as any).electronAPI
}

export function loadMiniTokenSession(): MiniTokenSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveMiniTokenSession(s: MiniTokenSession | null): void {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  else localStorage.removeItem(STORAGE_KEY)
}

export async function openMiniToken(path?: string): Promise<void> {
  if (isElectron()) {
    await api().minitokenOpen({ url: `https://minitoken.top${path || ''}` })
  } else {
    window.open(`https://minitoken.top${path || ''}`, '_blank')
  }
}

export async function extractSession(): Promise<MiniTokenSession | null> {
  if (!isElectron()) return null
  const result = await api().minitokenExtractSession()
  if (result?.session) {
    saveMiniTokenSession(result)
    return result
  }
  return null
}

async function callApi(path: string, session: MiniTokenSession): Promise<any> {
  if (isElectron()) {
    return await api().minitokenApi({
      apiPath: path,
      session: session.session,
      userId: session.userId,
    })
  }
  // Web fallback: direct fetch (may fail due to CORS)
  const resp = await fetch(`https://minitoken.top${path}`, {
    headers: {
      'Cookie': `session=${session.session}`,
      'new-api-user': session.userId || '',
    },
    credentials: 'include',
  })
  return await resp.json()
}

export async function fetchUserInfo(session: MiniTokenSession): Promise<MiniTokenUserInfo | null> {
  const r = await callApi('/api/user/self', session)
  if (!r?.success) return null
  const d = r.data
  return {
    quota: d.quota ?? 0,
    usedQuota: d.used_quota ?? 0,
    requestCount: d.request_count ?? 0,
    username: d.username || d.display_name || '',
    group: d.group || '',
  }
}

export async function fetchLogs(session: MiniTokenSession, page = 0): Promise<MiniTokenLogEntry[]> {
  const now = Math.floor(Date.now() / 1000)
  const start = now - 86400 * 7
  const r = await callApi(`/api/log/self?p=${page}&page_size=20&type=0&token_name=&model_name=&start_timestamp=${start}&end_timestamp=${now}&group=&user_id=`, session)
  if (!r?.success) return []
  return r.data?.logs || r.data || []
}

export async function fetchTokens(session: MiniTokenSession): Promise<MiniTokenToken[]> {
  const r = await callApi('/api/token/?p=0&size=100', session)
  if (!r?.success) return []
  return r.data?.data || r.data || []
}

/** Format NewAPI quota to readable string (quota is in 1/500000 of $1) */
export function formatQuota(quota: number): string {
  const dollars = quota / 500000
  if (dollars >= 1) return `$${dollars.toFixed(2)}`
  return `$${dollars.toFixed(4)}`
}
