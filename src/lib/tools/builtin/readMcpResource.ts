import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { activeMcpClients } from '@/lib/mcp/client'

const READ_MCP_RESOURCE_SCHEMA = {
  type: 'object',
  properties: {
    uri: {
      type: 'string',
      description: 'Resource URI returned by ListMcpResources (e.g. file:///path/to/x, db://schema/table).',
    },
    server: {
      type: 'string',
      description:
        'Optional MCP server id or name to read from. When omitted, every connected server is tried until one succeeds.',
    },
  },
  required: ['uri'],
}

export const ReadMcpResourceTool: ToolDef = {
  name: 'ReadMcpResource',
  description:
    'Read a single resource from a connected MCP server by URI. Returns concatenated text contents; ' +
    'binary parts are noted but not inlined. Discover URIs with `ListMcpResources` first.',
  category: 'core',
  planSafe: true,
  parameters: READ_MCP_RESOURCE_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { uri, server } = parseToolArgs<{ uri: string; server?: string }>(ctx.call.arguments)
    if (!uri) return { content: 'ReadMcpResource: missing `uri`.', isError: true }

    const clients = activeMcpClients().filter(c => !server || c.id === server || c.name === server)
    if (clients.length === 0) {
      const msg = server
        ? `ReadMcpResource: 没有名为/ID 为「${server}」的已连接 MCP 服务器。`
        : 'ReadMcpResource: 当前没有已连接的 MCP 服务器。'
      return { content: msg, isError: true }
    }

    const errors: string[] = []
    for (const c of clients) {
      try {
        const r = await c.readResource(uri)
        if (!r.contents || r.contents.length === 0) {
          errors.push(`${c.name}: 返回空内容`)
          continue
        }
        const parts: string[] = []
        for (const content of r.contents) {
          if (content.text !== undefined) {
            const mime = content.mimeType ? ` (${content.mimeType})` : ''
            parts.push(`--- ${content.uri}${mime} ---\n${content.text}`)
          } else if (content.blob) {
            parts.push(`--- ${content.uri} [binary ${content.mimeType || 'application/octet-stream'}, ${content.blob.length} base64 chars] ---`)
          }
        }
        return {
          content: `来自 ${c.name} 的 ${r.contents.length} 部分：\n\n${parts.join('\n\n')}`,
        }
      } catch (e) {
        errors.push(`${c.name}: ${(e as Error).message}`)
      }
    }
    return {
      content: `ReadMcpResource 失败 — 没有服务器能返回 ${uri}：\n${errors.join('\n')}`,
      isError: true,
    }
  },
}
