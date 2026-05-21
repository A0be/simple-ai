import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  type TerminalSession,
  loadSessions,
  deleteSession,
  clearSessions,
} from '@/lib/terminalHistory'

interface Props {
  open: boolean
  onClose: () => void
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(start: number, end: number): string {
  const s = Math.max(0, Math.round((end - start) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${s % 60}s`
  return `${Math.floor(m / 60)}h${m % 60}m`
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(2)}MB`
}

export default function TerminalHistoryDrawer({ open, onClose }: Props) {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (open) {
      const list = loadSessions()
      setSessions(list)
      setActiveId(list[0]?.id ?? null)
    }
  }, [open])

  // Init read-only terminal lazily once the player div is in the DOM. We depend
  // on sessions.length because the player div is only rendered when there are
  // sessions to show — without this dep the effect runs while playerRef is null
  // and never re-runs after sessions load.
  useEffect(() => {
    if (!open || !playerRef.current || sessions.length === 0) return
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#1e1e2e',
        selectionBackground: '#585b7066',
      },
      cursorBlink: false,
      disableStdin: true,
      convertEol: true,
      scrollback: 5000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(playerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const ro = new ResizeObserver(() => { try { fit.fit() } catch { /* noop */ } })
    ro.observe(playerRef.current)

    // Replay the currently selected session immediately so the user sees content
    // on first click rather than a black screen.
    const session = sessions.find(s => s.id === activeId)
    if (session) term.write(session.rawOutput)

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [open, sessions.length === 0])

  // Replay selected session
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.reset()
    if (!activeId) return
    const session = sessions.find(s => s.id === activeId)
    if (!session) return
    term.write(session.rawOutput)
  }, [activeId, sessions])

  const handleDelete = (id: string) => {
    const next = deleteSession(id)
    setSessions(next)
    if (activeId === id) setActiveId(next[0]?.id ?? null)
  }

  const handleClearAll = () => {
    if (!confirm('确认清空全部历史记录？此操作不可恢复。')) return
    clearSessions()
    setSessions([])
    setActiveId(null)
  }

  if (!open) return null

  const active = sessions.find(s => s.id === activeId) || null

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#1e1e2e] border border-ink-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-ink-900 border-b border-ink-800">
        <span className="text-sm font-medium text-zinc-100">📚 终端历史记录（{sessions.length}）</span>
        <div className="flex-1" />
        {sessions.length > 0 && (
          <button onClick={handleClearAll} className="text-xs text-red-300 hover:text-red-200">
            清空全部
          </button>
        )}
        <button onClick={onClose} className="text-zinc-300 hover:text-white text-sm px-2">
          ✕ 关闭
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          暂无历史记录。终端会话结束后会自动保存。
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Session list */}
          <div className="w-64 shrink-0 border-r border-ink-800 overflow-y-auto bg-[#181825]">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full text-left px-3 py-2 border-b border-ink-800 transition-colors ${
                  activeId === s.id ? 'bg-[#313244]' : 'hover:bg-[#252537]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    s.mode === 'claude' ? 'bg-violet-900 text-violet-200' : 'bg-sky-900 text-sky-200'
                  }`}>
                    {s.mode === 'claude' ? 'Claude' : 'Shell'}
                  </span>
                  <span className="text-zinc-300">{fmtTime(s.startedAt)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDelete(s.id) } }}
                    className="ml-auto text-zinc-500 hover:text-red-400 text-xs cursor-pointer"
                    title="删除"
                  >✕</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 truncate" title={s.cwd}>
                  {s.cwd || '(no cwd)'}
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5 flex gap-2">
                  <span>⏱ {fmtDuration(s.startedAt, s.endedAt)}</span>
                  <span>📦 {fmtSize(s.rawOutput.length)}</span>
                  {s.exitCode != null && <span>exit {s.exitCode}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Player */}
          <div className="flex-1 min-w-0 flex flex-col">
            {active && (
              <div className="px-3 py-1.5 bg-[#181825] border-b border-ink-800 text-[11px] text-zinc-400 flex gap-3 flex-wrap">
                <span>{fmtTime(active.startedAt)} → {fmtTime(active.endedAt)}</span>
                <span className="truncate">cwd: {active.cwd || '(none)'}</span>
                <span>{fmtSize(active.rawOutput.length)}</span>
              </div>
            )}
            <div ref={playerRef} className="flex-1 min-h-0" />
          </div>
        </div>
      )}
    </div>
  )
}
