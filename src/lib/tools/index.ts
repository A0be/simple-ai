import { ToolRegistry } from './types'
import { TodoWriteTool } from './builtin/todoWrite'
import { AskUserQuestionTool } from './builtin/askUserQuestion'
import { WebFetchTool } from './builtin/webFetch'
import { WebSearchTool } from './builtin/webSearch'
import { EnterPlanModeTool, ExitPlanModeTool } from './builtin/planMode'
import {
  TaskCreateTool,
  TaskListTool,
  TaskGetTool,
  TaskUpdateTool,
  TaskOutputTool,
  TaskStopTool
} from './builtin/tasks'
import { SkillTool } from './builtin/skill'
import { AgentTool } from './builtin/agent'
import { SendMessageTool } from './builtin/sendMessage'
import {
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  GlobTool,
  GrepTool,
  BashTool
} from './builtin/tauriFs'
import { NotebookEditTool } from './builtin/notebookEdit'
import {
  CronCreateTool,
  CronListTool,
  CronDeleteTool,
  ScheduleWakeupTool
} from './builtin/schedule'
import { EnterWorktreeTool, ExitWorktreeTool } from './builtin/worktree'
import {
  LspStartTool,
  LspStopTool,
  LspDefinitionTool,
  LspReferencesTool,
  LspHoverTool,
  LspListTool
} from './builtin/lsp'
import { ImageGenerateTool } from './builtin/imageGen'
import { VideoGenerateTool } from './builtin/videoGen'
import { PowerShellTool } from './builtin/powerShell'
import { SleepTool } from './builtin/sleep'
import { ToolSearchTool } from './builtin/toolSearch'
import { activeMcpClients } from '@/lib/mcp/client'

/** Build a fresh registry with all built-in tools. */
export function buildRegistry(): ToolRegistry {
  const reg = new ToolRegistry()
  reg.registerMany([
    // core
    AskUserQuestionTool,
    SkillTool,
    ToolSearchTool,
    SleepTool,
    // plan
    EnterPlanModeTool,
    ExitPlanModeTool,
    // task
    TodoWriteTool,
    TaskCreateTool,
    TaskListTool,
    TaskGetTool,
    TaskUpdateTool,
    TaskOutputTool,
    TaskStopTool,
    // schedule
    CronCreateTool,
    CronListTool,
    CronDeleteTool,
    ScheduleWakeupTool,
    // web
    WebFetchTool,
    WebSearchTool,
    // agent
    AgentTool,
    SendMessageTool,
    // tauri-only fs/shell
    FileReadTool,
    FileWriteTool,
    FileEditTool,
    GlobTool,
    GrepTool,
    BashTool,
    PowerShellTool,
    NotebookEditTool,
    EnterWorktreeTool,
    ExitWorktreeTool,
    // lsp (tauri-only)
    LspStartTool,
    LspStopTool,
    LspDefinitionTool,
    LspReferencesTool,
    LspHoverTool,
    LspListTool,
    // multimodal
    ImageGenerateTool,
    VideoGenerateTool
  ])
  // Merge in dynamically-discovered MCP tools from any active clients.
  for (const mc of activeMcpClients()) {
    for (const td of mc.asToolDefs()) reg.register(td)
  }
  return reg
}

export type { ToolRegistry } from './types'
export { parseToolArgs } from './types'
