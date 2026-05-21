import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomSkill } from '@/types'
import { loadConfig, saveConfig } from '@/lib/storage'
import {
  BUILTIN_SKILLS,
  getCustomSkills,
  loadCustomSkillsFromConfig,
  loadCustomSkillsFromDir,
  setCustomSkills
} from '@/lib/skills'
import { isTauri } from '@/lib/tauri'

export default function SkillsPage() {
  const navigate = useNavigate()
  const [custom, setCustom] = useState<CustomSkill[]>([])
  const [skillsDir, setSkillsDir] = useState('')
  const [editing, setEditing] = useState<CustomSkill | null>(null)
  const [reloadMsg, setReloadMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const cfg = loadConfig()
    setSkillsDir(cfg.skillsDir || '')
    setCustom(cfg.customSkills || [])
    // Make sure module overlay is in sync with what's shown.
    loadCustomSkillsFromConfig(cfg.customSkills)
  }, [])

  const persist = (next: CustomSkill[]) => {
    setCustom(next)
    setCustomSkills(next)
    const cfg = loadConfig()
    saveConfig({ ...cfg, customSkills: next })
  }

  const save = (s: CustomSkill) => {
    const existing = custom.findIndex((c) => c.name === s.name)
    const next = [...custom]
    if (existing >= 0) next[existing] = s
    else next.push(s)
    persist(next)
    setEditing(null)
  }

  const remove = (name: string) => {
    persist(custom.filter((c) => c.name !== name))
  }

  const saveDir = () => {
    const cfg = loadConfig()
    saveConfig({ ...cfg, skillsDir })
  }

  const reloadFromDisk = async () => {
    if (!skillsDir) {
      setReloadMsg({ ok: false, msg: '请先填写 skillsDir。' })
      return
    }
    saveDir()
    try {
      const loaded = await loadCustomSkillsFromDir(skillsDir)
      const merged = getCustomSkills()
      persist(merged)
      setReloadMsg({
        ok: true,
        msg: `✅ 从 ${skillsDir} 加载 ${loaded.length} 个 skill，当前共 ${merged.length} 个 custom skill。`
      })
    } catch (e) {
      setReloadMsg({ ok: false, msg: `❌ ${(e as Error).message}` })
    }
  }

  const builtinShadowed = new Set(custom.map((c) => c.name))

  return (
    <div className="pt-4 pb-10 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-3">
        ← 返回
      </button>
      <h1 className="text-xl font-semibold text-ink-900">Skills / 插件</h1>
      <p className="text-sm text-ink-500 mt-1">
        Skill 是模型可调用的领域指令包，通过 <code>Skill</code> 工具或{' '}
        <code>Agent(subagent_type=&quot;name&quot;)</code> 注入。同名 skill 会覆盖内置项。
      </p>

      {isTauri() && (
        <div className="card p-4 mt-4 space-y-2">
          <div className="font-medium text-ink-900">从磁盘加载</div>
          <div className="text-xs text-ink-500">
            指定一个目录，目录里每个 <code>*.md</code> 文件都被视作一个 skill。
            支持顶部 yaml 前置块：
            <pre className="bg-ink-50 p-2 mt-1 rounded text-[11px] leading-tight">{`---
name: my-skill
description: 一句话说明
---

skill 内容…`}</pre>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={skillsDir}
              onChange={(e) => setSkillsDir(e.target.value)}
              placeholder="/home/me/.simple-ai/skills"
              spellCheck={false}
            />
            <button onClick={reloadFromDisk} className="btn-primary text-sm">
              重新加载
            </button>
          </div>
          {reloadMsg && (
            <div
              className={`text-xs ${
                reloadMsg.ok ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {reloadMsg.msg}
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-900">自定义 Skills</h2>
          <button
            onClick={() =>
              setEditing({ name: '', description: '', content: '', source: 'inline' })
            }
            className="btn-primary text-xs"
          >
            + 新增
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {custom.length === 0 && (
            <div className="card p-3 text-xs text-ink-500">
              还没添加自定义 skill。
            </div>
          )}
          {custom.map((s) => (
            <div key={s.name} className="card p-3">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-ink-900">{s.name}</span>
                {s.source && s.source !== 'inline' && (
                  <span className="text-[10px] text-ink-500" title={s.source}>
                    {s.source.split(/[\\/]/).pop()}
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-500 mt-0.5 line-clamp-2">
                {s.description}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap text-xs">
                <button onClick={() => setEditing(s)} className="btn-ghost">
                  编辑
                </button>
                <button
                  onClick={() => remove(s.name)}
                  className="btn-ghost text-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">内置 Skills</h2>
        <div className="mt-2 space-y-2">
          {BUILTIN_SKILLS.map((s) => (
            <div key={s.name} className="card p-3 opacity-90">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-ink-900">{s.name}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
                  builtin
                </span>
                {builtinShadowed.has(s.name) && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    被自定义覆盖
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-500 mt-0.5 line-clamp-2">
                {s.description}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap text-xs">
                <button
                  onClick={() =>
                    setEditing({
                      name: s.name,
                      description: s.description,
                      content: s.content,
                      source: 'inline'
                    })
                  }
                  className="btn-ghost"
                >
                  作为覆盖编辑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <SkillEditor
          initial={editing}
          existing={custom}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function SkillEditor({
  initial,
  existing,
  onSave,
  onCancel
}: {
  initial: CustomSkill
  existing: CustomSkill[]
  onSave: (s: CustomSkill) => void
  onCancel: () => void
}) {
  const [s, setS] = useState<CustomSkill>(initial)
  const nameTaken =
    s.name !== initial.name && existing.some((c) => c.name === s.name)
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-w-2xl w-full p-5 space-y-3 bg-white max-h-[90vh] overflow-auto">
        <div className="text-lg font-semibold text-ink-900">
          {initial.name ? `编辑 skill：${initial.name}` : '新增 skill'}
        </div>
        <label className="block text-xs text-ink-500">name（用作工具/agent 引用）</label>
        <input
          className="input"
          value={s.name}
          onChange={(e) => setS({ ...s, name: e.target.value.trim() })}
          placeholder="my-skill"
          spellCheck={false}
        />
        {nameTaken && (
          <div className="text-xs text-red-600">该 name 已存在，保存会覆盖。</div>
        )}
        <label className="block text-xs text-ink-500">description（一句话）</label>
        <input
          className="input"
          value={s.description}
          onChange={(e) => setS({ ...s, description: e.target.value })}
          placeholder="什么时候应该调用这个 skill"
        />
        <label className="block text-xs text-ink-500">content（markdown 指令体）</label>
        <textarea
          className="input min-h-[260px] font-mono text-xs"
          value={s.content}
          onChange={(e) => setS({ ...s, content: e.target.value })}
          placeholder="When facing X, do Y…"
          spellCheck={false}
        />
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="btn-ghost">
            取消
          </button>
          <button
            onClick={() => onSave(s)}
            className="btn-primary"
            disabled={!s.name || !s.content}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
