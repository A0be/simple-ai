/**
 * Slash command system.
 *
 * Commands are matched by the user input starting with "/<name>".
 * Each command returns either:
 *  - { kind: 'message', text }  → inject a system message and continue
 *  - { kind: 'action', run }    → execute side-effect (clear, etc.)
 *  - { kind: 'inline', text }   → replace the user's message with text
 */
import type { ChatMessage, TodoItem, AgentTask } from '@/types'
import { listSkills, getSkill } from './skills'
import type { ToolRegistry } from './tools/types'

export interface SlashCommand {
  name: string
  description: string
  args?: string
  /** when true, command is exposed in /help even if model doesn't use it */
  visible?: boolean
  run: (ctx: SlashContext) => SlashResult | Promise<SlashResult>
}

export interface SlashContext {
  raw: string
  args: string
  messages: ChatMessage[]
  registry: ToolRegistry
  session: {
    todos: TodoItem[]
    tasks: AgentTask[]
    planMode: boolean
    planDraft: string
  }
  setMessages: (m: ChatMessage[]) => void
  setPlanMode: (v: boolean) => void
}

export type SlashResult =
  | { kind: 'message'; text: string }
  | { kind: 'action'; text?: string }
  | { kind: 'inline'; text: string }
  | { kind: 'noop' }

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'help',
    description: '查看可用的 slash 命令和工具',
    visible: true,
    run: ({ registry }) => {
      const cmds = SLASH_COMMANDS.map(
        (c) => `- /${c.name}${c.args ? ` ${c.args}` : ''} — ${c.description}`
      ).join('\n')
      const tools = registry
        .list(typeof window !== 'undefined' && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ? 'tauri' : 'web')
        .map((t) => `- ${t.name} — ${t.description.split('.')[0]}`)
        .join('\n')
      return {
        kind: 'message',
        text: `## 可用 slash 命令\n${cmds}\n\n## 当前可用工具\n${tools}`
      }
    }
  },
  {
    name: 'clear',
    description: '清空当前对话历史',
    visible: true,
    run: ({ setMessages }) => {
      setMessages([])
      return { kind: 'action', text: '✅ 已清空对话' }
    }
  },
  {
    name: 'compact',
    description: '压缩对话历史（保留摘要 + 最近 N 条）',
    visible: true,
    run: ({ messages, setMessages }) => {
      if (messages.length < 8) {
        return { kind: 'action', text: '对话还很短，无需压缩。' }
      }
      const keep = messages.slice(-4)
      const earlier = messages.slice(0, -4)
      const summary = earlier
        .filter((m) => m.role !== 'system')
        .map((m) => {
          const role = m.role
          const body =
            (m.content || '').slice(0, 200) +
            (m.tool_calls?.length ? ` [tools: ${m.tool_calls.map((c) => c.name).join(', ')}]` : '')
          return `- ${role}: ${body}`
        })
        .join('\n')
      const summaryMsg: ChatMessage = {
        role: 'system',
        content:
          '## 早期对话摘要\n' +
          summary +
          '\n\n（以上是被压缩的早期消息，下面是最近保留的 4 条）'
      }
      setMessages([summaryMsg, ...keep])
      return { kind: 'action', text: `✅ 已压缩 ${earlier.length} 条到摘要` }
    }
  },
  {
    name: 'plan',
    description: '切换 plan mode（只读工具可用，写操作被阻止）',
    visible: true,
    run: ({ session, setPlanMode }) => {
      const next = !session.planMode
      setPlanMode(next)
      return {
        kind: 'action',
        text: next
          ? '✅ 进入 plan mode：只读工具可用'
          : '✅ 退出 plan mode：所有工具恢复'
      }
    }
  },
  {
    name: 'tools',
    description: '列出当前可用的全部工具',
    visible: true,
    run: ({ registry }) => {
      const env = typeof window !== 'undefined' &&
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
        ? 'tauri'
        : 'web'
      const list = registry.list(env)
      const lines = list
        .map((t) => `- **${t.name}** (${t.category ?? 'misc'}, ${t.env ?? 'both'}) — ${t.description.split('.')[0]}`)
        .join('\n')
      return {
        kind: 'message',
        text: `## 当前工具 (${env} 运行时, ${list.length} 个)\n${lines}`
      }
    }
  },
  {
    name: 'skills',
    description: '列出可用 skills（领域知识 / playbook）',
    visible: true,
    run: () => {
      const lines = listSkills()
        .map((s) => `- **${s.name}** — ${s.description}`)
        .join('\n')
      return {
        kind: 'message',
        text: `## 可用 skills\n${lines}\n\n使用方法：模型可调用 Skill 工具，或你直接说"用 <name> skill 帮我..."`
      }
    }
  },
  {
    name: 'skill',
    description: '把某 skill 注入为系统提示',
    args: '<skill-name>',
    visible: true,
    run: ({ args, messages, setMessages }) => {
      const name = args.trim()
      if (!name) return { kind: 'action', text: '用法: /skill <name>。/skills 查看列表。' }
      const s = getSkill(name)
      if (!s) {
        return {
          kind: 'action',
          text: `未找到 skill "${name}"。可用：${listSkills().map((x) => x.name).join(', ')}`
        }
      }
      const sys: ChatMessage = {
        role: 'system',
        content: `[Skill: ${s.name}]\n${s.content}`
      }
      setMessages([sys, ...messages.filter((m) => m.role !== 'system' || !m.content.startsWith('[Skill:'))])
      return { kind: 'action', text: `✅ 注入 skill: ${s.name}` }
    }
  },
  {
    name: 'todos',
    description: '查看当前 todo 列表',
    visible: true,
    run: ({ session }) => {
      if (!session.todos.length) return { kind: 'action', text: '当前无 todos。' }
      const text = session.todos
        .map(
          (t) =>
            `${t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '▶️' : '⬜'} ${t.content}`
        )
        .join('\n')
      return { kind: 'message', text: `## Todos\n${text}` }
    }
  },
  {
    name: 'tasks',
    description: '查看当前任务列表',
    visible: true,
    run: ({ session }) => {
      if (!session.tasks.length) return { kind: 'action', text: '当前无 tasks。' }
      const text = session.tasks
        .map((t) => `#${t.id} [${t.status}] ${t.subject}`)
        .join('\n')
      return { kind: 'message', text: `## Tasks\n${text}` }
    }
  }
]

export function isSlashCommand(input: string): boolean {
  return /^\s*\/[a-zA-Z][\w-]*/.test(input)
}

export function findCommand(input: string): { cmd: SlashCommand; args: string } | null {
  const m = input.trim().match(/^\/([a-zA-Z][\w-]*)\s*(.*)$/s)
  if (!m) return null
  const cmd = SLASH_COMMANDS.find((c) => c.name === m[1])
  if (!cmd) return null
  return { cmd, args: m[2] || '' }
}
