/**
 * SendMessage — resume a previously-spawned sub-agent by id or name.
 * The agent's prior message history is loaded from in-memory cache,
 * a new user turn is appended, and the agent runs another bounded loop.
 */
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { streamChat } from '@/lib/ai'
import { getAgentHistory, resolveAgentId, saveAgentHistory, listAgents } from '@/lib/agentHistory'
import type { ChatMessage } from '@/types'

const SCHEMA = {
  type: 'object' as const,
  properties: {
    to: { type: 'string', description: 'Agent id or friendly name to resume.' },
    message: { type: 'string', description: 'New user-side message for the agent.' }
  },
  required: ['to', 'message']
}

export const SendMessageTool: ToolDef = {
  name: 'SendMessage',
  description:
    'Continue an existing sub-agent by id/name with a new message. Use this to follow up on a prior Agent call instead of spawning a fresh one.',
  category: 'agent',
  planSafe: true,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { to, message } = parseToolArgs<{ to: string; message: string }>(ctx.call.arguments)
    if (!to || !message) {
      return { content: 'SendMessage: `to` and `message` required.', isError: true }
    }
    const id = resolveAgentId(to)
    const history = getAgentHistory(to)
    if (!id || !history) {
      const known = listAgents()
        .map((a) => `${a.id}${a.name ? ` (${a.name})` : ''}`)
        .join(', ')
      return {
        content: `SendMessage: no agent matching "${to}". Known: ${known || '(none)'}.`,
        isError: true
      }
    }
    const messages: ChatMessage[] = [...history, { role: 'user', content: message }]

    // Find the matching task so we can stream into its output
    const task = ctx.session.tasks.find((t) => t.id === id)
    if (task) {
      task.status = 'in_progress'
      task.updatedAt = Date.now()
      task.output = (task.output || '') + `\n\n--- SendMessage at ${new Date().toISOString()} ---\nuser: ${message}\n\n`
    }

    // Tool subset same as AgentTool: no Agent, no write tools
    const subTools = ctx.registry.list(ctx.isTauri ? 'tauri' : 'web').filter((t) => {
      if (t.name === 'Agent' || t.name === 'SendMessage') return false
      const writeNames = ['FileWrite', 'FileEdit', 'Bash', 'NotebookEdit']
      if (writeNames.includes(t.name)) return false
      return true
    })

    const MAX_TURNS = 6
    let final = ''
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await streamChat({
          config: ctx.config,
          model: ctx.config.helperModel || ctx.config.model,
          messages,
          temperature: 0.4,
          tools: subTools.length
            ? subTools.map((t) => ({
                type: 'function',
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters
                }
              }))
            : undefined,
          signal: ctx.signal,
          onChunk: (delta) => {
            if (task) {
              task.output = (task.output || '') + delta
              task.updatedAt = Date.now()
            }
          }
        })

        if (res.content && !res.toolCalls.length) {
          final = res.content
          messages.push({ role: 'assistant', content: res.content })
          break
        }

        messages.push({
          role: 'assistant',
          content: res.content || '',
          tool_calls: res.toolCalls
        })
        if (!res.toolCalls.length) {
          final = res.content
          break
        }
        for (const tc of res.toolCalls) {
          const def = ctx.registry.get(tc.name)
          if (!def) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: `Tool not available to sub-agent: ${tc.name}`
            })
            continue
          }
          try {
            const result = await def.run(tc.arguments, { ...ctx, call: tc })
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: result.content
            })
          } catch (e) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: `Tool error: ${(e as Error).message}`
            })
          }
        }
      }
      if (task) {
        task.status = 'completed'
        task.updatedAt = Date.now()
      }
      saveAgentHistory(id, undefined, messages)
      return {
        content: `Agent #${id} reply:\n\n${final || '(no output)'}`,
        ui: { kind: 'agent', data: { taskId: id, output: final } }
      }
    } catch (e) {
      if (task) {
        task.status = 'failed'
        task.error = (e as Error).message
        task.updatedAt = Date.now()
      }
      return { content: `SendMessage failed: ${(e as Error).message}`, isError: true }
    }
  }
}
