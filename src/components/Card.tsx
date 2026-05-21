import { NavLink } from 'react-router-dom'
import type { FeatureCard } from '@/types'

export function FeatureCardItem({ feature }: { feature: FeatureCard }) {
  return (
    <NavLink
      to={feature.path}
      className="card card-hover p-5 flex flex-col gap-2 active:scale-[0.99]"
    >
      <div className="text-3xl">{feature.emoji}</div>
      <div className="font-semibold text-ink-900">{feature.title}</div>
      <div className="text-sm text-ink-500 leading-relaxed">{feature.description}</div>
    </NavLink>
  )
}

export function SectionTitle({
  title,
  subtitle
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">📭</div>
      <div className="font-medium text-ink-800">{title}</div>
      {description && <div className="text-sm text-ink-500 mt-1">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
