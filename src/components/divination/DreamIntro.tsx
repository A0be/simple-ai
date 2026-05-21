import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
}

export default function DreamIntro({ onSubmit }: Props) {
  const [scene, setScene] = useState('')
  const [people, setPeople] = useState('')
  const [emotion, setEmotion] = useState<string[]>([])
  const [details, setDetails] = useState('')
  const [recurrence, setRecurrence] = useState<'first' | 'recurring' | 'long-ago'>('first')

  const EMOTIONS = ['安心', '愉快', '紧张', '害怕', '悲伤', '愤怒', '困惑', '羞愧', '兴奋', '麻木']

  const toggleEmotion = (e: string) => {
    setEmotion((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
  }

  const ready = scene || details

  const submit = () => {
    if (!ready) return
    const lines: string[] = ['请帮我分析这个梦。']
    if (scene) lines.push(`【场景】${scene}`)
    if (people) lines.push(`【出现的人/角色】${people}`)
    if (emotion.length) lines.push(`【梦中情绪】${emotion.join('、')}`)
    if (details) lines.push(`【印象最深的细节】${details}`)
    lines.push(
      `【频率】${
        recurrence === 'first' ? '第一次做' :
        recurrence === 'recurring' ? '反复做这个梦' :
        '是很久以前的梦'
      }`
    )
    lines.push('')
    lines.push('请按规范输出：')
    lines.push('1. 一句话概括梦的情绪基调')
    lines.push('2. 抽出 2-4 个核心意象，每个意象给「东方传统解梦」+「心理学视角」')
    lines.push('3. 综合分析当前心理状态 / 现实关联')
    lines.push('4. 1-3 条积极的建议')
    onSubmit(lines.join('\n'))
  }

  return (
    <div className="card p-5 mb-3 bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="text-sm font-medium text-ink-900 mb-3">描述你的梦境</div>

      <div className="space-y-3">
        <div>
          <label className="label">场景（梦发生在哪？）</label>
          <input
            className="input"
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="例如：一片陌生的森林"
          />
        </div>

        <div>
          <label className="label">人物（梦里出现谁？选填）</label>
          <input
            className="input"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="例如：已故的爷爷、模糊的陌生人"
          />
        </div>

        <div>
          <label className="label">梦中情绪（多选）</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((e) => (
              <button
                key={e}
                onClick={() => toggleEmotion(e)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  emotion.includes(e)
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">印象最深的细节</label>
          <textarea
            className="input min-h-[100px]"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="例如：我在飞，但飞得越来越低；脚下的人都在笑..."
          />
        </div>

        <div>
          <label className="label">频率</label>
          <div className="flex gap-2">
            {[
              { v: 'first' as const, label: '第一次' },
              { v: 'recurring' as const, label: '反复出现' },
              { v: 'long-ago' as const, label: '很久前的梦' }
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setRecurrence(o.v)}
                className={`btn flex-1 ${
                  recurrence === o.v
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-100 text-ink-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!ready}
        className="btn-primary w-full mt-4"
      >
        🌙 分析这个梦
      </button>
    </div>
  )
}
