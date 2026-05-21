import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

interface FetchInput {
  url: string
  prompt?: string
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    url: {
      type: 'string',
      description: 'Fully-formed URL to fetch.'
    },
    prompt: {
      type: 'string',
      description:
        'Optional instruction describing what to extract / summarize from the page.'
    }
  },
  required: ['url']
}

/** Strip HTML to a rough markdown-ish text representation. */
function htmlToText(html: string): string {
  // Remove scripts/styles
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  // Convert <br> / <p> / </p> to newlines
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<\/p>/gi, '\n\n')
  // Convert headings
  t = t.replace(/<h([1-6])[^>]*>/gi, (_, n) => '\n' + '#'.repeat(Number(n)) + ' ')
  t = t.replace(/<\/h[1-6]>/gi, '\n\n')
  // Convert links to "text (url)"
  t = t.replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
  // Drop other tags
  t = t.replace(/<[^>]+>/g, '')
  // Decode common entities
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  // Collapse whitespace
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return t
}

const cache = new Map<string, { at: number; text: string }>()
const CACHE_TTL = 15 * 60 * 1000

export const WebFetchTool: ToolDef = {
  name: 'WebFetch',
  description:
    'Fetch a URL and return its content as plain text (HTML stripped). Optional `prompt` is included verbatim with the content for the next model turn to summarize.',
  category: 'web',
  planSafe: true,
  env: 'both',
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { url, prompt } = parseToolArgs<FetchInput>(ctx.call.arguments)
    if (!url) return { content: 'WebFetch: missing `url`', isError: true }
    let target = url
    if (target.startsWith('http://')) target = 'https://' + target.slice(7)

    const cached = cache.get(target)
    const now = Date.now()
    let text: string
    if (cached && now - cached.at < CACHE_TTL) {
      text = cached.text
    } else {
      try {
        const resp = await fetch(target, {
          signal: ctx.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'simple-ai/1.0 WebFetch' }
        })
        if (!resp.ok) {
          return {
            content: `WebFetch: HTTP ${resp.status} ${resp.statusText} for ${target}`,
            isError: true
          }
        }
        const body = await resp.text()
        const ctype = resp.headers.get('content-type') || ''
        text = /html|xml/.test(ctype) ? htmlToText(body) : body
        // Trim to ~30k chars
        if (text.length > 30000) text = text.slice(0, 30000) + '\n...[truncated]'
        cache.set(target, { at: now, text })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: `WebFetch failed: ${msg}. Note: web build is subject to CORS; for non-CORS hosts use the Tauri desktop build.`,
          isError: true
        }
      }
    }
    const header = `URL: ${target}\n` + (prompt ? `Request: ${prompt}\n\n` : '\n')
    return {
      content: header + '---\n' + text + '\n---',
      ui: { kind: 'fetch', data: { url: target, prompt, snippet: text.slice(0, 400) } }
    }
  }
}
