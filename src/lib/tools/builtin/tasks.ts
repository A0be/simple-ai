import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import type { AgentTask } from '@/types'

function nextId(prefix: string, existing: AgentTask[]): string {
  let n = existing.length + 1
  let id = `${n}`
  const used = new Set(existing.map((t) => t.id))
  while (used.has(id)) {
    n += 1
    id = `${n}`
  }
  void prefix
  return id
}

const CREATE_SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: { type: 'string', description: 'Brief title for the task.' },
    description: {
      type: 'string',
      description: 'Detailed description of what needs to be done.'
    },
    activeForm: {
      type: 'string',
      description: 'Present continuous, shown in spinner.'
    }
  },
  required: ['subject', 'description']
}

export const TaskCreateTool: ToolDef = {
  name: 'TaskCreate',
  description:
    'Create a tracked task for the current session (separate from TodoWrite — TaskCreate produces task IDs you can reference and update later).',
  category: 'task',
  planSafe: true,
  parameters: CREATE_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const args = parseToolArgs<{
      subject: string
      description: string
      activeForm?: string
    }>(ctx.call.arguments)
    const id = nextId('task', ctx.session.tasks)
    const task: AgentTask = {
      id,
      subject: args.subject || '(no subject)',
      description: args.description || '',
      activeForm: args.activeForm,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    ctx.session.tasks.push(task)
    return {
      content: `Task #${id} created: ${task.subject}`,
      ui: { kind: 'task-list', data: [...ctx.session.tasks] }
    }
  }
}

export const TaskListTool: ToolDef = {
  name: 'TaskList',
  description: 'List all tracked tasks with id, subject, status, and owner.',
  category: 'task',
  planSafe: true,
  parameters: { type: 'object' as const, properties: {} },
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const list = ctx.session.tasks
    if (!list.length) return { content: 'No tasks.' }
    const text = list
      .map(
        (t) =>
          `#${t.id} [${t.status}] ${t.subject}${t.owner ? ` (owner: ${t.owner})` : ''}`
      )
      .join('\n')
    return {
      content: text,
      ui: { kind: 'task-list', data: [...list] }
    }
  }
}

export const TaskGetTool: ToolDef = {
  name: 'TaskGet',
  description: 'Fetch full details for a task by id.',
  category: 'task',
  planSafe: true,
  parameters: {
    type: 'object' as const,
    properties: { taskId: { type: 'string' } },
    required: ['taskId']
  },
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { taskId } = parseToolArgs<{ taskId: string }>(ctx.call.arguments)
    const t = ctx.session.tasks.find((x) => x.id === taskId)
    if (!t) return { content: `Task #${taskId} not found.`, isError: true }
    return {
      content: JSON.stringify(t, null, 2)
    }
  }
}

export const TaskUpdateTool: ToolDef = {
  name: 'TaskUpdate',
  description:
    'Update a tracked task. Pass any subset of fields: status, subject, description, owner, activeForm.',
  category: 'task',
  planSafe: true,
  parameters: {
    type: 'object' as const,
    properties: {
      taskId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled']
      },
      subject: { type: 'string' },
      description: { type: 'string' },
      owner: { type: 'string' },
      activeForm: { type: 'string' }
    },
    required: ['taskId']
  },
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const args = parseToolArgs<{
      taskId: string
      status?: AgentTask['status']
      subject?: string
      description?: string
      owner?: string
      activeForm?: string
    }>(ctx.call.arguments)
    const t = ctx.session.tasks.find((x) => x.id === args.taskId)
    if (!t) return { content: `Task #${args.taskId} not found.`, isError: true }
    if (args.status) t.status = args.status
    if (args.subject) t.subject = args.subject
    if (args.description !== undefined) t.description = args.description
    if (args.owner !== undefined) t.owner = args.owner
    if (args.activeForm !== undefined) t.activeForm = args.activeForm
    t.updatedAt = Date.now()
    return {
      content: `Task #${t.id} updated.`,
      ui: { kind: 'task-list', data: [...ctx.session.tasks] }
    }
  }
}

export const TaskOutputTool: ToolDef = {
  name: 'TaskOutput',
  description: "Read a task's accumulated output (transcript) by id.",
  category: 'task',
  planSafe: true,
  parameters: {
    type: 'object' as const,
    properties: { taskId: { type: 'string' } },
    required: ['taskId']
  },
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { taskId } = parseToolArgs<{ taskId: string }>(ctx.call.arguments)
    const t = ctx.session.tasks.find((x) => x.id === taskId)
    if (!t) return { content: `Task #${taskId} not found.`, isError: true }
    return { content: t.output || '(no output yet)' }
  }
}

export const TaskStopTool: ToolDef = {
  name: 'TaskStop',
  description: 'Mark a running task as cancelled.',
  category: 'task',
  planSafe: true,
  parameters: {
    type: 'object' as const,
    properties: { taskId: { type: 'string' } },
    required: ['taskId']
  },
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { taskId } = parseToolArgs<{ taskId: string }>(ctx.call.arguments)
    const t = ctx.session.tasks.find((x) => x.id === taskId)
    if (!t) return { content: `Task #${taskId} not found.`, isError: true }
    t.status = 'cancelled'
    t.updatedAt = Date.now()
    return { content: `Task #${t.id} cancelled.` }
  }
}
