/**
 * MCP types — Model Context Protocol primitives.
 *
 * Spec: https://modelcontextprotocol.io/  (JSON-RPC 2.0 over multiple transports)
 *
 * We model only what we use: initialize, tools/list, tools/call.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

/** Server connection config (stored in localStorage). */
export interface McpServerConfig {
  id: string
  name: string
  /** Transport: http/sse over fetch+EventStream, or stdio (Tauri only). */
  transport: 'http' | 'stdio'
  /** For http: full URL (POST endpoint). */
  url?: string
  /** For stdio: command + args. */
  command?: string
  args?: string[]
  env?: Record<string, string>
  /** Disable without removing. */
  enabled: boolean
}

/** Tool returned by an MCP server's tools/list. */
export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpInitializeResult {
  protocolVersion: string
  serverInfo?: { name: string; version: string }
  capabilities?: Record<string, unknown>
}

export interface McpToolsListResult {
  tools: McpTool[]
}

export interface McpToolsCallResult {
  content: Array<{ type: string; text?: string; data?: string }>
  isError?: boolean
}
