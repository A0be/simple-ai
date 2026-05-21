import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

interface SearchInput {
  query: string
  allowed_domains?: string[]
  blocked_domains?: string[]
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    query: { type: 'string' },
    allowed_domains: { type: 'array' as const, items: { type: 'string' } },
    blocked_domains: { type: 'array' as const, items: { type: 'string' } }
  },
  required: ['query']
}

/**
 * DuckDuckGo HTML scrape — works without API key.
 * Note: CORS-blocked in browser unless the user runs this in Tauri or a proxy.
 */
export const WebSearchTool: ToolDef = {
  name: 'WebSearch',
  description:
    'Search the web (via DuckDuckGo). Returns top result titles + URLs + snippets. Optional include/exclude domains. CORS-blocked in some browsers; works in Tauri desktop.',
  category: 'web',
  planSafe: true,
  env: 'both',
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { query, allowed_domains, blocked_domains } = parseToolArgs<SearchInput>(
      ctx.call.arguments
    )
    if (!query) return { content: 'WebSearch: missing `query`', isError: true }
    let q = query
    if (allowed_domains?.length) q += ' ' + allowed_domains.map((d) => `site:${d}`).join(' OR ')
    if (blocked_domains?.length) q += ' ' + blocked_domains.map((d) => `-site:${d}`).join(' ')
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
    try {
      const resp = await fetch(url, {
        signal: ctx.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 simple-ai/1.0' }
      })
      if (!resp.ok) {
        return { content: `WebSearch: HTTP ${resp.status}`, isError: true }
      }
      const html = await resp.text()
      const results: { title: string; url: string; snippet: string }[] = []
      const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) && results.length < 10) {
        const stripTags = (s: string) =>
          s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
        let link = m[1]
        // DDG wraps URLs in /l/?kh=...&uddg=ENCODED
        const u = link.match(/uddg=([^&]+)/)
        if (u) link = decodeURIComponent(u[1])
        results.push({
          url: link,
          title: stripTags(m[2]),
          snippet: stripTags(m[3])
        })
      }
      if (!results.length) {
        return {
          content: `WebSearch returned no results for: ${query}`,
          ui: { kind: 'search', data: { query, results: [] } }
        }
      }
      const text = results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
        )
        .join('\n\n')
      return {
        content: `Search results for "${query}":\n\n${text}\n\nSources:\n${results
          .map((r) => `- [${r.title}](${r.url})`)
          .join('\n')}`,
        ui: { kind: 'search', data: { query, results } }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        content: `WebSearch failed: ${msg}. If running in browser, try Tauri desktop (CORS).`,
        isError: true
      }
    }
  }
}
