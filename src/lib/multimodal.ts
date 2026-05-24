/**
 * Multi-modal API module — image generation, audio TTS, video generation.
 * Uses OpenAI-compatible endpoints (works with MiniToken, OpenAI, etc.)
 */
import type { ApiConfig, ModelEndpoint } from '@/types'
import { loadConfig } from './storage'
import { withRetry } from './retry'

const MINITOKEN_BASE = 'https://minitoken.top/v1'

// Per-capability timeouts: image gen often takes 30-60s, video generation
// is async-but-some-providers-block for 5+ min, TTS is fast, transcription is
// proportional to clip length.
const TIMEOUT_IMAGE_MS = 600_000
const TIMEOUT_VIDEO_MS = 600_000
const TIMEOUT_AUDIO_MS = 600_000
const TIMEOUT_EMBED_MS = 60_000

const MULTIMODAL_MAX_ATTEMPTS = 2 // multimodal calls are expensive — fewer retries

/**
 * Resolve which endpoint to call.
 *  - If the per-capability override is fully filled in (baseUrl + apiKey + model), use it as-is.
 *  - Otherwise fall back to MiniToken — the main API key is reused, so the user must ensure
 *    that key is valid for minitoken.top (which is the typical setup).
 */
function getEndpoint(override?: ModelEndpoint, fallback?: ApiConfig): { baseUrl: string; apiKey: string; model: string } {
  const cfg = fallback || loadConfig()
  if (override?.baseUrl && override?.apiKey && override?.model) {
    return override
  }
  return {
    baseUrl: MINITOKEN_BASE,
    apiKey: override?.apiKey || cfg.apiKey,
    model: override?.model || '',
  }
}

/** Strip trailing slashes, /chat/completions, and a trailing /vN segment so callers
 *  can append /v1/<resource> uniformly. Without this, a user-entered base
 *  `https://minitoken.top/v1` ends up producing `/v1/v1/images/generations`.
 */
function normalizeBase(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '')
    .replace(/\/v\d+$/, '')
}

// ── Image Generation ──

export interface ImageGenOptions {
  prompt: string
  model?: string
  size?: string
  n?: number
  quality?: string
}

export interface ImageGenResult {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeImageItem(item: any): ImageGenResult {
  if (typeof item === 'string') {
    if (item.startsWith('data:')) {
      const comma = item.indexOf(',')
      return { b64_json: comma >= 0 ? item.slice(comma + 1) : item }
    }
    return { url: item }
  }
  if (!item || typeof item !== 'object') return {}
  const url = item.url || item.image_url || item.uri || item.image || item.output_url
  const b64 = item.b64_json || item.b64 || item.base64 || item.image_base64
  const revised = item.revised_prompt || item.revisedPrompt || item.prompt_revised
  return {
    url: typeof url === 'string' ? url : undefined,
    b64_json: typeof b64 === 'string' ? b64 : undefined,
    revised_prompt: typeof revised === 'string' ? revised : undefined,
  }
}

export async function generateImage(opts: ImageGenOptions): Promise<ImageGenResult[]> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.imageModel, cfg)
  const base = normalizeBase(ep.baseUrl)
  const url = `${base}/v1/images/generations`

  const body: Record<string, unknown> = {
    model: ep.model || opts.model || 'gpt-image-2-all',
    prompt: opts.prompt,
    n: opts.n || 1,
    size: opts.size || '1024x1024',
  }
  if (opts.quality) body.quality = opts.quality

  const resp = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: attemptSignal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        const err = new Error(`图像生成失败 (${r.status}): ${text.slice(0, 200)}`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    { perAttemptTimeoutMs: TIMEOUT_IMAGE_MS, maxAttempts: MULTIMODAL_MAX_ATTEMPTS },
  )

  const json = await resp.json()
  const rawList: any[] =
    (Array.isArray(json.data) && json.data) ||
    (Array.isArray(json.images) && json.images) ||
    (Array.isArray(json.output) && json.output) ||
    (Array.isArray(json.results) && json.results) ||
    (json.url ? [json] : []) ||
    []
  return rawList.map(normalizeImageItem).filter(r => r.url || r.b64_json)
}

// ── Audio TTS ──

export interface TTSOptions {
  input: string
  model?: string
  voice?: string
  speed?: number
}

export async function generateSpeech(opts: TTSOptions): Promise<Blob> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.audioModel, cfg)
  const base = normalizeBase(ep.baseUrl)
  const url = `${base}/v1/audio/speech`

  const body = {
    model: ep.model || opts.model || 'tts-1',
    input: opts.input,
    voice: opts.voice || 'alloy',
    speed: opts.speed || 1.0,
  }

  const resp = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: attemptSignal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        const err = new Error(`语音生成失败 (${r.status}): ${text.slice(0, 200)}`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    { perAttemptTimeoutMs: TIMEOUT_AUDIO_MS, maxAttempts: MULTIMODAL_MAX_ATTEMPTS },
  )

  return await resp.blob()
}

// ── Audio Transcription ──

