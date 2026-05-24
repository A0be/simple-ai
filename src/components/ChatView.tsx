import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatMessage, ConversationMeta, TodoItem, AgentTask, Attachment } from '@/types'
import { ApiError } from '@/lib/ai'
import { runAgent } from '@/lib/agentLoop'
import { buildRegistry } from '@/lib/tools'
import {
  generateId,
  isConfigReady,
  loadConfig,
  loadConversations,
  saveConversation
} from '@/lib/storage'
import { findCommand, isSlashCommand, SLASH_COMMANDS } from '@/lib/slash'
import { composeSystemPrompt } from '@/lib/prompts'
import MessageRender from './MessageRender'
import TodoPanel from './TodoPanel'
import PlanBanner from './PlanBanner'
import AskUserQuestionModal, { type AskQuestionRequest } from './AskUserQuestionModal'
import { isTauri } from '@/lib/tauri'
import { isElectron } from '@/lib/electron'
import { localBackendAvailable } from '@/lib/localBackend'
import { subscribeWorkspace, getWorkspace } from '@/lib/workspaceStore'
import { scheduler } from '@/lib/scheduler'

interface ChatViewProps {
  featureId: string
  featureTitle: string
  systemPrompt: string
  placeholder?: string
  presetSuggestions?: string[]
  conversationId?: string
  /**
   * 引导内容。可以是静态 ReactNode（作为提示文字渲染），
   * 也可以是一个函数：接收 ChatView 的 `send` 方法，
   * 返回一个交互式面板（如塔罗抽牌、八字表单），
   * 由它直接把整理好的提问提交给 AI。
   */
  introNode?: React.ReactNode | ((api: { send: (text: string) => void }) => React.ReactNode)
  /** if false, hide the slash bar and tools menu */
  enableTools?: boolean
  /** auto-send this message on mount (e.g. from Home quick chat) */
  initialMessage?: string
}

