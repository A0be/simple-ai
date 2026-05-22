/**
 * OpenAI Responses API adapter — talks to /v1/responses (the newer endpoint
 * OpenAI introduced for reasoning models et al.).
 *
 * Wire format:
 *   - POST <base>/v1/responses (or /responses if base already has /v1)
 *   - Body: { model, input, instructions?, tools?, stream }
 *     `input` can be a string OR a message array
 *     `instructions` is the system-prompt replacement
 *   - Streaming SSE events:
 *       response.output_text.delta   → text deltas (most important)
 *       response.output_item.done    → final output item (incl. function_call)
 *       response.completed           → end of stream
 *
 * MVP scope:
 *   - Plain text streaming ✓
 *   - Simple tool calling via function_call items ✓ (best-effort)
 *   - Reasoning blocks: not supported (would need reasoning.summary, etc.)
 *   - Multi-turn with function_call_output back-references: best-effort
 *     converted from our `tool` role messages
 */
import type { ChatMessage, ToolCall } from '@/types'
import { withRetry } from '../retry'
import { ApiError, type ChatAdapter, type AdapterStreamOptions, type StreamResult } from './adapter'

function buildEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ApiError('请先在「设置」中填写 API 地址 (baseUrl)', 400)
  if (/\/responses$/.test(trimmed)) return trimmed
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/responses`
  return `${trimmed}/v1/responses`
}

interface ResponsesItem {
  type: 'message' | 'function_call' | 'function_call_output'
  role?: 'user' | 'assistant' | 'system'
  content?: Array<{ type: string; text?: string }> | string
  call_id?: string
  name?: string
  arguments?: string
  output?: string
}

/** Convert simple-ai message list to Responses API input items + instructions. */
function buildResponsesInput(messages: ChatMessage[]): {
  instructions: string
  input: ResponsesItem[]
} {
  const sys: string[] = []
  const items: ResponsesItem[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      if (m.content) sys.push(m.content)
      continue
    }
    if (m.role === 'tool') {
      items.push({
        type: 'function_call_output',
        call_id: m.tool_call_id || '',
        output: m.content,
      })
      continue
    }
    if (m.role === 'user') {
      items.push({ type: 'message', role: 'user', content: m.content })
      continue
    }
    if (m.role === 'assistant') {
      if (m.content) {
        items.push({ type: 'message', role: 'assistant', content: m.content })
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          items.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments || '{}',
          })
        }
      }
    }
  }
  return { instructions: sys.join('\n\n'), input: items }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertToolsToResponses(tools?: unknown[]): unknown[] | undefined {
  if (!tools || !tools.length) return undefined
  return tools.map((t: any) => {
    const fn = t?.function || t
    return {
      type: 'function',
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters || { type: 'object', properties: {} },
    }
  })
}

export const openaiResponsesAdapter: ChatAdapter = {
  name: 'OpenAI Responses',
  matches: (baseUrl: string) => /\/responses(\b|$)/i.test(baseUrl),
  async streamChat(opts: AdapterStreamOptions): Promise<StreamResult> {
    const {
      baseUrl, apiKey, model, messages, temperature = 0.7, tools, useStream,
      signal, onChunk, onThinkingChunk, onToolCalls, onToolCallDelta, onRetry,
    } = opts
    const url = buildEndpoint(baseUrl)
    const { instructions, input } = buildResponsesInput(messages)
    const body: Record<string, unknown> = {
      model,
      input,
      temperature,
      stream: useStream,
    }
    if (instructions) body.instructions = instructions
    const respTools = convertToolsToResponses(tools)
    if (respTools) body.tools = respTools

    const response = await withRetry(
      async (attemptSignal) => {
        const r = await fetch(url, {
          method: 'POST',
          signal: attemptSignal,
          headers: {
            'Content-Type': 'application/json',
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

    if (!useStream) {
      const json = await response.json()
      let content = String(json.output_text || '')
      // Some shapes return content inside output[] items
      if (!content && Array.isArray(json.output)) {
        for (const item of json.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'output_text' && typeof c.text === 'string') content += c.text
            }
          }
        }
      }
      const toolCalls: ToolCall[] = []
      if (Array.isArray(json.output)) {
        for (const item of json.output) {
          if (item.type === 'function_call') {
            toolCalls.push({
              id: item.call_id || `call_${Date.now().toString(36)}`,
              name: item.name,
              arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {}),
            })
          }
        }
      }
      if (content) onChunk?.(content)
      if (toolCalls.length) onToolCalls?.(toolCalls)
      return { content, thinking: '', toolCalls, finishReason: json.status }
    }

    if (!response.body) throw new ApiError('服务端未返回响应体', 500)
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    let fullThinking = ''
    let finishReason: string | undefined
    // function_call deltas come in via response.function_call_arguments.delta
    // (or function_call.arguments.delta in some variants). We track by call_id.
    const callBuf = new Map<string, { name: string; arguments: string; index: number }>()
    let callIndex = 0

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
        if (!data || data === '[DONE]') continue
        let json: any
        try { json = JSON.parse(data) } catch { continue }

        const t = json.type as string
        if (t === 'response.output_text.delta' && typeof json.delta === 'string') {
          fullContent += json.delta
          onChunk?.(json.delta)
        } else if (t === 'response.reasoning_summary_text.delta' && typeof json.delta === 'string') {
          fullThinking += json.delta
          onThinkingChunk?.(json.delta)
        } else if (t === 'response.output_item.added' && json.item?.type === 'function_call') {
          const callId = String(json.item.call_id || json.item.id || '')
          callBuf.set(callId, { name: json.item.name || '', arguments: '', index: callIndex })
          onToolCallDelta?.(callIndex, { id: callId, name: json.item.name, arguments: '' })
          callIndex++
        } else if (t === 'response.function_call_arguments.delta') {
          const callId = String(json.item_id || json.call_id || '')
          const slot = callBuf.get(callId)
          if (slot && typeof json.delta === 'string') {
            slot.arguments += json.delta
            onToolCallDelta?.(slot.index, { id: callId, name: slot.name, arguments: slot.arguments })
          }
        } else if (t === 'response.completed') {
          finishReason = json.response?.status || 'completed'
          const toolCalls: ToolCall[] = [...callBuf.entries()].map(([id, slot]) => ({
            id, name: slot.name, arguments: slot.arguments || '{}',
          }))
          if (toolCalls.length) onToolCalls?.(toolCalls)
          return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
        }
      }
    }
    const toolCalls: ToolCall[] = [...callBuf.entries()].map(([id, slot]) => ({
      id, name: slot.name, arguments: slot.arguments || '{}',
    }))
    if (toolCalls.length) onToolCalls?.(toolCalls)
    return { content: fullContent, thinking: fullThinking, toolCalls, finishReason }
  },
}
