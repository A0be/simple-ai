import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { isConfigReady } from '@/lib/storage'
import CompanionStatus from './CompanionStatus'
import CompanionPermissionModal from './CompanionPermissionModal'
import { IconHome, IconUsers, IconHistory, IconSettings, IconTerminal } from './Icons'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: <IconHome /> },
  { to: '/agents', label: '角色', icon: <IconUsers /> },
  { to: '/claude-code', label: '终端', icon: <IconTerminal /> },
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
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      {!configured && location.pathname !== '/settings' && <ConfigBanner />}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 pt-2 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
      <CompanionPermissionModal />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-ink-100">
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <NavLink to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-ink-900 text-white flex items-center justify-center text-sm font-semibold">
            AI
          </span>
          <span className="font-semibold text-ink-900">简易 AI 工具箱</span>
        </NavLink>
        <div className="flex items-center gap-2">
          <CompanionStatus />
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

function ConfigBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 text-sm text-amber-800 flex items-center gap-2">
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
      <div className="max-w-5xl mx-auto px-2 grid grid-cols-5">
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
