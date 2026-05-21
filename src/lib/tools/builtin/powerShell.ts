import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { shellExec, localBackendAvailable } from '@/lib/localBackend'

const POWERSHELL_SCHEMA = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'PowerShell command/script to run via `powershell.exe -NoProfile -Command`.',
    },
    cwd: {
      type: 'string',
      description: 'Optional working directory. Defaults to the session cwd.',
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default 120000).',
    },
  },
  required: ['command'],
}

function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as { userAgentData?: { platform?: string }; platform?: string }).userAgentData?.platform
    || navigator.platform
    || ''
  return /win/i.test(platform)
}

export const PowerShellTool: ToolDef = {
  name: 'PowerShell',
  description:
    'Run a Windows PowerShell command via `powershell.exe -NoProfile -Command`. ' +
    'Returns combined stdout/stderr and the exit code. Windows-only — fails fast on other platforms. ' +
    'Use this when you need cmdlets / PowerShell-specific scripting; for cross-platform commands prefer Bash.',
  category: 'shell',
  env: 'both',
  planSafe: false,
  parameters: POWERSHELL_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (!localBackendAvailable()) {
      return {
        content: 'PowerShell 需要本机执行权限。请使用桌面版（Electron/Tauri）。',
        isError: true,
      }
    }
    if (!isWindows()) {
      return {
        content: 'PowerShellTool 仅支持 Windows 平台。在 macOS / Linux 上请改用 Bash。',
        isError: true,
      }
    }
    if (ctx.session.planMode) {
      return {
        content: 'PowerShell is blocked in plan mode. Call ExitPlanMode first.',
        isError: true,
      }
    }
    const { command, cwd, timeout } = parseToolArgs<{
      command: string
      cwd?: string
      timeout?: number
    }>(ctx.call.arguments)
    if (!command) return { content: 'PowerShell: missing command.', isError: true }
    const effectiveCwd = cwd || ctx.session.cwd || ''

    // Wrap with -NoProfile -Command so user's profile.ps1 doesn't pollute output
    // and -Command takes a single quoted argument. Escape any single quotes in
    // the user's command for safe embedding.
    const escaped = command.replace(/'/g, "''")
    const wrapped = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${escaped.replace(/"/g, '\\"')}"`

    try {
      const out = await shellExec(wrapped, {
        cwd: effectiveCwd || undefined,
        timeoutMs: timeout || 120_000,
      })
      const body = [
        out.stdout && `--- stdout ---\n${out.stdout}`,
        out.stderr && `--- stderr ---\n${out.stderr}`,
        `--- exit ${out.code} ---`,
      ]
        .filter(Boolean)
        .join('\n')
      return {
        content: body,
        isError: out.code !== 0,
        ui: {
          kind: 'shell',
          data: {
            command,
            code: out.code,
            stdout: out.stdout.slice(0, 400),
            stderr: out.stderr.slice(0, 400),
          },
        },
      }
    } catch (e) {
      return { content: `PowerShell failed: ${(e as Error).message}`, isError: true }
    }
  },
}
