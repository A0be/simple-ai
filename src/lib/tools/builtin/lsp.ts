/**
 * LSP-backed tools. Tauri-only (LSP servers are launched via stdio Tauri commands).
 *
 *   LspStart(name, command, args, rootPath)    → start a language server
 *   LspStop(id)                                → kill it
 *   LspDefinition(id, file, line, col)         → find definition(s)
 *   LspReferences(id, file, line, col)         → find references
 *   LspHover(id, file, line, col)              → markdown hover text
 */
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { tauriInvoke } from '@/lib/tauri'
import { startLsp, getLsp, stopLsp, listLsp } from '@/lib/lsp/client'

function fileUri(path: string): string {
  if (path.startsWith('file://')) return path
  // Normalize Windows paths to file:///C:/...
  if (/^[A-Za-z]:\\/.test(path)) return 'file:///' + path.replace(/\\/g, '/')
  return 'file://' + path
}

function guessLanguageId(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.java')) return 'java'
  if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c'
  if (lower.endsWith('.cpp') || lower.endsWith('.hpp')) return 'cpp'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  return 'plaintext'
}

async function ensureOpen(client: ReturnType<typeof getLsp>, path: string): Promise<string | null> {
  if (!client) return null
  const uri = fileUri(path)
  try {
    const text = await tauriInvoke<string>('fs_read', { path, offset: 0, limit: 10_000_000 })
    await client.ensureOpen(uri, text, guessLanguageId(path))
    return uri
  } catch (e) {
    throw new Error(`open file: ${(e as Error).message}`)
  }
}

const START_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Optional client id (for re-use). Defaults to spawn-generated id.' },
    command: { type: 'string', description: 'LSP server command (e.g. "typescript-language-server").' },
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Command args (e.g. ["--stdio"]).'
    },
    root_path: { type: 'string', description: 'Workspace root absolute path.' }
  },
  required: ['command', 'root_path']
}

export const LspStartTool: ToolDef = {
  name: 'LspStart',
  description:
    'Start a Language Server Protocol server over stdio. Returns the client id used by other Lsp* tools. Tauri-only.',
  category: 'agent',
  env: 'tauri',
  planSafe: false,
  parameters: START_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id, command, args, root_path } = parseToolArgs<{
      id?: string
      command: string
      args?: string[]
      root_path: string
    }>(ctx.call.arguments)
    if (!command || !root_path) {
      return { content: 'LspStart: command and root_path required.', isError: true }
    }
    try {
      const clientId = await startLsp({
        id,
        command,
        args: args || [],
        rootUri: fileUri(root_path)
      })
      return { content: `LSP started: ${clientId}`, ui: { kind: 'agent', data: { id: clientId } } }
    } catch (e) {
      return { content: `LspStart failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const STOP_SCHEMA = {
  type: 'object' as const,
  properties: { id: { type: 'string' } },
  required: ['id']
}

export const LspStopTool: ToolDef = {
  name: 'LspStop',
  description: 'Stop a running LSP server by id.',
  category: 'agent',
  env: 'tauri',
  planSafe: true,
  parameters: STOP_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id } = parseToolArgs<{ id: string }>(ctx.call.arguments)
    if (!id) return { content: 'LspStop: missing id.', isError: true }
    await stopLsp(id)
    return { content: `LSP ${id} stopped.` }
  }
}

const POS_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'LSP client id from LspStart.' },
    file: { type: 'string', description: 'Absolute file path.' },
    line: { type: 'integer', description: '0-indexed line.' },
    character: { type: 'integer', description: '0-indexed column.' }
  },
  required: ['id', 'file', 'line', 'character']
}

export const LspDefinitionTool: ToolDef = {
  name: 'LspDefinition',
  description: 'Find the definition of the symbol at file:line:character via LSP.',
  category: 'agent',
  env: 'tauri',
  planSafe: true,
  parameters: POS_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id, file, line, character } = parseToolArgs<{
      id: string
      file: string
      line: number
      character: number
    }>(ctx.call.arguments)
    const c = getLsp(id)
    if (!c) return { content: `LspDefinition: no client ${id}.`, isError: true }
    try {
      const uri = await ensureOpen(c, file)
      if (!uri) return { content: 'LspDefinition: open failed.', isError: true }
      const r = await c.definition(uri, line, character)
      return {
        content: JSON.stringify(r, null, 2),
        ui: { kind: 'generic', data: r }
      }
    } catch (e) {
      return { content: `LspDefinition failed: ${(e as Error).message}`, isError: true }
    }
  }
}

export const LspReferencesTool: ToolDef = {
  name: 'LspReferences',
  description: 'Find references to the symbol at file:line:character via LSP.',
  category: 'agent',
  env: 'tauri',
  planSafe: true,
  parameters: POS_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id, file, line, character } = parseToolArgs<{
      id: string
      file: string
      line: number
      character: number
    }>(ctx.call.arguments)
    const c = getLsp(id)
    if (!c) return { content: `LspReferences: no client ${id}.`, isError: true }
    try {
      const uri = await ensureOpen(c, file)
      if (!uri) return { content: 'LspReferences: open failed.', isError: true }
      const r = await c.references(uri, line, character)
      return {
        content: JSON.stringify(r, null, 2),
        ui: { kind: 'generic', data: r }
      }
    } catch (e) {
      return { content: `LspReferences failed: ${(e as Error).message}`, isError: true }
    }
  }
}

export const LspHoverTool: ToolDef = {
  name: 'LspHover',
  description: 'Get the hover text (markdown) at file:line:character via LSP.',
  category: 'agent',
  env: 'tauri',
  planSafe: true,
  parameters: POS_SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    const { id, file, line, character } = parseToolArgs<{
      id: string
      file: string
      line: number
      character: number
    }>(ctx.call.arguments)
    const c = getLsp(id)
    if (!c) return { content: `LspHover: no client ${id}.`, isError: true }
    try {
      const uri = await ensureOpen(c, file)
      if (!uri) return { content: 'LspHover: open failed.', isError: true }
      const r = await c.hover(uri, line, character)
      const text = extractHoverText(r)
      return {
        content: text || JSON.stringify(r, null, 2),
        ui: { kind: 'generic', data: r }
      }
    } catch (e) {
      return { content: `LspHover failed: ${(e as Error).message}`, isError: true }
    }
  }
}

const LIST_SCHEMA = {
  type: 'object' as const,
  properties: {},
  required: []
}

export const LspListTool: ToolDef = {
  name: 'LspList',
  description: 'List active LSP clients.',
  category: 'agent',
  env: 'tauri',
  planSafe: true,
  parameters: LIST_SCHEMA,
  async run(_input, _ctx: ToolContext): Promise<ToolResult> {
    const list = listLsp()
    if (!list.length) return { content: '(no LSP clients)' }
    return {
      content: list.map((l) => `${l.id}  ${l.rootUri}`).join('\n'),
      ui: { kind: 'generic', data: list }
    }
  }
}

function extractHoverText(hover: unknown): string {
  if (!hover || typeof hover !== 'object') return ''
  const h = hover as { contents?: unknown }
  if (!h.contents) return ''
  if (typeof h.contents === 'string') return h.contents
  if (Array.isArray(h.contents)) {
    return h.contents
      .map((c) => (typeof c === 'string' ? c : (c as { value?: string }).value || ''))
      .join('\n')
  }
  const c = h.contents as { value?: string; kind?: string }
  return c.value || ''
}
