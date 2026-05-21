import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

const TOOL_SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Keyword or phrase to search for across tool names and descriptions. Case-insensitive.',
    },
    limit: {
      type: 'number',
      description: 'Max number of matches to return (default 10, max 30).',
    },
  },
  required: ['query'],
}

interface Match {
  name: string
  score: number
  description: string
  category?: string
}

/** Tokenize on whitespace and slashes so "file edit" and "file/edit" match the same. */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[\s/_\-.,;]+/).filter(Boolean)
}

function score(tool: { name: string; description: string }, qTokens: string[]): number {
  const haystackName = tool.name.toLowerCase()
  const haystackDesc = tool.description.toLowerCase()
  let s = 0
  for (const t of qTokens) {
    if (haystackName === t) s += 100
    else if (haystackName.includes(t)) s += 40
    if (haystackDesc.includes(t)) s += 5
  }
  return s
}

export const ToolSearchTool: ToolDef = {
  name: 'ToolSearch',
  description:
    'Search the registered tool set by keyword. Returns matching tool names with their descriptions. ' +
    'Use this when you are not sure which tool fits — e.g. "search files", "send chat message", "schedule task". ' +
    'Read-only and safe in plan mode.',
  category: 'core',
  planSafe: true,
  parameters: TOOL_SEARCH_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { query, limit } = parseToolArgs<{ query: string; limit?: number }>(ctx.call.arguments)
    if (!query || !query.trim()) {
      return { content: 'ToolSearch: missing `query`.', isError: true }
    }
    const cap = Math.max(1, Math.min(limit ?? 10, 30))
    const qTokens = tokenize(query)
    if (qTokens.length === 0) {
      return { content: 'ToolSearch: query contained no searchable tokens.', isError: true }
    }
    const env = ctx.isTauri ? 'tauri' : 'web'
    const tools = ctx.registry.list(env)

    const matches: Match[] = []
    for (const t of tools) {
      // Skip self to avoid recursion-looking results
      if (t.name === 'ToolSearch') continue
      const s = score({ name: t.name, description: t.description }, qTokens)
      if (s > 0) {
        matches.push({ name: t.name, score: s, description: t.description, category: t.category })
      }
    }
    matches.sort((a, b) => b.score - a.score)
    const top = matches.slice(0, cap)

    if (top.length === 0) {
      return { content: `No tools matched "${query}". Try simpler keywords or check /tools for the full list.` }
    }
    const lines = top.map(
      (m, i) =>
        `${i + 1}. ${m.name}${m.category ? `  [${m.category}]` : ''}\n   ${m.description.slice(0, 200)}`,
    )
    return {
      content: `Found ${top.length} tool(s) matching "${query}":\n\n${lines.join('\n\n')}`,
    }
  },
}
