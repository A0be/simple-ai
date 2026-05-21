import { useState, useRef, useCallback } from 'react'
import { HTML_SKILLS, SKILL_CATEGORIES, buildHtmlPrompt } from '@/lib/htmlSkills'
import { streamChat } from '@/lib/ai'
import { loadConfig, isConfigReady } from '@/lib/storage'
import { isElectron } from '@/lib/electron'
import { useNavigate } from 'react-router-dom'

export default function HtmlAnything() {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string>('deck-simple')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [skillSearch, setSkillSearch] = useState('')
  const [html, setHtml] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [exporting, setExporting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const filteredSkills = HTML_SKILLS.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
    if (skillSearch && !s.name.includes(skillSearch) && !s.desc.includes(skillSearch) && !s.id.includes(skillSearch.toLowerCase())) return false
    return true
  })

  const generate = useCallback(async () => {
    if (!content.trim()) { setError('请输入内容'); return }
    if (!isConfigReady()) { navigate('/settings'); return }

    setGenerating(true)
    setError(null)
    setHtml('')
    const controller = new AbortController()
    abortRef.current = controller

    const config = loadConfig()
    const prompt = buildHtmlPrompt(selectedSkill, content, 'markdown')
    let accumulated = ''

    try {
      await streamChat({
        config,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `请按上述模板风格，将以下内容生成为精美的 HTML 页面:\n\n${content}` },
        ],
        temperature: 0.5,
        signal: controller.signal,
        onChunk: (delta) => {
          accumulated += delta
          setHtml(extractHtml(accumulated))
        },
      })
      setHtml(extractHtml(accumulated))
    } catch (e) {
      const msg = (e as Error).message
      if (!msg.includes('aborted')) setError(msg)
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }, [content, selectedSkill, navigate])

  const stop = () => abortRef.current?.abort()

  const downloadHtml = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedSkill || 'output'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportLocal = async () => {
    if (!html) return
    if (isElectron()) {
      setExporting(true)
      try {
        const api = (window as any).electronAPI
        const r = await api.htmlExport({ content: html, defaultName: selectedSkill || 'output' })
        if (r?.canceled) return
        if (r?.ok) {
          setError(`✅ 已导出并打开：${r.path}`)
          setTimeout(() => setError(prev => prev?.startsWith('✅') ? null : prev), 4000)
        } else if (r?.message) {
          setError(`导出失败：${r.message}`)
        }
      } finally {
        setExporting(false)
      }
    } else {
      downloadHtml()
    }
  }

  const copyHtml = async () => {
    if (!html) return
    await navigator.clipboard.writeText(html)
    setError('已复制到剪贴板')
    setTimeout(() => setError(null), 1500)
  }

  const skill = HTML_SKILLS.find(s => s.id === selectedSkill)

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Left sidebar: template picker */}
      <aside className="w-64 shrink-0 flex flex-col card p-3 gap-2 min-h-0">
        <div>
          <h1 className="text-base font-semibold text-ink-900">HTML 万物生成</h1>
          <p className="text-[10px] text-ink-400 mt-0.5">{HTML_SKILLS.length} 个模板 · AI 生成精美页面</p>
        </div>
        <input
          className="input !text-xs !py-1.5"
          value={skillSearch}
          onChange={e => setSkillSearch(e.target.value)}
          placeholder="🔍 搜索模板..."
          spellCheck={false}
        />
        <div className="flex gap-1 flex-wrap">
          {SKILL_CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                categoryFilter === c.id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {c.emoji && `${c.emoji} `}{c.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-ink-400 px-0.5">
          {filteredSkills.length} / {HTML_SKILLS.length}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 -mr-1">
          {filteredSkills.length === 0 ? (
            <div className="text-xs text-ink-400 text-center py-4">无匹配模板</div>
          ) : (
            filteredSkills.map(s => {
              const active = selectedSkill === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSkill(s.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    active
                      ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200 shadow-sm'
                      : 'bg-white border-ink-100 hover:border-ink-300 hover:bg-ink-50'
                  }`}
                  title={s.desc}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base shrink-0">{s.emoji}</span>
                    <span className={`text-xs font-medium truncate ${active ? 'text-violet-900' : 'text-ink-800'}`}>
                      {s.name}
                    </span>
                    {active && <span className="ml-auto text-violet-600 text-xs shrink-0">✓</span>}
                  </div>
                  <div className="text-[10px] text-ink-500 mt-1 leading-snug line-clamp-2">{s.desc}</div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Right side: top bar + editor + preview */}
      <div className="flex-1 flex flex-col min-w-0 gap-2">
        {/* Top bar */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {skill && (
            <div className="text-xs text-ink-600 flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-base shrink-0">{skill.emoji}</span>
              <strong className="text-ink-900 shrink-0">{skill.name}</strong>
              <span className="text-ink-400 truncate">— {skill.desc}</span>
            </div>
          )}
          <div className="flex gap-1.5 shrink-0">
            {html && (
              <>
                <button onClick={copyHtml} className="btn-ghost text-xs">📋 复制</button>
                <button onClick={exportLocal} disabled={exporting} className="btn-primary text-xs">
                  {exporting ? '导出中...' : (isElectron() ? '💾 导出到本地' : '⬇️ 下载 .html')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Editor */}
          <div className="w-1/2 flex flex-col min-h-0">
            <textarea
              className="flex-1 input font-mono text-xs resize-none"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={"输入内容（Markdown、纯文本、CSV、JSON 均可）…\n\n例如：\n# 2025 年度总结\n\n## 核心指标\n- 用户增长 230%\n- 营收 $12M\n- NPS 72\n\n## 重点项目\n1. AI 助手 2.0 — 上线 3 个月活跃用户破百万\n2. 国际化 — 覆盖 15 个语言\n3. 开源计划 — GitHub 3.2k stars"}
              spellCheck={false}
            />
            <div className="flex gap-2 mt-2 shrink-0">
              {generating ? (
                <button onClick={stop} className="btn-secondary flex-1">停止生成</button>
              ) : (
                <button onClick={generate} disabled={!content.trim()} className="btn-primary flex-1">
                  生成 HTML
                </button>
              )}
            </div>
            {error && (
              <div className={`text-xs mt-1 ${error.startsWith('✅') ? 'text-emerald-600' : error.startsWith('已') ? 'text-sky-600' : 'text-red-600'}`}>{error}</div>
            )}
          </div>

          {/* Preview */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="flex gap-1 mb-1 shrink-0">
              <button
                onClick={() => setTab('preview')}
                className={`text-xs px-3 py-1 rounded-t-lg ${tab === 'preview' ? 'bg-white border border-b-0 border-ink-200 text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
              >
                预览
              </button>
              <button
                onClick={() => setTab('code')}
                className={`text-xs px-3 py-1 rounded-t-lg ${tab === 'code' ? 'bg-white border border-b-0 border-ink-200 text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
              >
                代码
              </button>
            </div>
            {tab === 'preview' ? (
              <div className="flex-1 border border-ink-200 rounded-lg overflow-hidden bg-white">
                {html ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={html}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-0"
                    title="HTML Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-ink-400">
                    {generating ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-ink-300 border-t-ink-600 rounded-full animate-spin" />
                        生成中…
                      </div>
                    ) : '选择模板，输入内容，点击生成'}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className="flex-1 input font-mono text-[11px] resize-none"
                value={html}
                onChange={e => setHtml(e.target.value)}
                readOnly={generating}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function extractHtml(raw: string): string {
  let s = raw
  const fenceStart = s.indexOf('```html')
  if (fenceStart >= 0) s = s.slice(fenceStart + 7)
  else if (s.startsWith('```')) s = s.slice(3)
  const fenceEnd = s.lastIndexOf('```')
  if (fenceEnd > 0) s = s.slice(0, fenceEnd)
  s = s.trim()
  const docStart = s.indexOf('<!DOCTYPE')
  if (docStart < 0) {
    const htmlStart = s.indexOf('<html')
    if (htmlStart >= 0) s = s.slice(htmlStart)
  } else {
    s = s.slice(docStart)
  }
  return s
}
