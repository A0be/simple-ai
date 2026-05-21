/**
 * Minimal LSP client. Tauri-only (uses lsp_spawn/lsp_send/lsp_close commands).
 *
 * Supports the subset of requests we surface as tools: initialize, didOpen,
 * definition, references, hover.
 */
import { tauriInvoke } from '@/lib/tauri'

interface PendingRequest {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

export interface LspServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  rootUri: string
}

export class LspClient {
  readonly id: string
  readonly rootUri: string
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private listenerUnsub?: () => void
  private opened = new Set<string>()

  private constructor(id: string, rootUri: string) {
    this.id = id
    this.rootUri = rootUri
  }

  static async start(cfg: LspServerConfig): Promise<LspClient> {
    const id = await tauriInvoke<string>('lsp_spawn', {
      command: cfg.command,
      args: cfg.args || [],
      env: cfg.env || {}
    })
    const client = new LspClient(id, cfg.rootUri)
    await client.attachListener()
    await client.initialize()
    return client
  }

  private async attachListener() {
    const { listen } = await import('@tauri-apps/api/event')
    const unsub = await listen<string>(`lsp:${this.id}:message`, (e) => {
      this.handleMessage(e.payload)
    })
    this.listenerUnsub = unsub
  }

  private handleMessage(json: string) {
    try {
      const obj = JSON.parse(json) as { id?: number; result?: unknown; error?: { message: string } }
      if (typeof obj.id === 'number' && this.pending.has(obj.id)) {
        const p = this.pending.get(obj.id)!
        this.pending.delete(obj.id)
        if (obj.error) p.reject(new Error(obj.error.message))
        else p.resolve(obj.result)
      }
    } catch {
      /* ignore notifications & malformed */
    }
  }

  private send(method: string, params: unknown, expectResponse: boolean): Promise<unknown> {
    if (!expectResponse) {
      const note = { jsonrpc: '2.0', method, params }
      return tauriInvoke('lsp_send', { id: this.id, body: JSON.stringify(note) }).then(() => undefined)
    }
    const rid = this.nextId++
    const req = { jsonrpc: '2.0', id: rid, method, params }
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(rid, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(rid)) {
          this.pending.delete(rid)
          reject(new Error(`LSP timeout: ${method}`))
        }
      }, 15_000)
    })
    tauriInvoke('lsp_send', { id: this.id, body: JSON.stringify(req) }).catch((e) => {
      const p = this.pending.get(rid)
      if (p) {
        p.reject(e as Error)
        this.pending.delete(rid)
      }
    })
    return promise
  }

  async initialize(): Promise<unknown> {
    const res = await this.send(
      'initialize',
      {
        processId: null,
        rootUri: this.rootUri,
        capabilities: {
          textDocument: {
            definition: { linkSupport: false },
            references: {},
            hover: { contentFormat: ['markdown', 'plaintext'] }
          }
        }
      },
      true
    )
    await this.send('initialized', {}, false)
    return res
  }

  /** Open a document if not already opened. */
  async ensureOpen(uri: string, text: string, languageId: string): Promise<void> {
    if (this.opened.has(uri)) return
    await this.send(
      'textDocument/didOpen',
      {
        textDocument: { uri, languageId, version: 1, text }
      },
      false
    )
    this.opened.add(uri)
  }

  async definition(uri: string, line: number, character: number): Promise<unknown> {
    return await this.send(
      'textDocument/definition',
      {
        textDocument: { uri },
        position: { line, character }
      },
      true
    )
  }

  async references(uri: string, line: number, character: number): Promise<unknown> {
    return await this.send(
      'textDocument/references',
      {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true }
      },
      true
    )
  }

  async hover(uri: string, line: number, character: number): Promise<unknown> {
    return await this.send(
      'textDocument/hover',
      {
        textDocument: { uri },
        position: { line, character }
      },
      true
    )
  }

  async shutdown(): Promise<void> {
    try {
      await this.send('shutdown', {}, true)
      await this.send('exit', {}, false)
    } catch {
      /* ignore */
    }
    if (this.listenerUnsub) this.listenerUnsub()
    await tauriInvoke('lsp_close', { id: this.id })
  }
}

const ACTIVE = new Map<string, LspClient>()

export async function startLsp(cfg: LspServerConfig & { id?: string }): Promise<string> {
  const c = await LspClient.start(cfg)
  const key = cfg.id || c.id
  ACTIVE.set(key, c)
  return key
}

export function getLsp(id: string): LspClient | undefined {
  return ACTIVE.get(id)
}

export async function stopLsp(id: string): Promise<void> {
  const c = ACTIVE.get(id)
  if (!c) return
  await c.shutdown()
  ACTIVE.delete(id)
}

export function listLsp(): { id: string; rootUri: string }[] {
  return [...ACTIVE.entries()].map(([id, c]) => ({ id, rootUri: c.rootUri }))
}
