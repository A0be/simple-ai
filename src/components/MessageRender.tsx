import { useState } from 'react'
import type { ChatMessage } from '@/types'
import Markdown from './Markdown'
import ToolCallBlock from './ToolCallBlock'
import ThinkingIndicator from './ThinkingIndicator'

interface Props {
  message: ChatMessage
  streaming?: boolean
  toolResults: Record<string, { text: string; error?: boolean }>
  runningCalls: Map<string, string>
  retryInfo?: { attempt: number; total: number; reason: string } | null
}

/**
 * Render a single ChatMessage. Lifted out of ChatView.tsx in v1.0.8 to keep
 * the parent's state-management concerns separate from display logic.
 * Handles every role: tool messages are skipped (their results render inside
 * ToolCallBlock), system messages only render when display === 'normal',
 * thinking messages collapse into a compact toggle, user messages render
 * attachments + text, assistant messages render markdown + tool_calls.
 */
export default function MessageRender({
  message,
  streaming,
  toolResults,
  runningCalls,
  retryInfo,
}: Props) {
  const [thinkExpanded, setThinkExpanded] = useState(false)

  if (message.role === 'tool') return null

  if (message.role === 'system') {
    if (message.display !== 'normal') return null
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 whitespace-pre-wrap">
        {message.content}
      </div>
    )
  }

  if (message.display === 'thinking') {
    const isActive = streaming
    return (
      <div className="flex flex-col items-start">
        <button
          onClick={() => setThinkExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 py-1 transition-colors"
        >
          {isActive && (
            <span className="inline-block w-3 h-3 border-2 border-ink-300 border-t-ink-600 rounded-full animate-spin" />
          )}
          <span>{isActive ? '思考中…' : `思考完成（${message.content.length} 字）`}</span>
          <svg className={`w-3 h-3 transition-transform ${thinkExpanded ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
        </button>
        {thinkExpanded && (
          <div className="max-w-[92%] sm:max-w-[85%] rounded-xl px-3 py-2 bg-ink-50/60 border border-ink-100 text-ink-500 text-xs mt-1 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {message.content}
          </div>
        )}
      </div>
    )
  }

  const isUser = message.role === 'user'
  const hasToolCalls = !!message.tool_calls?.length

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 bg-ink-900 text-white rounded-br-md">
          {message.attachments?.map((att, i) => (
            att.type === 'image'
              ? <img key={i} src={att.data} alt={att.name} className="max-w-full max-h-48 rounded-lg mb-2" />
              : <div key={i} className="text-xs bg-white/10 rounded px-2 py-1 mb-2 truncate">{att.name}</div>
          ))}
          {message.content && <div className="whitespace-pre-wrap text-sm">{message.content}</div>}
        </div>
      </div>
    )
  }

  // assistant
  const showThinkingPlaceholder = streaming && !message.content && !hasToolCalls && !message.reasoning_content
  const hasReasoning = !!message.reasoning_content
  return (
    <div className="flex flex-col items-start gap-2">
      {hasReasoning && (
        <div className="flex flex-col items-start">
          <button
            onClick={() => setThinkExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 py-1 transition-colors"
          >
            {streaming && !message.content && (
              <span className="inline-block w-3 h-3 border-2 border-ink-300 border-t-ink-600 rounded-full animate-spin" />
            )}
            <span>
              {streaming && !message.content
                ? '思考中…'
                : `思考完成（${message.reasoning_content!.length} 字）`}
            </span>
            <svg className={`w-3 h-3 transition-transform ${thinkExpanded ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
          </button>
          {thinkExpanded && (
            <div className="max-w-[92%] sm:max-w-[85%] rounded-xl px-3 py-2 bg-ink-50/60 border border-ink-100 text-ink-500 text-xs mt-1 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {message.reasoning_content}
            </div>
          )}
        </div>
      )}
      {showThinkingPlaceholder && (
        <ThinkingIndicator
          variant={retryInfo ? 'retry' : 'thinking'}
          label={retryInfo ? `正在重试…(${retryInfo.attempt}/${retryInfo.total})` : undefined}
          sub={retryInfo?.reason}
        />
      )}
      {message.content && (
        <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-2.5 bg-ink-50 text-ink-900 rounded-bl-md">
          <Markdown content={message.content} />
          {streaming && (
            <span className="inline-block w-1.5 h-3.5 bg-ink-400 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
      )}
      {hasToolCalls && (
        <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-1.5">
          {message.tool_calls!.map((tc) => {
            const r = toolResults[tc.id]
            return (
              <ToolCallBlock
                key={tc.id}
                call={tc}
                resultText={r?.text}
                isError={r?.error}
                isRunning={runningCalls.has(tc.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
