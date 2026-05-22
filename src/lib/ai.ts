/**
 * Dispatcher — picks the right adapter for the user's baseUrl and delegates.
 *
 * URL detection rules:
 *   - `api.anthropic.com` → AnthropicMessages adapter
 *   - path contains `/responses` → OpenAIResponses adapter
 *   - else → OpenAI Chat Completions (default)
 *
 * Public surface stays the same so the rest of the app (agentLoop, Settings
 * testConnection) doesn't need changes — same StreamOptions/StreamResult.
 */
import type { ApiConfig, ChatMessage, ToolCall } from '@/types'
import type { RetryInfo } from './retry'
import { ApiError, type ChatAdapter, type StreamResult } from './api/adapter'
import { openaiChatAdapter } from './api/openai-chat'
import { anthropicAdapter } from './api/anthropic'
import { openaiResponsesAdapter } from './api/openai-responses'

export { ApiError }

const ADAPTERS: ChatAdapter[] = [anthropicAdapter, openaiResponsesAdapter, openaiChatAdapter]

/** Pick adapter by user-supplied baseUrl. Returns the most specific match;
 *  openaiChatAdapter is the catch-all default at the end of the list. */
export function detectAdapter(baseUrl: string): ChatAdapter {
  for (const a of ADAPTERS) {
    if (a === openaiChatAdapter) continue // fallback, check explicitly below
    if (a.matches(baseUrl)) return a
  }
  return openaiChatAdapter
}

export interface StreamOptions {
  config: ApiConfig
  messages: ChatMessage[]
  temperature?: number
  tools?: unknown[]
  model?: string
  onChunk?: (text: string) => void
  onThinkingChunk?: (text: string) => void
  onToolCalls?: (toolCalls: ToolCall[]) => void
  onToolCallDelta?: (index: number, delta: Partial<ToolCall>) => void
  onRetry?: (info: RetryInfo) => void
  signal?: AbortSignal
}

export type { StreamResult } from './api/adapter'

export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  const { config, messages, temperature = 0.7, tools, signal } = opts
  if (!config.apiKey) throw new ApiError('请先在「设置」中填写 API Key', 400)
  if (!config.model) throw new ApiError('请先在「设置」中选择模型', 400)

  const adapter = detectAdapter(config.baseUrl)
  return await adapter.streamChat({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: opts.model || config.model,
    messages,
    temperature,
    tools,
    useStream: !config.disableStreaming,
    signal,
    onChunk: opts.onChunk,
    onThinkingChunk: opts.onThinkingChunk,
    onToolCalls: opts.onToolCalls,
    onToolCallDelta: opts.onToolCallDelta,
    onRetry: opts.onRetry,
  })
}

export async function testConnection(config: ApiConfig): Promise<string> {
  let result = ''
  const r = await streamChat({
    config,
    messages: [
      { role: 'system', content: '你是一个测试助手，请简短回复。' },
      { role: 'user', content: '说"连接成功"四个字。' },
    ],
    temperature: 0,
    onChunk: (t) => { result += t },
  })
  return (result || r.content).trim() || '连接成功'
}
