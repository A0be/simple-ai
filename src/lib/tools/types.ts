/**
 * Tool interface — OpenAI/Anthropic-style tool definition + a runtime handler.
 *
 * Modeled after Claude Code's Tool.ts but stripped to what we actually need
 * in a browser/Tauri context. No Anthropic SDK dependency, no Zod, no Ink.
 */
import type { ApiConfig, ToolCall } from '@/types'

/** JSON schema fragment for a single tool parameter.
 *  `type` accepts a plain string so tool authors can write `type: 'string'`
 *  without `as const` — the union below is the documented allowed set. */
export interface JSONSchema {
  type?: string
  description?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: (string | number)[]
  default?: unknown
  additionalProperties?: boolean
  // Allow anything else for forward-compat
  [k: string]: unknown
}

/** Where can a tool run? */
export type ToolEnv = 'web' | 'tauri' | 'both'

/** Context passed to every tool invocation. */
export interface ToolContext {
  /** API config (helper model can be picked for sub-agent calls) */
  config: ApiConfig
  /** abort signal — tool should bail when triggered */
  signal?: AbortSignal
  /** the original tool call from the model */
  call: ToolCall
  /** access to the conversation message log (read-only snapshot) */
  history: () => Array<{ role: string; content: string }>
  /** for tools that need to prompt the user via the chat UI */
  ui: ToolUiBridge
  /** tools registered in the same session (for Agent sub-dispatch) */
  registry: ToolRegistry
  /** session-level state (todos, tasks, plan mode...) */
  session: SessionState
  /** are we running in a desktop environment (Tauri or Electron)? */
  isTauri: boolean
  isDesktop: boolean
}

export interface ToolUiBridge {
  /**
   * Open an Ask-User-Question modal and wait for selection.
   * Returns `{ chosen: string[]; notes?: string }` (multi-select returns array).
   * If user dismisses, return `{ chosen: [], cancelled: true }`.
   */
  askUserQuestion(input: {
    question: string
    options: { label: string; description?: string; preview?: string }[]
    multiSelect?: boolean
  }): Promise<{ chosen: string[]; cancelled?: boolean; notes?: string }>
  /** show a transient toast / inline note */
  notify(message: string, kind?: 'info' | 'warn' | 'error'): void
}

/** Mutable session-level data (todos, tasks, plan mode). */
export interface SessionState {
  todos: import('@/types').TodoItem[]
  tasks: import('@/types').AgentTask[]
  planMode: boolean
  /** transient notes / scratchpad surfaced when in plan mode */
  planDraft: string
  /** active worktree path — when set, fs/shell tools default cwd here */
  cwd?: string
  /** active worktree id (matches the directory name); cleared on ExitWorktree */
  worktreeName?: string
  /** original cwd before EnterWorktree (so we can restore on exit) */
  cwdBeforeWorktree?: string
}

/** Result returned from a tool. */
export interface ToolResult {
  /** text the model will see as the tool result */
  content: string
  /** if true, indicate to the user this tool errored */
  isError?: boolean
  /** optional structured display (for inline UI render) */
  ui?: {
    kind: 'todo' | 'task-list' | 'plan' | 'fetch' | 'fs-read' | 'fs-write' | 'fs-edit' | 'shell' | 'agent' | 'search' | 'skill' | 'generic'
    data?: unknown
  }
}

/** Tool definition — what gets registered & advertised to the model. */
export interface ToolDef {
  /** function name, e.g. "WebFetch", "TodoWrite" */
  name: string
  /** description shown to the model */
  description: string
  /** OpenAI tool schema (JSON schema for parameters) */
  parameters: JSONSchema
  /** where this tool can run; tools env-incompatible with current runtime are hidden */
  env?: ToolEnv
  /** category for the /tools UI listing */
  category?: 'core' | 'fs' | 'shell' | 'web' | 'agent' | 'plan' | 'task' | 'memory' | 'misc'
  /** whether this tool's calls should be allowed in plan mode (default: read-only tools yes) */
  planSafe?: boolean
  /** runtime implementation */
  run: (input: unknown, ctx: ToolContext) => Promise<ToolResult>
}

/** Registry — name → ToolDef. */
export class ToolRegistry {
  private tools = new Map<string, ToolDef>()
  register(t: ToolDef) {
    this.tools.set(t.name, t)
  }
  registerMany(ts: ToolDef[]) {
    for (const t of ts) this.register(t)
  }
  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }
  list(env: 'web' | 'tauri' = 'web'): ToolDef[] {
    return [...this.tools.values()].filter((t) => {
      const e = t.env ?? 'both'
      if (e === 'both') return true
      return e === env
    })
  }
  /** Convert tool definitions to OpenAI tool format for inclusion in API request. */
  toOpenAISchema(env: 'web' | 'tauri' = 'web'): unknown[] {
    return this.list(env).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }
}

/** Convenience JSON parser for a tool's `arguments` field. */
export function parseToolArgs<T = Record<string, unknown>>(raw: string): T {
  if (!raw || !raw.trim()) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    // Try to recover from incomplete / fenced JSON
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      return {} as T
    }
  }
}
