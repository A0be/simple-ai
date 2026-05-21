import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconDownload, IconPlug, IconCode, IconGlobe } from '@/components/Icons'
import { upsertMcpServer, loadMcpServers } from '@/lib/storage'
import { loadConfig, saveConfig } from '@/lib/storage'
import { generateId } from '@/lib/storage'
import { setCustomSkills } from '@/lib/skills'

interface MarketItem {
  id: string
  name: string
  nameZh: string
  desc: string
  descZh?: string
  type: 'mcp' | 'skill'
  source: 'global' | 'cn'
  origin?: string
  config?: { transport: 'http' | 'stdio'; url?: string; command?: string; args?: string[] }
  skillContent?: string
  installCmd?: string
  url?: string
}

// ── Built-in catalog ──
const BUILTIN_ITEMS: MarketItem[] = [
  // MCP servers
  { id: 'mcp-filesystem', name: 'Filesystem', nameZh: '文件系统', desc: 'Read and write local files', descZh: '读写本地文件', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] } },
  { id: 'mcp-brave-search', name: 'Brave Search', nameZh: 'Brave 搜索', desc: 'Web search via Brave API', descZh: '通过 Brave API 搜索', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] } },
  { id: 'mcp-github', name: 'GitHub', nameZh: 'GitHub', desc: 'Repos, issues, PRs', descZh: '仓库、Issue、PR 交互', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] } },
  { id: 'mcp-memory', name: 'Memory', nameZh: '知识图谱', desc: 'Persistent knowledge graph', descZh: '持久化知识图谱记忆', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } },
  { id: 'mcp-puppeteer', name: 'Puppeteer', nameZh: '浏览器自动化', desc: 'Browser automation', descZh: '浏览器自动化与抓取', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] } },
  { id: 'mcp-sqlite', name: 'SQLite', nameZh: 'SQLite', desc: 'Query SQLite databases', descZh: '查询 SQLite 数据库', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'] } },
  { id: 'mcp-fetch', name: 'Fetch', nameZh: '网页抓取', desc: 'Fetch web pages to markdown', descZh: '抓取网页转 Markdown', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] } },
  { id: 'mcp-sequential', name: 'Sequential Thinking', nameZh: '顺序推理', desc: 'Step-by-step reasoning', descZh: '逐步推理思考链', type: 'mcp', source: 'global', origin: 'MCP Official', config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] } },
  { id: 'mcp-skillsmp', name: 'SkillsMP', nameZh: 'SkillsMP 技能搜索', desc: 'Search 1.2M agent skills', descZh: '搜索 120 万+ Agent 技能', type: 'mcp', source: 'global', origin: 'SkillsMP', config: { transport: 'stdio', command: 'npx', args: ['-y', 'skillsmp-mcp-server'] } },
  // Skills — from html-anything
  { id: 'skill-html-anything', name: 'html-anything', nameZh: 'HTML 万物生成', desc: 'Turn anything into beautiful interactive HTML pages', descZh: '将任何内容转化为精美交互式 HTML 页面 — 支持杂志/海报/卡片/数据报告/原型等 9 种版面，75 个内置技能', type: 'skill', source: 'global', origin: 'nexu-io/html-anything', url: 'https://github.com/nexu-io/html-anything', installCmd: 'npx skills add nexu-io/html-anything', skillContent: `# HTML Anything — 万物皆可 HTML\n\n你是一个 HTML 页面生成专家。当用户需要生成可视化内容时，输出单文件 HTML 而非 Markdown。\n\n## 能力\n- 将文件、数据、文本、图片转化为精美的单页 HTML\n- 支持 9 种版面：杂志(magazine)、演示文稿(deck)、海报(poster)、小红书/推文(xhs/tweet)、原型(prototype)、数据报告(data-report)、超链接框架(hyperframes)\n- 自动选择最适合内容的排版风格\n- 所有样式内联，无外部依赖\n- 响应式设计，支持暗色模式\n\n## 使用场景\n- "帮我把这些数据做成一个报告页面"\n- "把这段文字做成小红书风格的卡片"\n- "生成一个产品介绍的海报"\n- 用户不需要提到 HTML — 当内容适合可视化呈现时，主动使用此技能\n\n## 输出要求\n1. 完整的单文件 HTML（含内联 CSS）\n2. 中文内容默认使用思源黑体/系统字体\n3. 配色和谐，排版专业\n4. 使用 FileWrite 工具保存为 .html 文件` },
  // Skills — built-in useful
  { id: 'skill-code-review', name: 'Code Review', nameZh: '代码审查', desc: 'Systematic code review', descZh: '系统化代码审查清单', type: 'skill', source: 'global', origin: 'Built-in', skillContent: `# Code Review\n\n审查代码时按以下清单：\n1. 安全漏洞（注入、XSS、认证）\n2. 错误处理和边界情况\n3. 性能影响\n4. 命名规范和可读性\n5. 测试覆盖\n6. API 契约合规\n\n输出格式：\n- **Critical**: 必须修复\n- **Warning**: 应该修复\n- **Suggestion**: 建议优化\n- **Praise**: 值得肯定` },
  { id: 'skill-xiaohongshu', name: 'Xiaohongshu Writer', nameZh: '小红书写手', desc: 'Write Xiaohongshu posts', descZh: '撰写小红书风格笔记', type: 'skill', source: 'cn', origin: 'Built-in', skillContent: `# 小红书写手\n\n写作风格：\n- 标题：数字+痛点，15字内，含emoji\n- 开头：直击痛点或制造共鸣\n- 正文：分段短句，emoji标记重点\n- 标签：5-10个精准话题标签\n- 封面建议：配图方向描述` },
  { id: 'skill-seo', name: 'SEO', nameZh: 'SEO 优化', desc: 'SEO analysis', descZh: 'SEO 分析与优化建议', type: 'skill', source: 'global', origin: 'Built-in', skillContent: `# SEO 优化\n\n分析：\n1. 标题标签（60字符，含关键词）\n2. Meta Description（160字符）\n3. H1-H6 层级\n4. 关键词密度 1-3%\n5. 内链/外链\n6. 图片 ALT\n7. 加载速度\n8. 移动适配\n9. Schema.org\n10. Core Web Vitals` },
  { id: 'skill-api-design', name: 'API Design', nameZh: 'API 设计', desc: 'RESTful API best practices', descZh: 'RESTful API 设计规范', type: 'skill', source: 'global', origin: 'Built-in', skillContent: `# API Design\n\n设计 RESTful API：\n1. 资源命名：复数名词 /users\n2. HTTP 方法：GET/POST/PUT/PATCH/DELETE\n3. 状态码：200/201/400/401/403/404/500\n4. 分页：cursor 或 offset\n5. 过滤：query params\n6. 版本：/v1/\n7. 错误格式：{ error: { code, message } }\n8. 认证：Bearer token\n9. 限速 headers\n10. OpenAPI 文档` },
  { id: 'skill-translate-pro', name: 'Pro Translator', nameZh: '专业翻译', desc: 'Context-aware translation', descZh: '高质量上下文感知翻译', type: 'skill', source: 'cn', origin: 'Built-in', skillContent: `# 专业翻译\n\n原则：信达雅\n1. 保留专业术语不译\n2. 根据上下文选最恰当译法\n3. 长句拆分符合目标语言习惯\n4. 文化差异适配\n\n输出：\n- 译文\n- 📝 译注（难点说明）` },
]

