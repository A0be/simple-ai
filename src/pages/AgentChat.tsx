import { useParams, Navigate, useNavigate } from 'react-router-dom'
import ChatView from '@/components/ChatView'
import { getAgent, getCategory } from '@/lib/agents'
import { getAgentPrompt } from '@/lib/prompts'

export default function AgentChat() {
  const { agentId, conversationId } = useParams<{ agentId: string; conversationId?: string }>()
  const navigate = useNavigate()
  if (!agentId) return <Navigate to="/agents" replace />

  const agent = getAgent(agentId)
  if (!agent) return <Navigate to="/agents" replace />

  const cat = getCategory(agent.cat)
  const prompt = getAgentPrompt(agent)

  return (
    <div className="flex-1 min-h-0 flex flex-col pt-2">
      <div className="mb-2 shrink-0 rounded-lg border border-ink-100 bg-white/70 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(-1)} className="text-xs text-ink-500 hover:text-ink-900 shrink-0">← 返回</button>
          <span className="text-base shrink-0">{agent.emoji}</span>
          <h1 className="text-sm font-semibold text-ink-900 truncate">{agent.name}</h1>
          <span className="hidden sm:inline text-xs text-ink-400 truncate">{agent.nameEn}</span>
          <span className="hidden md:inline text-xs text-ink-400 truncate">
            {cat ? `${cat.emoji} ${cat.name} · ` : ''}{agent.desc}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChatView
        featureId={`agent-${agent.id}`}
        featureTitle={agent.name}
        systemPrompt={prompt}
        placeholder={`向「${agent.name}」提问…`}
        conversationId={conversationId}
        presetSuggestions={[
          `你好，请介绍一下你的专业能力`,
          `${agent.whenToUse}，请给我一些建议`,
        ]}
        introNode={
          <div className="text-sm text-ink-600 leading-relaxed space-y-1">
            <p><strong>专业领域：</strong>{agent.expertise}</p>
            <p><strong>适用场景：</strong>{agent.whenToUse}</p>
          </div>
        }
      />
      </div>
    </div>
  )
}
