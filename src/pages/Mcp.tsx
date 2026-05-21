import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { McpServerConfig } from '@/lib/mcp/types'
import {
  loadMcpServers,
  upsertMcpServer,
  removeMcpServer,
  generateId
} from '@/lib/storage'
import { activateMcp, deactivateMcp, activeMcpClients } from '@/lib/mcp/client'
import { isTauri } from '@/lib/tauri'

interface RowState {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  message?: string
  toolCount?: number
}

export default function McpServers() {
  const navigate = useNavigate()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [editing, setEditing] = useState<McpServerConfig | null>(null)

  useEffect(() => {
    setServers(loadMcpServers())
    const init: Record<string, RowState> = {}
    for (const c of activeMcpClients()) {
      init[c.id] = { status: 'connected' }
    }
    setRowState(init)
  }, [])

  const connect = async (cfg: McpServerConfig) => {
    setRowState((s) => ({ ...s, [cfg.id]: { status: 'connecting' } }))
    try {
      const c = await activateMcp(cfg)
      const tools = await c.listTools(true)
      setRowState((s) => ({
        ...s,
        [cfg.id]: { status: 'connected', toolCount: tools.length }
      }))
    } catch (e) {
      setRowState((s) => ({
        ...s,
        [cfg.id]: { status: 'error', message: (e as Error).message }
      }))
    }
  }

  const disconnect = async (cfg: McpServerConfig) => {
    await deactivateMcp(cfg.id)
    setRowState((s) => ({ ...s, [cfg.id]: { status: 'idle' } }))
  }

  const save = (cfg: McpServerConfig) => {
    const next = upsertMcpServer(cfg)
    setServers(next)
    setEditing(null)
  }

  const remove = async (cfg: McpServerConfig) => {
    if (rowState[cfg.id]?.status === 'connected') {
      await deactivateMcp(cfg.id)
    }
    const next = removeMcpServer(cfg.id)
    setServers(next)
    setRowState((s) => {
      const n = { ...s }
      delete n[cfg.id]
      return n
    })
  }

  return (
    <div className="pt-4 pb-10 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-3">
        ← 返回
      </button>
      <h1 className="text-xl font-semibold text-ink-900">MCP 服务器</h1>
      <p className="text-sm text-ink-500 mt-1">
        Model Context Protocol。每个服务器可暴露一组工具，连接后会自动出现在模型可调用列表里。
        {!isTauri() && '（stdio 传输需要桌面版；Web 端只支持 HTTP）'}
      </p>

      <div className="mt-4 space-y-2">
        {servers.length === 0 && (
          <div className="card p-4 text-sm text-ink-500">还没添加 MCP 服务器。</div>
        )}
        {servers.map((cfg) => {
          const st = rowState[cfg.id] || { status: 'idle' }
          return (
            <div key={cfg.id} className="card p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-900">{cfg.name}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
                  {cfg.transport}
                </span>
                {st.status === 'connected' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                    已连接{st.toolCount ? ` · ${st.toolCount} 个工具` : ''}
                  </span>
                )}
                {st.status === 'connecting' && (
                  <span className="text-[10px] text-amber-700">连接中…</span>
                )}
                {st.status === 'error' && (
                  <span className="text-[10px] text-red-600" title={st.message}>
                    ❌ {st.message?.slice(0, 30)}
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-500 mt-0.5 break-all">
                {cfg.transport === 'http' ? cfg.url : `${cfg.command} ${(cfg.args || []).join(' ')}`}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap text-xs">
                {st.status !== 'connected' ? (
                  <button onClick={() => connect(cfg)} className="btn-ghost">
                    连接
                  </button>
                ) : (
                  <button onClick={() => disconnect(cfg)} className="btn-ghost">
                    断开
                  </button>
                )}
                <button onClick={() => setEditing(cfg)} className="btn-ghost">
                  编辑
                </button>
                <button
                  onClick={() => remove(cfg)}
                  className="btn-ghost text-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <button
          onClick={() =>
            setEditing({
              id: generateId(),
              name: '',
              transport: 'http',
              url: '',
              enabled: true
            })
          }
          className="btn-primary text-sm"
        >
          + 添加 MCP 服务器
        </button>
      </div>

      {editing && (
        <McpEditor
          server={editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function McpEditor({
  server,
  onSave,
  onCancel
}: {
  server: McpServerConfig
  onSave: (c: McpServerConfig) => void
  onCancel: () => void
}) {
  const [s, setS] = useState<McpServerConfig>(server)
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-w-lg w-full p-5 space-y-3 bg-white">
        <div className="text-lg font-semibold text-ink-900">编辑 MCP 服务器</div>
        <label className="block text-xs text-ink-500">显示名</label>
        <input
          className="input"
          value={s.name}
          onChange={(e) => setS({ ...s, name: e.target.value })}
          placeholder="my-mcp"
        />
        <label className="block text-xs text-ink-500">传输</label>
        <select
          className="input"
          value={s.transport}
          onChange={(e) => setS({ ...s, transport: e.target.value as 'http' | 'stdio' })}
        >
          <option value="http">HTTP / SSE</option>
          <option value="stdio">stdio (Tauri only)</option>
        </select>
        {s.transport === 'http' ? (
          <>
            <label className="block text-xs text-ink-500">URL</label>
            <input
              className="input"
              value={s.url || ''}
              onChange={(e) => setS({ ...s, url: e.target.value })}
              placeholder="https://example.com/mcp"
            />
          </>
        ) : (
          <>
            <label className="block text-xs text-ink-500">Command</label>
            <input
              className="input"
              value={s.command || ''}
              onChange={(e) => setS({ ...s, command: e.target.value })}
              placeholder="npx"
            />
            <label className="block text-xs text-ink-500">Args (空格分隔)</label>
            <input
              className="input"
              value={(s.args || []).join(' ')}
              onChange={(e) =>
                setS({ ...s, args: e.target.value.split(/\s+/).filter(Boolean) })
              }
              placeholder="-y @modelcontextprotocol/server-filesystem /path"
            />
          </>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="btn-ghost">
            取消
          </button>
          <button
            onClick={() => onSave(s)}
            className="btn-primary"
            disabled={!s.name || (s.transport === 'http' ? !s.url : !s.command)}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
