interface Props {
  active: boolean
  draft?: string
  onToggle?: () => void
}

export default function PlanBanner({ active, draft, onToggle }: Props) {
  if (!active && !draft) return null
  return (
    <div
      className={`rounded-xl px-3 py-2 mb-3 border text-sm flex items-start gap-2 ${
        active
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
      }`}
    >
      <span className="text-base shrink-0">{active ? '📋' : '✅'}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          {active ? 'Plan mode 进行中 — 只读工具可用' : 'Plan 已提交'}
        </div>
        {draft && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100">
              查看 plan 草稿 ({draft.length} 字符)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs bg-white/70 rounded p-2 max-h-72 overflow-y-auto">
              {draft}
            </pre>
          </details>
        )}
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="text-xs underline opacity-70 hover:opacity-100 shrink-0"
        >
          {active ? '退出' : '重新进入'}
        </button>
      )}
    </div>
  )
}
