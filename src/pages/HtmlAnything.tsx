import { useState, useRef, useCallback } from 'react'
import { HTML_SKILLS, SKILL_CATEGORIES, buildHtmlPrompt } from '@/lib/htmlSkills'
import { streamChat } from '@/lib/ai'
import { loadConfig, isConfigReady } from '@/lib/storage'
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
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedSkill || 'output'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyHtml = async () => {
    if (!html) return
    await navigator.clipboard.writeText(html)
    setError('已复制到剪贴板')
    setTimeout(() => setError(null), 1500)
  }

  const skill = HTML_SKILLS.find(s => s.id === selectedSkill)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* Top bar */}
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-lg font-semibold text-ink-900 shrink-0">HTML 万物生成</h1>
        <div className="text-xs text-ink-400">75 个模板 · AI 生成精美 HTML</div>
        <div className="ml-auto flex gap-1.5">
          {html && (
            <>
              <button onClick={copyHtml} className="btn-ghost text-xs">复制</button>
              <button onClick={downloadHtml} className="btn-ghost text-xs">下载 .html</button>
            </>
          )}
        </div>
      </div>

      {/* Skill picker */}
      <div className="shrink-0 space-y-2">
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
        <div className="flex gap-2 items-center">
          <input
            className="input !text-xs !py-1.5 flex-1"
            value={skillSearch}
            onChange={e => setSkillSearch(e.target.value)}
            placeholder="搜索模板…"
            spellCheck={false}
          />
          {skill && (
            <div className="text-xs text-ink-600 shrink-0">
              {skill.emoji} <strong>{skill.name}</strong> — {skill.desc}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {filteredSkills.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSkill(s.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                selectedSkill === s.id ? 'bg-violet-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
              title={s.desc}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main area: editor + preview */}
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
            <div className="text-xs text-red-600 mt-1">{error}</div>
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
