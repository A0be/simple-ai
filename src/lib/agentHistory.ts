/**
 * In-memory store of sub-agent conversation histories.
 *
 * Keyed by AgentTask id. Used by AgentTool to save its final message log,
 * and by SendMessageTool to resume an existing sub-agent.
 *
 * Session-only — dies when the tab/process exits.
 */
import type { ChatMessage } from '@/types'

const HISTORIES = new Map<string, ChatMessage[]>()
const NAME_INDEX = new Map<string, string>() // friendly name → id

export function saveAgentHistory(id: string, name: string | undefined, messages: ChatMessage[]) {
  HISTORIES.set(id, messages)
  if (name) NAME_INDEX.set(name, id)
}

export function getAgentHistory(idOrName: string): ChatMessage[] | undefined {
  if (HISTORIES.has(idOrName)) return HISTORIES.get(idOrName)
  const id = NAME_INDEX.get(idOrName)
  if (id) return HISTORIES.get(id)
  return undefined
}

export function resolveAgentId(idOrName: string): string | undefined {
  if (HISTORIES.has(idOrName)) return idOrName
  return NAME_INDEX.get(idOrName)
}

export function listAgents(): { id: string; name?: string; turns: number }[] {
  const out: { id: string; name?: string; turns: number }[] = []
  const idToName = new Map<string, string>()
  for (const [name, id] of NAME_INDEX.entries()) idToName.set(id, name)
  for (const [id, msgs] of HISTORIES.entries()) {
    out.push({ id, name: idToName.get(id), turns: msgs.filter((m) => m.role === 'user').length })
  }
  return out
}
