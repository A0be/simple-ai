import { useState } from 'react'

export default function CollapsibleSection({
  title,
  subtitle,
  emoji,
  svgIcon,
  count,
  defaultOpen = true,
  children
}: {
  title: string
  subtitle?: string
  emoji?: string
  svgIcon?: React.ReactNode
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 group text-left mb-3"
      >
        <span
          className="text-ink-400 text-xs transition-transform duration-150"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>
        {svgIcon && <span className="text-ink-700">{svgIcon}</span>}
        {!svgIcon && emoji && <span className="text-base">{emoji}</span>}
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-ink-400 font-normal">{count}</span>
        )}
        {subtitle && (
          <span className="text-xs text-ink-500 font-normal hidden sm:inline">
            — {subtitle}
          </span>
        )}
      </button>
      {open && children}
    </div>
  )
}
