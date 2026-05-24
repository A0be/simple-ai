/**
 * OpenAI Chat Completions adapter — the default protocol used by OpenAI,
 * DeepSeek, GLM, Qwen, Kimi, MiniToken, OpenRouter, and most providers.
 *
 * Wire format: POST <base>/chat/completions with `messages: [{role, content,
 * tool_calls?, reasoning_content?}]`, SSE deltas via `choices[0].delta`.
 */
import type { ChatMessage, ToolCall, Attachment } from '@/types'
import { withRetry } from '../retry'
import { ApiError, type ChatAdapter, type AdapterStreamOptions, type StreamResult } from './adapter'
import { stripInlineMedia } from './stripInlineMedia'

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ApiError('请先在「设置」中填写 API 地址 (baseUrl)', 400)
  if (/\/chat\/completions$/.test(trimmed)) return trimmed
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`
  if (/\/api(\/v\d+)?$/.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
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

function toWireMessage(m: ChatMessage): Record<string, unknown> {
  const base: Record<string, unknown> = { role: m.role }
  if (m.role === 'tool') {
    base.tool_call_id = m.tool_call_id
    // Strip inline base64 dataURLs (from ImageGenerate / VideoGenerate) so we
    // don't echo multi-MB image bytes back on every subsequent turn.
    base.content = stripInlineMedia(m.content)
    if (m.name) base.name = m.name
    return base
  }
  if (m.role === 'assistant') {
    if (m.content) base.content = m.content
    if (m.reasoning_content) base.reasoning_content = m.reasoning_content
    if (m.tool_calls && m.tool_calls.length) {
      base.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      }))
    }
    if (!base.content && !base.tool_calls) base.content = ''
    return base
  }
  if (m.role === 'user' && m.attachments?.length) {
    base.content = buildMultipartContent(m.content, m.attachments)
    return base
  }
  base.content = m.content
  return base
}

function finalizeToolCalls(
  buf: Map<number, { id?: string; name?: string; arguments: string }>,
): ToolCall[] {
  return [...buf.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, v]) => v.name)
    .map(([idx, v]) => ({
      id: v.id || `call_${idx}_${Date.now().toString(36)}`,
      name: v.name!,
      arguments: v.arguments || '{}',
    }))
}

export const openaiChatAdapter: ChatAdapter = {
  name: 'OpenAI Chat Completions',
  matches: (baseUrl: string) => {
    // Default adapter — never the "matches" winner explicitly, dispatcher uses
    // it as fallback. But keep a sane test for completeness.
    const u = baseUrl.toLowerCase()
    return /\/chat\/completions$|\/v\d+$|\/api(\/v\d+)?$|^https?:\/\//.test(u)
  },
  async streamChat(opts: AdapterStreamOptions): Promise<StreamResult> {
    const { baseUrl, apiKey, model, messages, temperature = 0.7, tools, useStream, signal, onChunk, onThinkingChunk, onToolCalls, onToolCallDelta, onRetry } = opts
    const url = normalizeBaseUrl(baseUrl)
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(toWireMessage),
      temperature,
      stream: useStream,
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
      const choice = json.choices?.[0]
      const msg = choice?.message ?? {}
      const content = String(msg.content ?? '')
      const thinking = String(msg.reasoning_content ?? msg.thinking ?? '')
      if (thinking) onThinkingChunk?.(thinking)
      if (content) onChunk?.(content)
      const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments ?? '',
        }),
      )
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
    const tcBuffer = new Map<number, { id?: string; name?: string; arguments: string }>()

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
              if (typeof tc.function?.arguments === 'string') slot.arguments += tc.function.arguments
              tcBuffer.set(idx, slot)
              onToolCallDelta?.(idx, { id: slot.id, name: slot.name, arguments: slot.arguments })
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
  },
}
