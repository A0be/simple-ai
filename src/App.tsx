import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'

const Home = lazy(() => import('@/pages/Home'))
const Settings = lazy(() => import('@/pages/Settings'))
const Feature = lazy(() => import('@/pages/Feature'))
const History = lazy(() => import('@/pages/History'))
const About = lazy(() => import('@/pages/About'))
const Tools = lazy(() => import('@/pages/Tools'))
const McpServers = lazy(() => import('@/pages/Mcp'))
const SkillsPage = lazy(() => import('@/pages/Skills'))
const Agents = lazy(() => import('@/pages/Agents'))
const AgentChat = lazy(() => import('@/pages/AgentChat'))
const HtmlAnything = lazy(() => import('@/pages/HtmlAnything'))

function route(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-ink-300" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={route(<Home />)} />
        <Route path="/settings" element={route(<Settings />)} />
        <Route path="/history" element={route(<History />)} />
        <Route path="/about" element={route(<About />)} />
        <Route path="/tools" element={route(<Tools />)} />
        <Route path="/mcp" element={route(<McpServers />)} />
        <Route path="/skills" element={route(<SkillsPage />)} />
        <Route path="/html-anything" element={route(<HtmlAnything />)} />
        <Route path="/agents" element={route(<Agents />)} />
        <Route path="/agent/:agentId" element={route(<AgentChat />)} />
        <Route path="/agent/:agentId/:conversationId" element={route(<AgentChat />)} />
        <Route path="/:featureId" element={route(<Feature />)} />
        <Route path="/:featureId/:conversationId" element={route(<Feature />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
