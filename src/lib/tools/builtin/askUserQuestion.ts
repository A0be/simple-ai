import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'

const SCHEMA = {
  type: 'object' as const,
  properties: {
    question: {
      type: 'string',
      description: 'The question to ask, ending with "?"'
    },
    options: {
      type: 'array' as const,
      description:
        '2-4 mutually-exclusive choices. Each: {label, description, preview?}',
      items: {
        type: 'object' as const,
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          preview: {
            type: 'string',
            description:
              'Optional preview content (markdown / code) shown side-by-side.'
          }
        },
        required: ['label', 'description']
      }
    },
    multiSelect: { type: 'boolean', description: 'Allow multiple selection' }
  },
  required: ['question', 'options']
}

interface AskInput {
  question: string
  options: { label: string; description: string; preview?: string }[]
  multiSelect?: boolean
}

export const AskUserQuestionTool: ToolDef = {
  name: 'AskUserQuestion',
  description:
    'Ask the user a multiple-choice question to gather preferences / clarify ambiguity / make decisions. Users may always pick "Other" for free text.',
  category: 'core',
  planSafe: true,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const args = parseToolArgs<AskInput>(ctx.call.arguments)
    if (!args.question || !Array.isArray(args.options) || args.options.length < 2) {
      return {
        content: 'AskUserQuestion requires `question` and at least 2 `options`.',
        isError: true
      }
    }
    const res = await ctx.ui.askUserQuestion({
      question: args.question,
      options: args.options,
      multiSelect: !!args.multiSelect
    })
    if (res.cancelled) {
      return { content: 'User dismissed the question without answering.' }
    }
    const reply = res.chosen.join(', ')
    const notes = res.notes ? `\nNotes: ${res.notes}` : ''
    return { content: `User chose: ${reply}${notes}` }
  }
}
