import { useEffect, useState, useCallback, useRef } from 'react'
import { isElectron } from '@/lib/electron'
import {
  type MiniTokenSession,
  type MiniTokenUserInfo,
  type MiniTokenToken,
  loadMiniTokenSession,
  saveMiniTokenSession,
  openMiniToken,
  fetchUserInfo,
  fetchTokens,
  formatQuota,
} from '@/lib/minitoken'

interface Props {
  onKeyFound?: (key: string) => void
}

export default function MiniTokenPanel({ onKeyFound }: Props) {
  const [session, setSession] = useState<MiniTokenSession | null>(null)
  const [user, setUser] = useState<MiniTokenUserInfo | null>(null)
  const [tokens, setTokens] = useState<MiniTokenToken[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const electron = isElectron()

  useEffect(() => {
    setSession(loadMiniTokenSession())
  }, [])

  // Listen for auto-detected session from Electron main process
  useEffect(() => {
    if (!electron) return
    const api = (window as any).electronAPI
    if (!api?.onMinitokenSession) return
    return api.onMinitokenSession((data: MiniTokenSession) => {
      saveMiniTokenSession(data)
      setSession(data)
    })
  }, [electron])

  const refreshData = useCallback(async (s: MiniTokenSession) => {
    setLoading(true)
    setError(null)
    try {
      const [u, t] = await Promise.all([
        fetchUserInfo(s),
        fetchTokens(s),
      ])
      if (u) setUser(u)
      else setError('获取用户信息失败，请重新登录')
      setTokens(t)
    } catch {
      setError('请求失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh on session load
  useEffect(() => {
    if (session) refreshData(session)
  }, [session, refreshData])

  // Auto-fill first available key on login
  useEffect(() => {
    if (!tokens.length || !onKeyFound) return
    const active = tokens.filter(t => t.status === 1)
    if (active.length && !autoKeyApplied.current) {
      autoKeyApplied.current = true
      const best = active[0]
      const k = best.key.startsWith('sk-') ? best.key : `sk-${best.key}`
      onKeyFound(k)
    }
  }, [tokens, onKeyFound])

  const autoKeyApplied = useRef(false)

  // Auto-refresh every 30s
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => refreshData(session), 30000)
    return () => clearInterval(id)
  }, [session, refreshData])

  const handleLogin = async () => {
    await openMiniToken()
  }

  const handleUseKey = (key: string) => {
    const k = key.startsWith('sk-') ? key : `sk-${key}`
    onKeyFound?.(k)
  }

  const handleRefreshAndApply = async () => {
    if (!session) return
    // Reset the auto-apply guard so the next tokens load re-applies the first
    // available key to Settings (covers re-issuing after a key was rotated).
    autoKeyApplied.current = false
    await refreshData(session)
  }

  const handleLogout = () => {
    saveMiniTokenSession(null)
    setSession(null)
    setUser(null)
    setTokens([])
  }

  // Not logged in
  if (!session || !user) {
    return (
      <div className="card p-4 bg-gradient-to-r from-sky-50 to-violet-50 border-sky-200">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0">🚀</div>
          <div className="flex-1">
            <div className="font-semibold text-ink-900">MiniToken 云算 API</div>
            <p className="text-xs text-ink-600 mt-1 leading-relaxed">
              一个 Key 调用 <strong>285+ 模型</strong>：Claude 4.5、GPT-5、Gemini 2.5、DeepSeek-R1、Grok-4、Qwen3 等。
              支持对话、绘画、视频生成、语音、Vision 图片识别。
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Claude', 'GPT', 'Gemini', 'DeepSeek', 'Grok', 'Qwen', 'Kimi', 'Midjourney'].map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 text-ink-600 border border-ink-200">{t}</span>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              {electron ? (
                <button onClick={handleLogin} className="btn-primary text-xs">
                  登录 MiniToken（登录后自动同步）
                </button>
              ) : (
                <a href="https://minitoken.top" target="_blank" rel="noreferrer"
                  className="btn-primary text-xs inline-block">
                  注册 / 登录 →
                </a>
              )}
            </div>
            {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
          </div>
        </div>
      </div>
    )
  }

  // Logged in — show dashboard
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <div>
            <div className="font-semibold text-ink-900 text-sm">MiniToken · {user.username}</div>
            {user.group && <span className="text-[10px] text-ink-400">分组: {user.group}</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleRefreshAndApply} disabled={loading} className="btn-ghost text-xs" title="重新从 MiniToken 拉取 key 与地址并写入 Settings">
            {loading ? '刷新中…' : '🔁 刷新 API'}
          </button>
          <button onClick={() => refreshData(session)} disabled={loading} className="btn-ghost text-xs" title="刷新余额和 API Key">
            {loading ? '…' : '🔄'}
          </button>
          {electron && (
            <button onClick={() => openMiniToken('/console')} className="btn-ghost text-xs">
              控制台
            </button>
          )}
          <button onClick={handleLogout} className="btn-ghost text-xs text-red-600">
            退出
          </button>
        </div>
      </div>

      {/* Group cost warning */}
      {user.group && user.group !== 'default' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
          <span className="text-amber-600 shrink-0 mt-0.5">⚠️</span>
          <div className="text-xs text-amber-800 leading-relaxed">
            <strong>当前分组: {user.group}</strong> — 非默认分组可能使用更高级模型自动路由，
            单次请求费用可能显著高于默认分组。建议在使用前确认<a href="https://minitoken.top/console" target="_blank" rel="noreferrer" className="underline">控制台</a>的分组倍率设置。
          </div>
        </div>
      )}

      {/* Balance */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-center">
          <div className="text-lg font-bold text-emerald-700">{formatQuota(user.quota)}</div>
          <div className="text-[10px] text-emerald-600">剩余额度</div>
        </div>
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-center">
          <div className="text-lg font-bold text-sky-700">{formatQuota(user.usedQuota)}</div>
          <div className="text-[10px] text-sky-600">已使用</div>
        </div>
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-2.5 text-center">
          <div className="text-lg font-bold text-violet-700">{user.requestCount.toLocaleString()}</div>
          <div className="text-[10px] text-violet-600">总请求数</div>
        </div>
      </div>

      {/* API Keys */}
      {tokens.length > 0 && (
        <div>
          <div className="text-xs font-medium text-ink-700 mb-1.5">API Key（点击自动填入）</div>
          {tokens.some(t => t.status === 1 && t.remain_quota < 0) && (
            <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1.5">
              部分令牌为无限额度，使用时请注意消费监控
            </div>
          )}
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {tokens.filter(t => t.status === 1).map(t => (
              <button
                key={t.id}
                onClick={() => handleUseKey(t.key)}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg bg-ink-50 hover:bg-ink-100 border border-ink-100 transition-colors flex items-center justify-between gap-2"
              >
                <span className="font-mono truncate">{t.key.slice(0, 8)}…{t.key.slice(-6)}</span>
                <span className="text-ink-400 shrink-0">{t.name || '默认'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  )
}
