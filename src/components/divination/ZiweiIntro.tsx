import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
}

export default function ZiweiIntro({ onSubmit }: Props) {
  const [date, setDate] = useState('') // 农历
  const [shichen, setShichen] = useState('') // 子-亥 12 时辰
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [focusGong, setFocusGong] = useState<string[]>([])

  const SHICHEN = [
    '子（23-1时）', '丑（1-3时）', '寅（3-5时）', '卯（5-7时）',
    '辰（7-9时）', '巳（9-11时）', '午（11-13时）', '未（13-15时）',
    '申（15-17时）', '酉（17-19时）', '戌（19-21时）', '亥（21-23时）'
  ]

  const SHIER_GONG = [
    '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
    '迁移', '交友', '官禄', '田宅', '福德', '父母'
  ]

  const toggleGong = (g: string) => {
    setFocusGong((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
  }

  const ready = date && shichen && gender

  const submit = () => {
    if (!ready) return
    const lines: string[] = ['请帮我排紫微斗数命盘并解读。']
    lines.push(`【农历出生日期】${date}`)
    lines.push(`【时辰】${shichen}`)
    lines.push(`【性别】${gender === 'male' ? '男' : '女'}`)
    if (focusGong.length) {
      lines.push(`【重点关注的宫位】${focusGong.join('、')}`)
    }
    lines.push('')
    lines.push('请按以下结构输出：')
    lines.push('1. 命宫格局：主星 + 辅星 + 四化')
    lines.push('2. 十二宫摘要表（一句话点出主星 + 含义）')
    lines.push('3. 三方四正解读（命/财/官/迁）')
    lines.push('4. 当前大限的关键提示')
    onSubmit(lines.join('\n'))
  }

  return (
    <div className="card p-5 mb-3 bg-gradient-to-br from-violet-50 via-white to-sky-50">
      <div className="text-sm font-medium text-ink-900 mb-1">填写农历出生信息</div>
      <div className="text-xs text-ink-500 mb-3">
        紫微斗数主要以农历计算。如果你只有公历，可以先在搜索引擎查"农历转换"。
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">农历出生日期</label>
          <input
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="例如：1990 年 四月 初八"
          />
        </div>

        <div>
          <label className="label">出生时辰</label>
          <select
            className="input"
            value={shichen}
            onChange={(e) => setShichen(e.target.value)}
          >
            <option value="">选择时辰</option>
            {SHICHEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">性别</label>
          <div className="flex gap-2">
            <button
              onClick={() => setGender('male')}
              className={`btn flex-1 ${
                gender === 'male' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              男
            </button>
            <button
              onClick={() => setGender('female')}
              className={`btn flex-1 ${
                gender === 'female' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              女
            </button>
          </div>
        </div>

        <div>
          <label className="label">重点关注的宫位（选填，可多选）</label>
          <div className="flex flex-wrap gap-1.5">
            {SHIER_GONG.map((g) => (
              <button
                key={g}
                onClick={() => toggleGong(g)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  focusGong.includes(g)
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {g}
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
        ✨ 开始排紫微盘
      </button>
    </div>
  )
}
