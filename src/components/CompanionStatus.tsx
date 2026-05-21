import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  type CompanionState,
  subscribeCompanion,
  parseConnectUrl,
  connectCompanion,
  disconnectCompanion,
  pickWorkspace,
  setWorkspace,
  refreshCompanion,
  loadCompanionConfig
} from '@/lib/companion'
import { isTauri } from '@/lib/tauri'
import { isElectron, electronPickWorkspace, electronSetWorkspace } from '@/lib/electron'
import { setWorkspaceStore, subscribeWorkspace } from '@/lib/workspaceStore'
import {
  type CliDetectorState,
  subscribeCliDetector,
  detectClis,
  setActiveCli
} from '@/lib/cliDetector'

export default function CompanionStatus() {
  const [s, setS] = useState<CompanionState | null>(null)
  const [cli, setCli] = useState<CliDetectorState | null>(null)
  const [open, setOpen] = useState(false)
  const [electronWs, setElectronWs] = useState<string | null>(null)
  const tauri = isTauri()
  const electron = isElectron()

  useEffect(() => subscribeCompanion(setS), [])
  useEffect(() => subscribeCliDetector(setCli), [])
  useEffect(() => {
    const id = setInterval(() => {
      if (s?.config) refreshCompanion()
    }, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.config?.token])

  useEffect(() => subscribeWorkspace(setElectronWs), [])

  if (tauri || electron) {
    const doPickElectron = async () => {
      const ws = await electronPickWorkspace()
      if (ws) {
        setWorkspaceStore(ws)
        electronSetWorkspace(ws)
      }
    }
    const availableClis = cli?.clis.filter(c => c.available) || []
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
          🖥 桌面版
        </span>
        {electron && (
          <button
            onClick={doPickElectron}
            className="text-[10px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200 transition-colors max-w-[180px] truncate"
            title={electronWs || '选择工作目录'}
          >
            📁 {electronWs ? shortPath(electronWs) : '选择目录…'}
          </button>
        )}
        {cli?.detected && (
          <select
            value={cli.activeCli?.id || ''}
            onChange={(e) => setActiveCli(e.target.value || null)}
            className="text-[10px] px-1.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 appearance-none cursor-pointer hover:bg-sky-200 transition-colors"
            title="选择 AI CLI 工具"
          >
            <option value="">⚙️ 内置 Agent</option>
            {availableClis.map(c => (
              <option key={c.id} value={c.id}>🔗 {c.name}{c.version ? ` (${c.version.slice(0, 20)})` : ''}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(true)}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors max-w-[220px] truncate ${
            s?.connected
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
              : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
          }`}
          title={s?.connected ? (s.workspace || '未选择目录') : '连接本机助手'}
        >
          {s?.connected
            ? `🟢 ${s.workspace ? shortPath(s.workspace) : '选择目录…'}`
            : '🔌 连接本机'
          }
        </button>
        {cli?.detected && (
          <select
            value={cli.activeCli?.id || ''}
            onChange={(e) => setActiveCli(e.target.value || null)}
            className="text-[10px] px-1.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 appearance-none cursor-pointer hover:bg-sky-200 transition-colors"
            title="选择 AI CLI 工具"
          >
            <option value="">⚙️ 内置 Agent</option>
            {(cli.clis.filter(c => c.available) || []).map(c => (
              <option key={c.id} value={c.id}>🔗 {c.name}</option>
            ))}
          </select>
        )}
      </div>
      {open && createPortal(
        <LocalConnectDialog onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  )
}

function shortPath(p: string): string {
  if (p.length <= 24) return p
  return '…' + p.slice(-22)
}

// ─── Unified connect + workspace dialog ───

type Step = 'connect' | 'workspace' | 'done'

function LocalConnectDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<CompanionState | null>(null)
  const [cli, setCli] = useState<CliDetectorState | null>(null)
  const [step, setStep] = useState<Step>('connect')
  const [scanning, setScanning] = useState(false)
  const [raw, setRaw] = useState('')
  const [manual, setManual] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeCompanion(setS), [])
  useEffect(() => subscribeCliDetector(setCli), [])

  // If already connected, skip to workspace step
  useEffect(() => {
    if (s?.connected) setStep('workspace')
  }, [s?.connected])

  // ── Auto-scan ──
  const autoScan = useCallback(async () => {
    setScanning(true)
    setErr(null)
    const ports = [17381, 17382, 17383, 17380]
    const savedCfg = loadCompanionConfig()

    for (const port of ports) {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(2000)
        })
        if (resp.ok) {
          const base = `http://127.0.0.1:${port}`

          // Already connected to this port
          if (s?.config?.baseUrl === base && s?.connected) {
            setStep('workspace')
            setScanning(false)
            return
          }

          // Try saved token (same or different port)
          if (savedCfg?.token) {
            try {
              await connectCompanion({ baseUrl: base, token: savedCfg.token })
              detectClis()
              setStep('workspace')
              setScanning(false)
              return
            } catch {
              // saved token didn't work
            }
          }

          // Can't auto-connect — ask for token
          setErr(`找到 companion 在端口 ${port}，请粘贴完整链接（含 token）`)
          setRaw(`http://127.0.0.1:${port}#token=`)
          setScanning(false)
          return
        }
      } catch {
        // port not responding
      }
    }
    setErr('未在本机发现 companion 服务。请先启动 simple-ai-companion.exe')
    setScanning(false)
  }, [s])

  // ── Connect via URL ──
  const doConnect = async () => {
    const cfg = parseConnectUrl(raw)
    if (!cfg) {
      setErr('链接格式不对，需要包含 #token=...')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await connectCompanion(cfg)
      detectClis()
      setStep('workspace')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ── Workspace: system picker ──
  const doPick = async () => {
    setBusy(true)
    setErr(null)
    try {
      const ws = await pickWorkspace()
      if (ws) {
        setStep('done')
        setTimeout(onClose, 600)
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ── Workspace: manual path ──
  const doManual = async () => {
    if (!manual.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await setWorkspace(manual.trim())
      setStep('done')
      setTimeout(onClose, 600)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doDisconnect = () => {
    disconnectCompanion()
    setStep('connect')
    setErr(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card max-w-lg w-full p-5">
        {/* ── Header with steps ── */}
        <div className="flex items-center gap-3 mb-4">
          <StepDot active={step === 'connect'} done={step !== 'connect'} label="1. 连接" />
          <div className="flex-1 h-px bg-ink-200" />
          <StepDot active={step === 'workspace'} done={step === 'done'} label="2. 目录" />
          <div className="flex-1 h-px bg-ink-200" />
          <StepDot active={step === 'done'} done={false} label="3. 就绪" />
        </div>

        {/* ── Step: Connect ── */}
        {step === 'connect' && (
          <div>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">连接本机助手</h2>

            <button
              onClick={autoScan}
              disabled={scanning}
              className="btn-primary w-full text-sm mb-3"
            >
              {scanning ? '⏳ 扫描中…' : '🔍 自动扫描本机 companion'}
            </button>

            <div className="text-xs text-ink-500 text-center mb-3">或手动粘贴链接</div>

            <input
              className="input font-mono text-xs"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="http://127.0.0.1:17381#token=..."
              autoFocus
              spellCheck={false}
              onKeyDown={(e) => e.key === 'Enter' && doConnect()}
            />

            <div className="flex gap-2 mt-3">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">取消</button>
              <button
                onClick={doConnect}
                disabled={!raw.trim() || busy}
                className="btn-primary flex-1 text-sm"
              >
                {busy ? '连接中…' : '连接'}
              </button>
            </div>

            <details className="mt-4 text-xs text-ink-500">
              <summary className="cursor-pointer hover:text-ink-700">没有 companion？</summary>
              <div className="mt-2 space-y-1 leading-relaxed">
                <p>1. 在项目目录找到 <code className="bg-ink-100 px-1 rounded">打包companion.bat</code>，双击编译</p>
                <p>2. 运行 <code className="bg-ink-100 px-1 rounded">companion/target/release/simple-ai-companion.exe</code></p>
                <p>3. 终端会打印一条含 token 的链接，粘贴到上方即可</p>
              </div>
            </details>
          </div>
        )}

        {/* ── Step: Workspace ── */}
        {step === 'workspace' && (
          <div>
            <h2 className="text-lg font-semibold text-ink-900 mb-1">选择工作目录</h2>
            <p className="text-xs text-ink-500 mb-4">
              AI 工具将在此目录中读写文件、运行命令
              {s?.workspace && (
                <>
                  <br />当前：<code className="bg-ink-100 px-1 rounded">{s.workspace}</code>
                </>
              )}
            </p>

            <button
              onClick={doPick}
              disabled={busy}
              className="btn-primary w-full text-sm mb-3 py-3"
            >
              📁 打开系统文件选择框
            </button>

            <div className="text-xs text-ink-500 text-center mb-2">或输入绝对路径</div>

            <div className="flex gap-2">
              <input
                className="input font-mono text-xs flex-1"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="D:\my-project 或 /home/me/code"
                spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && doManual()}
              />
              <button
                onClick={doManual}
                disabled={!manual.trim() || busy}
                className="btn-secondary text-sm"
              >
                确定
              </button>
            </div>

            {/* CLI detection status */}
            {cli?.detected && (
              <div className="mt-3 p-2.5 rounded-lg bg-ink-50 border border-ink-100">
                <div className="text-xs font-medium text-ink-700 mb-1">本机 CLI 检测</div>
                {cli.clis.filter(c => c.available).length > 0 ? (
                  <div className="space-y-0.5">
                    {cli.clis.filter(c => c.available).map(c => (
                      <div key={c.id} className="text-xs text-emerald-700 flex items-center gap-1.5">
                        <span>✓</span> {c.name} <span className="text-ink-400">{c.version}</span>
                      </div>
                    ))}
                  </div>
                ) : cli.probing ? (
                  <div className="text-xs text-ink-500">检测中…</div>
                ) : (
                  <div className="text-xs text-ink-500">未检测到外部 CLI，将使用内置 Agent</div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-3 border-t border-ink-100">
              <button onClick={doDisconnect} className="btn-ghost text-sm text-red-600 flex-1">
                断开连接
              </button>
              {s?.workspace && (
                <button onClick={onClose} className="btn-secondary text-sm flex-1">
                  保持当前目录
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-lg font-semibold text-ink-900">已就绪</div>
            <div className="text-sm text-ink-500 mt-1">
              工作目录：<code className="bg-ink-100 px-1 rounded">{s?.workspace}</code>
            </div>
            {cli?.activeCli && (
              <div className="text-sm text-emerald-600 mt-1">
                🔗 已连接 {cli.activeCli.name}
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {err && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-3">
            {err}
          </div>
        )}
      </div>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
        done ? 'bg-emerald-500 text-white'
          : active ? 'bg-ink-900 text-white'
            : 'bg-ink-200 text-ink-500'
      }`}>
        {done ? '✓' : label.charAt(0)}
      </div>
      <span className={`text-[10px] ${active ? 'text-ink-900 font-medium' : 'text-ink-400'}`}>
        {label}
      </span>
    </div>
  )
}
