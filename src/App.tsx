import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Settings from '@/pages/Settings'
import Feature from '@/pages/Feature'
import History from '@/pages/History'
import About from '@/pages/About'
import Tools from '@/pages/Tools'
import McpServers from '@/pages/Mcp'
import SkillsPage from '@/pages/Skills'
import Agents from '@/pages/Agents'
import AgentChat from '@/pages/AgentChat'
import ClaudeTerminal from '@/pages/ClaudeTerminal'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
        <Route path="/about" element={<About />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/mcp" element={<McpServers />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/claude-code" element={<ClaudeTerminal />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agent/:agentId" element={<AgentChat />} />
        <Route path="/agent/:agentId/:conversationId" element={<AgentChat />} />
        <Route path="/:featureId" element={<Feature />} />
        <Route path="/:featureId/:conversationId" element={<Feature />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
