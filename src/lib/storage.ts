import type { ApiConfig, ConversationMeta } from '@/types'
import type { McpServerConfig } from './mcp/types'

const CONFIG_KEY = 'simple-ai:config'
const CONVERSATIONS_KEY = 'simple-ai:conversations'
const MCP_KEY = 'simple-ai:mcp-servers'

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://minitoken.top/v1',
  apiKey: '',
  model: 'gpt-5.5',
  helperModel: '',
  disableStreaming: false,
  projectContext: '',
  customSkills: [],
  skillsDir: ''
}

export function loadConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<ApiConfig>
    return {
      baseUrl: parsed.baseUrl ?? DEFAULT_CONFIG.baseUrl,
      apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
      model: parsed.model ?? DEFAULT_CONFIG.model,
      helperModel: parsed.helperModel ?? DEFAULT_CONFIG.helperModel,
      disableStreaming: parsed.disableStreaming ?? DEFAULT_CONFIG.disableStreaming,
      projectContext: parsed.projectContext ?? DEFAULT_CONFIG.projectContext,
      customSkills: parsed.customSkills ?? DEFAULT_CONFIG.customSkills,
      skillsDir: parsed.skillsDir ?? DEFAULT_CONFIG.skillsDir,
      imageModel: parsed.imageModel,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: ApiConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function isConfigReady(config?: ApiConfig): boolean {
  const c = config ?? loadConfig()
  return Boolean(c.baseUrl && c.apiKey && c.model)
}

export function loadConversations(): ConversationMeta[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ConversationMeta[]
  } catch {
    return []
  }
}

export function saveConversation(conv: ConversationMeta): void {
  const all = loadConversations()
  const idx = all.findIndex((c) => c.id === conv.id)
  if (idx >= 0) all[idx] = conv
  else all.unshift(conv)
  const trimmed = all.slice(0, 50)
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(trimmed))
}

export function deleteConversation(id: string): void {
  const all = loadConversations().filter((c) => c.id !== id)
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all))
}

export function clearAllConversations(): void {
  localStorage.removeItem(CONVERSATIONS_KEY)
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/* ---------- MCP server list ---------- */

export function loadMcpServers(): McpServerConfig[] {
  try {
    const raw = localStorage.getItem(MCP_KEY)
    if (!raw) return []
    return JSON.parse(raw) as McpServerConfig[]
  } catch {
    return []
  }
}

export function saveMcpServers(list: McpServerConfig[]): void {
  localStorage.setItem(MCP_KEY, JSON.stringify(list))
}

export function upsertMcpServer(cfg: McpServerConfig): McpServerConfig[] {
  const all = loadMcpServers()
  const i = all.findIndex((s) => s.id === cfg.id)
  if (i >= 0) all[i] = cfg
  else all.push(cfg)
  saveMcpServers(all)
  return all
}

export function removeMcpServer(id: string): McpServerConfig[] {
  const all = loadMcpServers().filter((s) => s.id !== id)
  saveMcpServers(all)
  return all
}
