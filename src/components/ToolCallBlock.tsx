import { useState } from 'react'
import type { ToolCall } from '@/types'
import ThinkingIndicator from './ThinkingIndicator'

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
      case 'ImageGenerate':
        return (args.prompt || '').slice(0, 60)
      case 'VideoGenerate':
        return (args.prompt || '').slice(0, 60)
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
  TaskStop: '🛑',
  ImageGenerate: '🎨',
  VideoGenerate: '🎬'
}

function extractMediaFromResult(name: string, resultText?: string): { images?: string[]; videoUrl?: string } | null {
  if (!resultText) return null
  if (name === 'ImageGenerate') {
    const urls: string[] = []
    const re = /\[Image \d+\]: (https?:\/\/\S+|data:image\/\S+)/g
    let m
    while ((m = re.exec(resultText)) !== null) urls.push(m[1])
    if (urls.length) return { images: urls }
  }
  if (name === 'VideoGenerate') {
    const m = resultText.match(/Video URL: (https?:\/\/\S+)/)
    if (m) return { videoUrl: m[1] }
  }
  return null
}

async function downloadMedia(url: string, suggestedName: string): Promise<void> {
  // Best effort: for http(s) URLs we fetch+blob so `download` is honored even
  // when the response server didn't send Content-Disposition. data:/blob:
  // URLs use the anchor directly. If anything fails we fall back to opening
  // the URL in a new tab so the user can still save it manually.
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const resp = await fetch(url, { mode: 'cors' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = suggestedName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = suggestedName
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  } catch {
    window.open(url, '_blank')
  }
}

function inferExt(url: string, fallback: string): string {
  if (url.startsWith('data:')) {
    const m = /^data:([^;,]+)/.exec(url)
    if (m) {
      const mime = m[1]
      const ext = mime.split('/')[1]
      if (ext) return ext.split('+')[0]
    }
    return fallback
  }
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').pop() || ''
    const dot = last.lastIndexOf('.')
    if (dot > 0) return last.slice(dot + 1).toLowerCase().slice(0, 5)
  } catch { /* ignore */ }
  return fallback
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

  const media = extractMediaFromResult(call.name, resultText)

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

      {isRunning && (call.name === 'ImageGenerate' || call.name === 'VideoGenerate') && !media && (
        <div className="px-3 pb-3">
          <ThinkingIndicator
            variant={call.name === 'ImageGenerate' ? 'image' : 'video'}
            sub={call.name === 'VideoGenerate' ? '视频生成耗时较长，最长可能等待 10 分钟' : '通常 30-90 秒'}
          />
        </div>
      )}

      {media?.images && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {media.images.map((url, i) => {
            const ext = inferExt(url, 'png')
            const filename = `image-${Date.now()}-${i + 1}.${ext}`
            return (
              <div key={i} className="relative group">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <img src={url} alt={`Generated ${i + 1}`} className="max-w-full max-h-80 rounded-lg border border-ink-200 shadow-sm hover:shadow-md transition-shadow" loading="lazy" />
                </a>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadMedia(url, filename) }}
                  className="absolute top-1.5 right-1.5 px-2 py-1 rounded-md bg-black/55 hover:bg-black/75 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  title="下载原图"
                >
                  💾 下载
                </button>
              </div>
            )
          })}
        </div>
      )}

      {media?.videoUrl && (
        <div className="px-3 pb-3 space-y-1.5">
          <video src={media.videoUrl} controls className="max-w-full max-h-80 rounded-lg border border-ink-200" />
          <div>
            <button
              onClick={() => downloadMedia(media.videoUrl!, `video-${Date.now()}.${inferExt(media.videoUrl!, 'mp4')}`)}
              className="text-xs px-2.5 py-1 rounded-md bg-ink-900 hover:bg-ink-800 text-white"
              title="下载视频原文件"
            >
              💾 下载视频
            </button>
            <a
              href={media.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-xs text-sky-700 hover:text-sky-900"
            >
              在新标签打开
            </a>
          </div>
        </div>
      )}

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
