/**
 * Worktree tools — wrap `git worktree` via Tauri shell_exec.
 *
 * EnterWorktree:
 *   - takes name + optional baseBranch + optional repoPath
 *   - runs git worktree add and sets session.cwd to the new worktree
 *
 * ExitWorktree:
 *   - takes action="keep"|"remove"
 *   - "remove" runs git worktree remove and clears session state
 *   - "keep" just resets cwd
 */
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { tauriInvoke } from '@/lib/tauri'

interface ShellResult {
  stdout: string
  stderr: string
  status: number | null
}

async function shell(command: string, cwd?: string, timeoutMs = 30_000): Promise<ShellResult> {
  return await tauriInvoke<ShellResult>('shell_exec', {
    command,
    cwd: cwd || null,
    timeoutMs
  })
}

const ENTER_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Worktree directory name (alnum/dash/underscore).' },
    repo_path: {
      type: 'string',
      description: 'Repository root (defaults to current cwd if Bash has been used).'
    },
    base_branch: {
      type: 'string',
      description: 'Base branch / ref to fork from. Defaults to current HEAD.'
    },
    path: {
      type: 'string',
      description: 'Enter an existing worktree at this path instead of creating one.'
    }
  },
  required: []
}

export const EnterWorktreeTool: ToolDef = {
  name: 'EnterWorktree',
  description:
    'Create (or enter) a git worktree and make it the session cwd. Tauri-only. Subsequent shell/fs calls default to this cwd.',
  category: 'shell',
  env: 'tauri',
  planSafe: false,
  parameters: ENTER_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (ctx.session.planMode) {
      return { content: 'EnterWorktree blocked in plan mode. Run ExitPlanMode first.', isError: true }
    }
    const { name, repo_path, base_branch, path } = parseToolArgs<{
      name?: string
      repo_path?: string
      base_branch?: string
      path?: string
    }>(ctx.call.arguments)

    // Mode A: enter existing worktree
    if (path) {
      const lsr = await shell('git worktree list --porcelain', path)
      if (lsr.status !== 0) {
        return { content: `EnterWorktree: not inside a git repo (${path}).`, isError: true }
      }
      ctx.session.cwdBeforeWorktree = ctx.session.cwd
      ctx.session.cwd = path
      ctx.session.worktreeName = path.split(/[\\/]/).pop()
      return {
        content: `Entered existing worktree at ${path}. Active cwd updated.`,
        ui: { kind: 'shell', data: { cwd: path } }
      }
    }

    // Mode B: create new worktree
    const repo = repo_path || ctx.session.cwd
    if (!repo) {
      return {
        content: 'EnterWorktree: need repo_path (or run a Bash cmd that sets cwd first).',
        isError: true
      }
    }
    if (!name) {
      return { content: 'EnterWorktree: missing `name`.', isError: true }
    }
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      return { content: 'EnterWorktree: name must match [A-Za-z0-9._-]+', isError: true }
    }
    const wtPath = `${repo}/.claude/worktrees/${name}`
    const branch = `sai/${name}`
    const base = base_branch || 'HEAD'
    const cmd = `git worktree add -b ${branch} "${wtPath}" ${base}`
    const r = await shell(cmd, repo, 60_000)
    if (r.status !== 0) {
      return {
        content: `EnterWorktree failed (status ${r.status}):\n${r.stderr || r.stdout}`,
        isError: true
      }
    }
    ctx.session.cwdBeforeWorktree = ctx.session.cwd
    ctx.session.cwd = wtPath
    ctx.session.worktreeName = name
    return {
      content: `Created worktree ${name} at ${wtPath} on branch ${branch}. Active cwd updated.`,
      ui: { kind: 'shell', data: { worktree: wtPath, branch } }
    }
  }
}

const EXIT_SCHEMA = {
  type: 'object' as const,
  properties: {
    action: {
      type: 'string',
      enum: ['keep', 'remove'],
      description: '"keep" leaves the worktree on disk; "remove" deletes the directory + branch.'
    },
    discard_changes: {
      type: 'boolean',
      description: 'Force-remove a dirty worktree (passes --force to git worktree remove).'
    }
  },
  required: ['action']
}

export const ExitWorktreeTool: ToolDef = {
  name: 'ExitWorktree',
  description:
    'Leave the active worktree session. action="remove" deletes it; "keep" just resets cwd.',
  category: 'shell',
  env: 'tauri',
  planSafe: false,
  parameters: EXIT_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { action, discard_changes } = parseToolArgs<{
      action: 'keep' | 'remove'
      discard_changes?: boolean
    }>(ctx.call.arguments)
    if (!ctx.session.worktreeName || !ctx.session.cwd) {
      return { content: 'ExitWorktree: no active worktree session.', isError: true }
    }
    const wtPath = ctx.session.cwd
    const restoreCwd = ctx.session.cwdBeforeWorktree
    if (action === 'remove') {
      const force = discard_changes ? '--force' : ''
      const r = await shell(
        `git worktree remove ${force} "${wtPath}"`.trim(),
        restoreCwd || undefined,
        60_000
      )
      if (r.status !== 0) {
        return {
          content: `ExitWorktree remove failed:\n${r.stderr || r.stdout}\nUse discard_changes=true to force.`,
          isError: true
        }
      }
    }
    ctx.session.cwd = restoreCwd
    ctx.session.worktreeName = undefined
    ctx.session.cwdBeforeWorktree = undefined
    return {
      content: `ExitWorktree ${action} — cwd restored to ${restoreCwd || '(none)'}.`,
      ui: { kind: 'shell', data: { action, restoredCwd: restoreCwd } }
    }
  }
}