// ── Online sources ──
const ONLINE_SOURCES = [
  { id: 'skills-sh', name: 'Skills.sh', nameZh: 'Skills.sh 官方目录', url: 'https://skills.sh', desc: 'Vercel 官方技能目录，87,000+ 技能', source: 'global' as const },
  { id: 'skillsmp', name: 'SkillsMP', nameZh: 'SkillsMP 市场', url: 'https://skillsmp.com', desc: '120万+ Agent 技能，支持语义搜索', source: 'global' as const },
  { id: 'officialskills', name: 'Official Skills', nameZh: '官方技能目录', url: 'https://officialskills.sh', desc: 'Cloudflare/Anthropic/Stripe 等官方团队技能', source: 'global' as const },
  { id: 'awesome-prompts', name: 'Awesome Prompts', nameZh: 'Awesome 提示词库', url: 'https://github.com/f/awesome-chatgpt-prompts', desc: 'GitHub 热门提示词合集', source: 'global' as const },
  { id: 'html-anything', name: 'HTML Anything', nameZh: 'HTML 万物生成器', url: 'https://github.com/nexu-io/html-anything', desc: '75 Skills × 9 版面，AI 生成精美 HTML', source: 'global' as const },
  { id: 'lobehub', name: 'LobeHub Skills', nameZh: 'LobeHub 技能库', url: 'https://github.com/lobehub/lobe-chat-agents', desc: 'LobeChat 社区 Agent 角色与技能', source: 'cn' as const },
  { id: 'awesome-claude', name: 'Awesome Claude', nameZh: 'Claude 技能合集', url: 'https://github.com/anthropics/courses', desc: 'Anthropic 官方教程和技能模板', source: 'global' as const },
]

