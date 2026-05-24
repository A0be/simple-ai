/**
 * Agent loop — the core multi-turn tool-dispatch state machine.
 *
 * On each call:
 * 1. Send current message log to the model (streaming, with tools).
 * 2. While the model emits tool_calls (not just text):
 *    - Append assistant message with tool_calls to log.
 *    - Dispatch each tool_call, capture results.
 *    - Append role:'tool' results to log.
 *    - Loop.
 * 3. When model emits text content without tool_calls → finished.
 *
 * Streaming callbacks let the UI update progressively.
 */
import type { ChatMessage, ToolCall } from '@/types'
import { streamChat, ApiError } from './ai'
import type { RetryInfo } from './retry'
import type { ToolContext, ToolDef, ToolRegistry, ToolResult, SessionState, ToolUiBridge } from './tools/types'
import { isTauri as detectTauri } from './tauri'
import { isElectron as detectElectron } from './electron'
import type { ApiConfig } from '@/types'

const READ_ONLY_TOOLS = new Set([
  'FileRead', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TaskList', 'TaskGet', 'TaskOutput', 'TodoWrite',
  'LspDefinition', 'LspReferences', 'LspHover', 'LspList',
  'ImageGenerate'
])

function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name) || name.startsWith('mcp__')
}

export interface RunAgentOptions {
  config: ApiConfig
  /** the persistent message log; mutated in-place as the loop runs */
  messages: ChatMessage[]
  /** tool registry */
  registry: ToolRegistry
  /** session state (todos, tasks, plan mode) */
  session: SessionState
  /** UI bridge for AskUserQuestion + notifications */
  ui: ToolUiBridge
  signal?: AbortSignal
  /** max tool-dispatch iterations (default 12) */
  maxTurns?: number
  /** override which tools are exposed (default: env-appropriate) */
  toolFilter?: (toolName: string) => boolean
  /** called with each thinking/reasoning delta */
  onThinkingText?: (delta: string) => void
  /** called with each text delta from the assistant */
  onText?: (delta: string) => void
  /** called when an assistant message (with optional tool_calls) is complete */
  onAssistantMessage?: (msg: ChatMessage) => void
  /** called when a tool starts running */
  onToolStart?: (call: ToolCall) => void
  /** called when a tool finishes */
  onToolEnd?: (call: ToolCall, result: ToolResult) => void
  /** called when the entire turn finishes (model emitted text without tool_calls) */
  onFinish?: () => void
  /** propagated from streamChat; null when a successful response starts streaming */
  onRetry?: (info: RetryInfo | null) => void
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const {
    config,
    messages,
    registry,
    session,
    ui,
    signal,
    maxTurns = 12,
    toolFilter,
    onThinkingText,
    onText,
    onAssistantMessage,
    onToolStart,
    onToolEnd,
    onFinish,
    onRetry
  } = opts
  const isTauri = detectTauri()
  const isDesktop = isTauri || detectElectron()
  const runEnv: 'web' | 'tauri' = isTauri ? 'tauri' : 'web'

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) return
    // Filter tools by env + custom filter + plan mode rules
    const allTools = registry.list(runEnv).filter((t) => {
      if (toolFilter && !toolFilter(t.name)) return false
      if (session.planMode && t.planSafe === false) return false
      return true
    })
    const toolSchemas = allTools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))

    // Insert an in-progress assistant message we stream into. Thinking content
    // (reasoning_content from DeepSeek-R1 / o1 / etc.) goes onto this same
    // message so the next turn's request can echo it back as the
    // `reasoning_content` field — protocol requires that.
    const liveAssistant: ChatMessage = { role: 'assistant', content: '', display: 'normal' }
    messages.push(liveAssistant)

    let streamedToolCalls: ToolCall[] = []
    try {
      const res = await streamChat({
        config,
        messages: messages.slice(0, -1), // don't include the live assistant itself
        temperature: 0.4,
        tools: toolSchemas.length ? toolSchemas : undefined,
        signal,
        onRetry,
        onThinkingChunk: (delta) => {
          liveAssistant.reasoning_content = (liveAssistant.reasoning_content || '') + delta
          onThinkingText?.(delta)
        },
        onChunk: (delta) => {
          // First content chunk → the request is past retry territory, clear retry banner.
          if (!liveAssistant.content) onRetry?.(null)
          liveAssistant.content += delta
          onText?.(delta)
        }
      })
      // After streaming, finalize
      liveAssistant.content = res.content
      liveAssistant.tool_calls = res.toolCalls.length ? res.toolCalls : undefined
      if (res.thinking) liveAssistant.reasoning_content = res.thinking
      streamedToolCalls = res.toolCalls
    } catch (e) {
      // Remove the live placeholder; surface error as a system note
      messages.pop()
      if (e instanceof ApiError) throw e
      throw e
    }

    onAssistantMessage?.(liveAssistant)

    // If no tool_calls, we're done
    if (!streamedToolCalls.length) {
      onFinish?.()
      return
    }
    const imageOnlyTurn = streamedToolCalls.length > 0 && streamedToolCalls.every((tc) => tc.name === 'ImageGenerate')
    let imageTurnHadError = false

    // Dispatch each tool_call — run concurrency-safe tools in parallel
    const concurrentCalls: { tc: ToolCall; def: ToolDef }[] = []
    const sequentialCalls: { tc: ToolCall; def: ToolDef | undefined }[] = []

    for (const tc of streamedToolCalls) {
      const def = registry.get(tc.name)
      if (!def || (def.env && def.env !== 'both' && def.env !== runEnv) || (session.planMode && def.planSafe === false)) {
        sequentialCalls.push({ tc, def })
      } else if (isReadOnlyTool(tc.name)) {
        concurrentCalls.push({ tc, def })
      } else {
        sequentialCalls.push({ tc, def })
      }
    }

    // Run read-only tools in parallel
    if (concurrentCalls.length > 1) {
      const results = await Promise.all(
        concurrentCalls.map(async ({ tc, def }) => {
          if (signal?.aborted) return { tc, result: { content: 'Aborted', isError: true } as ToolResult }
          onToolStart?.(tc)
          const ctx: ToolContext = {
            config, signal, call: tc,
            history: () => messages.map((m) => ({ role: m.role, content: m.content })),
            ui, registry, session, isTauri, isDesktop
          }
          try {
            const result = await def.run(tc.arguments, ctx)
            return { tc, result }
          } catch (e) {
            return { tc, result: { content: `Tool ${tc.name} threw: ${(e as Error).message}`, isError: true } as ToolResult }
          }
        })
      )
      for (const { tc, result } of results) {
        const toolMsg: ChatMessage = { role: 'tool', tool_call_id: tc.id, name: tc.name, content: result.content }
        messages.push(toolMsg)
        if (tc.name === 'ImageGenerate' && result.isError) imageTurnHadError = true
        onToolEnd?.(tc, result)
      }
    } else if (concurrentCalls.length === 1) {
      sequentialCalls.unshift(concurrentCalls[0])
    }

    // Run write/unknown tools sequentially
    for (const { tc, def } of sequentialCalls) {
      if (signal?.aborted) return
      onToolStart?.(tc)
      let result: ToolResult
      if (!def) {
        result = { content: `Unknown tool: ${tc.name}`, isError: true }
      } else if (def.env && def.env !== 'both' && def.env !== runEnv) {
        result = {
          content: `Tool ${tc.name} is not available in ${runEnv} runtime. Run the Tauri desktop build to use it.`,
          isError: true
        }
      } else if (session.planMode && def.planSafe === false) {
        result = {
          content: `Tool ${tc.name} is blocked in plan mode. Use ExitPlanMode to enable it.`,
          isError: true
        }
      } else {
        const ctx: ToolContext = {
          config, signal, call: tc,
          history: () => messages.map((m) => ({ role: m.role, content: m.content })),
          ui, registry, session, isTauri, isDesktop
        }
        try {
          result = await def.run(tc.arguments, ctx)
        } catch (e) {
          result = {
            content: `Tool ${tc.name} threw: ${(e as Error).message}`,
            isError: true
          }
        }
      }
      const toolMsg: ChatMessage = { role: 'tool', tool_call_id: tc.id, name: tc.name, content: result.content }
      messages.push(toolMsg)
      if (tc.name === 'ImageGenerate' && result.isError) imageTurnHadError = true
      onToolEnd?.(tc, result)
    }

    if (imageOnlyTurn && !imageTurnHadError) {
      onFinish?.()
      return
    }
  }

  // Exceeded turn budget — append a system note
  messages.push({
    role: 'tool',
    tool_call_id: `budget_${Date.now()}`,
    name: 'system',
    content: `Tool-call budget (${maxTurns}) exceeded. Stopping.`
  })
  onFinish?.()
}
