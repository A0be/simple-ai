import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '@/lib/features'
import { AGENTS, AGENT_CATEGORIES, agentsByCategory, getAgent } from '@/lib/agents'
import CollapsibleSection from '@/components/CollapsibleSection'
import { isConfigReady, loadConfig } from '@/lib/storage'
import { getFavorites, isFavorite, toggleFavorite, subscribeFavorites } from '@/lib/favorites'
import { IconStar, IconSend, IconStore, IconTerminal } from '@/components/Icons'

export default function Home() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [model, setModel] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [, setFavTick] = useState(0)

  useEffect(() => {
    const cfg = loadConfig()
    setReady(isConfigReady(cfg))
    setModel(cfg.model)
  }, [])

  useEffect(() => subscribeFavorites(() => setFavTick(t => t + 1)), [])

  const startChat = useCallback(() => {
    if (!chatInput.trim()) return
    if (!ready) { navigate('/settings'); return }
    navigate('/chat', { state: { initialMessage: chatInput.trim() } })
  }, [chatInput, ready, navigate])

  const favIds = getFavorites()
  const favAgents = favIds.map(id => getAgent(id)).filter(Boolean)
  const divFeatures = FEATURES.filter(f => f.category === 'divination')
  const sysFeatures = FEATURES.filter(f => f.category === 'system')

  return (
    <div className="space-y-4 pt-3">
      {/* ── Quick chat bar ── */}
      <div className="card p-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-transparent text-sm px-3 py-2.5 focus:outline-none placeholder-ink-400"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startChat()}
            placeholder="直接输入开始对话，或选择下方角色…"
          />
          <button onClick={startChat} disabled={!chatInput.trim()} className="btn-primary !py-2.5 !px-4 shrink-0">
            <IconSend />
          </button>
        </div>
        {!ready && (
          <button onClick={() => navigate('/settings')} className="w-full text-left text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            尚未配置 API → 点此设置
          </button>
        )}
        {ready && model && (
          <div className="text-[10px] text-ink-400 mt-1.5 px-1">当前模型: {model}</div>
        )}
      </div>

      {/* ── Favorites ── */}
      {favAgents.length > 0 && (
        <CollapsibleSection title="收藏" emoji="" count={favAgents.length} svgIcon={<IconStar filled />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {favAgents.map(a => a && (
              <AgentMiniCard key={a.id} agent={a} onNavigate={() => navigate(`/agent/${a.id}`)} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── AI 角色库 ── */}
      <CollapsibleSection title="AI 角色库" emoji="" subtitle={`${AGENTS.length} 个角色`} svgIcon={<IconStore />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {AGENT_CATEGORIES.map(cat => {
            const agents = agentsByCategory(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/agents?cat=${cat.id}`)}
                className="card card-hover p-3 text-left"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{cat.emoji}</span>
                  <span className="font-medium text-ink-900 text-xs">{cat.name}</span>
                  <span className="text-[10px] text-ink-400 ml-auto">{agents.length}</span>
                </div>
                <div className="text-[11px] text-ink-500 line-clamp-2">{cat.desc}</div>
              </button>
            )
          })}
        </div>
      </CollapsibleSection>

      {/* ── 命理参考 ── */}
      <CollapsibleSection title="命理参考" emoji="🔮" subtitle="传统智慧 + AI 解读" count={divFeatures.length}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {divFeatures.map(f => (
            <button key={f.id} onClick={() => navigate(f.path)} className="card card-hover p-3 text-left">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-base">{f.emoji}</span>
                <span className="font-medium text-ink-900 text-sm">{f.title}</span>
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">{f.description}</div>
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── 开发者 & 工具 ── */}
      <CollapsibleSection title="开发者工具" emoji="" subtitle="Agent / Plan / 工具链" svgIcon={<IconTerminal />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {sysFeatures.map(f => (
            <button key={f.id} onClick={() => navigate(f.path)} className="card card-hover p-3 text-left">
              <div className="font-medium text-ink-900 text-sm">{f.title}</div>
              <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">{f.description}</div>
            </button>
          ))}
          <button onClick={() => navigate('/tools')} className="card card-hover p-3 text-left">
            <div className="font-medium text-ink-900 text-sm">工具清单</div>
            <div className="text-[11px] text-ink-500 mt-0.5">查看全部可用工具</div>
          </button>
        </div>
      </CollapsibleSection>
    </div>
  )
}

function AgentMiniCard({ agent, onNavigate }: { agent: { id: string; emoji: string; name: string; desc: string }; onNavigate: () => void }) {
  const [fav, setFav] = useState(isFavorite(agent.id))
  return (
    <div className="card p-3 flex items-start gap-2 group">
      <button onClick={onNavigate} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{agent.emoji}</span>
          <span className="font-medium text-ink-900 text-xs truncate">{agent.name}</span>
        </div>
        <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-1">{agent.desc}</div>
      </button>
      <button
        onClick={() => setFav(toggleFavorite(agent.id))}
        className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title={fav ? '取消收藏' : '收藏'}
      >
        <IconStar filled={fav} className={fav ? 'text-amber-500' : 'text-ink-300'} />
      </button>
    </div>
  )
}
