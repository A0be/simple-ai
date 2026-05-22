import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { loadConfig, saveConfig } from '@/lib/storage'
import type { ApiConfig } from '@/types'

/**
 * Reflects the user's settings to the model. Only exposes safe, scalar fields
 * — apiKey reads come back masked to avoid leaking the secret into the
 * conversation transcript. Writes go through AskUserQuestion for confirmation.
 *
 * (Modeled on Claude Code's ConfigTool but scoped to simple-ai's ApiConfig.)
 */

type Setting =
  | 'baseUrl'
  | 'apiKey'
  | 'model'
  | 'helperModel'
  | 'disableStreaming'
  | 'projectContext'

interface SettingMeta {
  type: 'string' | 'boolean'
  description: string
  /** Read-side: hide secret content. */
  maskOnRead?: boolean
  /** Read-side: trim long strings to N chars. */
  truncateOnRead?: number
}

const SUPPORTED: Record<Setting, SettingMeta> = {
  baseUrl: { type: 'string', description: 'OpenAI-compatible chat API base URL' },
  apiKey: { type: 'string', description: 'API key for the configured baseUrl', maskOnRead: true },
  model: { type: 'string', description: 'Main chat completion model id' },
  helperModel: { type: 'string', description: 'Cheaper helper model used by sub-agents' },
  disableStreaming: { type: 'boolean', description: 'Force non-streaming responses' },
  projectContext: {
    type: 'string',
    description: 'Project-level CLAUDE.md / system context prepended to every chat',
    truncateOnRead: 500,
  },
}

const SUPPORTED_NAMES = Object.keys(SUPPORTED) as Setting[]

function maskApiKey(v: unknown): string {
  if (typeof v !== 'string' || !v) return '(unset)'
  if (v.length <= 10) return '****'
  return `${v.slice(0, 5)}...${v.slice(-4)}`
}

function coerceValue(setting: Setting, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const meta = SUPPORTED[setting]
  if (meta.type === 'boolean') {
    if (typeof raw === 'boolean') return { ok: true, value: raw }
    if (raw === 'true') return { ok: true, value: true }
    if (raw === 'false') return { ok: true, value: false }
    return { ok: false, error: `expected boolean, got ${typeof raw}` }
  }
  // string
  if (typeof raw !== 'string') return { ok: false, error: `expected string, got ${typeof raw}` }
  return { ok: true, value: raw }
}

const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    setting: {
      type: 'string',
      enum: SUPPORTED_NAMES,
      description: 'Which config field to read or write.',
    },
    value: {
      description:
        'When provided, set the setting to this value. When omitted, return the current value (apiKey is masked).',
    },
  },
  required: ['setting'],
}

export const ConfigTool: ToolDef = {
  name: 'Config',
  description:
    'Read or modify the user\'s simple-ai application settings (baseUrl, apiKey, model, helperModel, disableStreaming, projectContext). ' +
    'Reads are auto-allowed and apiKey is masked. Writes prompt the user for confirmation via AskUserQuestion. ' +
    'Use this when the user explicitly asks you to inspect or change a setting — do not invoke speculatively.',
  category: 'core',
  planSafe: true,
  parameters: CONFIG_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { setting, value } = parseToolArgs<{ setting: string; value?: unknown }>(ctx.call.arguments)
    if (!setting || !SUPPORTED_NAMES.includes(setting as Setting)) {
      return {
        content: `Config: unsupported setting "${setting}". Supported: ${SUPPORTED_NAMES.join(', ')}`,
        isError: true,
      }
    }
    const key = setting as Setting
    const meta = SUPPORTED[key]
    const cfg = loadConfig()

    // READ
    if (value === undefined) {
      const current = (cfg as unknown as Record<string, unknown>)[key]
      const display = meta.maskOnRead
        ? maskApiKey(current)
        : meta.truncateOnRead && typeof current === 'string' && current.length > meta.truncateOnRead
        ? `${current.slice(0, meta.truncateOnRead)}…(truncated, ${current.length} chars total)`
        : current === undefined || current === ''
        ? '(unset)'
        : current
      return { content: `Config.${key} = ${JSON.stringify(display)}` }
    }

    // WRITE — coerce + confirm
    const coerced = coerceValue(key, value)
    if (!coerced.ok) {
      return { content: `Config: invalid value for ${key} — ${coerced.error}`, isError: true }
    }
    const newVal = coerced.value

    // Build a description that doesn't echo back secrets
    const displayValue = key === 'apiKey' && typeof newVal === 'string'
      ? maskApiKey(newVal)
      : typeof newVal === 'string' && newVal.length > 80
      ? `"${newVal.slice(0, 77)}…"`
      : JSON.stringify(newVal)

    const ans = await ctx.ui.askUserQuestion({
      question: `允许将设置 ${key} 改为 ${displayValue} 吗？`,
      options: [
        { label: '允许', description: '应用此修改' },
        { label: '拒绝', description: '保持当前值' },
      ],
    })
    if (ans.cancelled || ans.chosen[0] !== '允许') {
      return { content: `Config write to ${key} cancelled by user.` }
    }

    const nextConfig: ApiConfig = { ...cfg, [key]: newVal } as ApiConfig
    saveConfig(nextConfig)
    return { content: `Config.${key} updated → ${displayValue}` }
  },
}
