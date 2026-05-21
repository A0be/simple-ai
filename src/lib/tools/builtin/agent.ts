import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { streamChat } from '@/lib/ai'
import { getSkill } from '@/lib/skills'
import { saveAgentHistory } from '@/lib/agentHistory'

interface AgentInput {
  description: string
  prompt: string
  subagent_type?: string
  name?: string
  allow_write?: boolean
  model?: string
  max_turns?: number
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string',
      description: '3-5 word task description shown in UI.'
    },
    prompt: {
      type: 'string',
      description:
        "Full briefing for the sub-agent. The sub-agent doesn't see prior context — make it self-contained: goal, what's been ruled out, what to report back."
    },
    subagent_type: {
      type: 'string',
      description:
        'Optional specialized agent name. If omitted, runs a general-purpose sub-agent.'
    },
    name: {
      type: 'string',
      description: 'Optional short label for the agent (one-two words).'
    },
    allow_write: {
      type: 'boolean',
      description: 'If true, sub-agent can use write tools (FileWrite, FileEdit, Bash). Default: false (read-only).'
    },
    model: {
      type: 'string',
      description: 'Override model for this sub-agent. If omitted, uses helper model or main model.'
    },
    max_turns: {
      type: 'number',
      description: 'Max tool-dispatch turns (default 6, max 12).'
    }
  },
  required: ['description', 'prompt']
}

const READ_ONLY_BLOCKED = new Set(['FileWrite', 'FileEdit', 'Bash', 'NotebookEdit'])
const ALWAYS_BLOCKED = new Set(['Agent', 'SendMessage'])

export const AgentTool: ToolDef = {
  name: 'Agent',
  description:
    'Launch a sub-agent to handle a complex sub-task (research, focused analysis, code changes, parallel work). ' +
    'Pass a self-contained `prompt`. Returns the sub-agent\'s final report. ' +
    'The sub-agent does NOT see your conversation; brief it fully. ' +
    'By default sub-agents are read-only; set allow_write=true for implementation tasks. ' +
    'You can launch multiple agents in one response for parallel work — each runs independently.',
  category: 'agent',
  planSafe: false,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const {
      description, prompt, subagent_type, name,
      allow_write = false, model, max_turns
    } = parseToolArgs<AgentInput>(ctx.call.arguments)
    if (!prompt) return { content: 'Agent: missing `prompt`.', isError: true }

    const skillHint = subagent_type ? getSkill(subagent_type) : null
    const subSys = [
      'You are a sub-agent dispatched by a coordinator.',
      `Your task: ${description}`,
      subagent_type ? `Agent type: ${subagent_type}` : null,
      skillHint
        ? `Apply this skill:\n${skillHint.content}`
        : 'You are a general-purpose research/analysis agent.',
      'Work autonomously. You have access to a restricted tool set.',
      allow_write
        ? 'You have WRITE access: FileWrite, FileEdit, Bash are available. Use them carefully.'
        : 'You are in READ-ONLY mode: no file writes or shell commands that modify state.',
      'Return a self-contained report. Do not ask the user clarification questions; make reasonable assumptions and note them.',
      'Structure your report: Scope → Findings → Conclusion (or Scope → Changes → Verification for write tasks).'
    ]
      .filter(Boolean)
      .join('\n\n')

    const subTools = ctx.registry.list(ctx.isTauri ? 'tauri' : 'web').filter((t) => {
      if (ALWAYS_BLOCKED.has(t.name)) return false
      if (!allow_write && READ_ONLY_BLOCKED.has(t.name)) return false
      return true
    })

    const taskId = `agent_${Date.now().toString(36)}`
    const turns = Math.min(max_turns || 6, 12)
    const task: import('@/types').AgentTask = {
      id: taskId,
      subject: name || description.slice(0, 30),
      description,
      status: 'in_progress',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      output: ''
    }
    ctx.session.tasks.push(task)

    try {
      const messages: import('@/types').ChatMessage[] = [
        { role: 'system', content: subSys },
        { role: 'user', content: prompt }
      ]
      let final = ''
      for (let turn = 0; turn < turns; turn++) {
        const res = await streamChat({
          config: ctx.config,
          model: model || ctx.config.helperModel || ctx.config.model,
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
            task.output = (task.output || '') + delta
            task.updatedAt = Date.now()
          }
        })

        if (res.content && !res.toolCalls.length) {
          final = res.content
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
          const tEnv = def.env ?? 'both'
          const runEnv = ctx.isTauri ? 'tauri' : 'web'
          if (tEnv !== 'both' && tEnv !== runEnv) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: `Tool ${tc.name} unavailable in ${runEnv} runtime.`
            })
            continue
          }
          try {
            const result = await def.run(tc.arguments, {
              ...ctx,
              call: tc
            })
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

      task.status = 'completed'
      task.output = final || task.output || '(no output)'
      task.updatedAt = Date.now()
      saveAgentHistory(taskId, name, messages)
      return {
        content: `Sub-agent (#${taskId}) reported:\n\n${task.output}`,
        ui: { kind: 'agent', data: { taskId, subject: task.subject, output: task.output } }
      }
    } catch (e) {
      task.status = 'failed'
      task.error = (e as Error).message
      task.updatedAt = Date.now()
      return {
        content: `Sub-agent failed: ${(e as Error).message}`,
        isError: true
      }
    }
  }
}
