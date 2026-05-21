import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiConfig } from '@/types'
import { loadConfig, saveConfig } from '@/lib/storage'
import { testConnection } from '@/lib/ai'
import { isTauri, tauriInvoke } from '@/lib/tauri'
import MiniTokenPanel from '@/components/MiniTokenPanel'

const PRESETS: { label: string; baseUrl: string; hint?: string }[] = [
  { label: 'MiniToken', baseUrl: 'https://minitoken.top/v1', hint: 'minitoken.top 中转，支持 Claude/GPT/Gemini 等' },
  { label: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', hint: '需要全球可访问的网络环境' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', hint: '国内可直接访问' },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', hint: '国内可直接访问' },
  { label: '阿里通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1' }
]

const FALLBACK_MODELS = [
  // OpenAI — latest first
  'gpt-5.5', 'gpt-5', 'gpt-5-mini',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.5-preview',
  'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini',
  'gpt-image-1', 'dall-e-3',
  // Anthropic Claude
  'claude-opus-4-5', 'claude-opus-4', 'claude-sonnet-4-5', 'claude-sonnet-4',
  'claude-haiku-4-5', 'claude-3.7-sonnet', 'claude-3.5-sonnet',
  // Google Gemini
  'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
  // DeepSeek
  'deepseek-chat', 'deepseek-reasoner', 'deepseek-v3',
  // Grok
  'grok-4', 'grok-4-fast', 'grok-3', 'grok-3-mini',
  // 阿里 Qwen
  'qwen3-235b', 'qwen3-32b', 'qwen3-8b', 'qwen-plus', 'qwen-turbo',
  'qwq-32b', 'qwen-vl-max',
  // 智谱 GLM
  'glm-4.5', 'glm-4-flash', 'glm-4-air',
  // 豆包
  'doubao-seed-1-6', 'doubao-seed-1-6-thinking',
  // 月之暗面
  'kimi-k2', 'moonshot-v1-8k',
  // Meta Llama
  'llama-4-maverick', 'llama-4-scout',
]

type ModelType = 'all' | 'chat' | 'reasoning' | 'image' | 'audio' | 'video' | 'embedding'

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  all: '全部',
  chat: '对话',
  reasoning: '推理',
  image: '图像',
  audio: '音频',
  video: '视频',
  embedding: '向量',
}

function inferModelType(id: string): Exclude<ModelType, 'all'> {
  const l = id.toLowerCase()
  if (/embed/.test(l)) return 'embedding'
  if (/dall-e|gpt-image|midjourney|flux|stable[-_]?diff|seedream|imagen|sd[-_]/.test(l)) return 'image'
  if (/tts|whisper|audio|speech/.test(l)) return 'audio'
  if (/veo|sora|kling|hailuo|seedance|video|wan-|cogvideo/.test(l)) return 'video'
  if (/^o[1-4]|reasoner|^qwq|thinking/.test(l)) return 'reasoning'
  return 'chat'
}

async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!baseUrl || !apiKey) return []
  const trimmed = baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/completions$/, '')
  // Try multiple URL patterns to auto-adapt various API formats
  const candidates = [
    trimmed + '/models',
    trimmed + '/v1/models',
    trimmed.replace(/\/v\d+$/, '') + '/v1/models',
  ]
  // Deduplicate
  const urls = [...new Set(candidates)]
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const list = j.data ?? j.models ?? []
      if (!Array.isArray(list) || !list.length) continue
      return list.map((m: { id: string }) => m.id).sort()
    } catch {
      continue
    }
  }
  return []
}

