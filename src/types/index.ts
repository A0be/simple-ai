/** Per-capability model endpoint config */
export interface ModelEndpoint {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  /** sub-agent / cheap-task model; if empty falls back to model */
  helperModel?: string
  /** disable streaming tool_calls (some endpoints don't support it well) */
  disableStreaming?: boolean
  /** project / system context — typically the contents of a project's CLAUDE.md */
  projectContext?: string
  /** user-defined skills (override or extend BUILTIN_SKILLS) */
  customSkills?: CustomSkill[]
  /** Tauri-only: absolute path to a directory of *.md skill files to auto-load */
  skillsDir?: string
  /** image generation model (defaults to main if not set) */
  imageModel?: ModelEndpoint
}

/** A user-defined skill — same shape as BUILTIN_SKILLS entries but persisted in localStorage. */
export interface CustomSkill {
  name: string
  description: string
  content: string
  /** optional source tag, e.g. 'inline' or a file path */
  source?: string
}

/** OpenAI-style function tool call emitted by the model. */
export interface ToolCall {
  /** stable id assigned by the model, used to pair with the tool result */
  id: string
  /** function name as registered in the tool registry */
  name: string
  /** raw JSON-stringified arguments as emitted by the model */
  arguments: string
}

/** File or image attachment on a user message. */
export interface Attachment {
  type: 'image' | 'file'
  name: string
  /** base64 data URL for images; text content for files */
  data: string
  mimeType?: string
}

/** Single message in an OpenAI-compatible conversation. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  /** text content; may be empty when assistant only emits tool_calls */
  content: string
  /**
   * Chain-of-thought / reasoning content captured from `reasoning_content` /
   * `thinking` SSE deltas. Some thinking models (DeepSeek-R1 et al.) require
   * the value to be echoed back in the next turn's assistant message, so it
   * lives on the same message and is serialized as a top-level field by
   * toWireMessage.
   */
  reasoning_content?: string
  /** file/image attachments (user messages only) */
  attachments?: Attachment[]
  /** when role==='assistant', any tool_calls the model issued */
  tool_calls?: ToolCall[]
  /** when role==='tool', the id of the tool_call this message responds to */
  tool_call_id?: string
  /** when role==='tool', the registered name of the tool (for display) */
  name?: string
  /**
   * internal: how this message should be rendered.
   * 'normal' default; 'thinking' shows greyed thought trace (legacy — new code
   * uses reasoning_content on a normal assistant message instead).
   * 'plan' shows in plan-mode banner. set by client-side post-processing.
   */
  display?: 'normal' | 'thinking' | 'plan'
}

export interface ChatRequest {
  messages: ChatMessage[]
  model: string
  temperature?: number
  stream?: boolean
}

export interface ConversationMeta {
  id: string
  title: string
  feature: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  /** any persisted todos for the conversation */
  todos?: TodoItem[]
  /** whether plan mode was active when saved */
  planMode?: boolean
}

export interface FeatureCard {
  id: string
  title: string
  description: string
  path: string
  emoji: string
  category: 'chat' | 'divination' | 'tool' | 'system'
}

/** Todo item kept in conversation state via the TodoWrite tool. */
export interface TodoItem {
  id: string
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed'
}

/** A single sub-agent task tracked by the TaskCreate / Task* tool family. */
export interface AgentTask {
  id: string
  /** task name shown in lists */
  subject: string
  /** description briefing the sub-agent */
  description: string
  /** present-continuous form */
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  owner?: string
  blocks?: string[]
  blockedBy?: string[]
  /** sub-agent transcript / output, appended as it streams */
  output?: string
  /** error message if failed */
  error?: string
  createdAt: number
  updatedAt: number
}
