import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { activeMcpClients } from '@/lib/mcp/client'

const LIST_MCP_RESOURCES_SCHEMA = {
  type: 'object',
  properties: {
    server: {
      type: 'string',
      description:
        'Optional MCP server id or name to filter on. When omitted, returns resources from every connected server.',
    },
  },
}

export const ListMcpResourcesTool: ToolDef = {
  name: 'ListMcpResources',
  description:
    'List resources (files, records, prompts, etc.) exposed by connected MCP servers. ' +
    'Servers that do not implement the `resources/list` capability are silently skipped. ' +
    'Use this to discover what data sources are reachable; pair with `ReadMcpResource` to fetch a specific entry.',
  category: 'core',
  planSafe: true,
  parameters: LIST_MCP_RESOURCES_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { server } = parseToolArgs<{ server?: string }>(ctx.call.arguments)
    const clients = activeMcpClients().filter(c => !server || c.id === server || c.name === server)
    if (clients.length === 0) {
      const msg = server
        ? `ListMcpResources: 没有名为/ID 为「${server}」的已连接 MCP 服务器。`
        : 'ListMcpResources: 当前没有已连接的 MCP 服务器。请到 MCP 页配置并连接。'
      return { content: msg, isError: !!server }
    }

    const sections: string[] = []
    let total = 0
    for (const c of clients) {
      try {
        const resources = await c.listResources()
        if (resources.length === 0) {
          sections.push(`### ${c.name} (${c.id})\n(无资源或服务器未实现 resources/list)`)
          continue
        }
        total += resources.length
        const lines = resources.map(r => {
          const mime = r.mimeType ? ` [${r.mimeType}]` : ''
          const desc = r.description ? ` — ${r.description}` : ''
          return `- ${r.name || r.uri}${mime}\n  uri: ${r.uri}${desc}`
        })
        sections.push(`### ${c.name} (${c.id}) — ${resources.length} resource(s)\n${lines.join('\n')}`)
      } catch (e) {
        sections.push(`### ${c.name} (${c.id}) — ⚠️ ${(e as Error).message}`)
      }
    }
    return {
      content: `共 ${total} 个资源，来自 ${clients.length} 个 MCP 服务器：\n\n${sections.join('\n\n')}`,
    }
  },
}
