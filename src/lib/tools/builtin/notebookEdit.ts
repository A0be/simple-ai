/**
 * NotebookEdit — Jupyter (.ipynb) cell editor. Tauri-only because it
 * touches the filesystem. Implemented in pure JS on top of fs_read / fs_write.
 */
import type { ToolDef, ToolContext, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { tauriInvoke } from '@/lib/tauri'

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw'
  source: string | string[]
  metadata?: Record<string, unknown>
  id?: string
  outputs?: unknown[]
  execution_count?: number | null
}

interface Notebook {
  cells: NotebookCell[]
  metadata?: Record<string, unknown>
  nbformat?: number
  nbformat_minor?: number
}

interface NotebookEditInput {
  notebook_path: string
  new_source: string
  cell_number?: number
  cell_id?: string
  cell_type?: 'code' | 'markdown'
  edit_mode?: 'replace' | 'insert' | 'delete'
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    notebook_path: {
      type: 'string',
      description: 'Absolute path to the .ipynb file.'
    },
    new_source: {
      type: 'string',
      description: 'New source for the cell (ignored when edit_mode=delete).'
    },
    cell_number: {
      type: 'integer',
      description: '0-indexed cell index. Provide either cell_number or cell_id.'
    },
    cell_id: {
      type: 'string',
      description: 'Target cell by its id (alternative to cell_number).'
    },
    cell_type: {
      type: 'string',
      enum: ['code', 'markdown'],
      description: 'Required when edit_mode=insert. Defaults to current cell type for replace.'
    },
    edit_mode: {
      type: 'string',
      enum: ['replace', 'insert', 'delete'],
      description: 'replace (default), insert, or delete.'
    }
  },
  required: ['notebook_path', 'new_source']
}

function genCellId(): string {
  return `cell_${Math.random().toString(36).slice(2, 10)}`
}

function findCellIndex(nb: Notebook, byId?: string, byNumber?: number): number {
  if (byId) {
    const i = nb.cells.findIndex((c) => c.id === byId)
    if (i < 0) return -1
    return i
  }
  if (typeof byNumber === 'number') return byNumber
  return -1
}

export const NotebookEditTool: ToolDef = {
  name: 'NotebookEdit',
  description:
    'Edit a Jupyter notebook (.ipynb) cell — replace, insert, or delete. Provide either cell_number or cell_id.',
  category: 'fs',
  env: 'tauri',
  planSafe: false,
  parameters: SCHEMA,
  async run(_input, ctx: ToolContext): Promise<ToolResult> {
    if (ctx.session.planMode) {
      return {
        content: 'NotebookEdit is blocked in plan mode. Call ExitPlanMode first.',
        isError: true
      }
    }
    const args = parseToolArgs<NotebookEditInput>(ctx.call.arguments)
    const { notebook_path, new_source, cell_number, cell_id, cell_type } = args
    const edit_mode = args.edit_mode || 'replace'

    if (!notebook_path) {
      return { content: 'NotebookEdit: missing notebook_path.', isError: true }
    }

    let raw: string
    try {
      raw = await tauriInvoke<string>('fs_read', {
        path: notebook_path,
        offset: 0,
        limit: 10_000_000
      })
    } catch (e) {
      return { content: `NotebookEdit: read failed — ${(e as Error).message}`, isError: true }
    }

    let nb: Notebook
    try {
      nb = JSON.parse(raw) as Notebook
    } catch (e) {
      return {
        content: `NotebookEdit: not valid JSON — ${(e as Error).message}`,
        isError: true
      }
    }
    if (!Array.isArray(nb.cells)) {
      return { content: 'NotebookEdit: not a valid notebook (no `cells` array).', isError: true }
    }

    const idx = findCellIndex(nb, cell_id, cell_number)

    if (edit_mode === 'delete') {
      if (idx < 0 || idx >= nb.cells.length) {
        return { content: `NotebookEdit: cell not found (idx=${idx}).`, isError: true }
      }
      nb.cells.splice(idx, 1)
    } else if (edit_mode === 'insert') {
      const insertAt = idx < 0 ? nb.cells.length : idx
      const ct = cell_type || 'code'
      const newCell: NotebookCell = {
        cell_type: ct,
        source: new_source,
        metadata: {},
        id: genCellId()
      }
      if (ct === 'code') {
        newCell.outputs = []
        newCell.execution_count = null
      }
      nb.cells.splice(insertAt, 0, newCell)
    } else {
      // replace
      if (idx < 0 || idx >= nb.cells.length) {
        return { content: `NotebookEdit: cell not found (idx=${idx}).`, isError: true }
      }
      const cell = nb.cells[idx]
      cell.source = new_source
      if (cell_type) cell.cell_type = cell_type
      // clear outputs / execution_count on edit
      if (cell.cell_type === 'code') {
        cell.outputs = []
        cell.execution_count = null
      }
    }

    try {
      await tauriInvoke('fs_write', {
        path: notebook_path,
        content: JSON.stringify(nb, null, 1)
      })
    } catch (e) {
      return {
        content: `NotebookEdit: write failed — ${(e as Error).message}`,
        isError: true
      }
    }

    return {
      content: `NotebookEdit: ${edit_mode} cell at index ${idx >= 0 ? idx : nb.cells.length - 1} of ${notebook_path}`,
      ui: { kind: 'fs-edit', data: { notebook_path, edit_mode, idx } }
    }
  }
}
