import type { ApiConfig, ChatMessage, ToolCall, Attachment } from '@/types'
import { withRetry, type RetryInfo } from './retry'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ApiError('请先在「设置」中填写 API 地址 (baseUrl)', 400)
  // Already a full completions endpoint
  if (/\/chat\/completions$/.test(trimmed)) return trimmed
  // /v1, /v2, etc.
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`
  // /api or /api/v1 style
  if (/\/api(\/v\d+)?$/.test(trimmed)) return `${trimmed}/chat/completions`
  // Bare domain or path without version — append /v1
  return `${trimmed}/v1/chat/completions`
}

/** what the API expects on the wire for a message */
function toWireMessage(m: ChatMessage): Record<string, unknown> {
  const base: Record<string, unknown> = { role: m.role }
  if (m.role === 'tool') {
    base.tool_call_id = m.tool_call_id
    base.content = m.content
    if (m.name) base.name = m.name
    return base
  }
  if (m.role === 'assistant') {
    if (m.content) base.content = m.content
    // Some thinking models (DeepSeek-R1 et al.) reject the next turn if the
    // prior reasoning_content isn't echoed back on the same assistant message.
    if (m.reasoning_content) base.reasoning_content = m.reasoning_content
    if (m.tool_calls && m.tool_calls.length) {
      base.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments }
      }))
    }
    // OpenAI requires content even if null; some impls require empty string
    if (!base.content && !base.tool_calls) base.content = ''
    return base
  }
  // user / system — support attachments (vision)
  if (m.role === 'user' && m.attachments?.length) {
    base.content = buildMultipartContent(m.content, m.attachments)
    return base
  }
  base.content = m.content
  return base
}

function buildMultipartContent(text: string, attachments: Attachment[]): unknown[] {
  const parts: unknown[] = []
  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: att.data } })
    } else {
      parts.push({ type: 'text', text: `[${att.name}]\n${att.data}` })
    }
  }
  if (text) parts.push({ type: 'text', text })
  return parts
}

export interface StreamOptions {
  config: ApiConfig
  messages: ChatMessage[]
  temperature?: number
  /** if provided, include as `tools` in request; receive tool_calls in response */
  tools?: unknown[]
  /** force a specific model (overrides config.model) */
  model?: string
  /** called for each text delta */
  onChunk?: (text: string) => void
  /** called for each thinking/reasoning delta */
  onThinkingChunk?: (text: string) => void
  /** called when assistant message is complete with assembled tool_calls (if any) */
  onToolCalls?: (toolCalls: ToolCall[]) => void
  /** called for each tool_call delta to allow incremental UI render */
  onToolCallDelta?: (index: number, delta: Partial<ToolCall>) => void
  /** notified before each retry attempt (not before the first) */
  onRetry?: (info: RetryInfo) => void
  signal?: AbortSignal
}

export interface StreamResult {
  /** assembled assistant content (may be empty if only tool_calls were emitted) */
  content: string
  /** assembled thinking/reasoning content */
  thinking: string
  /** any tool calls the model wants to make */
  toolCalls: ToolCall[]
  /** finish reason as reported by the API */
  finishReason?: string
}

/**
 * Call the chat completions endpoint with streaming SSE.
 * Supports OpenAI-style `tools` + `tool_calls` (DeepSeek, GLM, Qwen, OpenAI all compatible).
 */
export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  const {
    config,
    messages,
    temperature = 0.7,
    tools,
    onChunk,
    onThinkingChunk,
    onToolCalls,
    onToolCallDelta,
    signal
  } = opts
  if (!config.apiKey) throw new ApiError('请先在「设置」中填写 API Key', 400)
  if (!config.model) throw new ApiError('请先在「设置」中选择模型', 400)

  const url = normalizeBaseUrl(config.baseUrl)
  const model = opts.model || config.model
  const useStream = !config.disableStreaming

  const body: Record<string, unknown> = {
    model,
    messages: messages.map(toWireMessage),
    temperature,
    stream: useStream
  }
  if (tools && tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const response = await withRetry(
    async (attemptSignal) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: attemptSignal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        throw new ApiError(
          `请求失败 (${r.status}): ${text.slice(0, 500) || r.statusText}`,
          r.status
        )
      }
      return r
    },
    { signal, onRetry: opts.onRetry },
  )

  // Non-streaming fallback
  if (!useStream) {
    const json = await response.json()
    const choice = json.choices?.[0]
    const msg = choice?.message ?? {}
    const content = String(msg.content ?? '')
    const thinking = String(msg.reasoning_content ?? msg.thinking ?? '')
    if (thinking) onThinkingChunk?.(thinking)
    if (content) onChunk?.(content)
    const toolCalls: ToolCall[] =
      (msg.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments ?? ''
      }))
    if (toolCalls.length) onToolCalls?.(toolCalls)
    return { content, thinking, toolCalls, finishReason: choice?.finish_reason }
  }

  if (!response.body) throw new ApiError('服务端未返回响应体', 500)

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullContent = ''
  let fullThinking = ''
  let finishReason: string | undefined
  // tool_call assembly map by index (model streams arguments token by token)
  const tcBuffer = new Map<
    number,
    { id?: string; name?: string; arguments: string }
  >()

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') {
        const toolCalls = finalizeToolCalls(tcBuffer)
        if (toolCalls.length) onToolCalls?.(toolCalls)
        return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
      }
      try {
        const json = JSON.parse(data)
        const choice = json.choices?.[0]
        if (!choice) continue
        if (choice.finish_reason) finishReason = choice.finish_reason
        const delta = choice.delta ?? {}
        // Thinking / reasoning content (DeepSeek, o-series, Claude)
        const thinkDelta = delta.reasoning_content ?? delta.thinking ?? ''
        if (typeof thinkDelta === 'string' && thinkDelta) {
          fullThinking += thinkDelta
          onThinkingChunk?.(thinkDelta)
        }
        if (typeof delta.content === 'string' && delta.content) {
          fullContent += delta.content
          onChunk?.(delta.content)
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0
            const slot = tcBuffer.get(idx) ?? { arguments: '' }
            if (tc.id) slot.id = tc.id
            if (tc.function?.name) slot.name = tc.function.name
            if (typeof tc.function?.arguments === 'string')
              slot.arguments += tc.function.arguments
            tcBuffer.set(idx, slot)
            onToolCallDelta?.(idx, {
              id: slot.id,
              name: slot.name,
              arguments: slot.arguments
            })
          }
        }
      } catch {
        continue
      }
    }
  }

  const toolCalls = finalizeToolCalls(tcBuffer)
  if (toolCalls.length) onToolCalls?.(toolCalls)
  return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
}

function finalizeToolCalls(
  buf: Map<number, { id?: string; name?: string; arguments: string }>
): ToolCall[] {
  const sorted = [...buf.entries()].sort((a, b) => a[0] - b[0])
  return sorted
    .filter(([, v]) => v.name)
    .map(([idx, v]) => ({
      id: v.id || `call_${idx}_${Date.now().toString(36)}`,
      name: v.name!,
      arguments: v.arguments || '{}'
    }))
}

export async function testConnection(config: ApiConfig): Promise<string> {
  let result = ''
  const r = await streamChat({
    config,
    messages: [
      { role: 'system', content: '你是一个测试助手，请简短回复。' },
      { role: 'user', content: '说"连接成功"四个字。' }
    ],
    temperature: 0,
    onChunk: (t) => {
      result += t
    }
  })
  return (result || r.content).trim() || '连接成功'
}
