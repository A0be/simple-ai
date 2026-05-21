/**
 * Schedule / Cron tools — wrap the in-memory scheduler.
 *
 * CronCreate / CronList / CronDelete  → cron-style recurring or one-shot
 * ScheduleWakeup                       → simple delaySeconds reminder
 *
 * Jobs are session-only (in-memory). A fired job emits a `scheduler-fire`
 * event the active ChatView can pick up to inject the prompt.
 */
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { scheduler } from '@/lib/scheduler'

const CRON_CREATE_SCHEMA = {
  type: 'object' as const,
  properties: {
    cron: {
      type: 'string',
      description:
        '5-field cron expression in local time (M H DoM Mon DoW). Example: "0 9 * * 1-5" = weekdays 9am.'
    },
    prompt: {
      type: 'string',
      description: 'Prompt to enqueue when the cron expression matches.'
    },
    recurring: {
      type: 'boolean',
      description:
        'true (default) = fires on every match. false = fires once then auto-deletes.'
    }
  },
  required: ['cron', 'prompt']
}

export const CronCreateTool: ToolDef = {
  name: 'CronCreate',
  description:
    'Schedule a prompt to be fired at future cron-matched times. Session-only (in-memory).',
  category: 'task',
  planSafe: true,
  parameters: CRON_CREATE_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { cron, prompt, recurring } = parseToolArgs<{
      cron: string
      prompt: string
      recurring?: boolean
    }>(ctx.call.arguments)
    if (!cron || !prompt) {
      return { content: 'CronCreate: cron and prompt are required.', isError: true }
    }
    try {
      const job = scheduler.scheduleCron(cron, prompt, recurring !== false)
      return {
        content: `Scheduled job ${job.id} for cron "${cron}". Next fire at ${new Date(
          job.nextFireAt
        ).toLocaleString()}.`,
        ui: { kind: 'generic', data: { id: job.id, nextFireAt: job.nextFireAt, cron } }
      }
    } catch (e) {
      return { content: `CronCreate failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const CRON_LIST_SCHEMA = {
  type: 'object' as const,
  properties: {},
  required: []
}

export const CronListTool: ToolDef = {
  name: 'CronList',
  description: 'List all scheduled jobs (cron + one-shot reminders).',
  category: 'task',
  planSafe: true,
  parameters: CRON_LIST_SCHEMA,
  async run(_input, _ctx: ToolContext): Promise<ToolResult> {
    const jobs = scheduler.list()
    if (!jobs.length) return { content: '(no scheduled jobs)' }
    const lines = jobs.map(
      (j) =>
        `- ${j.id}  ${j.cron ? `cron="${j.cron}"` : 'one-shot'}  next=${new Date(
          j.nextFireAt
        ).toLocaleString()}  ${j.recurring ? '(recurring)' : '(once)'}  → ${j.prompt.slice(0, 60)}`
    )
    return {
      content: lines.join('\n'),
      ui: { kind: 'generic', data: jobs }
    }
  }
}

const CRON_DELETE_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Job ID returned by CronCreate / ScheduleWakeup.' }
  },
  required: ['id']
}

export const CronDeleteTool: ToolDef = {
  name: 'CronDelete',
  description: 'Cancel a previously scheduled job.',
  category: 'task',
  planSafe: true,
  parameters: CRON_DELETE_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id } = parseToolArgs<{ id: string }>(ctx.call.arguments)
    if (!id) return { content: 'CronDelete: missing id.', isError: true }
    const ok = scheduler.cancel(id)
    return { content: ok ? `Cancelled ${id}.` : `No job with id ${id}.`, isError: !ok }
  }
}

const WAKEUP_SCHEMA = {
  type: 'object' as const,
  properties: {
    delaySeconds: {
      type: 'integer',
      description: 'Seconds from now to fire the prompt. Clamped to [1, 2592000].'
    },
    prompt: { type: 'string', description: 'Prompt to fire on wake-up.' },
    reason: { type: 'string', description: 'Short explanation; shown back to the user.' }
  },
  required: ['delaySeconds', 'prompt']
}

export const ScheduleWakeupTool: ToolDef = {
  name: 'ScheduleWakeup',
  description:
    'Schedule a one-shot wake-up reminder after `delaySeconds`. Session-only (in-memory).',
  category: 'task',
  planSafe: true,
  parameters: WAKEUP_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { delaySeconds, prompt, reason } = parseToolArgs<{
      delaySeconds: number
      prompt: string
      reason?: string
    }>(ctx.call.arguments)
    if (!delaySeconds || !prompt) {
      return { content: 'ScheduleWakeup: delaySeconds and prompt required.', isError: true }
    }
    const job = scheduler.scheduleAfter(delaySeconds, prompt, reason)
    return {
      content: `Wake-up scheduled in ${delaySeconds}s (id=${job.id}, at ${new Date(
        job.nextFireAt
      ).toLocaleString()}). Reason: ${reason || '(none)'}.`,
      ui: { kind: 'generic', data: { id: job.id, nextFireAt: job.nextFireAt } }
    }
  }
}
