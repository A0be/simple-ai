/**
 * Shared helpers for the Settings page and the per-capability ModelEndpointEditor:
 *  - PRESETS: well-known provider base URLs
 *  - FALLBACK_MODELS: a curated list used when the remote /models endpoint is
 *    unreachable or unauthenticated
 *  - inferModelType: best-effort classification by model id
 *  - fetchModels: probe common /models URL shapes
 */

export interface PresetEndpoint {
  label: string
  baseUrl: string
  hint?: string
}

export const PRESETS: PresetEndpoint[] = [
  { label: 'MiniToken', baseUrl: 'https://minitoken.top/v1', hint: 'minitoken.top 中转，支持 Claude/GPT/Gemini 等' },
  { label: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', hint: '需要全球可访问的网络环境' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', hint: '国内可直接访问' },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', hint: '国内可直接访问' },
  { label: '阿里通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1' },
]

export const FALLBACK_MODELS = [
  // OpenAI — latest first
  'gpt-5.5', 'gpt-5', 'gpt-5-mini',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.5-preview',
  'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini',
  'gpt-image-2-all', 'gpt-image-1', 'dall-e-3',
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

export type ModelType = 'all' | 'chat' | 'reasoning' | 'image' | 'audio' | 'video' | 'embedding'

export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  all: '全部',
  chat: '对话',
  reasoning: '推理',
  image: '图像',
  audio: '音频',
  video: '视频',
  embedding: '向量',
}

export function inferModelType(id: string): Exclude<ModelType, 'all'> {
  const l = id.toLowerCase()
  if (/embed/.test(l)) return 'embedding'
  if (/dall-e|gpt-image|midjourney|flux|stable[-_]?diff|seedream|imagen|sd[-_]/.test(l)) return 'image'
  if (/tts|whisper|audio|speech/.test(l)) return 'audio'
  if (/veo|sora|kling|hailuo|seedance|video|wan-|cogvideo/.test(l)) return 'video'
  if (/^o[1-4]|reasoner|^qwq|thinking/.test(l)) return 'reasoning'
  return 'chat'
}

/**
 * Probe the most common `/models` URL shapes for an OpenAI-compatible base URL.
 * Returns a sorted unique list of model ids, or [] on any failure.
 */
export async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!baseUrl || !apiKey) return []
  const trimmed = baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '')
    .replace(/\/completions$/, '')
  const candidates = [
    trimmed + '/models',
    trimmed + '/v1/models',
    trimmed.replace(/\/v\d+$/, '') + '/v1/models',
  ]
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
