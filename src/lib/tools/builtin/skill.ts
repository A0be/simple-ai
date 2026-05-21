import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { getSkill, listSkills } from '@/lib/skills'

interface SkillInput {
  skill: string
  args?: string
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    skill: {
      type: 'string',
      description: 'Name of a skill to invoke (see /skills for list)'
    },
    args: {
      type: 'string',
      description: 'Optional free-form arguments passed to the skill'
    }
  },
  required: ['skill']
}

export const SkillTool: ToolDef = {
  name: 'Skill',
  description:
    'Invoke a registered "skill" — a bundled markdown playbook that injects domain-specific instructions for the model. Use /skills slash command to list available skills.',
  category: 'core',
  planSafe: true,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { skill, args } = parseToolArgs<SkillInput>(ctx.call.arguments)
    if (!skill) return { content: 'Skill: missing `skill` name.', isError: true }
    const s = getSkill(skill)
    if (!s) {
      return {
        content: `Skill "${skill}" not found. Available: ${listSkills()
          .map((x) => x.name)
          .join(', ')}`,
        isError: true
      }
    }
    return {
      content: `Skill "${s.name}" activated.\n\n--- skill instructions ---\n${s.content}\n--- end skill ---\n${
        args ? `\nArguments: ${args}` : ''
      }\n\nNow apply this skill to the user's request.`,
      ui: { kind: 'skill', data: { name: s.name, description: s.description } }
    }
  }
}
