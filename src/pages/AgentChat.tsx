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
    <div className="flex-1 min-h-0 flex flex-col pt-4">
      <div className="mb-3 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-2">← 返回</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{agent.emoji}</span>
          <h1 className="text-lg font-semibold text-ink-900">{agent.name}</h1>
          <span className="text-xs text-ink-400">{agent.nameEn}</span>
        </div>
        <div className="text-xs text-ink-500 mt-0.5">
          {cat && <span className="mr-2">{cat.emoji} {cat.name}</span>}
          {agent.desc}
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
