import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TerminalPanel from '@/components/TerminalPanel'
import { IconFolder, IconTerminal } from '@/components/Icons'

/* eslint-disable @typescript-eslint/no-explicit-any */
function api(): any { return (window as any).electronAPI }

interface ClaudeInfo {
  path: string | null
  version: string | null
  hasGlobal: boolean
  hasLocal: boolean
  hasBundled: boolean
}

interface TermInfo {
  hasPty: boolean
  claudePath: string | null
}

export default function ClaudeTerminal() {
  const navigate = useNavigate()
  const [termInfo, setTermInfo] = useState<TermInfo | null>(null)
  const [claudeInfo, setClaudeInfo] = useState<ClaudeInfo | null>(null)
  const [termId, setTermId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')
  const [cwd, setCwd] = useState('')

  const refresh = useCallback(async () => {
    if (!api()) return
    const [ti, ci] = await Promise.all([api().termInfo(), api().claudeInfo()])
    setTermInfo(ti)
    setClaudeInfo(ci)
  }, [])

  useEffect(() => {
    if (!api()) return
    refresh()
    api().getWorkspace().then((w: string | null) => { if (w) setCwd(w) })
  }, [refresh])

  const launch = useCallback(async (mode: 'claude' | 'shell' = 'claude') => {
    if (!api() || !termInfo) return
    if (termId) api().termKill({ id: termId })
    const id = `claude-${Date.now()}`
    const opts: any = { id, cwd: cwd || undefined }
    if (mode === 'claude' && termInfo.claudePath) {
      opts.cmd = termInfo.claudePath
      opts.args = []
    }
    const result = await api().termCreate(opts)
    if (result.error) {
      alert(result.error)
      return
    }
    setTermId(id)
    setRunning(true)
  }, [termInfo, termId, cwd])

  const kill = useCallback(() => {
    if (termId) api()?.termKill({ id: termId })
    setRunning(false)
    setTermId(null)
  }, [termId])

  const pickDir = useCallback(async () => {
    const dir = await api()?.pickWorkspace()
    if (dir) setCwd(dir)
  }, [])

  const doSetup = useCallback(async (mode: 'auto' | 'update' | 'extract') => {
    setSetupBusy(true)
    setSetupMsg(mode === 'extract' ? '正在释放封装版…' : '正在安装/更新 Claude Code CLI…')
    try {
      const result = await api()?.claudeSetup({ mode })
      if (result?.ok) {
        setSetupMsg(
          result.source === 'bundled'
            ? '已释放封装版 Claude CLI'
            : result.version
              ? `已安装 Claude CLI ${result.version}`
              : '安装完成'
        )
        await refresh()
      } else {
        setSetupMsg('安装失败：' + (result?.message || '未知错误'))
      }
    } catch (e: any) {
      setSetupMsg('安装出错：' + e.message)
    } finally {
      setSetupBusy(false)
    }
  }, [refresh])

  const handleExit = useCallback(() => {
    setRunning(false)
  }, [])

  if (!api()) {
    return <div className="py-12 text-center text-ink-500">此功能仅在 Electron 桌面版可用</div>
  }

  const hasClaude = !!termInfo?.claudePath
  const hasPty = !!termInfo?.hasPty

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7.5rem)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-ink-50 border border-ink-200 rounded-t-lg flex-wrap">
        <button onClick={() => navigate(-1)} className="btn-ghost text-sm">← 返回</button>
        <div className="w-px h-5 bg-ink-200" />

        <button onClick={pickDir} className="btn-ghost text-xs flex items-center gap-1" title="选择工作目录">
          <IconFolder />
          <span className="max-w-[200px] truncate">{cwd || '选择目录'}</span>
        </button>

        {hasClaude ? (
          <button onClick={() => launch('claude')} className="btn-primary text-xs" disabled={!hasPty}>
            {running ? '重启 Claude' : '启动 Claude Code'}
          </button>
        ) : (
          <button
            onClick={() => doSetup('auto')}
            className="btn-primary text-xs"
            disabled={setupBusy}
          >
            {setupBusy ? '安装中…' : '安装 Claude Code'}
          </button>
        )}

        <button onClick={() => launch('shell')} className="btn-ghost text-xs" disabled={!hasPty}>
          普通终端
        </button>

        {running && (
          <button onClick={kill} className="btn-ghost text-xs text-red-600">终止</button>
        )}

        <div className="flex-1" />

        {claudeInfo?.version && (
          <span className="text-[10px] text-ink-400 hidden sm:inline">
            {claudeInfo.version}
            {claudeInfo.hasGlobal ? '' : claudeInfo.hasLocal ? ' (本地)' : ' (封装)'}
          </span>
        )}

        {hasClaude && (
          <button
            onClick={() => doSetup('update')}
            className="btn-ghost text-xs"
            disabled={setupBusy}
          >
            {setupBusy ? '更新中…' : '更新 CLI'}
          </button>
        )}
      </div>

      {/* Status messages */}
      {!hasPty && termInfo && (
        <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs border-x border-ink-200">
          node-pty 不可用。请安装 Visual Studio Build Tools 后重新运行 npm install
        </div>
      )}
      {setupMsg && (
        <div className={`px-3 py-1.5 text-xs border-x border-ink-200 ${
          setupMsg.includes('失败') || setupMsg.includes('出错')
            ? 'bg-red-50 text-red-700'
            : 'bg-emerald-50 text-emerald-700'
        }`}>
          {setupMsg}
          <button onClick={() => setSetupMsg('')} className="ml-2 text-ink-400 hover:text-ink-600">✕</button>
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0 bg-[#1e1e2e] rounded-b-lg overflow-hidden border-x border-b border-ink-200">
        {termId ? (
          <TerminalPanel key={termId} termId={termId} onExit={handleExit} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
            <IconTerminal className="w-16 h-16 opacity-20" />
            {!hasClaude && !setupBusy ? (
              <div className="text-center space-y-2">
                <div className="text-sm">未检测到 Claude Code CLI</div>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => doSetup('auto')} className="btn-primary text-xs">
                    自动安装
                  </button>
                  {claudeInfo?.hasBundled && (
                    <button onClick={() => doSetup('extract')} className="btn-ghost text-xs">
                      释放封装版
                    </button>
                  )}
                </div>
              </div>
            ) : hasClaude ? (
              <div className="text-sm">点击上方按钮启动终端</div>
            ) : setupBusy ? (
              <div className="text-sm animate-pulse">{setupMsg || '准备中…'}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
