import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

const SLEEP_SCHEMA = {
  type: 'object',
  properties: {
    seconds: {
      type: 'number',
      description: 'How long to sleep, in seconds. Capped at 300 (5 minutes) to keep the agent loop responsive.',
    },
    reason: {
      type: 'string',
      description: 'Optional one-line reason for the wait (shown to the user).',
    },
  },
  required: ['seconds'],
}

const MAX_SLEEP_SECONDS = 300

export const SleepTool: ToolDef = {
  name: 'Sleep',
  description:
    'Pause execution for a number of seconds (max 300). Useful when polling external state ' +
    'between tool calls (e.g. waiting for a background task, a remote deploy, an async video render). ' +
    'Prefer ScheduleWakeup or CronCreate for waits longer than a few minutes.',
  category: 'misc',
  planSafe: true,
  parameters: SLEEP_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { seconds, reason } = parseToolArgs<{ seconds: number; reason?: string }>(
      ctx.call.arguments,
    )
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
      return { content: 'Sleep: `seconds` must be a non-negative number.', isError: true }
    }
    const capped = Math.min(seconds, MAX_SLEEP_SECONDS)
    const ms = Math.round(capped * 1000)

    // Honor an abort signal from the surrounding agent loop so /stop is responsive.
    const signal = ctx.signal
    try {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        const timer = setTimeout(resolve, ms)
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
          },
          { once: true },
        )
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return { content: 'Sleep interrupted.', isError: true }
      }
      throw e
    }
    const note = reason ? ` (${reason})` : ''
    const truncatedNote = capped < seconds ? ` [capped from ${seconds}s to ${MAX_SLEEP_SECONDS}s]` : ''
    return { content: `Slept ${capped}s${note}${truncatedNote}.` }
  },
}
