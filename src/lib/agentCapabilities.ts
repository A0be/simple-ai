/**
 * Agent capabilities module — patterns from awesome-llm-apps integrated.
 * Provides enhanced agent behaviors: RAG, multi-agent, tool-use, memory, multimodal.
 */
import { loadConfig } from './storage'
import { hasImageModel, hasAudioModel, hasVideoModel } from './multimodal'
import { cliCapabilitiesPrompt } from './cliDetector'

export type AgentCapability =
  | 'chat'           // basic conversation
  | 'tool-use'       // file/shell/web tools
  | 'rag'            // retrieval-augmented generation
  | 'multi-agent'    // sub-agent delegation
  | 'memory'         // persistent memory across sessions
  | 'multimodal'     // image/audio/video generation
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

  // Multimodal capabilities
  if (hasImageModel() || hasAudioModel() || hasVideoModel()) {
    const parts: string[] = []
    if (hasImageModel()) parts.push('图像生成（gpt-image-1/dall-e-3/midjourney）')
    if (hasAudioModel()) parts.push('语音合成（TTS）和语音识别（Whisper）')
    if (hasVideoModel()) parts.push('视频生成（Veo/Sora/Kling）')
    addons.push(`\n## 多模态能力\n你可以调用以下生成能力：\n${parts.map(p => `- ${p}`).join('\n')}\n\n当用户要求生成图片/音频/视频时，先确认需求，然后告知用户将调用对应模型。用户确认后执行。`)
  }

  // CLI capabilities
  const cliInfo = cliCapabilitiesPrompt()
  if (cliInfo) addons.push(cliInfo)

  // Model suggestion based on task
  addons.push(`\n## 模型选择提示\n当前对话模型: ${cfg.model}\n如果用户的任务需要更强的模型（如复杂推理用 o4-mini/claude-opus-4-5，代码用 claude-sonnet-4-5/gpt-4.1），可以建议切换。\n如果需要的模型未配置，提示用户在设置中添加 API Key。`)

  return { capabilities: caps, systemPromptAddons: addons }
}

export function getCapabilityPrompt(): string {
  const profile = buildAgentProfile()
  return profile.systemPromptAddons.join('\n')
}

/** Check if a multimodal action is available and prompt user if not */
export function checkModelAvailability(type: 'image' | 'audio' | 'video'): { available: boolean; message: string } {
  const cfg = loadConfig()
  const hasKey = !!cfg.apiKey

  if (!hasKey) {
    return { available: false, message: `需要配置 API Key 才能使用${type === 'image' ? '图像' : type === 'audio' ? '音频' : '视频'}生成。请在设置中添加 MiniToken 或其他 API 的 Key。` }
  }

  switch (type) {
    case 'image': return { available: hasImageModel(), message: hasImageModel() ? '' : '图像模型未单独配置，将使用默认 API 端点。' }
    case 'audio': return { available: hasAudioModel(), message: hasAudioModel() ? '' : '音频模型未单独配置，将使用默认 API 端点。' }
    case 'video': return { available: hasVideoModel(), message: hasVideoModel() ? '' : '视频模型未单独配置，将使用默认 API 端点。' }
  }
}
