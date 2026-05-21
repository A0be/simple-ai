import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildRegistry } from '@/lib/tools'
import { listSkills } from '@/lib/skills'
import { isTauri } from '@/lib/tauri'
import { SLASH_COMMANDS } from '@/lib/slash'

const CATEGORY_LABEL: Record<string, string> = {
  core: '核心',
  plan: '计划',
  task: '任务',
  web: '网络',
  fs: '文件',
  shell: '终端',
  agent: '代理',
  memory: '记忆',
  misc: '其它'
}

export default function Tools() {
  const navigate = useNavigate()
  const registry = useMemo(() => buildRegistry(), [])
  const tauri = isTauri()
  const env = tauri ? 'tauri' : 'web'
  const tools = useMemo(() => registry.list(env), [registry, env])
  const skills = useMemo(() => listSkills(), [])

  // group by category
  const byCat: Record<string, typeof tools> = {}
  for (const t of tools) {
    const k = t.category || 'misc'
    if (!byCat[k]) byCat[k] = []
    byCat[k].push(t)
  }

  return (
    <div className="pt-4 pb-10">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-3">
        ← 返回
      </button>
      <h1 className="text-xl font-semibold text-ink-900">工具清单</h1>
      <div className="text-xs text-ink-500 mt-1">
        当前运行时：
        <span
          className={`ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] border ${
            tauri
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}
        >
          {tauri ? 'Tauri 桌面' : 'Web 浏览器'}
        </span>
        {!tauri && (
          <span className="ml-1">（FS / Bash / Glob / Grep 仅 Tauri 桌面可用）</span>
        )}
      </div>

      <h2 className="text-base font-semibold text-ink-900 mt-6 mb-2">工具（{tools.length}）</h2>
      <div className="space-y-4">
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-xs font-semibold text-ink-500 mb-2">
              {CATEGORY_LABEL[cat] || cat} · {list.length}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((t) => (
                <div key={t.name} className="card p-3">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-semibold text-ink-900">{t.name}</code>
                    {t.env === 'tauri' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Tauri
                      </span>
                    )}
                    {t.planSafe === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                        plan 不允许
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-600 mt-1">{t.description}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold text-ink-900 mt-8 mb-2">Skills（{skills.length}）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {skills.map((s) => (
          <div key={s.name} className="card p-3">
            <div className="font-mono text-sm font-semibold text-ink-900">{s.name}</div>
            <div className="text-xs text-ink-600 mt-1">{s.description}</div>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold text-ink-900 mt-8 mb-2">
        Slash 命令（{SLASH_COMMANDS.length}）
      </h2>
      <div className="card p-3 text-xs text-ink-700 space-y-1.5">
        {SLASH_COMMANDS.map((c) => (
          <div key={c.name} className="flex items-start gap-3">
            <code className="font-semibold text-ink-900 shrink-0">
              /{c.name}
              {c.args ? ` ${c.args}` : ''}
            </code>
            <span className="text-ink-600">{c.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
