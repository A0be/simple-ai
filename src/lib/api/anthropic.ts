/**
 * Anthropic Messages API adapter — talks directly to api.anthropic.com.
 *
 * Wire format differs from OpenAI Chat Completions:
 *   - POST <base>/v1/messages (or /messages if base already includes /v1)
 *   - Header: `x-api-key` (not Bearer), `anthropic-version: 2023-06-01`
 *   - Top-level `system` field (string), not in messages array
 *   - `messages: [{ role, content }]` where content can be string or
 *     content blocks: { type: 'text'|'image'|'tool_use'|'tool_result', ... }
 *   - Tools use input_schema (not parameters); calls come back as tool_use
 *     content blocks, results sent back as tool_result blocks (in user role!)
 *   - SSE has named events: message_start / content_block_{start,delta,stop}
 *     / message_delta / message_stop
 *   - max_tokens is REQUIRED
 *
 * Not implemented in MVP (v1.0.10):
 *   - extended thinking (thinking content blocks)
 *   - prompt caching
 *   - computer use / bash tools
 *   - vision images other than passthrough from our Attachment type
 */
import type { ChatMessage, ToolCall } from '@/types'
import { withRetry } from '../retry'
import { ApiError, type ChatAdapter, type AdapterStreamOptions, type StreamResult } from './adapter'

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 4096

function buildEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ApiError('请先在「设置」中填写 API 地址 (baseUrl)', 400)
  if (/\/messages$/.test(trimmed)) return trimmed
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/messages`
  return `${trimmed}/v1/messages`
}

interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: { type: 'base64'; media_type: string; data: string }
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

/** Convert one simple-ai ChatMessage to (optional) Anthropic message(s) +
 *  collect system text. Some sources map to multiple messages (a single
 *  assistant turn with tool_calls becomes one assistant message; the following
 *  tool result rows fold into the *next* user message as tool_result blocks). */
function buildAnthropicRequest(messages: ChatMessage[]): {
  system: string
  messages: AnthropicMessage[]
} {
  const sys: string[] = []
  const out: AnthropicMessage[] = []
  let pendingToolResults: AnthropicContentBlock[] = []

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return
    // Tool results MUST be a user message in Anthropic protocol
    out.push({ role: 'user', content: pendingToolResults })
    pendingToolResults = []
  }

  for (const m of messages) {
    if (m.role === 'system') {
      if (m.content) sys.push(m.content)
      continue
    }
    if (m.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: m.tool_call_id || '',
        content: m.content,
      })
      continue
    }
    if (m.role === 'user') {
      flushToolResults()
      const blocks: AnthropicContentBlock[] = []
      if (m.attachments?.length) {
        for (const att of m.attachments) {
          if (att.type === 'image') {
            // Expect att.data to be a data URL: data:<mime>;base64,<base64>
            const match = /^data:([^;]+);base64,(.+)$/.exec(att.data)
            if (match) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: match[1], data: match[2] },
              })
            }
          } else {
            blocks.push({ type: 'text', text: `[${att.name}]\n${att.data}` })
          }
        }
      }
      if (m.content) blocks.push({ type: 'text', text: m.content })
      out.push({
        role: 'user',
        content: blocks.length ? blocks : (m.content || ''),
      })
      continue
    }
    if (m.role === 'assistant') {
      flushToolResults()
      const blocks: AnthropicContentBlock[] = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let input: unknown = {}
          try { input = JSON.parse(tc.arguments || '{}') } catch { input = {} }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input })
        }
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' })
      out.push({ role: 'assistant', content: blocks })
    }
  }
  flushToolResults()

  return { system: sys.join('\n\n'), messages: out }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertToolsToAnthropic(tools?: unknown[]): unknown[] | undefined {
  if (!tools || !tools.length) return undefined
  return tools.map((t: any) => {
    // simple-ai passes OpenAI format: { type: 'function', function: { name, description, parameters } }
    const fn = t?.function || t
    return {
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters || { type: 'object', properties: {} },
    }
  })
}

export const anthropicAdapter: ChatAdapter = {
  name: 'Anthropic Messages',
  matches: (baseUrl: string) => /api\.anthropic\.com/i.test(baseUrl),
  async streamChat(opts: AdapterStreamOptions): Promise<StreamResult> {
    const {
      baseUrl, apiKey, model, messages, temperature = 0.7, tools, useStream,
      signal, onChunk, onThinkingChunk, onToolCalls, onToolCallDelta, onRetry,
    } = opts

    const url = buildEndpoint(baseUrl)
    const { system, messages: anthMessages } = buildAnthropicRequest(messages)
    const body: Record<string, unknown> = {
      model,
      messages: anthMessages,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature,
      stream: useStream,
    }
    if (system) body.system = system
    const anthTools = convertToolsToAnthropic(tools)
    if (anthTools) body.tools = anthTools

    const response = await withRetry(
      async (attemptSignal) => {
        const r = await fetch(url, {
          method: 'POST',
          signal: attemptSignal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            // Some Anthropic-compatible proxies still want Bearer; pass both
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        })
        if (!r.ok) {
          const text = await r.text().catch(() => '')
          throw new ApiError(`请求失败 (${r.status}): ${text.slice(0, 500) || r.statusText}`, r.status)
        }
        return r
      },
      { signal, onRetry },
    )

    // Non-streaming: parse top-level message + content blocks
    if (!useStream) {
      const json = await response.json()
      const blocks: AnthropicContentBlock[] = Array.isArray(json.content) ? json.content : []
      let content = ''
      let thinking = ''
      const toolCalls: ToolCall[] = []
      for (const b of blocks) {
        if (b.type === 'text' && b.text) content += b.text
        if (b.type === 'tool_use' && b.id && b.name) {
          toolCalls.push({
            id: b.id,
            name: b.name,
            arguments: JSON.stringify(b.input ?? {}),
          })
        }
        // extended thinking (when enabled): type === 'thinking'
        if ((b as any).type === 'thinking' && (b as any).thinking) thinking += String((b as any).thinking)
      }
      if (thinking) onThinkingChunk?.(thinking)
      if (content) onChunk?.(content)
      if (toolCalls.length) onToolCalls?.(toolCalls)
      return { content, thinking, toolCalls, finishReason: json.stop_reason }
    }

    if (!response.body) throw new ApiError('服务端未返回响应体', 500)
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    let fullThinking = ''
    let finishReason: string | undefined
    // Track each content_block index; remember its type + accumulating data
    const blockState = new Map<number, { type: string; toolId?: string; toolName?: string; argBuf: string }>()
    const toolCallIndices: number[] = []

    // SSE has named events. We only need data lines (event line tells us
    // the type but data already carries `type` field).
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
        if (!data) continue
        let json: any
        try { json = JSON.parse(data) } catch { continue }

        switch (json.type) {
          case 'content_block_start': {
            const idx = json.index as number
            const cb = json.content_block || {}
            blockState.set(idx, {
              type: cb.type,
              toolId: cb.id,
              toolName: cb.name,
              argBuf: '',
            })
            if (cb.type === 'tool_use') {
              toolCallIndices.push(idx)
              onToolCallDelta?.(idx, { id: cb.id, name: cb.name, arguments: '' })
            }
            break
          }
          case 'content_block_delta': {
            const idx = json.index as number
            const slot = blockState.get(idx)
            const delta = json.delta || {}
            if (!slot) continue
            if (delta.type === 'text_delta' && typeof delta.text === 'string') {
              fullContent += delta.text
              onChunk?.(delta.text)
            } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
              fullThinking += delta.thinking
              onThinkingChunk?.(delta.thinking)
            } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
              slot.argBuf += delta.partial_json
              onToolCallDelta?.(idx, {
                id: slot.toolId,
                name: slot.toolName,
                arguments: slot.argBuf,
              })
            }
            break
          }
          case 'message_delta': {
            // stop_reason lives here
            if (json.delta?.stop_reason) finishReason = json.delta.stop_reason
            break
          }
          case 'message_stop': {
            const toolCalls: ToolCall[] = toolCallIndices
              .map((i) => blockState.get(i))
              .filter((s): s is NonNullable<typeof s> => !!s && s.type === 'tool_use')
              .map((s) => ({
                id: s.toolId || `call_${Date.now().toString(36)}`,
                name: s.toolName || 'unknown',
                arguments: s.argBuf || '{}',
              }))
            if (toolCalls.length) onToolCalls?.(toolCalls)
            return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
          }
        }
      }
    }

    // Stream ended without explicit message_stop — finalize anyway
    const toolCalls: ToolCall[] = toolCallIndices
      .map((i) => blockState.get(i))
      .filter((s): s is NonNullable<typeof s> => !!s && s.type === 'tool_use')
      .map((s) => ({
        id: s.toolId || `call_${Date.now().toString(36)}`,
        name: s.toolName || 'unknown',
        arguments: s.argBuf || '{}',
      }))
    if (toolCalls.length) onToolCalls?.(toolCalls)
    return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
  },
}
