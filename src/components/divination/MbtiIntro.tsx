import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
}

const TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
]

const TYPE_NAMES: Record<string, string> = {
  INTJ: '建筑师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
  INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
  ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官',
  ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者'
}

export default function MbtiIntro({ onSubmit }: Props) {
  const [mode, setMode] = useState<'pick' | 'test'>('pick')
  const [type, setType] = useState('')
  const [topic, setTopic] = useState<'self' | 'career' | 'relationship' | 'growth'>('self')
  const [partnerType, setPartnerType] = useState('')

  const submitPick = () => {
    if (!type) return
    const lines: string[] = [`我的 MBTI 类型是 ${type}（${TYPE_NAMES[type]}）。`]
    const topicMap = {
      self: '请详细分析我的认知功能堆栈、健康型 vs 未发展型表现、成长路径。',
      career: '请重点分析我适合的职业方向与工作风格。',
      relationship: '请重点分析我的关系动力与亲密关系模式。',
      growth: '请重点分析我的盲点、第三/劣势功能、当前阶段成长课题。'
    } as const
    lines.push(topicMap[topic])
    if (topic === 'relationship' && partnerType) {
      lines.push(`对方的类型是 ${partnerType}，请重点分析我们的功能堆栈互动（镜像 / 互补 / 同侪 / 对偶）与磨合点。`)
    }
    lines.push('')
    lines.push('请按规范输出：类型与维度倾向 → 4 功能堆栈 → 行为模式 → 关系动力 → 职业适配 → 成长建议 → 科学边界声明。')
    onSubmit(lines.join('\n'))
  }

  const submitTest = () => {
    onSubmit('我不知道自己的 MBTI 类型，请逐题问我，每题给 4 个选项 A/B/C/D，问完 12 题后给出我的类型与完整分析。')
  }

  return (
    <div className="card p-5 mb-3 bg-gradient-to-br from-cyan-50 via-white to-purple-50">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('pick')}
          className={`btn flex-1 ${
            mode === 'pick' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
          }`}
        >
          我已经知道我的类型
        </button>
        <button
          onClick={() => setMode('test')}
          className={`btn flex-1 ${
            mode === 'test' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
          }`}
        >
          帮我测一下
        </button>
      </div>

      {mode === 'pick' && (
        <div className="space-y-4">
          <div>
            <label className="label">选择你的类型</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-center px-2 py-2 rounded-lg transition-colors ${
                    type === t
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                  }`}
                >
                  <div className="text-xs font-bold">{t}</div>
                  <div className="text-[9px] opacity-70 mt-0.5">{TYPE_NAMES[t]}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">想重点了解</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'self' as const, label: '自我画像' },
                { v: 'career' as const, label: '职业发展' },
                { v: 'relationship' as const, label: '关系/亲密' },
                { v: 'growth' as const, label: '盲点与成长' }
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setTopic(o.v)}
                  className={`btn ${
                    topic === o.v ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {topic === 'relationship' && (
            <div>
              <label className="label">对方的 MBTI 类型（选填）</label>
              <select
                className="input"
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value)}
              >
                <option value="">不指定</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t} {TYPE_NAMES[t]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={submitPick}
            disabled={!type}
            className="btn-primary w-full"
          >
            🧠 开始分析
          </button>
        </div>
      )}

      {mode === 'test' && (
        <div>
          <div className="text-sm text-ink-600 mb-3 leading-relaxed">
            点击下面按钮，AI 会逐题问你 12 道生活化场景题，帮你推断 MBTI 类型并完整分析。
          </div>
          <button onClick={submitTest} className="btn-primary w-full">
            ▶ 开始测试
          </button>
        </div>
      )}
    </div>
  )
}
