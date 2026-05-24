/**
 * Agent capabilities module — patterns from awesome-llm-apps integrated.
 * Provides enhanced agent behaviors: RAG, multi-agent, tool-use, memory, multimodal.
 */
import { loadConfig } from './storage'
import { hasImageModel } from './multimodal'

export type AgentCapability =
  | 'chat'           // basic conversation
  | 'tool-use'       // file/shell/web tools
  | 'rag'            // retrieval-augmented generation
  | 'multi-agent'    // sub-agent delegation
  | 'memory'         // persistent memory across sessions
  | 'multimodal'     // image generation
  | 'code'           // code generation and execution
  | 'web'            // web search and fetch
  | 'planning'       // plan mode with structured execution

export interface AgentProfile {
  capabilities: AgentCapability[]
  suggestedModel?: string
  systemPromptAddons: string[]
}

export function buildAgentProfile(): AgentProfile {
  const cfg = loadConfig()
  const caps: AgentCapability[] = ['chat', 'tool-use', 'planning', 'web']

  if (hasImageModel()) caps.push('multimodal')
  if (cfg.helperModel) caps.push('multi-agent')

  const addons: string[] = []

  if (hasImageModel()) {
    addons.push(`\n## 多模态能力\n你可以调用 ImageGenerate 生成图片：\n- 默认使用 MiniToken 生图端点和 gpt-image-2-all，除非用户或设置指定其他图像模型。\n- 当用户要求画图、生成图片、设计海报/头像/插画/logo/壁纸时，必须先调用 AskUserQuestion 请求确认。\n- 确认问题应展示你将用于生图的简短 prompt、尺寸、张数，并提供“同意生成”和“取消”两个选项。\n- 只有用户选择同意后，才能调用 ImageGenerate，并且必须传 confirmed=true。\n- 用户给出的描述很短时，可以在确认前扩写成具体视觉 prompt，但不要在未确认前生成。\n- 用户是在询问“如何生图/生图原理/能否生图”时，先文字回答，不要误触发生成。`)
  }

  addons.push(`\n## 模型选择提示\n当前对话模型: ${cfg.model}\n如果用户的任务需要更强的模型（如复杂推理用 o4-mini/claude-opus-4-5，代码用 claude-sonnet-4-5/gpt-4.1），可以建议切换。\n如果需要的模型未配置，提示用户在设置中添加 API Key。`)

  return { capabilities: caps, systemPromptAddons: addons }
}

export function getCapabilityPrompt(): string {
  const profile = buildAgentProfile()
  return profile.systemPromptAddons.join('\n')
}

export function checkModelAvailability(_type: 'image'): { available: boolean; message: string } {
  const cfg = loadConfig()
  if (!cfg.apiKey) {
    return { available: false, message: '需要配置 API Key 才能使用图像生成。请在设置中添加 MiniToken 或其他 API 的 Key。' }
  }
  return { available: hasImageModel(), message: hasImageModel() ? '' : '图像模型未单独配置，将使用默认 API 端点。' }
}
