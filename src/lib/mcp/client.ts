/**
 * MCP client — wraps a Transport and exposes high-level methods:
 *   initialize, listTools, callTool.
 *
 * Also adapts each MCP tool into our ToolDef shape so it can be merged into
 * the ToolRegistry alongside built-in tools.
 */
import type { ToolDef, ToolContext, ToolResult } from '@/lib/tools/types'
import { Transport, HttpTransport, StdioTransport } from './transport'
import type {
  McpServerConfig,
  McpInitializeResult,
  McpToolsListResult,
  McpToolsCallResult,
  McpTool,
  McpResource,
  McpResourcesListResult,
  McpResourcesReadResult,
} from './types'

export class McpClient {
  private transport: Transport
  readonly id: string
  readonly name: string
  initialized = false
  private cachedTools: McpTool[] = []

  constructor(cfg: McpServerConfig, transport: Transport) {
    this.transport = transport
    this.id = cfg.id
    this.name = cfg.name
  }

  static async connect(cfg: McpServerConfig): Promise<McpClient> {
    let transport: Transport
    if (cfg.transport === 'http') {
      if (!cfg.url) throw new Error('http MCP needs a url')
      transport = new HttpTransport(cfg.url)
    } else {
      transport = await StdioTransport.spawn(cfg)
    }
    const c = new McpClient(cfg, transport)
    await c.initialize()
    return c
  }

  async initialize(): Promise<McpInitializeResult> {
    const res = await this.transport.request<McpInitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'simple-ai', version: '0.1.0' }
    })
    this.initialized = true
    // notify initialized — required by spec
    try {
      await this.transport.notify('notifications/initialized', {})
    } catch {
      /* some servers don't care */
    }
    return res
  }

  async listTools(force = false): Promise<McpTool[]> {
    if (this.cachedTools.length && !force) return this.cachedTools
    const r = await this.transport.request<McpToolsListResult>('tools/list', {})
    this.cachedTools = r.tools || []
    return this.cachedTools
  }

  async callTool(name: string, args: unknown): Promise<McpToolsCallResult> {
    return await this.transport.request<McpToolsCallResult>('tools/call', {
      name,
      arguments: args
    })
  }

  /** List resources exposed by this server. Servers without resource capability
   *  reject with -32601 (method not found); we surface that as an empty list. */
  async listResources(): Promise<McpResource[]> {
    try {
      const r = await this.transport.request<McpResourcesListResult>('resources/list', {})
      return r.resources || []
    } catch (e) {
      const msg = (e as Error).message || ''
      if (/method not found|-32601/i.test(msg)) return []
      throw e
    }
  }

  /** Read a single resource by URI. */
  async readResource(uri: string): Promise<McpResourcesReadResult> {
    return await this.transport.request<McpResourcesReadResult>('resources/read', { uri })
  }

  async close(): Promise<void> {
    await this.transport.close()
  }

  /** Adapt every MCP tool to a ToolDef the registry can consume. */
  asToolDefs(): ToolDef[] {
    return this.cachedTools.map((t) => this.toolToDef(t))
  }

  private toolToDef(mt: McpTool): ToolDef {
    const self = this
    return {
      name: `mcp__${self.id}__${mt.name}`,
      description: `[MCP/${self.name}] ${mt.description || mt.name}`,
      category: 'misc',
      planSafe: false,
      parameters: (mt.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
      async run(_input, ctx: ToolContext): Promise<ToolResult> {
        try {
          // arguments come in pre-parsed via ctx.call
          let args: unknown = {}
          try {
            args = JSON.parse(ctx.call.arguments || '{}')
          } catch {
            /* leave as {} */
          }
          const r = await self.callTool(mt.name, args)
          const text = r.content
            .map((c) => (c.type === 'text' ? c.text || '' : `[${c.type}]`))
            .join('\n')
          return {
            content: text || '(MCP tool returned no content)',
            isError: r.isError === true,
            ui: { kind: 'generic', data: r }
          }
        } catch (e) {
          return {
            content: `MCP call failed: ${(e as Error).message}`,
            isError: true
          }
        }
      }
    }
  }
}

/* ---------- module-level pool of active MCP clients ---------- */

const ACTIVE = new Map<string, McpClient>()

export async function activateMcp(cfg: McpServerConfig): Promise<McpClient> {
  if (ACTIVE.has(cfg.id)) return ACTIVE.get(cfg.id)!
  const c = await McpClient.connect(cfg)
  await c.listTools()
  ACTIVE.set(cfg.id, c)
  return c
}

export async function deactivateMcp(id: string): Promise<void> {
  const c = ACTIVE.get(id)
  if (!c) return
  try {
    await c.close()
  } catch {
    /* ignore */
  }
  ACTIVE.delete(id)
}

export function activeMcpClients(): McpClient[] {
  return [...ACTIVE.values()]
}

export function getActiveMcp(id: string): McpClient | undefined {
  return ACTIVE.get(id)
}
