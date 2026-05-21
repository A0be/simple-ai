import { useParams, Navigate, useNavigate, useLocation } from 'react-router-dom'
import ChatView from '@/components/ChatView'
import { getFeature } from '@/lib/features'
import { PROMPTS, type PromptKey } from '@/lib/prompts'
import BaziIntro from '@/components/divination/BaziIntro'
import ZiweiIntro from '@/components/divination/ZiweiIntro'
import TarotIntro from '@/components/divination/TarotIntro'
import LiuyaoIntro from '@/components/divination/LiuyaoIntro'
import DreamIntro from '@/components/divination/DreamIntro'
import MbtiIntro from '@/components/divination/MbtiIntro'

const SUGGESTIONS: Record<string, string[]> = {
  chat: [
    '你能做什么？',
    '帮我写一段周报',
    '用一句话解释什么是量子纠缠',
    '推荐 3 本入门 Python 的书'
  ],
  writing: [
    '帮我写一封请假邮件',
    '帮我写一段产品发布文案',
    '给这篇文章写一个开头：……',
    '把下面的口语整理成正式书面语'
  ],
  translate: [
    '把这段翻译成英文：今天天气真好',
    '把下面这段翻译成中文：……',
    '帮我润色这段英文邮件'
  ],
  developer: [
    '/help',
    '/tools',
    '/skills',
    '帮我研究一下 React 18 Suspense 在数据获取场景的最佳实践',
    '/plan',
    '用 WebSearch 找一下 Tauri 2 的最新发布日期'
  ]
}

type IntroFn = (api: { send: (text: string) => void }) => React.ReactNode
const INTERACTIVE_INTROS: Record<string, IntroFn> = {
  bazi: ({ send }) => <BaziIntro onSubmit={send} />,
  ziwei: ({ send }) => <ZiweiIntro onSubmit={send} />,
  tarot: ({ send }) => <TarotIntro onSubmit={send} />,
  liuyao: ({ send }) => <LiuyaoIntro onSubmit={send} />,
  dream: ({ send }) => <DreamIntro onSubmit={send} />,
  mbti: ({ send }) => <MbtiIntro onSubmit={send} />
}

const STATIC_INTROS: Record<string, React.ReactNode> = {
  developer: (
    <div className="text-sm text-ink-600 leading-relaxed space-y-1">
      <p>
        开发者模式 — 模型可以自动调用工具（WebFetch / WebSearch / TodoWrite / Plan mode / Agent ...）。
      </p>
      <p>
        桌面版或已连接本机时，额外提供{' '}
        <code className="bg-ink-100 px-1 rounded">FileRead</code> /
        <code className="bg-ink-100 px-1 rounded">FileWrite</code> /
        <code className="bg-ink-100 px-1 rounded">Bash</code> /
        <code className="bg-ink-100 px-1 rounded">Glob</code> /
        <code className="bg-ink-100 px-1 rounded">Grep</code> 本地文件和命令执行。
      </p>
      <p className="text-xs text-ink-400">输入框开头打 <code>/</code> 唤起 slash 命令。</p>
    </div>
  )
}

export default function Feature() {
  const { featureId, conversationId } = useParams<{
    featureId: string
    conversationId?: string
  }>()
  const navigate = useNavigate()
  const location = useLocation()
  const initialMessage = (location.state as { initialMessage?: string } | null)?.initialMessage

  if (!featureId) return <Navigate to="/" replace />
  const feature = getFeature(featureId)
  const prompt = PROMPTS[featureId as PromptKey]
  if (!feature || !prompt) return <Navigate to="/" replace />

  const intro = INTERACTIVE_INTROS[feature.id] ?? STATIC_INTROS[feature.id]

  return (
    <div className="pt-4">
      <div className="mb-3">
        <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-2">← 返回</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{feature.emoji}</span>
          <h1 className="text-lg font-semibold text-ink-900">{feature.title}</h1>
        </div>
        <div className="text-xs text-ink-500 mt-0.5">{feature.description}</div>
      </div>

      <ChatView
        featureId={feature.id}
        featureTitle={feature.title}
        systemPrompt={prompt}
        presetSuggestions={SUGGESTIONS[feature.id] ?? []}
        introNode={intro}
        conversationId={conversationId}
        initialMessage={initialMessage}
      />
    </div>
  )
}
