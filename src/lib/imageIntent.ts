export interface ImageGenerationIntent {
  prompt: string
  size?: string
  n?: number
}

const IMAGE_NOUN_RE = /(图片|图像|插画|海报|头像|壁纸|封面|logo|图标|表情包|照片|摄影|场景图|概念图|character|image|picture|poster|avatar|wallpaper|cover|logo|icon|illustration|photo)/i
const IMAGE_VERB_RE = /(生成|画|绘制|做|制作|设计|出一张|来一张|create|generate|draw|make|design)/i
const STRONG_DRAW_RE = /(画一|画张|画个|画幅|绘制|生成一张|来一张|出一张|draw\s+(me\s+)?(an?\s+)?|generate\s+(an?\s+)?image)/i
const HELP_QUESTION_RE = /(怎么|如何|为什么|原理|教程|指南|介绍|解释|能不能|可以吗|how to|what is|why)/i
const DEFER_RE = /(先问|先确认|先别|不要生成|别生成|暂时不要|只给.*prompt|只写.*提示词|only.*prompt)/i

const SIZE_PATTERNS: Array<[RegExp, string]> = [
  [/(竖图|竖版|手机壁纸|portrait|vertical)/i, '1024x1536'],
  [/(横图|横版|宽屏|封面|banner|landscape|wide)/i, '1536x1024'],
  [/(方图|正方形|头像|logo|icon|square)/i, '1024x1024'],
]

function inferSize(text: string): string | undefined {
  const explicit = text.match(/\b(1024x1024|1024x1536|1536x1024|auto)\b/i)
  if (explicit) return explicit[1].toLowerCase()
  for (const [re, size] of SIZE_PATTERNS) {
    if (re.test(text)) return size
  }
  return undefined
}

function inferCount(text: string): number | undefined {
  const arabic = text.match(/(?:生成|画|绘制|做|制作|create|generate|draw|make)?\s*([1-4])\s*(?:张|幅|个|images?|pictures?)/i)
  if (arabic) return Number(arabic[1])
  if (/[两二]\s*(张|幅|个)/.test(text)) return 2
  if (/三\s*(张|幅|个)/.test(text)) return 3
  if (/四\s*(张|幅|个)/.test(text)) return 4
  return undefined
}

export function detectImageGenerationIntent(text: string): ImageGenerationIntent | null {
  const prompt = text.trim()
  if (!prompt) return null
  if (DEFER_RE.test(prompt)) return null

  const hasImageNoun = IMAGE_NOUN_RE.test(prompt)
  const hasImageVerb = IMAGE_VERB_RE.test(prompt)
  const directDraw = /^(画|绘制|生成|做|制作|设计|create|generate|draw|make|design)(\s|一|张|个|幅|$)/i.test(prompt)

  const strongDraw = STRONG_DRAW_RE.test(prompt)

  if (!(hasImageNoun && hasImageVerb) && !directDraw && !strongDraw) return null
  if (HELP_QUESTION_RE.test(prompt) && !/(给我|帮我|直接|现在|来一张|出一张)/.test(prompt)) return null

  return {
    prompt,
    size: inferSize(prompt),
    n: inferCount(prompt),
  }
}
