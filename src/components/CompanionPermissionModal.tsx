import { useEffect, useState } from 'react'
import {
  type PermissionItem,
  subscribePermissions,
  resolvePermission,
  type Decision
} from '@/lib/companion'

const TOOL_LABELS: Record<string, string> = {
  FileRead: '读取文件',
  FileWrite: '写入文件',
  FileEdit: '编辑文件',
  Bash: '执行命令',
  Glob: '搜索文件',
  Grep: '搜索内容'
}

/**
 * Listens for companion permission requests and renders a modal. Mirrors
 * Claude Code's `handleInteractivePermission` flow — the user can pick
 * allow-once / allow-session / allow-always / deny.
 */
export default function CompanionPermissionModal() {
  const [queue, setQueue] = useState<PermissionItem[]>([])
  const [scopeChoice, setScopeChoice] = useState<string>('')

  useEffect(() => {
    return subscribePermissions((items) => {
      setQueue((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        const merged = [...prev]
        for (const it of items) if (!seen.has(it.id)) merged.push(it)
        return merged
      })
    })
  }, [])

  const current = queue[0]
  useEffect(() => {
    setScopeChoice(current?.suggested_scope?.[0] || '')
  }, [current?.id])

  if (!current) return null

  const resolve = async (decision: Decision) => {
    const scope = decision === 'allow-once' ? undefined : scopeChoice || undefined
    try {
      await resolvePermission(current.id, decision, scope)
    } catch (e) {
      console.error('resolvePermission failed', e)
    }
    setQueue((q) => q.filter((x) => x.id !== current.id))
  }

  const toolLabel = TOOL_LABELS[current.tool] || current.tool

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-3">
      <div className="card max-w-lg w-full p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            授权请求
          </span>
          <span className="text-sm font-semibold text-ink-900">{toolLabel}</span>
          {queue.length > 1 && (
            <span className="text-[10px] text-ink-500 ml-auto">还有 {queue.length - 1} 项待处理</span>
          )}
        </div>

        <div className="text-sm text-ink-800 mb-2 leading-relaxed">{current.summary}</div>

        {current.detail && (
          <pre className="text-xs bg-ink-50 border border-ink-200 rounded-lg p-2 mb-3 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-ink-700">
            {current.detail}
          </pre>
        )}

        {current.suggested_scope.length > 1 && (
          <div className="mb-3">
            <div className="label">允许范围（用于 session / always）</div>
            <div className="space-y-1">
              {current.suggested_scope.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-ink-50 rounded px-1.5 py-1"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={s}
                    checked={scopeChoice === s}
                    onChange={() => setScopeChoice(s)}
                  />
                  <code className="font-mono text-ink-700">{s}</code>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => resolve('allow-once')} className="btn-secondary text-sm">
            ✓ 仅此一次
          </button>
          <button onClick={() => resolve('allow-session')} className="btn-secondary text-sm">
            ✓ 本次会话允许
          </button>
          <button onClick={() => resolve('allow-always')} className="btn-primary text-sm">
            ✓ 始终允许
          </button>
          <button
            onClick={() => resolve('deny')}
            className="btn-secondary text-sm text-red-700 hover:bg-red-50"
          >
            ✗ 拒绝
          </button>
        </div>

        <div className="text-[11px] text-ink-400 mt-3 text-center">
          所有操作都被限制在你选择的工作目录内。session 允许在断开本机连接后失效。
        </div>
      </div>
    </div>
  )
}