export default function ChatView({
  featureId,
  featureTitle,
  systemPrompt,
  placeholder = '输入消息，Enter 发送，Shift+Enter 换行，/ 唤起命令',
  presetSuggestions = [],
  conversationId,
  introNode,
  enableTools = true,
  initialMessage
}: ChatViewProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convId, setConvId] = useState<string>(conversationId ?? '')
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [planMode, setPlanMode] = useState(false)
  const [planDraft, setPlanDraft] = useState('')
  const [cwd, setCwd] = useState<string | undefined>(() => getWorkspace() ?? undefined)
  const [worktreeName, setWorktreeName] = useState<string | undefined>(undefined)
  const [cwdBeforeWorktree, setCwdBeforeWorktree] = useState<string | undefined>(undefined)
  const [askRequest, setAskRequest] = useState<AskQuestionRequest | null>(null)
  /** map tool_call_id → result text (already in messages but cached for live render) */
  const [toolResults, setToolResults] = useState<Record<string, { text: string; error?: boolean }>>({})
  /** which tool calls are currently running */
  const [runningCalls, setRunningCalls] = useState<Set<string>>(new Set())
  /** show slash menu */
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  /** pending file/image attachments */
  const [attachments, setAttachments] = useState<Attachment[]>([])
  /** retry state surfaced by streamChat (null when not retrying) */
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number; reason: string } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottomRef = useRef(true)

  const registry = useMemo(() => buildRegistry(), [])
  const tauri = isTauri()
  const electron = isElectron()
  const desktop = tauri || electron
  const hasLocal = localBackendAvailable()

  // Sync workspace store → cwd
  useEffect(() => subscribeWorkspace((ws) => {
    if (ws) setCwd(ws)
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to scheduler fire events — fired prompts become a system reminder
  useEffect(() => {
    return scheduler.subscribe((job) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `⏰ 计划提醒（id=${job.id}）：${job.prompt}${job.reason ? `\n（${job.reason}）` : ''}`,
          display: 'normal'
        }
      ])
    })
  }, [])

  // Load conversation if specified
  useEffect(() => {
    if (conversationId) {
      const conv = loadConversations().find((c) => c.id === conversationId)
      if (conv) {
        setMessages(conv.messages.filter((m) => m.role !== 'system' || !m.content.startsWith('[base]')))
        setConvId(conv.id)
        if (conv.todos) setTodos(conv.todos)
        if (conv.planMode) setPlanMode(conv.planMode)
      }
    } else {
      setMessages([])
      setConvId('')
      setTodos([])
      setPlanMode(false)
      setPlanDraft('')
    }
  }, [conversationId])

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }

  const onScrollContainer = () => {
    const el = scrollRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    if (!isNearBottomRef.current && !streaming) return
    scrollToBottom()
  }, [messages, streaming])

  // While streaming, keep scrolling to bottom at a steady interval so
  // late-loading images / tool blocks that resize the container don't leave
  // the user stuck mid-page.
  useEffect(() => {
    if (!streaming) return
    const id = setInterval(scrollToBottom, 200)
    return () => clearInterval(id)
  }, [streaming])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  // Show slash menu when user types "/"
  useEffect(() => {
    setShowSlashMenu(input.startsWith('/') && !input.includes('\n'))
  }, [input])

  const filteredSlash = useMemo(() => {
    if (!showSlashMenu) return []
    const q = input.slice(1).toLowerCase()
    return SLASH_COMMANDS.filter((c) => c.visible).filter((c) =>
      c.name.toLowerCase().startsWith(q)
    )
  }, [showSlashMenu, input])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    // Slash command?
    if (isSlashCommand(content)) {
      const match = findCommand(content)
      if (match) {
        const session = { todos, tasks, planMode, planDraft }
        const res = await match.cmd.run({
          raw: content,
          args: match.args,
          messages,
          registry,
          session,
          setMessages,
          setPlanMode: (v) => {
            setPlanMode(v)
          }
        })
        setInput('')
        if (res.kind === 'message') {
          setMessages((prev) => [
            ...prev,
            { role: 'user', content },
            { role: 'assistant', content: res.text }
          ])
        } else if (res.kind === 'action' && res.text) {
          const actionText = res.text
          setMessages((prev) => [
            ...prev,
            { role: 'user', content },
            { role: 'assistant', content: actionText }
          ])
        }
        return
      } else {
        setError(`未知 slash 命令: ${content.split(/\s/)[0]}`)
        setInput('')
        return
      }
    }

    if (!isConfigReady()) {
      setError('请先在「设置」页填写 API 地址和 Key')
      navigate('/settings')
      return
    }

    setInput('')
    setError(null)
    isNearBottomRef.current = true

    const pendingAttachments = attachments.length ? [...attachments] : undefined
    setAttachments([])

    // Push user message; agent loop will push assistant + tool messages
    const finalSystem = composeSystemPrompt(systemPrompt, loadConfig().projectContext)
    const userMsg: ChatMessage = { role: 'user', content, attachments: pendingAttachments }
    const baseHistory: ChatMessage[] = [
      { role: 'system', content: finalSystem },
      ...messages,
      userMsg
    ]
    setMessages([...messages, userMsg])

    const id = convId || generateId()
    if (!convId) setConvId(id)

    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    const session = {
      todos: [...todos],
      tasks: [...tasks],
      planMode,
      planDraft,
      cwd,
      worktreeName,
      cwdBeforeWorktree
    }

    const ui = {
      askUserQuestion: (req: {
        question: string
        options: { label: string; description?: string; preview?: string }[]
        multiSelect?: boolean
      }) =>
        new Promise<{ chosen: string[]; cancelled?: boolean; notes?: string }>((resolve) => {
          setAskRequest({
            question: req.question,
            options: req.options,
            multiSelect: req.multiSelect,
            resolve: (val) => {
              setAskRequest(null)
              resolve(val)
            }
          })
        }),
      notify: (msg: string) => setError(msg)
    }

    const log = [...baseHistory]
    setRetryInfo(null)
    try {
      await runAgent({
        config: loadConfig(),
        messages: log,
        registry,
        session,
        ui,
        signal: controller.signal,
        toolFilter: enableTools ? undefined : () => false,
        onRetry: (info) => setRetryInfo(info),
        onThinkingText: () => {
          setMessages(log.filter((m) => m !== baseHistory[0]).map(cloneMessage))
        },
        onText: () => {
          // mirror log into UI state (drop the leading system prompt)
          setMessages(log.filter((m) => m !== baseHistory[0]).map(cloneMessage))
        },
        onAssistantMessage: () => {
          setMessages(log.filter((m) => m !== baseHistory[0]).map(cloneMessage))
        },
        onToolStart: (tc) => {
          setRunningCalls((s) => new Set([...s, tc.id]))
        },
        onToolEnd: (tc, result) => {
          setRunningCalls((s) => {
            const n = new Set(s)
            n.delete(tc.id)
            return n
          })
          setToolResults((r) => ({
            ...r,
            [tc.id]: { text: result.content, error: result.isError }
          }))
          // sync session-driven UI state
          setTodos([...session.todos])
          setTasks([...session.tasks])
          setPlanMode(session.planMode)
          setPlanDraft(session.planDraft)
          setCwd(session.cwd)
          setWorktreeName(session.worktreeName)
          setCwdBeforeWorktree(session.cwdBeforeWorktree)
          setMessages(log.filter((m) => m !== baseHistory[0]).map(cloneMessage))
        }
      })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      if (msg !== 'The operation was aborted.' && !msg.includes('aborted')) {
        setError(msg)
      }
    } finally {
      setStreaming(false)
      setRetryInfo(null)
      abortRef.current = null
      // Persist
      const meta: ConversationMeta = {
        id,
        title: content.slice(0, 30) || featureTitle,
        feature: featureId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [{ role: 'system', content: systemPrompt }, ...log.filter((m) => m !== baseHistory[0])],
        todos: session.todos,
        planMode: session.planMode
      }
      saveConversation(meta)
    }
  }

  // Auto-send initial message from navigation state (e.g. Home quick chat)
  const initialSentRef = useRef(false)
  useEffect(() => {
    if (initialMessage && !initialSentRef.current && !conversationId) {
      initialSentRef.current = true
      send(initialMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => abortRef.current?.abort()

  const reset = () => {
    if (streaming) stop()
    setMessages([])
    setConvId('')
    setTodos([])
    setTasks([])
    setPlanMode(false)
    setPlanDraft('')
    setToolResults({})
    setRunningCalls(new Set())
    setAttachments([])
    setError(null)
    navigate(`/${featureId}`)
  }

  const readFileAsAttachment = (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      if (file.type.startsWith('image/')) {
        reader.onload = () => resolve({
          type: 'image',
          name: file.name,
          data: reader.result as string,
          mimeType: file.type,
        })
        reader.onerror = reject
        reader.readAsDataURL(file)
      } else {
        reader.onload = () => resolve({
          type: 'file',
          name: file.name,
          data: reader.result as string,
          mimeType: file.type || 'text/plain',
        })
        reader.onerror = reject
        reader.readAsText(file)
      }
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const items: Attachment[] = []
    for (const f of Array.from(files)) {
      try {
        items.push(await readFileAsAttachment(f))
      } catch {
        setError(`无法读取文件: ${f.name}`)
      }
    }
    setAttachments(prev => [...prev, ...items])
    e.target.value = ''
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        try {
          const att = await readFileAsAttachment(file)
          setAttachments(prev => [...prev, att])
        } catch { /* ignore */ }
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <AskUserQuestionModal request={askRequest} />
      <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
        <div className="text-xs text-ink-500 flex items-center gap-2 min-w-0">
          <span>{messages.length} 条消息</span>
          {desktop && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
              桌面版 · 文件/命令可用
            </span>
          )}
          {!desktop && enableTools && hasLocal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
              已连接本机 · 文件/命令可用
            </span>
          )}
          {!desktop && enableTools && !hasLocal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
              Web 模式：连接本机助手以启用文件/Bash 工具
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPlanMode(!planMode)}
            className={`text-xs px-2.5 py-1 rounded-md ${
              planMode
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            {planMode ? '📋 计划模式' : '🔧 执行模式'}
          </button>
          <button onClick={reset} className="btn-ghost text-sm py-1.5 px-3">
            新对话
          </button>
        </div>
      </div>

      <PlanBanner active={planMode} draft={planDraft} onToggle={() => setPlanMode(!planMode)} />

      <div ref={scrollRef} onScroll={onScrollContainer} className="flex-1 overflow-y-auto card p-4 sm:p-5 space-y-3">
        {messages.length === 0 && (
          <div>
            {typeof introNode === 'function' ? introNode({ send }) : introNode}
            {presetSuggestions.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-ink-500 mb-2">试试问问：</div>
                <div className="flex flex-wrap gap-2">
                  {presetSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {enableTools && (
              <div className="mt-4 text-xs text-ink-500">
                💡 在输入框开头输入 <code className="bg-ink-100 px-1 rounded">/</code> 唤起命令；模型会自动调用工具
              </div>
            )}
          </div>
        )}

        {todos.length > 0 && <TodoPanel todos={todos} />}

        {messages.map((m, i) => (
          <MessageRender
            key={i}
            message={m}
            streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
            toolResults={toolResults}
            runningCalls={runningCalls}
            retryInfo={streaming && i === messages.length - 1 && m.role === 'assistant' ? retryInfo : null}
          />
        ))}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            ⚠️ {error}
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 shrink-0 relative border-t border-ink-200">
        {showSlashMenu && filteredSlash.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 card p-1.5 max-h-72 overflow-y-auto shadow-lg z-10">
            {filteredSlash.map((cmd) => (
              <button
                key={cmd.name}
                onClick={() => {
                  setInput(`/${cmd.name}${cmd.args ? ` ` : ''}`)
                  setShowSlashMenu(false)
                  textareaRef.current?.focus()
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-100 flex items-center gap-2"
              >
                <code className="text-xs font-semibold text-ink-700 shrink-0">
                  /{cmd.name}
                </code>
                {cmd.args && <code className="text-xs text-ink-400">{cmd.args}</code>}
                <span className="text-xs text-ink-500 truncate">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        <div className="card p-2 shadow-md ring-1 ring-ink-100">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pb-2 border-b border-ink-100 mb-2">
              {attachments.map((att, i) => {
                // base64 data URLs: data:image/png;base64,XXXX — XXXX length × 3/4 ≈ bytes
                const approxBytes = att.type === 'image' && att.data.startsWith('data:')
                  ? Math.floor((att.data.length - att.data.indexOf(',') - 1) * 0.75)
                  : att.data.length
                const tooLarge = att.type === 'image' && approxBytes > 1024 * 1024
                return (
                  <div key={i} className="relative group">
                    {att.type === 'image' ? (
                      <img src={att.data} alt={att.name} className={`h-16 w-16 object-cover rounded-lg border ${tooLarge ? 'border-amber-400 ring-1 ring-amber-300' : 'border-ink-200'}`} />
                    ) : (
                      <div className="h-16 px-3 flex items-center rounded-lg border border-ink-200 bg-ink-50 text-xs text-ink-600 max-w-[140px] truncate">
                        {att.name}
                      </div>
                    )}
                    {tooLarge && (
                      <div className="absolute -top-1 -left-1 bg-amber-500 text-white text-[9px] px-1 rounded shadow" title={`图像 ≈ ${(approxBytes / 1024 / 1024).toFixed(1)}MB，可能超出模型 token 限额`}>
                        ⚠️ 大
                      </div>
                    )}
                    <button
                    onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-700 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
                )
              })}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css,.xml,.yaml,.yml,.toml,.log,.sh,.bat"
              multiple
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors"
              title="添加文件或图片"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                } else if (e.key === 'Escape') {
                  setShowSlashMenu(false)
                }
              }}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none px-3 py-2 bg-transparent focus:outline-none text-sm placeholder-ink-400"
              style={{ maxHeight: '200px' }}
            />
            {streaming ? (
              <button onClick={stop} className="btn-secondary !py-2 !px-3">
                停止
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim() && !attachments.length}
                className="btn-primary !py-2 !px-4"
              >
                发送
              </button>
            )}
          </div>
        </div>
        <div className="text-[11px] text-ink-400 mt-1.5 text-center">
          AI 回复仅供参考，请理性判断。/help 查看命令。
        </div>
      </div>
    </div>
  )
}

function cloneMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    tool_calls: m.tool_calls ? m.tool_calls.map((tc) => ({ ...tc })) : undefined
  }
}

