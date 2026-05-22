import { useState } from 'react'
import { fetchModels } from '@/lib/modelHelpers'

interface Props {
  label: string
  hint: string
  value?: { baseUrl: string; apiKey: string; model: string }
  onChange: (v: { baseUrl: string; apiKey: string; model: string } | undefined) => void
  suggestedModels: string[]
  mainConfig?: { baseUrl: string; apiKey: string }
}

/**
 * Inline editor for a per-capability ModelEndpoint (imageModel / audioModel /
 * videoModel on ApiConfig). Collapsed by default; expanding reveals fields for
 * baseUrl / apiKey / model. Leaving baseUrl + apiKey empty means "fall back to
 * MiniToken" — see multimodal.ts:getEndpoint.
 */
export default function ModelEndpointEditor({
  label,
  hint,
  value,
  onChange,
  suggestedModels,
  mainConfig,
}: Props) {
  const [expanded, setExpanded] = useState(!!value?.model)
  const [filter, setFilter] = useState('')
  const [remoteModels, setRemoteModels] = useState<string[]>([])
  const [loadingRemote, setLoadingRemote] = useState(false)
  const v = value || { baseUrl: '', apiKey: '', model: '' }
  const effectiveBase = v.baseUrl || mainConfig?.baseUrl || ''
  const effectiveKey = v.apiKey || mainConfig?.apiKey || ''

  const loadRemoteModels = async () => {
    if (!effectiveBase || !effectiveKey) return
    setLoadingRemote(true)
    const ids = await fetchModels(effectiveBase, effectiveKey)
    setRemoteModels(ids)
    setLoadingRemote(false)
  }

  const displayModels = remoteModels.length ? remoteModels : suggestedModels
  const filtered = filter ? displayModels.filter(m => m.toLowerCase().includes(filter.toLowerCase())) : displayModels

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
      <div className="flex gap-1.5 items-center">
        <input
          className="input !text-xs !py-1.5 flex-1"
          value={v.model}
          onChange={e => onChange({ ...v, model: e.target.value })}
          placeholder="模型名称"
          spellCheck={false}
        />
        <button
          onClick={loadRemoteModels}
          disabled={loadingRemote || (!effectiveBase || !effectiveKey)}
          className="text-[10px] text-sky-700 hover:text-sky-900 disabled:opacity-40 shrink-0 px-2"
        >
          {loadingRemote ? '…' : '拉取'}
        </button>
      </div>
      {remoteModels.length > 0 && (
        <input
          className="input !text-[10px] !py-1"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="搜索筛选模型…"
          spellCheck={false}
        />
      )}
      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
        {filtered.map(m => (
          <button key={m} onClick={() => onChange({ ...v, model: m })} className={`text-[10px] px-2 py-0.5 rounded-full ${v.model === m ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
            {m}
          </button>
        ))}
        {filter && !filtered.length && <span className="text-[10px] text-ink-400">无匹配</span>}
      </div>
    </div>
  )
}
