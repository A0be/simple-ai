import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { isConfigReady } from '@/lib/storage'
import { IconFolder, IconHome, IconUsers, IconHistory, IconSettings } from './Icons'
import { electronPickWorkspace, electronSetWorkspace, isElectron } from '@/lib/electron'
import { getWorkspace, setWorkspaceStore, subscribeWorkspace } from '@/lib/workspaceStore'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: <IconHome /> },
  { to: '/agents', label: '角色', icon: <IconUsers /> },
  { to: '/history', label: '记录', icon: <IconHistory /> },
  { to: '/settings', label: '设置', icon: <IconSettings /> },
]

export default function Layout() {
  const location = useLocation()
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    setConfigured(isConfigReady())
  }, [location])

  return (
    <div className="min-h-dvh h-dvh flex flex-col overflow-hidden">
      <Header />
      {!configured && location.pathname !== '/settings' && <ConfigBanner />}
      <main className="flex-1 min-h-0 flex flex-col w-full max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 pb-[calc(4.5rem+var(--safe-bottom))] pt-2 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  )
}

function Header() {
  const electron = isElectron()
  const [workspace, setWorkspace] = useState<string | null>(() => getWorkspace())

  useEffect(() => subscribeWorkspace(setWorkspace), [])

  const chooseWorkspace = async () => {
    const picked = await electronPickWorkspace()
    if (!picked) return
    await electronSetWorkspace(picked)
    setWorkspaceStore(picked)
  }

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-ink-100">
      <div
        className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 flex items-center justify-between h-14"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <NavLink to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-ink-900 text-white flex items-center justify-center text-sm font-semibold">
            AI
          </span>
          <span className="font-semibold text-ink-900 truncate">简易 AI 工具箱</span>
        </NavLink>
        <div className="flex items-center gap-2">
          {electron && (
            <button
              type="button"
              onClick={chooseWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
              title={workspace ? `工具运行目录：${workspace}` : '选择工具运行目录'}
            >
              <IconFolder />
              <span className="hidden sm:inline max-w-[180px] truncate">
                {workspace ? displayWorkspace(workspace) : '选择目录'}
              </span>
            </button>
          )}
          <NavLink
            to="/agents"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            title="内置 Agent"
          >
            <IconUsers />
            <span className="hidden sm:inline">内置 Agent</span>
          </NavLink>
          <NavLink
            to="/settings"
            className="text-ink-500 hover:text-ink-900 text-sm flex items-center gap-1"
            aria-label="设置"
          >
            <IconSettings />
          </NavLink>
        </div>
      </div>
    </header>
  )
}

function displayWorkspace(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  const last = parts[parts.length - 1] || normalized
  if (!last) return path
  return last.length > 24 ? `${last.slice(0, 10)}…${last.slice(-10)}` : last
}

function ConfigBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-2.5 text-sm text-amber-800 flex items-center gap-2">
        <span>⚠️</span>
        <span>还没配置 API，</span>
        <NavLink to="/settings" className="underline font-medium hover:text-amber-900">
          点这里去配置
        </NavLink>
      </div>
    </div>
  )
}

function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-ink-100"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="max-w-6xl mx-auto px-2 grid grid-cols-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 transition-colors ${
                isActive ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
              }`
            }
          >
            <span className="leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