interface OnlineSkill {
  name: string
  description: string
  install_count?: number
  repo?: string
}

export default function Marketplace() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'mcp' | 'skill' | 'online'>('all')
  const [region, setRegion] = useState<'all' | 'global' | 'cn'>('all')
  const [search, setSearch] = useState('')
  const [installed, setInstalled] = useState<Set<string>>(getInstalled)
  const [onlineResults, setOnlineResults] = useState<OnlineSkill[]>([])
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)

  function getInstalled(): Set<string> {
    const ids = new Set<string>()
    loadMcpServers().forEach(m => ids.add(m.name))
    loadConfig().customSkills?.forEach(s => ids.add(s.name))
    return ids
  }

  const filtered = BUILTIN_ITEMS.filter(item => {
    if (tab === 'online') return false
    if (tab !== 'all' && item.type !== tab) return false
    if (region !== 'all' && item.source !== region) return false
    if (search) {
      const q = search.toLowerCase()
      return item.name.toLowerCase().includes(q) || item.nameZh.includes(q) || (item.descZh || item.desc).toLowerCase().includes(q)
    }
    return true
  })

  const searchOnline = useCallback(async () => {
    if (!search.trim()) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const resp = await fetch(`https://skillsmp.com/api/v1/skills/search?q=${encodeURIComponent(search)}&limit=20`)
      if (resp.ok) {
        const data = await resp.json()
        setOnlineResults(data.data || data.skills || [])
      } else {
        setOnlineError('在线搜索暂不可用')
      }
    } catch {
      setOnlineError('网络错误，请检查连接')
    } finally {
      setOnlineLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (tab === 'online' && search.trim()) {
      const t = setTimeout(searchOnline, 600)
      return () => clearTimeout(t)
    }
  }, [tab, search, searchOnline])

  const installMcp = (item: MarketItem) => {
    if (!item.config) return
    upsertMcpServer({ id: generateId(), name: item.nameZh || item.name, transport: item.config.transport, url: item.config.url, command: item.config.command, args: item.config.args, enabled: true })
    setInstalled(getInstalled())
  }

  const installSkill = (item: MarketItem) => {
    if (!item.skillContent) return
    const cfg = loadConfig()
    const skills = cfg.customSkills || []
    if (skills.some(s => s.name === (item.nameZh || item.name))) return
    skills.push({ name: item.nameZh || item.name, description: item.descZh || item.desc, content: item.skillContent, source: `marketplace:${item.id}` })
    cfg.customSkills = skills
    saveConfig(cfg)
    setCustomSkills(skills)
    setInstalled(getInstalled())
  }

  const installOnlineSkill = (skill: OnlineSkill) => {
    const cfg = loadConfig()
    const skills = cfg.customSkills || []
    if (skills.some(s => s.name === skill.name)) return
    skills.push({ name: skill.name, description: skill.description || '', content: `# ${skill.name}\n\n${skill.description || ''}`, source: `online:skillsmp` })
    cfg.customSkills = skills
    saveConfig(cfg)
    setCustomSkills(skills)
    setInstalled(getInstalled())
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm">← 返回</button>
          <h1 className="text-xl font-semibold text-ink-900">插件市场</h1>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => navigate('/mcp')} className="btn-ghost text-xs">MCP 管理</button>
          <button onClick={() => navigate('/skills')} className="btn-ghost text-xs">Skills 管理</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg overflow-hidden border border-ink-200">
          {([['all', '内置'], ['mcp', 'MCP'], ['skill', 'Skills'], ['online', '在线搜索']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`text-xs px-3 py-1.5 ${tab === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'online' && (
          <div className="flex rounded-lg overflow-hidden border border-ink-200">
            {([['all', '全部'], ['global', '国际'], ['cn', '国内']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setRegion(k)} className={`text-xs px-3 py-1.5 ${region === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <input
          className="input !text-xs !py-1.5 flex-1 min-w-[120px]"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'online' ? '搜索 SkillsMP 在线技能库…' : '搜索插件…'}
          onKeyDown={e => e.key === 'Enter' && tab === 'online' && searchOnline()}
        />
      </div>

      {/* Online sources */}
      {tab !== 'online' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {ONLINE_SOURCES.filter(s => region === 'all' || s.source === region).map(src => (
            <a key={src.id} href={src.url} target="_blank" rel="noreferrer" className="card card-hover p-3 text-left block">
              <div className="flex items-center gap-1.5 mb-0.5">
                <IconGlobe className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="font-medium text-ink-900 text-xs truncate">{src.nameZh}</span>
              </div>
              <div className="text-[11px] text-ink-500 line-clamp-2">{src.desc}</div>
            </a>
          ))}
        </div>
      )}

      {/* Built-in items */}
      {tab !== 'online' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => {
            const isInst = installed.has(item.nameZh || item.name)
            return (
              <div key={item.id} className="card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-ink-600 shrink-0">{item.type === 'mcp' ? <IconPlug /> : <IconCode />}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-ink-900 truncate">{item.nameZh}</div>
                      <div className="text-[10px] text-ink-400">{item.origin || item.name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.type === 'mcp' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {item.type === 'mcp' ? 'MCP' : 'Skill'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-ink-600">{item.descZh || item.desc}</div>
                <button
                  onClick={() => item.type === 'mcp' ? installMcp(item) : installSkill(item)}
                  disabled={isInst}
                  className={`w-full text-xs py-1.5 rounded-lg transition-colors ${isInst ? 'bg-ink-100 text-ink-400' : 'bg-ink-900 text-white hover:bg-ink-800'}`}
                >
                  {isInst ? '已安装' : <span className="flex items-center justify-center gap-1"><IconDownload className="w-3.5 h-3.5" /> 安装到本地</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Online search results */}
      {tab === 'online' && (
        <div>
          {onlineLoading && <div className="text-center text-ink-400 py-8 text-sm">搜索中…</div>}
          {onlineError && <div className="text-center text-red-500 py-4 text-sm">{onlineError}</div>}
          {!onlineLoading && onlineResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {onlineResults.map((skill, i) => (
                <div key={i} className="card p-3 space-y-2">
                  <div className="font-medium text-xs text-ink-900">{skill.name}</div>
                  <div className="text-[11px] text-ink-600 line-clamp-3">{skill.description}</div>
                  {skill.install_count && <div className="text-[10px] text-ink-400">{skill.install_count.toLocaleString()} 安装</div>}
                  <button
                    onClick={() => installOnlineSkill(skill)}
                    disabled={installed.has(skill.name)}
                    className={`w-full text-xs py-1.5 rounded-lg transition-colors ${installed.has(skill.name) ? 'bg-ink-100 text-ink-400' : 'bg-ink-900 text-white hover:bg-ink-800'}`}
                  >
                    {installed.has(skill.name) ? '已安装' : '安装'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!onlineLoading && !onlineResults.length && search.trim() && !onlineError && (
            <div className="text-center text-ink-400 py-8 text-sm">输入关键词后按回车搜索在线技能库</div>
          )}
          {!search.trim() && (
            <div className="text-center text-ink-400 py-8 text-sm">输入关键词搜索 SkillsMP 的 120 万+ 在线技能</div>
          )}
        </div>
      )}

      {tab !== 'online' && filtered.length === 0 && (
        <div className="text-center text-ink-400 py-12 text-sm">暂无匹配插件</div>
      )}
    </div>
  )
}
