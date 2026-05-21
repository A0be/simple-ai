import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import type { TodoItem } from '@/types'

const SCHEMA = {
  type: 'object' as const,
  properties: {
    todos: {
      type: 'array' as const,
      description: 'The full updated list of todos. Replaces previous list.',
      items: {
        type: 'object' as const,
        properties: {
          content: {
            type: 'string',
            description: 'Imperative form, e.g. "Run tests"'
          },
          activeForm: {
            type: 'string',
            description: 'Present continuous, e.g. "Running tests"'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed']
          }
        },
        required: ['content', 'activeForm', 'status']
      }
    }
  },
  required: ['todos']
}

interface TodoInput {
  todos: Array<{ content: string; activeForm: string; status: TodoItem['status']; id?: string }>
}

export const TodoWriteTool: ToolDef = {
  name: 'TodoWrite',
  description:
    'Create / update a structured todo list for the current session. Use proactively for multi-step tasks. Keep exactly ONE item in_progress at a time.',
  category: 'task',
  planSafe: true,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { todos } = parseToolArgs<TodoInput>(ctx.call.arguments)
    if (!Array.isArray(todos)) {
      return { content: 'todos must be an array', isError: true }
    }
    const next: TodoItem[] = todos.map((t, i) => ({
      id: t.id || `todo_${Date.now().toString(36)}_${i}`,
      content: t.content || '(no content)',
      activeForm: t.activeForm || t.content || '(working)',
      status: ['pending', 'in_progress', 'completed'].includes(t.status)
        ? (t.status as TodoItem['status'])
        : 'pending'
    }))
    ctx.session.todos = next
    const inProgress = next.filter((t) => t.status === 'in_progress').length
    if (inProgress > 1) {
      return {
        content: `Warning: ${inProgress} todos in_progress at once; only one allowed at a time. Saved anyway.`,
        ui: { kind: 'todo', data: next }
      }
    }
    return {
      content: `Saved ${next.length} todos. ${next.filter((t) => t.status === 'completed').length} completed.`,
      ui: { kind: 'todo', data: next }
    }
  }
}
