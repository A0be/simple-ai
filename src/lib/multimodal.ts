/**
 * Multi-modal API module — image generation only.
 * Uses OpenAI-compatible endpoints (works with MiniToken, OpenAI, etc.)
 */
import type { ApiConfig, ModelEndpoint } from '@/types'
import { loadConfig } from './storage'
import { withRetry } from './retry'

const MINITOKEN_BASE = 'https://minitoken.top/v1'
const TIMEOUT_IMAGE_MS = 600_000
const MULTIMODAL_MAX_ATTEMPTS = 2

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

// ── Model availability check ──

export function hasImageModel(): boolean {
  const cfg = loadConfig()
  return !!(cfg.imageModel?.model || cfg.apiKey)
}

// ── Suggested models ──

export const IMAGE_MODELS = ['gpt-image-2-all', 'gpt-image-2', 'gpt-image-1', 'dall-e-3', 'midjourney', 'flux-1', 'seedream-3']
