import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

interface PlanInput {
  plan?: string
}

const ENTER_SCHEMA = {
  type: 'object' as const,
  properties: {
    plan: {
      type: 'string',
      description:
        'Optional initial plan draft. Can be updated later by ExitPlanMode.'
    }
  }
}

const EXIT_SCHEMA = {
  type: 'object' as const,
  properties: {
    plan: {
      type: 'string',
      description: 'The finalized plan to present to the user for approval.'
    }
  },
  required: ['plan']
}

export const EnterPlanModeTool: ToolDef = {
  name: 'EnterPlanMode',
  description:
    'Switch into plan mode — only read-only tools may run; write/exec tools are blocked. Use this for non-trivial implementation tasks before writing code.',
  category: 'plan',
  planSafe: true,
  parameters: ENTER_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { plan } = parseToolArgs<PlanInput>(ctx.call.arguments)
    ctx.session.planMode = true
    if (plan) ctx.session.planDraft = plan
    return {
      content:
        'Entered plan mode. Read-only tools are allowed. Write your plan, then call ExitPlanMode with the final plan to request user approval.',
      ui: { kind: 'plan', data: { mode: 'enter', plan: ctx.session.planDraft } }
    }
  }
}

export const ExitPlanModeTool: ToolDef = {
  name: 'ExitPlanMode',
  description:
    'Signal that the plan is ready for user review. Pass the final plan as `plan`. After exiting, write tools become available again.',
  category: 'plan',
  planSafe: true,
  parameters: EXIT_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { plan } = parseToolArgs<PlanInput>(ctx.call.arguments)
    if (!plan) return { content: 'ExitPlanMode requires `plan`.', isError: true }
    ctx.session.planDraft = plan
    ctx.session.planMode = false
    return {
      content:
        'Plan presented to user. Plan mode exited; write tools are now available.',
      ui: { kind: 'plan', data: { mode: 'exit', plan } }
    }
  }
}
