/**
 * Multi-modal API module — image generation, audio TTS, video generation.
 * Uses OpenAI-compatible endpoints (works with MiniToken, OpenAI, etc.)
 */
import type { ApiConfig, ModelEndpoint } from '@/types'
import { loadConfig } from './storage'

function getEndpoint(override?: ModelEndpoint, fallback?: ApiConfig): { baseUrl: string; apiKey: string; model: string } {
  const cfg = fallback || loadConfig()
  if (override?.baseUrl && override?.apiKey && override?.model) {
    return override
  }
  return { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model }
}

function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/v\d+$/, (m) => m)
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

export async function generateImage(opts: ImageGenOptions): Promise<ImageGenResult[]> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.imageModel, cfg)
  const base = normalizeBase(ep.baseUrl)
  const url = `${base}/v1/images/generations`

  const body: Record<string, unknown> = {
    model: opts.model || ep.model || 'gpt-image-1',
    prompt: opts.prompt,
    n: opts.n || 1,
    size: opts.size || '1024x1024',
  }
  if (opts.quality) body.quality = opts.quality

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`图像生成失败 (${resp.status}): ${text.slice(0, 200)}`)
  }

  const json = await resp.json()
  return json.data || []
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
    model: opts.model || ep.model || 'tts-1',
    input: opts.input,
    voice: opts.voice || 'alloy',
    speed: opts.speed || 1.0,
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`语音生成失败 (${resp.status}): ${text.slice(0, 200)}`)
  }

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

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ep.apiKey}` },
    body: form,
  })

  if (!resp.ok) throw new Error(`语音识别失败 (${resp.status})`)
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

export async function generateVideo(opts: VideoGenOptions): Promise<VideoGenResult> {
  const cfg = loadConfig()
  const ep = getEndpoint(cfg.videoModel, cfg)
  const base = normalizeBase(ep.baseUrl)

  const body: Record<string, unknown> = {
    model: opts.model || ep.model || 'veo-2',
    prompt: opts.prompt,
  }
  if (opts.duration) body.duration = opts.duration
  if (opts.size) body.size = opts.size

  // Try standard video endpoint
  const resp = await fetch(`${base}/v1/videos/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`视频生成失败 (${resp.status}): ${text.slice(0, 200)}`)
  }

  const json = await resp.json()
  return { id: json.id || json.task_id || '', status: json.status || 'pending', url: json.url }
}

// ── Embeddings ──

export async function createEmbedding(input: string | string[], model?: string): Promise<number[][]> {
  const cfg = loadConfig()
  const base = normalizeBase(cfg.baseUrl)
  const url = `${base}/v1/embeddings`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: model || 'text-embedding-3-small', input }),
  })

  if (!resp.ok) throw new Error(`Embedding 失败 (${resp.status})`)
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
