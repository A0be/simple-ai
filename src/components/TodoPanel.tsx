import type { TodoItem } from '@/types'

interface Props {
  todos: TodoItem[]
}

export default function TodoPanel({ todos }: Props) {
  if (!todos.length) return null
  return (
    <div className="card p-3 border border-ink-200 bg-ink-50/40">
      <div className="text-xs font-semibold text-ink-700 mb-2">📝 Todos</div>
      <ul className="space-y-1">
        {todos.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 mt-0.5">
              {t.status === 'completed'
                ? '✅'
                : t.status === 'in_progress'
                ? '▶️'
                : '⬜'}
            </span>
            <span
              className={
                t.status === 'completed'
                  ? 'text-ink-400 line-through'
                  : t.status === 'in_progress'
                  ? 'text-ink-900 font-medium'
                  : 'text-ink-700'
              }
            >
              {t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
