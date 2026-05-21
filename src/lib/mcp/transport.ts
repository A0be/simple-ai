/**
 * MCP transport abstraction. Two implementations:
 *  - HttpTransport: POST + SSE (works in both Web and Tauri)
 *  - StdioTransport: Tauri-only; spawns a subprocess and communicates over stdin/stdout (newline-delimited JSON)
 */
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpServerConfig
} from './types'
import { tauriInvoke } from '@/lib/tauri'

export interface Transport {
  /** Send a request and await its response. */
  request<T = unknown>(method: string, params?: unknown): Promise<T>
  /** Send a notification (no response expected). */
  notify(method: string, params?: unknown): Promise<void>
  /** Close + clean up. */
  close(): Promise<void>
}

let __id = 1
function nextId(): number {
  return __id++
}

/* ---------- HTTP transport ---------- */

export class HttpTransport implements Transport {
  private url: string
  private pending = new Map<number | string, (r: JsonRpcResponse) => void>()
  private closed = false

  constructor(url: string) {
    this.url = url
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) throw new Error('transport closed')
    const id = nextId()
    const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const r = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!r.ok) throw new Error(`MCP HTTP ${r.status}: ${await r.text()}`)
    const data = (await r.json()) as JsonRpcResponse<T>
    if (data.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`)
    return data.result as T
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (this.closed) return
    const body: JsonRpcNotification = { jsonrpc: '2.0', method, params }
    await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  async close(): Promise<void> {
    this.closed = true
    this.pending.clear()
  }
}

/* ---------- stdio transport (Tauri only) ---------- */

export class StdioTransport implements Transport {
  private spawnId: string
  private pending = new Map<number | string, (r: JsonRpcResponse) => void>()
  private listenerUnsub?: () => void
  private closed = false

  constructor(spawnId: string) {
    this.spawnId = spawnId
  }

  static async spawn(cfg: McpServerConfig): Promise<StdioTransport> {
    if (!cfg.command) throw new Error('stdio MCP needs a command')
    const id = await tauriInvoke<string>('mcp_stdio_spawn', {
      command: cfg.command,
      args: cfg.args || [],
      env: cfg.env || {}
    })
    const t = new StdioTransport(id)
    await t.attachListener()
    return t
  }

  private async attachListener() {
    // Listen for `mcp:<spawnId>:line` events emitted by Rust as the subprocess writes lines.
    const { listen } = await import('@tauri-apps/api/event')
    const unlisten = await listen<string>(`mcp:${this.spawnId}:line`, (e) => {
      this.handleLine(e.payload)
    })
    this.listenerUnsub = unlisten
  }

  private handleLine(line: string) {
    if (!line.trim()) return
    try {
      const obj = JSON.parse(line) as JsonRpcResponse
      if ('id' in obj && this.pending.has(obj.id)) {
        const resolve = this.pending.get(obj.id)!
        this.pending.delete(obj.id)
        resolve(obj)
      }
    } catch {
      /* ignore non-JSON lines (servers often log to stdout too) */
    }
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) throw new Error('transport closed')
    const id = nextId()
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const promise = new Promise<JsonRpcResponse<T>>((resolve, reject) => {
      this.pending.set(id, (r) => resolve(r as JsonRpcResponse<T>))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`MCP stdio timeout: ${method}`))
        }
      }, 30_000)
    })
    await tauriInvoke('mcp_stdio_send', {
      id: this.spawnId,
      line: JSON.stringify(req) + '\n'
    })
    const data = await promise
    if (data.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`)
    return data.result as T
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (this.closed) return
    const note: JsonRpcNotification = { jsonrpc: '2.0', method, params }
    await tauriInvoke('mcp_stdio_send', {
      id: this.spawnId,
      line: JSON.stringify(note) + '\n'
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (this.listenerUnsub) this.listenerUnsub()
    try {
      await tauriInvoke('mcp_stdio_close', { id: this.spawnId })
    } catch {
      /* ignore */
    }
  }
}
