import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiConfig } from '@/types'
import { loadConfig, saveConfig } from '@/lib/storage'
import {
  type ApiProfile,
  loadProfiles,
  upsertProfile,
  deleteProfile,
  suggestProfileName,
  setProfileProxy,
} from '@/lib/profiles'
import { testConnection, detectAdapter } from '@/lib/ai'
import { isTauri, tauriInvoke } from '@/lib/tauri'
import { isElectron } from '@/lib/electron'
import {
  PRESETS,
  FALLBACK_MODELS,
  MODEL_TYPE_LABELS,
  type ModelType,
  inferModelType,
  fetchModels,
} from '@/lib/modelHelpers'
import MiniTokenPanel from '@/components/MiniTokenPanel'
import MarketplaceManager from '@/components/MarketplaceManager'
import ModelEndpointEditor from '@/components/ModelEndpointEditor'
import AutoUpdateCard from '@/components/AutoUpdateCard'

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
  const [profiles, setProfiles] = useState<ApiProfile[]>([])
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null)
  const [proxyDraft, setProxyDraft] = useState('')

  const applyProxyTo = (url: string | undefined) => {
    if (!isElectron()) return
    const api = (window as any).electronAPI
    if (api?.proxySet) api.proxySet({ url: url || '' })
  }

  useEffect(() => {
    const cfg = loadConfig()
    setConfig(cfg)
    const profs = loadProfiles()
    setProfiles(profs)
    // On boot, push the matching profile's proxy to the main process so that
    // network requests originating from this window go out the configured route.
    const matched = profs.find(p => p.baseUrl === cfg.baseUrl && p.apiKey === cfg.apiKey)
    applyProxyTo(matched?.proxy)
  }, [])

  const archive = (cfg: ApiConfig, source: ApiProfile['source']) => {
    if (!cfg.baseUrl || !cfg.apiKey) return
    const name = suggestProfileName(cfg.baseUrl, cfg.apiKey, source)
    const next = upsertProfile({
      name,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      source,
    })
    setProfiles(next)
    const matched = next.find(p => p.baseUrl === cfg.baseUrl && p.apiKey === cfg.apiKey)
    applyProxyTo(matched?.proxy)
  }

  const applyProfile = (p: ApiProfile) => {
    const next: ApiConfig = {
      ...config,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: p.model || config.model,
    }
    setConfig(next)
    saveConfig(next)
    applyProxyTo(p.proxy)
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 1800)
  }

  const removeProfile = (id: string) => {
    setProfiles(deleteProfile(id))
  }

  const saveProxyEdit = () => {
    if (!editingProxyId) return
    const trimmed = proxyDraft.trim()
    if (trimmed && !/^(socks5|socks4|http|https):\/\/[^\s]+:\d+/i.test(trimmed)) {
      setTestResult({ ok: false, msg: '代理格式无效，例如：socks5://127.0.0.1:1080' })
      return
    }
    const next = setProfileProxy(editingProxyId, trimmed)
    setProfiles(next)
    const p = next.find(x => x.id === editingProxyId)
    if (p && p.baseUrl === config.baseUrl && p.apiKey === config.apiKey) {
      applyProxyTo(p.proxy)
    }
    setEditingProxyId(null)
    setProxyDraft('')
    setTestResult(null)
  }

  const clearProxy = (id: string) => {
    const next = setProfileProxy(id, '')
    setProfiles(next)
    const p = next.find(x => x.id === id)
    if (p && p.baseUrl === config.baseUrl && p.apiKey === config.apiKey) {
      applyProxyTo('')
    }
  }

  const applyMiniTokenKey = (key: string) => {
    const next: ApiConfig = { ...config, apiKey: key, baseUrl: 'https://minitoken.top/v1' }
    setConfig(next)
    saveConfig(next)
    archive(next, 'minitoken')
    setSaved(false)
    setTestResult(null)
  }

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
    archive(config, 'manual')
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
      archive(config, 'manual')
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
    archive(config, 'manual')
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

      <MiniTokenPanel onKeyFound={applyMiniTokenKey} />

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
          {config.baseUrl && (
            <div className="mt-1 text-[10px] text-ink-500">
              协议自动识别：
              <span className={`ml-1 px-1.5 py-0.5 rounded font-medium ${
                detectAdapter(config.baseUrl).name === 'Anthropic Messages' ? 'bg-violet-100 text-violet-700'
                : detectAdapter(config.baseUrl).name === 'OpenAI Responses' ? 'bg-emerald-100 text-emerald-700'
                : 'bg-sky-100 text-sky-700'
              }`}>{detectAdapter(config.baseUrl).name}</span>
            </div>
          )}
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

      {profiles.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-medium text-ink-900 text-sm">💾 已保存的配置（{profiles.length}）</div>
              <div className="text-[10px] text-ink-500 mt-0.5">
                保存 / 测试连接 / MiniToken 应用后自动入档；每条可独立设置 SOCKS5 代理
                {!isElectron() && <span className="text-amber-600 ml-1">（代理仅 Electron 桌面版生效）</span>}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {profiles.map(p => {
              const inUse = config.baseUrl === p.baseUrl && config.apiKey === p.apiKey
              const editing = editingProxyId === p.id
              return (
                <div key={p.id} className={`rounded-lg border px-2.5 py-1.5 ${
                  inUse ? 'bg-emerald-50 border-emerald-200' : 'bg-ink-50 border-ink-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
                      p.source === 'minitoken' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                    }`}>{p.source === 'minitoken' ? 'MT' : '手动'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-ink-800 truncate" title={`${p.baseUrl} · ${p.apiKey}`}>{p.name}</div>
                      <div className="text-[10px] text-ink-500 font-mono truncate">
                        {p.model || '(no model)'} · ****{p.apiKey.slice(-6)}
                      </div>
                    </div>
                    <button
                      onClick={() => applyProfile(p)}
                      disabled={inUse}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${
                        inUse ? 'bg-emerald-200 text-emerald-800 cursor-default' : 'bg-ink-200 hover:bg-ink-900 hover:text-white text-ink-700'
                      }`}
                    >
                      {inUse ? '使用中 ✓' : '应用'}
                    </button>
                    <button
                      onClick={() => removeProfile(p.id)}
                      className="text-[10px] text-ink-400 hover:text-red-600 px-1"
                      title="删除"
                    >✕</button>
                  </div>

                  <div className="mt-1 ml-7 text-[10px] flex items-center gap-1.5">
                    {editing ? (
                      <>
                        <input
                          autoFocus
                          className="input !text-[10px] !py-0.5 flex-1"
                          value={proxyDraft}
                          onChange={e => setProxyDraft(e.target.value)}
                          placeholder="socks5://user:pass@127.0.0.1:1080  (留空=直连)"
                          spellCheck={false}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveProxyEdit()
                            else if (e.key === 'Escape') { setEditingProxyId(null); setProxyDraft('') }
                          }}
                        />
                        <button onClick={saveProxyEdit} className="text-emerald-700 hover:text-emerald-900 shrink-0">保存</button>
                        <button onClick={() => { setEditingProxyId(null); setProxyDraft('') }} className="text-ink-400 hover:text-ink-700 shrink-0">取消</button>
                      </>
                    ) : p.proxy ? (
                      <>
                        <span className="text-emerald-700 font-mono truncate flex-1" title={p.proxy}>
                          🔒 {p.proxy.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2')}
                        </span>
                        {inUse && <span className="text-emerald-600 shrink-0">· 生效中</span>}
                        <button
                          onClick={() => { setEditingProxyId(p.id); setProxyDraft(p.proxy || '') }}
                          className="text-ink-500 hover:text-ink-900 shrink-0"
                          title="编辑代理"
                        >✎</button>
                        <button
                          onClick={() => clearProxy(p.id)}
                          className="text-ink-400 hover:text-red-600 shrink-0"
                          title="清除代理"
                        >清除</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditingProxyId(p.id); setProxyDraft('') }}
                        className="text-ink-500 hover:text-ink-900"
                      >+ 添加 SOCKS5 代理</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* Image model config */}
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-800">
          🎨 图像生成模型配置
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-ink-500">
            留空时默认走 <strong>minitoken.top</strong> 的 gpt-image-2 模型，主 API Key 需对 MiniToken 有效。
            如要走其他端点，请完整填写 baseUrl + Key + 模型。
          </p>
          <ModelEndpointEditor
            label="图像生成模型"
            hint="gpt-image-2 / gpt-image-1 / dall-e-3 / midjourney"
            value={config.imageModel}
            onChange={(v) => setConfig(c => ({ ...c, imageModel: v }))}
            suggestedModels={['gpt-image-2', 'gpt-image-1', 'dall-e-3', 'midjourney', 'flux-1', 'seedream-3']}
            mainConfig={{ baseUrl: config.baseUrl, apiKey: config.apiKey }}
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

      <MarketplaceManager />

      <AutoUpdateCard />

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

