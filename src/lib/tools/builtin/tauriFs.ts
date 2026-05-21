import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { fsRead, fsWrite, fsGlob, fsGrep, shellExec, localBackendAvailable } from '@/lib/localBackend'

function unavailable(name: string): ToolResult {
  return {
    content: `${name} 需要本机执行权限。请使用桌面版（Electron/Tauri），或在 Web 版顶部点击「连接本机」。`,
    isError: true
  }
}

function noCwd(name: string): ToolResult {
  return {
    content: `${name} 需要先设置工作目录。请在顶部状态栏点击「选择目录」设定当前工作路径。`,
    isError: true
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

async function checkPathPermission(targetPath: string, ctx: ToolContext): Promise<ToolResult | null> {
  const cwd = ctx.session.cwd
  if (!cwd) return noCwd('文件操作')
  const normalTarget = normalizePath(targetPath)
  const normalCwd = normalizePath(cwd)
  if (normalTarget.startsWith(normalCwd)) return null
  // Outside cwd — ask for confirmation
  const answer = await ctx.ui.askUserQuestion({
    question: `工具请求访问工作目录以外的路径：\n${targetPath}\n\n当前工作目录：${cwd}\n\n是否允许？`,
    options: [
      { label: '允许' },
      { label: '拒绝' }
    ]
  })
  if (answer.cancelled || answer.chosen[0] === '拒绝') {
    return { content: `用户拒绝访问目录外路径: ${targetPath}`, isError: true }
  }
  return null
}

const READ_SCHEMA = {
  type: 'object' as const,
  properties: {
    file_path: { type: 'string', description: 'Absolute path to read.' },
    offset: { type: 'integer', description: '0-based starting line (optional).' },
    limit: { type: 'integer', description: 'Max lines to read (default 2000).' }
  },
  required: ['file_path']
}

export const FileReadTool: ToolDef = {
  name: 'FileRead',
  description:
    'Read a file from the local filesystem. Use absolute paths. Returns cat -n style numbered lines.',
  category: 'fs',
  env: 'both',
  planSafe: true,
  parameters: READ_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('FileRead')
    const { file_path, offset, limit } = parseToolArgs<{
      file_path: string
      offset?: number
      limit?: number
    }>(ctx.call.arguments)
    if (!file_path) return { content: 'FileRead: missing file_path.', isError: true }
    const permErr = await checkPathPermission(file_path, ctx)
    if (permErr) return permErr
    try {
      const text = await fsRead(file_path, offset ?? 0, limit ?? 2000)
      const lines = text.split('\n')
      const start = offset ?? 0
      const numbered = lines
        .map((l, i) => `${String(start + i + 1).padStart(5)}\t${l}`)
        .join('\n')
      return {
        content: numbered.length > 60000 ? numbered.slice(0, 60000) + '\n...[truncated]' : numbered,
        ui: { kind: 'fs-read', data: { file_path, lineCount: lines.length } }
      }
    } catch (e) {
      return { content: `FileRead failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const WRITE_SCHEMA = {
  type: 'object' as const,
  properties: {
    file_path: { type: 'string', description: 'Absolute path.' },
    content: { type: 'string', description: 'Full file contents.' }
  },
  required: ['file_path', 'content']
}

export const FileWriteTool: ToolDef = {
  name: 'FileWrite',
  description:
    'Write a file to the local filesystem. Overwrites existing file. Creates parent directories if needed.',
  category: 'fs',
  env: 'both',
  planSafe: false,
  parameters: WRITE_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('FileWrite')
    if (ctx.session.planMode) {
      return {
        content: 'FileWrite is blocked in plan mode. Call ExitPlanMode first.',
        isError: true
      }
    }
    const { file_path, content } = parseToolArgs<{
      file_path: string
      content: string
    }>(ctx.call.arguments)
    if (!file_path) return { content: 'FileWrite: missing file_path.', isError: true }
    const permErr = await checkPathPermission(file_path, ctx)
    if (permErr) return permErr
    try {
      await fsWrite(file_path, content)
      return {
        content: `Wrote ${file_path} (${content.length} chars)`,
        ui: { kind: 'fs-write', data: { file_path, size: content.length } }
      }
    } catch (e) {
      return { content: `FileWrite failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const EDIT_SCHEMA = {
  type: 'object' as const,
  properties: {
    file_path: { type: 'string' },
    old_string: { type: 'string', description: 'Exact text to replace.' },
    new_string: { type: 'string', description: 'Replacement text.' },
    replace_all: { type: 'boolean', description: 'Replace every occurrence (default false).' }
  },
  required: ['file_path', 'old_string', 'new_string']
}

export const FileEditTool: ToolDef = {
  name: 'FileEdit',
  description:
    'Edit a file by replacing `old_string` with `new_string`. `old_string` must be unique unless `replace_all` is true.',
  category: 'fs',
  env: 'both',
  planSafe: false,
  parameters: EDIT_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('FileEdit')
    if (ctx.session.planMode) {
      return {
        content: 'FileEdit is blocked in plan mode. Call ExitPlanMode first.',
        isError: true
      }
    }
    const { file_path, old_string, new_string, replace_all } = parseToolArgs<{
      file_path: string
      old_string: string
      new_string: string
      replace_all?: boolean
    }>(ctx.call.arguments)
    if (!file_path || !old_string) {
      return { content: 'FileEdit: missing required args.', isError: true }
    }
    const permErr = await checkPathPermission(file_path, ctx)
    if (permErr) return permErr
    try {
      const text = await fsRead(file_path, 0, 1_000_000)
      if (!text.includes(old_string)) {
        return {
          content: `FileEdit: old_string not found in ${file_path}.`,
          isError: true
        }
      }
      if (!replace_all) {
        const occurrences = text.split(old_string).length - 1
        if (occurrences > 1) {
          return {
            content: `FileEdit: old_string matches ${occurrences} places; provide more context or set replace_all=true.`,
            isError: true
          }
        }
      }
      const updated = replace_all
        ? text.split(old_string).join(new_string)
        : text.replace(old_string, new_string)
      await fsWrite(file_path, updated)
      return {
        content: `Edited ${file_path}`,
        ui: { kind: 'fs-edit', data: { file_path } }
      }
    } catch (e) {
      return { content: `FileEdit failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const GLOB_SCHEMA = {
  type: 'object' as const,
  properties: {
    pattern: { type: 'string', description: 'Glob pattern, e.g. "src/**/*.ts"' },
    path: { type: 'string', description: 'Optional base directory.' }
  },
  required: ['pattern']
}

export const GlobTool: ToolDef = {
  name: 'Glob',
  description: 'Find files matching a glob pattern. Returns up to 200 paths.',
  category: 'fs',
  env: 'both',
  planSafe: true,
  parameters: GLOB_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('Glob')
    const { pattern, path } = parseToolArgs<{ pattern: string; path?: string }>(ctx.call.arguments)
    if (!pattern) return { content: 'Glob: missing pattern.', isError: true }
    const basePath = path || ctx.session.cwd || ''
    if (!ctx.session.cwd) return noCwd('Glob')
    if (basePath) {
      const permErr = await checkPathPermission(basePath, ctx)
      if (permErr) return permErr
    }
    try {
      const list = await fsGlob(pattern, basePath)
      if (!list.length) return { content: `No matches for ${pattern}` }
      return {
        content: list.slice(0, 200).join('\n') + (list.length > 200 ? `\n...[${list.length - 200} more]` : ''),
        ui: { kind: 'generic', data: { count: list.length, sample: list.slice(0, 5) } }
      }
    } catch (e) {
      return { content: `Glob failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const GREP_SCHEMA = {
  type: 'object' as const,
  properties: {
    pattern: { type: 'string', description: 'Regex (ECMAScript flavor).' },
    path: { type: 'string', description: 'Base path / file. Optional.' },
    glob: { type: 'string', description: 'Restrict to glob, e.g. "*.ts"' },
    output_mode: {
      type: 'string',
      enum: ['files_with_matches', 'content', 'count'],
      description: 'Default: files_with_matches'
    },
    case_insensitive: { type: 'boolean' }
  },
  required: ['pattern']
}

export const GrepTool: ToolDef = {
  name: 'Grep',
  description:
    'Search file contents by regex. Modes: files_with_matches (default), content (matching lines), count.',
  category: 'fs',
  env: 'both',
  planSafe: true,
  parameters: GREP_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('Grep')
    const args = parseToolArgs<{
      pattern: string
      path?: string
      glob?: string
      output_mode?: 'files_with_matches' | 'content' | 'count'
      case_insensitive?: boolean
    }>(ctx.call.arguments)
    if (!args.pattern) return { content: 'Grep: missing pattern.', isError: true }
    const searchPath = args.path || ctx.session.cwd || ''
    if (!ctx.session.cwd) return noCwd('Grep')
    if (searchPath) {
      const permErr = await checkPathPermission(searchPath, ctx)
      if (permErr) return permErr
    }
    try {
      const text = await fsGrep(args.pattern, {
        path: searchPath,
        glob: args.glob,
        mode: args.output_mode,
        ci: args.case_insensitive
      })
      return { content: text || '(no matches)' }
    } catch (e) {
      return { content: `Grep failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const BASH_SCHEMA = {
  type: 'object' as const,
  properties: {
    command: { type: 'string', description: 'Shell command to execute.' },
    cwd: { type: 'string', description: 'Optional working directory.' },
    timeout: { type: 'integer', description: 'Timeout in ms (default 120_000).' }
  },
  required: ['command']
}

export const BashTool: ToolDef = {
  name: 'Bash',
  description:
    'Run a shell command on the local machine. Output (stdout+stderr) is returned. Use cautiously; this can modify the filesystem.',
  category: 'shell',
  env: 'both',
  planSafe: false,
  parameters: BASH_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) return unavailable('Bash')
    if (ctx.session.planMode) {
      return {
        content: 'Bash is blocked in plan mode. Call ExitPlanMode first.',
        isError: true
      }
    }
    const { command, cwd, timeout } = parseToolArgs<{
      command: string
      cwd?: string
      timeout?: number
    }>(ctx.call.arguments)
    if (!command) return { content: 'Bash: missing command.', isError: true }
    if (!ctx.session.cwd && !cwd) return noCwd('Bash')
    const effectiveCwd = cwd || ctx.session.cwd || ''
    if (cwd) {
      const permErr = await checkPathPermission(cwd, ctx)
      if (permErr) return permErr
    }
    try {
      const out = await shellExec(command, {
        cwd: effectiveCwd || undefined,
        timeoutMs: timeout || 120_000
      })
      const body = [
        out.stdout && `--- stdout ---\n${out.stdout}`,
        out.stderr && `--- stderr ---\n${out.stderr}`,
        `--- exit ${out.code} ---`
      ]
        .filter(Boolean)
        .join('\n')
      return {
        content: body,
        isError: out.code !== 0,
        ui: { kind: 'shell', data: { command, code: out.code, stdout: out.stdout.slice(0, 400), stderr: out.stderr.slice(0, 400) } }
      }
    } catch (e) {
      return { content: `Bash failed: ${(e as Error).message}`, isError: true }
    }
  }
}
