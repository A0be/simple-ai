import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConversationMeta } from '@/types'
import {
  clearAllConversations,
  deleteConversation,
  loadConversations
} from '@/lib/storage'
import { getFeature } from '@/lib/features'
import { getAgent } from '@/lib/agents'
import { EmptyState } from '@/components/Card'

export default function History() {
  const navigate = useNavigate()
  const [convs, setConvs] = useState<ConversationMeta[]>([])

  const refresh = () => setConvs(loadConversations())

  useEffect(() => {
    refresh()
  }, [])

  const handleDelete = (id: string) => {
    if (confirm('确认删除这条记录？')) {
      deleteConversation(id)
      refresh()
    }
  }

  const handleClear = () => {
    if (confirm('确认清空所有记录？此操作不可撤销。')) {
      clearAllConversations()
      refresh()
    }
  }

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink-900">历史记录</h1>
        {convs.length > 0 && (
          <button onClick={handleClear} className="btn-ghost text-sm text-red-600 hover:bg-red-50">
            清空全部
          </button>
        )}
      </div>

      {convs.length === 0 ? (
        <EmptyState
          title="还没有对话记录"
          description="开始一段对话后会自动保存在这里"
          action={
            <button onClick={() => navigate('/')} className="btn-primary text-sm">
              去首页
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {convs.map((c) => {
            const lastMessage = c.messages
              .filter((m) => m.role !== 'system')
              .slice(-1)[0]
            return (
              <button
                key={c.id}
                onClick={() => {
                  // agent-xxx conversations route to /agent/xxx/:convId
                  if (c.feature.startsWith('agent-')) {
                    const agentId = c.feature.slice('agent-'.length)
                    navigate(`/agent/${agentId}/${c.id}`)
                  } else {
                    navigate(`/${c.feature}/${c.id}`)
                  }
                }}
                className="w-full card card-hover p-4 text-left active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {(() => {
                        if (c.feature.startsWith('agent-')) {
                          const agent = getAgent(c.feature.slice('agent-'.length))
                          return <>
                            <span className="text-lg">{agent?.emoji ?? '🤖'}</span>
                            <span className="text-xs text-ink-500">{agent?.name ?? c.feature}</span>
                          </>
                        }
                        const feature = getFeature(c.feature)
                        return <>
                          <span className="text-lg">{feature?.emoji ?? '💬'}</span>
                          <span className="text-xs text-ink-500">{feature?.title ?? c.feature}</span>
                        </>
                      })()}
                      <span className="text-xs text-ink-400">·</span>
                      <span className="text-xs text-ink-400">
                        {new Date(c.updatedAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="font-medium text-ink-900 mt-1 truncate">{c.title}</div>
                    {lastMessage && (
                      <div className="text-xs text-ink-500 mt-1 line-clamp-2">
                        {lastMessage.content.slice(0, 120)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(c.id)
                    }}
                    className="text-ink-400 hover:text-red-600 text-xs px-1 py-1"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
