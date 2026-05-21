import { useEffect, useState } from 'react'

export interface AskQuestionRequest {
  question: string
  options: { label: string; description?: string; preview?: string }[]
  multiSelect?: boolean
  resolve: (val: { chosen: string[]; cancelled?: boolean; notes?: string }) => void
}

interface Props {
  request: AskQuestionRequest | null
}

export default function AskUserQuestionModal({ request }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [other, setOther] = useState('')
  const [showOther, setShowOther] = useState(false)

  useEffect(() => {
    setSelected(new Set())
    setOther('')
    setShowOther(false)
    setFocusedIndex(0)
  }, [request])

  if (!request) return null

  const choose = (label: string) => {
    if (request.multiSelect) {
      const next = new Set(selected)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      setSelected(next)
    } else {
      setSelected(new Set([label]))
    }
  }

  const submit = () => {
    const chosen = [...selected]
    if (showOther && other.trim()) chosen.push(`Other: ${other.trim()}`)
    if (!chosen.length) return
    request.resolve({ chosen })
  }

  const cancel = () => {
    request.resolve({ chosen: [], cancelled: true })
  }

  const hasPreview = request.options.some((o) => o.preview)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-3xl w-full ${hasPreview ? 'sm:max-w-4xl' : ''} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="p-5 border-b border-ink-200">
          <div className="text-xs text-ink-500 mb-1">AI 正在询问</div>
          <h2 className="text-lg font-semibold text-ink-900">{request.question}</h2>
          {request.multiSelect && (
            <div className="text-xs text-ink-500 mt-1">（可多选）</div>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto ${hasPreview ? 'sm:grid sm:grid-cols-2' : ''}`}>
          <div className="p-3 space-y-2">
            {request.options.map((opt, i) => {
              const isSel = selected.has(opt.label)
              return (
                <button
                  key={i}
                  onClick={() => {
                    setFocusedIndex(i)
                    choose(opt.label)
                  }}
                  onMouseEnter={() => setFocusedIndex(i)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${
                    isSel
                      ? 'border-ink-900 bg-ink-50'
                      : 'border-ink-200 hover:border-ink-400 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border-2 shrink-0 ${
                        isSel ? 'border-ink-900 bg-ink-900' : 'border-ink-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-ink-900">{opt.label}</div>
                      {opt.description && (
                        <div className="text-xs text-ink-600 mt-0.5">{opt.description}</div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            <button
              onClick={() => setShowOther(!showOther)}
              className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all ${
                showOther
                  ? 'border-ink-900 bg-ink-50'
                  : 'border-dashed border-ink-300 hover:border-ink-400 bg-white'
              }`}
            >
              <div className="text-sm font-medium text-ink-700">+ Other (自定义)</div>
            </button>
            {showOther && (
              <textarea
                autoFocus
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="输入你自己的答案"
                rows={2}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-300"
              />
            )}
          </div>

          {hasPreview && (
            <div className="hidden sm:block p-5 bg-ink-50 border-l border-ink-200 overflow-y-auto">
              {request.options[focusedIndex]?.preview ? (
                <pre className="text-xs text-ink-800 whitespace-pre-wrap font-mono">
                  {request.options[focusedIndex].preview}
                </pre>
              ) : (
                <div className="text-xs text-ink-400">（此选项无预览）</div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-ink-200 flex items-center justify-between gap-2">
          <button onClick={cancel} className="btn-ghost py-2 px-3 text-sm">
            取消
          </button>
          <button
            onClick={submit}
            disabled={!selected.size && !other.trim()}
            className="btn-primary !py-2 !px-5 text-sm"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
