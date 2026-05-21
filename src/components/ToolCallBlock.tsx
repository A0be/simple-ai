import { useState } from 'react'
import type { ToolCall } from '@/types'

interface Props {
  call: ToolCall
  resultText?: string
  isError?: boolean
  isRunning?: boolean
}

function summarizeArgs(name: string, raw: string): string {
  try {
    const args = JSON.parse(raw || '{}')
    switch (name) {
      case 'WebFetch':
        return args.url || ''
      case 'WebSearch':
        return args.query || ''
      case 'FileRead':
      case 'FileWrite':
      case 'FileEdit':
        return args.file_path || ''
      case 'Glob':
      case 'Grep':
        return args.pattern || ''
      case 'Bash':
        return (args.command || '').slice(0, 80)
      case 'AskUserQuestion':
        return args.question || ''
      case 'EnterPlanMode':
      case 'ExitPlanMode':
        return args.plan ? args.plan.slice(0, 80) + '…' : ''
      case 'Skill':
        return args.skill || ''
      case 'Agent':
        return args.description || ''
      case 'TodoWrite':
        return `${(args.todos || []).length} 条`
      case 'TaskCreate':
        return args.subject || ''
      case 'TaskUpdate':
        return `#${args.taskId} → ${args.status || '...'}`
      default:
        return Object.keys(args)
          .slice(0, 3)
          .map((k) => `${k}=${String(args[k]).slice(0, 30)}`)
          .join(', ')
    }
  } catch {
    return ''
  }
}

const ICONS: Record<string, string> = {
  WebFetch: '🌐',
  WebSearch: '🔍',
  FileRead: '📄',
  FileWrite: '✏️',
  FileEdit: '✏️',
  Glob: '📁',
  Grep: '🔎',
  Bash: '⌨️',
  AskUserQuestion: '❓',
  EnterPlanMode: '📋',
  ExitPlanMode: '✅',
  Skill: '🧠',
  Agent: '🤖',
  TodoWrite: '📝',
  TaskCreate: '➕',
  TaskList: '📋',
  TaskUpdate: '✏️',
  TaskGet: '🔍',
  TaskOutput: '📤',
  TaskStop: '🛑'
}

export default function ToolCallBlock({ call, resultText, isError, isRunning }: Props) {
  const [expanded, setExpanded] = useState(false)
  const icon = ICONS[call.name] ?? '🔧'
  const summary = summarizeArgs(call.name, call.arguments)
  const status = isRunning ? '运行中' : isError ? '失败' : '完成'
  const statusColor = isRunning
    ? 'text-blue-600 bg-blue-50 border-blue-200'
    : isError
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-green-700 bg-green-50 border-green-200'

  return (
    <div className="border border-ink-200 rounded-xl overflow-hidden bg-ink-50/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-ink-100 transition-colors text-left"
      >
        <span className="text-base shrink-0">{icon}</span>
        <span className="text-xs font-mono font-semibold text-ink-800 shrink-0">
          {call.name}
        </span>
        {summary && (
          <span className="text-xs text-ink-600 truncate flex-1 min-w-0">{summary}</span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColor} shrink-0`}>
          {status}
        </span>
        <span className="text-xs text-ink-400 shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-ink-200/60">
          <div>
            <div className="text-[10px] font-semibold text-ink-500 mt-2 mb-1">参数</div>
            <pre className="text-xs bg-white border border-ink-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {formatJson(call.arguments)}
            </pre>
          </div>
          {resultText !== undefined && (
            <div>
              <div className="text-[10px] font-semibold text-ink-500 mb-1">结果</div>
              <pre className="text-xs bg-white border border-ink-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
                {resultText.slice(0, 5000)}
                {resultText.length > 5000 && '\n...[truncated]'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw || '{}'), null, 2)
  } catch {
    return raw
  }
}
