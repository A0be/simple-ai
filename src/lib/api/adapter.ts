/**
 * Chat adapter interface.
 *
 * simple-ai talks to three protocol families:
 *  - OpenAI Chat Completions (chat/completions) — most providers, default
 *  - Anthropic Messages API (api.anthropic.com/v1/messages) — Claude native
 *  - OpenAI Responses API (/v1/responses) — newer OpenAI endpoint
 *
 * The dispatcher in ai.ts picks an adapter based on baseUrl, then this contract
 * normalizes the streaming surface (text / thinking / tool_calls deltas).
 *
 * Each adapter is responsible for:
 *  - URL normalization for its protocol
 *  - Request body shape + headers
 *  - SSE / non-stream response parsing
 *  - Mapping protocol-specific tool semantics into ToolCall[]
 *  - Wrapping the network call with withRetry on the fetch boundary (not the
 *    stream body — re-streaming would replay onChunk and cause UI duplication)
 */
import type { ChatMessage, ToolCall } from '@/types'
import type { RetryInfo } from '../retry'

export interface AdapterStreamOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  /** OpenAI-style function tool schemas (caller passes normalized to OpenAI shape) */
  tools?: unknown[]
  useStream: boolean
  signal?: AbortSignal
  onChunk?: (text: string) => void
  onThinkingChunk?: (text: string) => void
  onToolCalls?: (toolCalls: ToolCall[]) => void
  onToolCallDelta?: (index: number, delta: Partial<ToolCall>) => void
  onRetry?: (info: RetryInfo) => void
}

export interface StreamResult {
  content: string
  thinking: string
  toolCalls: ToolCall[]
  finishReason?: string
}

export interface ChatAdapter {
  /** Short human label shown in Settings / errors */
  name: string
  /** True if this adapter handles the given baseUrl */
  matches: (baseUrl: string) => boolean
  /** Do the actual streaming call */
  streamChat: (opts: AdapterStreamOptions) => Promise<StreamResult>
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}
