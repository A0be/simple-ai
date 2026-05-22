import { useEffect, useState } from 'react'
import { isElectron } from '@/lib/electron'

interface UpdaterState {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version: string | null
  progress: number
  error: string | null
}

interface UpdaterStatus extends UpdaterState {
  available: boolean
}

const STATE_LABEL: Record<UpdaterState['state'], string> = {
  idle: '空闲',
  checking: '正在检查更新…',
  available: '发现新版本',
  'not-available': '已是最新版',
  downloading: '正在下载',
  downloaded: '下载完成，可重启安装',
  error: '出错',
}

/**
 * Auto-update card surfaced in Settings.
 * Pulls status on mount, subscribes to push updates from electron-updater via
 * the `updater:state` IPC channel. Buttons map to updater:check / download / install.
 * In dev mode (no electron-updater bound) the card shows a friendly notice and disables actions.
 */
export default function AutoUpdateCard() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [busy, setBusy] = useState<'check' | 'download' | 'install' | null>(null)
  const electron = isElectron()

  useEffect(() => {
    if (!electron) return
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const api = (window as any).electronAPI
    if (!api?.updaterStatus) return
    api.updaterStatus().then(setStatus)
    const off = api.onUpdaterState?.((data: UpdaterState) => {
      setStatus(prev => ({ ...(prev || { available: true }), ...data }))
    })
    return off
  }, [electron])

  if (!electron) {
    return (
      <div className="card p-4">
        <div className="font-medium text-ink-900 text-sm">🔄 自动更新</div>
        <div className="text-xs text-ink-500 mt-1">仅 Electron 桌面版支持自动从 GitHub 拉新版本。</div>
      </div>
    )
  }

  const run = async (which: 'check' | 'download' | 'install') => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const api = (window as any).electronAPI
    setBusy(which)
    try {
      if (which === 'check') await api.updaterCheck()
      if (which === 'download') await api.updaterDownload()
      if (which === 'install') await api.updaterInstall()
    } finally {
      setBusy(null)
    }
  }

  const stateText = status ? STATE_LABEL[status.state] : '加载中…'
  const isCheckable = status && status.available && !['checking', 'downloading'].includes(status.state)
  const canDownload = status?.state === 'available'
  const canInstall = status?.state === 'downloaded'

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-ink-900 text-sm">🔄 自动更新</div>
          <div className="text-xs text-ink-500 mt-0.5">
            从 <a href="https://github.com/A0be/simple-ai/releases" target="_blank" rel="noreferrer" className="text-sky-700 underline">GitHub Releases</a> 检查并安装新版本
          </div>
        </div>
        <button
          onClick={() => run('check')}
          disabled={!isCheckable || busy !== null}
          className="btn-ghost text-xs"
        >
          {busy === 'check' ? '检查中…' : '🔍 检查更新'}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={`px-1.5 py-0.5 rounded-full font-medium ${
          status?.state === 'error' ? 'bg-red-100 text-red-700'
          : status?.state === 'downloaded' ? 'bg-emerald-100 text-emerald-700'
          : status?.state === 'available' ? 'bg-amber-100 text-amber-700'
          : 'bg-ink-100 text-ink-600'
        }`}>{stateText}</span>
        {status?.version && (
          <span className="text-ink-500">v{status.version}</span>
        )}
        {status?.state === 'downloading' && (
          <span className="text-ink-500">{status.progress}%</span>
        )}
      </div>

      {status?.error && (
        <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 break-all">{status.error}</div>
      )}

      {!status?.available && status && (
        <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
          当前是开发模式（vite dev server），自动更新已禁用。打包后的安装版会自动启用。
        </div>
      )}

      {(canDownload || canInstall) && (
        <div className="flex gap-2 pt-1">
          {canDownload && (
            <button
              onClick={() => run('download')}
              disabled={busy !== null}
              className="btn-primary text-xs flex-1"
            >
              {busy === 'download' ? '下载中…' : `⬇️ 下载 v${status?.version}`}
            </button>
          )}
          {canInstall && (
            <button
              onClick={() => run('install')}
              disabled={busy !== null}
              className="btn-primary text-xs flex-1"
            >
              {busy === 'install' ? '安装中…' : '♻️ 重启并安装'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