export async function transcribeAudio(file: Blob, model?: string): Promise<string> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.audioModel, cfg)
  const base = normalizeBase(ep.baseUrl)
  const url = `${base}/v1/audio/transcriptions`

  const form = new FormData()
  form.append('file', file, 'audio.webm')
  form.append('model', model || 'whisper-1')

  const resp = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: attemptSignal,
        headers: { Authorization: `Bearer ${ep.apiKey}` },
        body: form,
      })
      if (!r.ok) {
        const err = new Error(`语音识别失败 (${r.status})`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    { perAttemptTimeoutMs: TIMEOUT_AUDIO_MS, maxAttempts: MULTIMODAL_MAX_ATTEMPTS },
  )
  const json = await resp.json()
  return json.text || ''
}

// ── Video Generation ──

export interface VideoGenOptions {
  prompt: string
  model?: string
  duration?: number
  size?: string
}

export interface VideoGenResult {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  url?: string
  error?: string
}

function extractVideoUrl(json: any): string | undefined {
  if (!json || typeof json !== 'object') return undefined
  const direct = json.url || json.video_url || json.videoUrl || json.output_url
  if (typeof direct === 'string') return direct
  // Some providers wrap the URL inside data[0]
  const list = Array.isArray(json.data) ? json.data : Array.isArray(json.outputs) ? json.outputs : null
  if (list && list.length) {
    const first = list[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      const u = first.url || first.video_url || first.uri || first.output_url
      if (typeof u === 'string') return u
    }
  }
  return undefined
}

export async function generateVideo(opts: VideoGenOptions): Promise<VideoGenResult> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.videoModel, cfg)
  const base = normalizeBase(ep.baseUrl)

  const body: Record<string, unknown> = {
    model: ep.model || opts.model || 'veo-2',
    prompt: opts.prompt,
  }
  if (opts.duration) body.duration = opts.duration
  if (opts.size) body.size = opts.size

  const resp = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(`${base}/v1/video/create`, {
        method: 'POST',
        signal: attemptSignal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        const err = new Error(`视频生成失败 (${r.status}): ${text.slice(0, 200)}`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    { perAttemptTimeoutMs: TIMEOUT_VIDEO_MS, maxAttempts: MULTIMODAL_MAX_ATTEMPTS },
  )

  const json = await resp.json()
  const immediateUrl = extractVideoUrl(json)
  const taskId = json.id || json.task_id || json.taskId || ''

  // If the API returned a URL right away, we're done.
  if (immediateUrl) {
    return { id: taskId, status: 'completed', url: immediateUrl }
  }

  // Otherwise the task is async — poll until completed or timeout.
  if (taskId) {
    const pollUrl = `${base}/v1/video/query`
    const pollStart = Date.now()
    const POLL_INTERVAL = 5_000
    while (Date.now() - pollStart < TIMEOUT_VIDEO_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
      try {
        const pr = await fetch(pollUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
          body: JSON.stringify({ id: taskId, task_id: taskId }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!pr.ok) continue
        const pj = await pr.json()
        const status = (pj.status || '').toLowerCase()
        const videoUrl = extractVideoUrl(pj)
        if (videoUrl) return { id: taskId, status: 'completed', url: videoUrl }
        if (status === 'failed' || status === 'error') {
          return { id: taskId, status: 'failed', error: pj.error || pj.message || 'Video generation failed' }
        }
      } catch { /* retry next interval */ }
    }
  }

  return {
    id: taskId,
    status: json.status || 'pending',
    url: undefined,
    error: taskId ? '轮询超时，任务可能仍在处理中' : undefined,
  }
}

// ── Embeddings ──

export async function createEmbedding(input: string | string[], model?: string): Promise<number[][]> {
  const cfg = loadConfig()
  const base = normalizeBase(cfg.baseUrl)
  const url = `${base}/v1/embeddings`

  const resp = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: attemptSignal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: model || 'text-embedding-3-small', input }),
      })
      if (!r.ok) {
        const err = new Error(`Embedding 失败 (${r.status})`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    { perAttemptTimeoutMs: TIMEOUT_EMBED_MS, maxAttempts: MULTIMODAL_MAX_ATTEMPTS },
  )
  const json = await resp.json()
  return (json.data || []).map((d: { embedding: number[] }) => d.embedding)
}

// ── Model availability check ──

export function hasImageModel(): boolean {
  const cfg = loadConfig()
  return !!(cfg.imageModel?.model || cfg.apiKey)
}

export function hasAudioModel(): boolean {
  const cfg = loadConfig()
  return !!(cfg.audioModel?.model || cfg.apiKey)
}

export function hasVideoModel(): boolean {
  const cfg = loadConfig()
  return !!(cfg.videoModel?.model || cfg.apiKey)
}

// ── Suggested models per capability ──

export const IMAGE_MODELS = ['gpt-image-1', 'dall-e-3', 'midjourney', 'flux-1', 'seedream-3', 'qwen-image-2.0']
export const AUDIO_MODELS = ['tts-1', 'tts-1-hd', 'whisper-1', 'gpt-4o-audio']
export const VIDEO_MODELS = ['veo-2', 'veo-3', 'sora-2', 'kling-video', 'seedance-1-6', 'minimax-hailuo']
