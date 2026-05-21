import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AGENT_CATEGORIES, agentsByCategory, type AgentDef } from '@/lib/agents'
import CollapsibleSection from '@/components/CollapsibleSection'
import { isFavorite, toggleFavorite, subscribeFavorites } from '@/lib/favorites'
import { IconStar } from '@/components/Icons'

export default function Agents() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [, setFavTick] = useState(0)
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const q = search.trim().toLowerCase()

  useEffect(() => subscribeFavorites(() => setFavTick(t => t + 1)), [])

  // Auto-scroll to category from URL param
  const targetCat = searchParams.get('cat')
  useEffect(() => {
    if (targetCat && catRefs.current[targetCat]) {
      setTimeout(() => catRefs.current[targetCat]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [targetCat])

  const filteredByCategory = AGENT_CATEGORIES.map((cat) => {
    const agents = agentsByCategory(cat.id)
    if (!q) return { cat, agents }
    const filtered = agents.filter(
      (a) =>
        a.name.includes(q) ||
        a.nameEn.toLowerCase().includes(q) ||
        a.desc.includes(q) ||
        a.expertise.includes(q) ||
        a.whenToUse.includes(q)
    )
    return { cat, agents: filtered }
  }).filter((g) => g.agents.length > 0)

  const totalShown = filteredByCategory.reduce((s, g) => s + g.agents.length, 0)

  return (
    <div className="pt-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">AI 角色库</h1>
        <p className="text-xs text-ink-500 mt-1">{totalShown} 个专业角色，点击启动对话</p>
      </div>

      <input
        className="input"
        placeholder="搜索角色名、专业、关键词…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        spellCheck={false}
      />

      {filteredByCategory.map(({ cat, agents }) => (
        <div key={cat.id} ref={el => { catRefs.current[cat.id] = el }}>
          <CollapsibleSection
            title={cat.name}
            emoji={cat.emoji}
            subtitle={cat.desc}
            count={agents.length}
            defaultOpen={!q ? (targetCat ? cat.id === targetCat : true) : true}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {agents.map((a) => (
                <AgentCard key={a.id} agent={a} onClick={() => navigate(`/agent/${a.id}`)} />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      ))}

      {filteredByCategory.length === 0 && (
        <div className="card p-8 text-center">
          <div className="font-medium text-ink-800">没有找到匹配的角色</div>
          <div className="text-sm text-ink-500 mt-1">试试其他关键词</div>
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, onClick }: { agent: AgentDef; onClick: () => void }) {
  const [fav, setFav] = useState(isFavorite(agent.id))
  return (
    <div className="card p-3 text-left flex flex-col gap-1 group relative">
      <button onClick={onClick} className="flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{agent.emoji}</span>
          <div className="font-medium text-ink-900 text-xs leading-tight truncate">{agent.name}</div>
        </div>
        <div className="text-[10px] text-ink-400 truncate">{agent.nameEn}</div>
        <div className="text-[11px] text-ink-600 mt-0.5 line-clamp-2">{agent.desc}</div>
      </button>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 truncate max-w-[80%]">
          {agent.expertise.split('、')[0]}
        </span>
        <button
          onClick={() => setFav(toggleFavorite(agent.id))}
          className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <IconStar filled={fav} className={`w-3.5 h-3.5 ${fav ? 'text-amber-500' : 'text-ink-300'}`} />
        </button>
      </div>
    </div>
  )
}
