interface Props {
  /** Optional label shown next to the spinner. Defaults to 思考中… */
  label?: string
  /** Color theme — auto uses violet for thinking, sky for image, emerald for video */
  variant?: 'thinking' | 'image' | 'video' | 'retry'
  /** Sub-line (e.g. retry attempt counter) */
  sub?: string
}

const VARIANTS = {
  thinking: { color: '#7c3aed', label: '思考中…', emoji: '💭' },
  image: { color: '#0ea5e9', label: '正在生成图像…', emoji: '🎨' },
  video: { color: '#10b981', label: '正在生成视频…', emoji: '🎬' },
  retry: { color: '#f59e0b', label: '正在重试…', emoji: '🔄' },
} as const

export default function ThinkingIndicator({ label, variant = 'thinking', sub }: Props) {
  const v = VARIANTS[variant]
  const text = label || v.label
  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-ink-50/70 border border-ink-200/60">
      <span className="text-base shrink-0" aria-hidden="true">{v.emoji}</span>
      <svg viewBox="0 0 40 16" width="40" height="16" className="shrink-0" aria-hidden="true">
        <circle cx="6" cy="8" r="3" fill={v.color}>
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0s" />
          <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" begin="0s" />
        </circle>
        <circle cx="20" cy="8" r="3" fill={v.color}>
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0.2s" />
          <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" begin="0.2s" />
        </circle>
        <circle cx="34" cy="8" r="3" fill={v.color}>
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0.4s" />
          <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" begin="0.4s" />
        </circle>
      </svg>
      <div className="flex flex-col">
        <span className="text-xs text-ink-700">{text}</span>
        {sub && <span className="text-[10px] text-ink-500 mt-0.5">{sub}</span>}
      </div>
    </div>
  )
}
