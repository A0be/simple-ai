import { useEffect, useState } from 'react'
import type { ApiConfig, CustomSkill } from '@/types'
import { loadConfig, saveConfig } from '@/lib/storage'
import {
  type Marketplace,
  type PluginEntry,
  loadMarketplaces,
  addMarketplaceFromUrl,
  deleteMarketplace,
  refreshMarketplace,
  loadInstalledPlugins,
  isInstalled,
  recordInstall,
  recordUninstall,
  installPlugin,
  marketplaceDisplayName,
} from '@/lib/marketplace'

function fmtAgo(ts?: number): string {
  if (!ts) return '从未刷新'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s 前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function MarketplaceManager() {
  const [urlInput, setUrlInput] = useState('')
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyPlugin, setBusyPlugin] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState(loadInstalledPlugins())

  useEffect(() => {
    setMarketplaces(loadMarketplaces())
  }, [])

  const handleAdd = async () => {
    setError(null)
    const m = addMarketplaceFromUrl(urlInput)
    if (!m) {
      setError('请输入有效的 GitHub 仓库 URL，例如 https://github.com/owner/repo')
      return
    }
    setUrlInput('')
    setMarketplaces(loadMarketplaces())
    // Auto-refresh manifest on add
    setBusyId(m.id)
    const updated = await refreshMarketplace(m)
    setBusyId(null)
    setMarketplaces(loadMarketplaces())
    setExpanded(new Set([m.id]))
    if (updated.error) setError(`${marketplaceDisplayName(updated)}: ${updated.error}`)
  }

  const handleRefresh = async (m: Marketplace) => {
    setError(null)
    setBusyId(m.id)
    const updated = await refreshMarketplace(m)
    setBusyId(null)
    setMarketplaces(loadMarketplaces())
    if (updated.error) setError(`${marketplaceDisplayName(updated)}: ${updated.error}`)
  }

  const handleDelete = (m: Marketplace) => {
    if (!confirm(`确认删除 marketplace「${marketplaceDisplayName(m)}」？已安装的 skill 不会被卸载。`)) return
    setMarketplaces(deleteMarketplace(m.id))
  }

  const toggleExpand = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleInstall = async (m: Marketplace, p: PluginEntry) => {
    setError(null)
    setBusyPlugin(`${m.id}:${p.name}`)
    try {
      const cfg = loadConfig()
      const existingNames = (cfg.customSkills || []).map((s) => s.name)
      const { skills, report } = await installPlugin(m, p, existingNames)
      if (!report.ok) {
        setError(`${p.name} 安装失败：${report.errors.join('; ')}`)
        return
      }
      const newSkills: CustomSkill[] = skills.map((s) => ({
        name: s.name,
        description: s.description,
        content: s.content,
        source: `marketplace:${m.owner}/${m.repo}#${p.name}`,
      }))
      const nextConfig: ApiConfig = {
        ...cfg,
        customSkills: [...(cfg.customSkills || []), ...newSkills],
      }
      saveConfig(nextConfig)
      setInstalled(
        recordInstall({
          marketplaceId: m.id,
          pluginName: p.name,
          version: p.version,
          installedAt: Date.now(),
          skillNames: report.installedSkillNames,
        }),
      )
      const reasons = report.skippedReasons.length ? `（${report.skippedReasons.join('；')}）` : ''
      setError(`✅ 已安装 ${skills.length} 个 skill${reasons}`)
    } catch (e) {
      setError(`安装异常：${(e as Error).message}`)
    } finally {
      setBusyPlugin(null)
    }
  }

  const handleUninstall = (m: Marketplace, p: PluginEntry) => {
    const installedEntry = installed.find((i) => i.marketplaceId === m.id && i.pluginName === p.name)
    if (!installedEntry) return
    if (!confirm(`确认卸载「${p.name}」？会移除 ${installedEntry.skillNames.length} 个相关 skill。`)) return
    const cfg = loadConfig()
    const keep = (cfg.customSkills || []).filter((s) => !installedEntry.skillNames.includes(s.name))
    saveConfig({ ...cfg, customSkills: keep })
    setInstalled(recordUninstall(m.id, p.name))
  }

  return (
    <details className="card p-4 text-sm">
      <summary className="cursor-pointer font-medium text-ink-800">
        🧩 插件市场（Claude Code 兼容）
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-ink-500 leading-relaxed">
          粘贴一个含 <code className="px-1 py-0.5 bg-ink-100 rounded text-[10px]">.claude-plugin/marketplace.json</code> 的 GitHub 仓库 URL，
          自动拉取并显示可装 plugin；点「安装」会把 plugin 里的 skill 注入到你的 Skills 列表。
        </p>

        <div className="flex gap-2">
          <input
            className="input !text-xs flex-1"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://github.com/owner/repo"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            spellCheck={false}
          />
          <button onClick={handleAdd} disabled={!urlInput.trim()} className="btn-primary text-xs whitespace-nowrap">
            + 添加
          </button>
        </div>

        {error && (
          <div className={`text-xs px-2 py-1.5 rounded ${error.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {error}
          </div>
        )}

        {marketplaces.length === 0 ? (
          <div className="text-xs text-ink-400 py-2">暂无 marketplace。试试 <span className="font-mono">https://github.com/affaan-m/everything-claude-code</span></div>
        ) : (
          <div className="space-y-2">
            {marketplaces.map((m) => {
              const exp = expanded.has(m.id)
              const isBusy = busyId === m.id
              return (
                <div key={m.id} className="rounded-lg border border-ink-200 bg-white">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-ink-800 truncate">{marketplaceDisplayName(m)}</div>
                      <div className="text-[10px] text-ink-500 truncate">
                        {m.owner}/{m.repo} · {m.manifest?.plugins.length ?? 0} plugin · {fmtAgo(m.fetchedAt)}
                        {m.error && <span className="text-red-600 ml-1">· ⚠️ {m.error}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleRefresh(m)} disabled={isBusy} className="text-[10px] text-sky-700 hover:text-sky-900 disabled:opacity-40">
                      {isBusy ? '...' : '刷新'}
                    </button>
                    <button onClick={() => toggleExpand(m.id)} className="text-[10px] text-ink-600 hover:text-ink-900">
                      {exp ? '收起' : '展开'}
                    </button>
                    <button onClick={() => handleDelete(m)} className="text-[10px] text-ink-400 hover:text-red-600">
                      ✕
                    </button>
                  </div>

                  {exp && m.manifest?.plugins && (
                    <div className="border-t border-ink-100 max-h-80 overflow-y-auto">
                      {m.manifest.plugins.map((p) => {
                        const installed_ = isInstalled(m.id, p.name)
                        const busy = busyPlugin === `${m.id}:${p.name}`
                        return (
                          <div key={p.name} className="flex items-start gap-2 px-3 py-2 border-b border-ink-50 last:border-b-0 hover:bg-ink-50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-ink-800">{p.name}</span>
                                {p.version && <span className="text-[10px] text-ink-400">v{p.version}</span>}
                                {p.category && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-violet-50 text-violet-700">
                                    {p.category}
                                  </span>
                                )}
                              </div>
                              {p.description && (
                                <div className="text-[10px] text-ink-500 leading-snug mt-0.5 line-clamp-2">{p.description}</div>
                              )}
                            </div>
                            {installed_ ? (
                              <button
                                onClick={() => handleUninstall(m, p)}
                                className="text-[10px] px-2 py-1 rounded bg-emerald-50 hover:bg-red-50 text-emerald-700 hover:text-red-700 shrink-0"
                                title="点击卸载"
                              >
                                ✓ 已安装
                              </button>
                            ) : (
                              <button
                                onClick={() => handleInstall(m, p)}
                                disabled={busy}
                                className="text-[10px] px-2 py-1 rounded bg-ink-200 hover:bg-ink-900 hover:text-white text-ink-700 shrink-0 disabled:opacity-40"
                              >
                                {busy ? '安装中...' : '安装'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </details>
  )
}
