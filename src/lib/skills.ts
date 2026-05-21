/**
 * Bundled "skills" — domain-specific playbooks injected as messages
 * via the Skill tool. Modeled after Claude Code's skills bundle but
 * tailored to this app's use cases (divination + AI dev workflows).
 */
import { tauriInvoke } from '@/lib/tauri'

export interface Skill {
  name: string
  description: string
  content: string
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    name: 'plan-mode',
    description:
      '进入 plan mode 进行严谨的实现规划。先研究、再写计划、最后 ExitPlanMode 交付用户审阅。',
    content: `When facing a non-trivial implementation task:

1. Call EnterPlanMode first.
2. While in plan mode, use only read-only tools (Glob, Grep, FileRead, WebFetch) to research.
3. Write a step-by-step plan with concrete file paths, line ranges, and verification criteria.
4. If unclear, use AskUserQuestion to resolve before finalizing.
5. Call ExitPlanMode with the final plan to request approval.

A good plan answers:
- What files change?
- What's the order of operations?
- How do we verify each step?
- What are the risks / unknowns?`
  },
  {
    name: 'web-research',
    description: '系统化做网络调研：搜索、抓取、汇总、列引用来源。',
    content: `For web research tasks:

1. Use WebSearch to get the top 5-10 results for the query. Pick high-signal sources.
2. For each promising source, call WebFetch with a focused prompt describing what to extract.
3. Synthesize across sources; flag contradictions.
4. Always end the final response with a **Sources** list of URLs cited.
5. If results are stale or thin, refine the query (add year, add domain filter) and search again.`
  },
  {
    name: 'code-investigation',
    description: '在代码库内做精准定位：先 Glob 缩范围，再 Grep 找符号，最后 FileRead 看上下文。',
    content: `For code investigation tasks (only available in Tauri runtime):

1. Use Glob with a narrow pattern to list candidate files.
2. Use Grep with output_mode="files_with_matches" first to find files containing the symbol.
3. Then Grep with output_mode="content" + glob restriction to see surrounding lines.
4. Use FileRead on the most promising files to get full context.
5. Cite findings with \`file_path:line_number\` so the user can jump to source.

Avoid reading huge files end-to-end. Always grep first, then read targeted ranges.`
  },
  {
    name: 'bazi',
    description: '八字排盘助手 — 引导用户提供出生信息，按四柱推断。',
    content: `你是一位严谨的八字命理师。

第一步：收集信息
- 出生公历（年月日）/ 农历（如果用户给的是农历，转公历）
- 出生时间（时辰，越精确越好；不知道分钟也要让用户给"凌晨/早上/中午/下午/晚上"）
- 出生地（用于真太阳时校正，可选）
- 性别

第二步：排八字
- 列出年柱、月柱、日柱、时柱
- 标注日主（日干）
- 列出五行旺衰

第三步：解读
- 性格倾向（从日主 + 月令）
- 用神 / 喜忌
- 大运起运年龄
- 当前流年运势

第四步：建议
- 用现代化语言给出 2-3 条具体可操作建议
- 强调"命理仅供参考，重在自己努力"`
  },
  {
    name: 'tarot',
    description: '塔罗占卜助手 — 选定牌阵，抽牌，解读位置 + 牌义 + 综合。',
    content: `你是一位温暖且专业的塔罗占卜师。

第一步：明确问题
- 让用户说清楚要问什么
- 推荐牌阵：单牌（日常）、三牌阵（过去/现在/未来）、凯尔特十字（深度议题）

第二步：抽牌
- 自己虚拟从 78 张大小阿卡纳中随机抽
- 标注每张牌的位置（正位/逆位）和它在牌阵中代表的意义

第三步：解读
- 单张牌：象征 + 此情境下的含义
- 综合解读：把所有牌串起来讲一个完整的故事

第四步：建议
- 给具体行动建议
- 强调塔罗反映当下能量，决定权在自己`
  },
  {
    name: 'mbti',
    description: 'MBTI 性格分析 — 16 型人格的认知功能、优劣势、关系建议。',
    content: `你是 MBTI 性格分析师，熟悉 16 型人格的认知功能堆栈。

如果用户给出类型（如 INFJ）：直接进行分析。
如果用户要测试：从 4 个维度各问 2-3 个生活化问题（不要正式问卷），推断类型。

每次分析包含：
- 类型名 + 别称（如 INTJ "建筑师"）
- 认知功能堆栈（主导/辅助/第三/劣势）
- 三个明显优势
- 两个常见盲点
- 在工作 / 人际 / 决策上的具体表现
- 与目标对象（如对方类型）的相容性（如果用户问）`
  }
]