export default function Settings() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<ApiConfig>({ baseUrl: 'https://minitoken.top/v1', apiKey: '', model: 'gpt-5.5' })
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [remoteModels, setRemoteModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelFilter, setModelFilter] = useState('')
  const [modelTypeFilter, setModelTypeFilter] = useState<ModelType>('all')

  useEffect(() => { setConfig(loadConfig()) }, [])

  const update = (k: keyof ApiConfig, v: string) => {
    setConfig((c) => ({ ...c, [k]: v }))
    setSaved(false)
    setTestResult(null)
  }

  const loadModels = async () => {
    setLoadingModels(true)
    const ids = await fetchModels(config.baseUrl, config.apiKey)
    setRemoteModels(ids)
    setLoadingModels(false)
    if (!ids.length) setTestResult({ ok: false, msg: '未能获取模型列表，请检查 API 地址和 Key' })
  }

  const loadClaudeMd = async () => {
    if (!isTauri()) {
      setTestResult({ ok: false, msg: '需要桌面版（Tauri）才能读取本地文件。' })
      return
    }
    try {
      const path = window.prompt('输入 CLAUDE.md 的绝对路径', '')
      if (!path) return
      const text = await tauriInvoke<string>('fs_read', { path })
      update('projectContext', text)
      setTestResult({ ok: true, msg: `✅ 已加载 ${path}（${text.length} 字符）` })
    } catch (e) {
      setTestResult({ ok: false, msg: `❌ 读取失败：${(e as Error).message}` })
    }
  }

  const save = () => {
    saveConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      saveConfig(config)
      const reply = await testConnection(config)
      setTestResult({ ok: true, msg: `✅ 连接成功：${reply.slice(0, 30)}` })
      setSaved(true)
      // auto-fetch models on successful test
      const ids = await fetchModels(config.baseUrl, config.apiKey)
      if (ids.length) setRemoteModels(ids)
    } catch (e) {
      setTestResult({ ok: false, msg: `❌ ${(e as Error).message}` })
    } finally {
      setTesting(false)
    }
  }

  const finishAndGo = () => {
    saveConfig(config)
    navigate('/')
  }

  const displayModels = remoteModels.length ? remoteModels : FALLBACK_MODELS
  const filteredModels = displayModels.filter(m => {
    if (modelFilter && !m.toLowerCase().includes(modelFilter.toLowerCase())) return false
    if (modelTypeFilter !== 'all' && inferModelType(m) !== modelTypeFilter) return false
    return true
  })

  return (
    <div className="max-w-2xl mx-auto pt-4 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">API 配置</h1>
        <p className="text-sm text-ink-500 mt-1">
          填写下面两项即可使用。所有信息只保存在你的本地浏览器，不会上传任何服务器。
        </p>
      </div>

      <MiniTokenPanel onKeyFound={(key) => { update('apiKey', key); update('baseUrl', 'https://minitoken.top/v1') }} />

      <div className="card p-5 space-y-5">
        <div>
          <label className="label">API 地址 (Base URL)</label>
          <input
            className="input"
            value={config.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            placeholder="https://minitoken.top/v1"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => update('baseUrl', p.baseUrl)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  config.baseUrl === p.baseUrl
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">API Key</label>
          <div className="relative">
            <input
              className="input pr-20"
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder="sk-..."
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs px-2.5 py-1.5 rounded-lg text-ink-600 hover:bg-ink-100"
              type="button"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">模型</label>
            <button
              onClick={loadModels}
              disabled={loadingModels || !config.baseUrl || !config.apiKey}
              className="text-xs text-sky-700 hover:text-sky-900 disabled:opacity-40"
            >
              {loadingModels ? '获取中…' : '🔄 从 API 拉取模型列表'}
            </button>
          </div>
          <input
            className="input"
            value={config.model}
            onChange={(e) => update('model', e.target.value)}
            placeholder="输入或选择模型，如 gpt-4o-mini"
            spellCheck={false}
          />
          {remoteModels.length > 0 && (
            <div className="text-xs text-emerald-600 mt-1">
              ✓ 已从 API 获取 {remoteModels.length} 个模型
            </div>
          )}
          <div className="mt-2">
            <input
              className="input !text-xs !py-1.5"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="🔍 筛选模型… 输入 claude / gpt / gemini 等"
              spellCheck={false}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.entries(MODEL_TYPE_LABELS) as [ModelType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setModelTypeFilter(type)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  modelTypeFilter === type
                    ? 'bg-sky-600 text-white'
                    : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {filteredModels.length > 0 ? filteredModels.map((m) => {
              const type = inferModelType(m)
              const typeColor = type === 'reasoning' ? 'text-indigo-600' : type === 'image' ? 'text-violet-600' : type === 'audio' ? 'text-emerald-600' : type === 'video' ? 'text-orange-600' : type === 'embedding' ? 'text-ink-400' : ''
              return (
                <button
                  key={m}
                  onClick={() => { update('model', m); setModelFilter('') }}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    config.model === m
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                  }`}
                >
                  {m}
                  {type !== 'chat' && <span className={`ml-1 text-[9px] ${config.model === m ? 'text-white/70' : typeColor}`}>{MODEL_TYPE_LABELS[type]}</span>}
                </button>
              )
            }) : (
              <div className="text-xs text-ink-400 py-2">无匹配模型</div>
            )}
          </div>
        </div>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-800">
          🧠 项目上下文 / CLAUDE.md（高级，可选）
        </summary>
        <div className="mt-3 space-y-2">
          <div className="text-xs text-ink-500">
            粘贴你的项目 CLAUDE.md 内容，模型在每次对话开始时都会看到这段指令。
            {isTauri() && '（桌面版可直接从磁盘读取）'}
          </div>
          <textarea
            className="input min-h-[160px] font-mono text-xs"
            value={config.projectContext || ''}
            onChange={(e) => update('projectContext', e.target.value)}
            placeholder="# CLAUDE.md&#10;&#10;指南内容..."
            spellCheck={false}
          />
          <div className="flex gap-2 flex-wrap">
            {isTauri() && (
              <button onClick={loadClaudeMd} className="btn-ghost text-xs">
                📂 从磁盘读取
              </button>
            )}
            {(config.projectContext || '').trim() && (
              <button onClick={() => update('projectContext', '')} className="btn-ghost text-xs text-red-600">
                清空
              </button>
            )}
          </div>
        </div>
      </details>

      {/* Multi-model config */}
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-800">
          🎨 多模态模型配置（图像/音频/视频）
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-ink-500">
            不配置则使用主 API 端点。MiniToken 支持所有模态，无需单独配置。
          </p>
          <ModelEndpointEditor
            label="图像生成模型"
            hint="gpt-image-1 / dall-e-3 / midjourney"
            value={config.imageModel}
            onChange={(v) => setConfig(c => ({ ...c, imageModel: v }))}
            suggestedModels={['gpt-image-1', 'dall-e-3', 'midjourney', 'flux-1', 'seedream-3']}
          />
          <ModelEndpointEditor
            label="音频模型（TTS/STT）"
            hint="tts-1 / whisper-1"
            value={config.audioModel}
            onChange={(v) => setConfig(c => ({ ...c, audioModel: v }))}
            suggestedModels={['tts-1', 'tts-1-hd', 'whisper-1', 'gpt-4o-audio']}
          />
          <ModelEndpointEditor
            label="视频生成模型"
            hint="veo-2 / sora-2 / kling-video"
            value={config.videoModel}
            onChange={(v) => setConfig(c => ({ ...c, videoModel: v }))}
            suggestedModels={['veo-2', 'veo-3', 'sora-2', 'kling-video', 'seedance-1-6', 'minimax-hailuo']}
          />
        </div>
      </details>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={test} disabled={testing} className="btn-secondary flex-1">
          {testing ? '测试中…' : '测试连接'}
        </button>
        <button onClick={save} className="btn-secondary flex-1">
          {saved ? '已保存 ✓' : '仅保存'}
        </button>
        <button onClick={finishAndGo} className="btn-primary flex-1">
          保存并开始使用
        </button>
      </div>

      {testResult && (
        <div className={`card p-4 text-sm ${
          testResult.ok
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            : 'text-red-700 bg-red-50 border border-red-200'
        }`}>
          {testResult.msg}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-ink-900">MCP 服务器</div>
            <div className="text-xs text-ink-500 mt-0.5">连接 Model Context Protocol 服务器，扩展模型可用工具</div>
          </div>
          <button onClick={() => navigate('/mcp')} className="btn-ghost text-sm">管理 →</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-ink-900">Skills / 插件</div>
            <div className="text-xs text-ink-500 mt-0.5">自定义/扩展 skill 指令包</div>
          </div>
          <button onClick={() => navigate('/skills')} className="btn-ghost text-sm">管理 →</button>
        </div>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-800">
          🛒 插件市场 / 在线资源
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { name: 'SkillsMP 市场', url: 'https://skillsmp.com', desc: '120万+ Agent 技能，支持语义搜索' },
            { name: 'Skills.sh 官方目录', url: 'https://skills.sh', desc: 'Vercel 官方技能目录，87,000+ 技能' },
            { name: '官方技能目录', url: 'https://officialskills.sh', desc: 'Cloudflare/Anthropic/Stripe 等官方团队技能' },
            { name: 'LobeHub 技能库', url: 'https://github.com/lobehub/lobe-chat-agents', desc: 'LobeChat 社区 Agent 角色与技能' },
            { name: 'Awesome Prompts', url: 'https://github.com/f/awesome-chatgpt-prompts', desc: 'GitHub 热门提示词合集' },
            { name: 'HTML 万物生成器', url: 'https://github.com/nexu-io/html-anything', desc: '75 Skills 生成精美 HTML' },
          ].map(src => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="block p-2.5 rounded-lg bg-ink-50 hover:bg-ink-100 transition-colors">
              <div className="text-xs font-medium text-ink-800">{src.name}</div>
              <div className="text-[10px] text-ink-500 mt-0.5">{src.desc}</div>
            </a>
          ))}
        </div>
      </details>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-800">📖 哪里能搞到 API Key？</summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p><strong>MiniToken 云算（推荐）</strong>：访问 <a href="https://minitoken.top" target="_blank" rel="noreferrer" className="text-sky-700 underline">minitoken.top</a>，注册后获取 Key。一个 Key 即可调用 Claude/GPT/Gemini/DeepSeek/Grok/Qwen/Kimi 等 285+ 模型，国内可直接访问，默认 API 地址已填好。</p>
          <p><strong>DeepSeek（国内）</strong>：<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-sky-700 underline">platform.deepseek.com</a>，新用户有赠送额度。</p>
          <p><strong>智谱 GLM（国内）</strong>：<a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noreferrer" className="text-sky-700 underline">open.bigmodel.cn</a>，有免费额度。</p>
          <p><strong>OpenAI</strong>：<a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-sky-700 underline">platform.openai.com</a>，需要国际网络。</p>
          <p className="text-xs text-ink-500 pt-2 border-t border-ink-100">Key 只保存在你的浏览器本地，不会上传。</p>
        </div>
      </details>
    </div>
  )
}

function ModelEndpointEditor({ label, hint, value, onChange, suggestedModels }: {
  label: string
  hint: string
  value?: { baseUrl: string; apiKey: string; model: string }
  onChange: (v: { baseUrl: string; apiKey: string; model: string } | undefined) => void
  suggestedModels: string[]
}) {
  const [expanded, setExpanded] = useState(!!value?.model)
  const v = value || { baseUrl: '', apiKey: '', model: '' }

  if (!expanded) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-ink-700">{label}</div>
          <div className="text-[10px] text-ink-400">{hint}</div>
        </div>
        <button onClick={() => setExpanded(true)} className="text-xs text-sky-700 hover:text-sky-900">
          自定义 →
        </button>
      </div>
    )
  }

  return (
    <div className="border border-ink-100 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-ink-700">{label}</div>
        <button onClick={() => { onChange(undefined); setExpanded(false) }} className="text-[10px] text-red-600">
          清除
        </button>
      </div>
      <input
        className="input !text-xs !py-1.5"
        value={v.baseUrl}
        onChange={e => onChange({ ...v, baseUrl: e.target.value })}
        placeholder="API 地址（留空使用主地址）"
        spellCheck={false}
      />
      <input
        className="input !text-xs !py-1.5"
        type="password"
        value={v.apiKey}
        onChange={e => onChange({ ...v, apiKey: e.target.value })}
        placeholder="API Key（留空使用主 Key）"
        spellCheck={false}
      />
      <input
        className="input !text-xs !py-1.5"
        value={v.model}
        onChange={e => onChange({ ...v, model: e.target.value })}
        placeholder="模型名称"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-1">
        {suggestedModels.map(m => (
          <button key={m} onClick={() => onChange({ ...v, model: m })} className={`text-[10px] px-2 py-0.5 rounded-full ${v.model === m ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
