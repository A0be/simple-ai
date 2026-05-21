import type { FeatureCard } from '@/types'

export const FEATURES: FeatureCard[] = [
  {
    id: 'chat',
    title: 'AI 对话',
    description: '通用 AI 对话助手，问什么都行',
    path: '/chat',
    emoji: '💬',
    category: 'chat'
  },
  {
    id: 'writing',
    title: '写作助手',
    description: '帮你写文章、邮件、文案、总结',
    path: '/writing',
    emoji: '✍️',
    category: 'tool'
  },
  {
    id: 'translate',
    title: '智能翻译',
    description: '多语言互译，理解上下文',
    path: '/translate',
    emoji: '🌐',
    category: 'tool'
  },
  {
    id: 'bazi',
    title: '八字排盘',
    description: '输入生辰即可获得八字分析',
    path: '/bazi',
    emoji: '🀄',
    category: 'divination'
  },
  {
    id: 'ziwei',
    title: '紫微斗数',
    description: '紫微命盘解读',
    path: '/ziwei',
    emoji: '✨',
    category: 'divination'
  },
  {
    id: 'tarot',
    title: '塔罗占卜',
    description: '抽牌问事，AI 解读牌意',
    path: '/tarot',
    emoji: '🔮',
    category: 'divination'
  },
  {
    id: 'liuyao',
    title: '六爻起卦',
    description: '硬币 / 数字起卦，AI 解卦',
    path: '/liuyao',
    emoji: '☯️',
    category: 'divination'
  },
  {
    id: 'dream',
    title: '周公解梦',
    description: '描述梦境，AI 帮你分析',
    path: '/dream',
    emoji: '🌙',
    category: 'divination'
  },
  {
    id: 'mbti',
    title: 'MBTI 性格',
    description: '回答几个问题获得性格分析',
    path: '/mbti',
    emoji: '🧠',
    category: 'divination'
  },
  {
    id: 'developer',
    title: '开发者助手',
    description: '类 Claude Code 的开发者模式：计划、工具、子代理',
    path: '/developer',
    emoji: '🛠',
    category: 'system'
  },
  {
    id: 'html-anything',
    title: 'HTML 万物生成',
    description: '75 个模板，AI 生成精美 HTML 页面、幻灯片、海报',
    path: '/html-anything',
    emoji: '🎨',
    category: 'system'
  }
]

export function getFeature(id: string): FeatureCard | undefined {
  return FEATURES.find((f) => f.id === id)
}