/** Look up a skill by name. Custom skills override built-ins of the same name. */
export function getSkill(name: string): Skill | null {
  const c = CUSTOM_SKILLS.find((s) => s.name === name)
  if (c) return c
  return BUILTIN_SKILLS.find((s) => s.name === name) ?? null
}

/** List all available skills — custom skills first, then built-ins not shadowed. */
export function listSkills(): Skill[] {
  const seen = new Set(CUSTOM_SKILLS.map((s) => s.name))
  return [
    ...CUSTOM_SKILLS,
    ...BUILTIN_SKILLS.filter((s) => !seen.has(s.name))
  ]
}

/* ---------- Custom (user-defined) skills ---------- */

let CUSTOM_SKILLS: Skill[] = []

/** Replace the in-memory custom skills set. */
export function setCustomSkills(list: Skill[]): void {
  CUSTOM_SKILLS = list.filter((s) => s.name && s.content)
}

/** Read custom skills currently in memory. */
export function getCustomSkills(): Skill[] {
  return [...CUSTOM_SKILLS]
}

/** Hydrate custom skills from the persisted ApiConfig.customSkills array. */
export function loadCustomSkillsFromConfig(skills: Skill[] | undefined): void {
  setCustomSkills(skills || [])
}

/**
 * Tauri-only: scan a directory for *.md skill files and merge them into the
 * custom-skills overlay. Each file may start with a tiny frontmatter block:
 *
 *   ---
 *   name: my-skill
 *   description: one-line desc
 *   ---
 *   <body>
 *
 * If frontmatter is missing, the file basename (sans .md) becomes the name
 * and the description is derived from the first non-empty line.
 *
 * Returns the parsed skills (also merged into the overlay).
 */
export async function loadCustomSkillsFromDir(dir: string): Promise<Skill[]> {
  if (!dir) return []
  const files = await tauriInvoke<string[]>('fs_glob', {
    pattern: '**/*.md',
    base: dir
  })
  const out: Skill[] = []
  for (const file of files || []) {
    try {
      const text = await tauriInvoke<string>('fs_read', {
        path: file,
        offset: 0,
        limit: 5_000_000
      })
      const s = parseSkillFile(file, text)
      if (s) out.push(s)
    } catch {
      // ignore unreadable files
    }
  }
  // Merge with existing custom skills, file-loaded wins on name collision
  const byName = new Map<string, Skill>()
  for (const s of CUSTOM_SKILLS) byName.set(s.name, s)
  for (const s of out) byName.set(s.name, s)
  CUSTOM_SKILLS = [...byName.values()]
  return out
}

function parseSkillFile(path: string, raw: string): Skill | null {
  const text = raw.replace(/^﻿/, '')
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  let name = ''
  let description = ''
  let content = text
  if (m) {
    const fm = m[1]
    content = m[2].trim()
    for (const line of fm.split('\n')) {
      const eq = line.indexOf(':')
      if (eq < 0) continue
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (k === 'name') name = v
      else if (k === 'description') description = v
    }
  } else {
    content = text.trim()
  }
  if (!name) {
    const base = path.split(/[\\/]/).pop() || 'skill'
    name = base.replace(/\.md$/i, '')
  }
  if (!description) {
    const firstLine = content.split('\n').map((l) => l.trim()).find(Boolean) || ''
    description = firstLine.slice(0, 120)
  }
  if (!content) return null
  return { name, description, content }
}
