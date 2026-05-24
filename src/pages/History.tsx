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

  const enterConversation = (c: ConversationMeta) => {
    if (c.feature.startsWith('agent-')) {
      const agentId = c.feature.slice('agent-'.length)
      navigate(`/agent/${agentId}/${c.id}`)
    } else {
      navigate(`/${c.feature}/${c.id}`)
    }
  }

  return (
    <div className="pt-3 sm:pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">历史记录</h1>
          <p className="mt-0.5 text-xs text-ink-500">点击记录可重新进入会话并继续对话</p>
        </div>
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {convs.map((c) => {
            const lastMessage = c.messages
              .filter((m) => m.role !== 'system')
              .slice(-1)[0]
            const hasImage = c.messages.some((m) => m.name === 'ImageGenerate' || m.content.includes('app-media://'))
            return (
              <article
                key={c.id}
                className="card card-hover flex min-h-[150px] flex-col p-4 text-left active:scale-[0.995]"
                onClick={() => enterConversation(c)}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => enterConversation(c)}>
                    <div className="flex min-w-0 items-center gap-2">
                      {(() => {
                        if (c.feature.startsWith('agent-')) {
                          const agent = getAgent(c.feature.slice('agent-'.length))
                          return <>
                            <span className="shrink-0 text-lg">{agent?.emoji ?? '🤖'}</span>
                            <span className="truncate text-xs text-ink-500">{agent?.name ?? c.feature}</span>
                          </>
                        }
                        const feature = getFeature(c.feature)
                        return <>
                          <span className="shrink-0 text-lg">{feature?.emoji ?? '💬'}</span>
                          <span className="truncate text-xs text-ink-500">{feature?.title ?? c.feature}</span>
                        </>
                      })()}
                      {hasImage && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">含图片</span>}
                    </div>
                    <div className="mt-1 truncate font-medium text-ink-900">{c.title}</div>
                    {lastMessage && (
                      <div className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-500">
                        {lastMessage.content.slice(0, 180)}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(c.id)
                    }}
                    className="shrink-0 px-1 py-1 text-xs text-ink-400 hover:text-red-600"
                    title="删除"
                  >
                    x
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="text-xs text-ink-400">
                        {new Date(c.updatedAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      enterConversation(c)
                    }}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                  >
                    继续会话
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
