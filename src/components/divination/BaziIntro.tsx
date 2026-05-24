import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
}

export default function BaziIntro({ onSubmit }: Props) {
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar')
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('') // 0-23
  const [minute, setMinute] = useState('')
  const [unknownTime, setUnknownTime] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [place, setPlace] = useState('')
  const [focus, setFocus] = useState<string[]>([])

  const FOCI = ['性格', '事业', '财运', '感情', '健康', '今年流年', '大运']

  const toggleFocus = (f: string) => {
    setFocus((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    )
  }

  const ready = date && gender && (unknownTime || hour !== '')

  const submit = () => {
    if (!ready) return
    const lines: string[] = ['请帮我做八字命理分析。']
    lines.push(`【出生日期（${calendar === 'solar' ? '公历' : '农历'}）】${date}`)
    if (unknownTime) {
      lines.push('【出生时辰】不详（请按"日上起时"提示我推算的可能性）')
    } else {
      lines.push(
        `【出生时辰】${hour}:${(minute || '00').padStart(2, '0')}（24 小时制）`
      )
    }
    lines.push(`【性别】${gender === 'male' ? '男' : '女'}`)
    if (place) lines.push(`【出生地】${place}（用于真太阳时校正）`)
    if (focus.length) lines.push(`【重点关注】${focus.join('、')}`)
    lines.push('')
    lines.push('请按规范结构输出：四柱排盘 → 日主旺衰 → 性格天赋 → 重点议题 → 大运流年。')
    onSubmit(lines.join('\n'))
  }

  return (
    <div className="card p-5 mb-3 divination-panel bazi-panel">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">填写出生信息开始排盘</div>
          <div className="text-xs text-ink-500 mt-0.5">日期、时辰、性别会影响四柱与大运推算</div>
        </div>
        <div className="divination-orbit" aria-hidden="true"><span>甲</span><span>子</span><span>运</span></div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setCalendar('solar')}
            className={`btn flex-1 divination-toggle ${
              calendar === 'solar' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
            }`}
          >
            公历
          </button>
          <button
            onClick={() => setCalendar('lunar')}
            className={`btn flex-1 divination-toggle ${
              calendar === 'lunar' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
            }`}
          >
            农历
          </button>
        </div>

        <div>
          <label className="label">出生日期</label>
          {calendar === 'solar' ? (
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <input
              type="text"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="例如：1995 年 七月 初八"
            />
          )}
        </div>

        <div>
          <label className="label">出生时辰</label>
          {!unknownTime ? (
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
              >
                <option value="">时</option>
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i} 时
                  </option>
                ))}
              </select>
              <select
                className="input flex-1"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
              >
                <option value="">分</option>
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {m} 分
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm text-ink-500 px-1">⏰ 时辰不详，AI 会列出几种可能</div>
          )}
          <label className="flex items-center gap-2 mt-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={unknownTime}
              onChange={(e) => setUnknownTime(e.target.checked)}
            />
            不知道精确时辰
          </label>
        </div>

        <div>
          <label className="label">性别</label>
          <div className="flex gap-2">
            <button
              onClick={() => setGender('male')}
              className={`btn flex-1 divination-toggle ${
                gender === 'male' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              男
            </button>
            <button
              onClick={() => setGender('female')}
              className={`btn flex-1 divination-toggle ${
                gender === 'female' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              女
            </button>
          </div>
        </div>

        <div>
          <label className="label">出生地（选填，真太阳时校正）</label>
          <input
            className="input"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="例如：江苏南京"
          />
        </div>

        <div>
          <label className="label">想重点了解（多选，选填）</label>
          <div className="flex flex-wrap gap-1.5">
            {FOCI.map((f) => (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  focus.includes(f)
                    ? 'bg-ink-900 text-white shadow-sm -translate-y-0.5'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200 hover:-translate-y-0.5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {['日期', '时辰', '性别', '关注'].map((label, i) => {
          const done = [!!date, unknownTime || hour !== '', !!gender, focus.length > 0][i]
          return <div key={label} className={`divination-step ${done ? 'done' : ''}`}>{label}</div>
        })}
      </div>

      <button
        onClick={submit}
        disabled={!ready}
        className="btn-primary w-full mt-4"
      >
        🀄 开始排盘
      </button>
    </div>
  )
}
