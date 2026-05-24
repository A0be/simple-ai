import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
}

type Coin = 'yang' | 'yin' // 阳=数字面，阴=字面（约定：3 个正面=老阳⚊变⚋；3 个反面=老阴⚋变⚊；2正1反=少阴⚋；1正2反=少阳⚊）
type CoinThrow = [Coin, Coin, Coin]

interface Yao {
  type: 'old-yang' | 'old-yin' | 'young-yang' | 'young-yin'
  symbol: string
  desc: string
}

function classifyThrow(t: CoinThrow): Yao {
  const yangCount = t.filter((c) => c === 'yang').length
  if (yangCount === 3) return { type: 'old-yang', symbol: '⚊○', desc: '老阳（动）' }
  if (yangCount === 0) return { type: 'old-yin', symbol: '⚋×', desc: '老阴（动）' }
  if (yangCount === 2) return { type: 'young-yin', symbol: '⚋', desc: '少阴（静）' }
  return { type: 'young-yang', symbol: '⚊', desc: '少阳（静）' }
}

function randomThrow(): CoinThrow {
  return [Math.random() < 0.5 ? 'yang' : 'yin',
          Math.random() < 0.5 ? 'yang' : 'yin',
          Math.random() < 0.5 ? 'yang' : 'yin'] as CoinThrow
}

export default function LiuyaoIntro({ onSubmit }: Props) {
  const [question, setQuestion] = useState('')
  const [throws, setThrows] = useState<Yao[]>([]) // 从初爻到上爻
  const [throwing, setThrowing] = useState(false)

  const next = () => {
    if (throws.length >= 6) return
    setThrowing(true)
    setTimeout(() => {
      const y = classifyThrow(randomThrow())
      setThrows((prev) => [...prev, y])
      setThrowing(false)
    }, 600)
  }

  const reset = () => {
    setThrows([])
  }

  const submit = () => {
    if (throws.length !== 6) return
    const lines: string[] = ['我在心中默念问题摇出一卦，请帮我解卦。']
    if (question.trim()) lines.push(`【所问】${question.trim()}`)
    lines.push('【六爻（从初爻到上爻）】')
    throws.forEach((y, i) => {
      lines.push(`第${i + 1}爻：${y.symbol} ${y.desc}`)
    })
    lines.push('')
    lines.push('请按规范输出：')
    lines.push('1. 起卦记录：本卦 / 变卦 / 互卦 / 错卦 / 综卦')
    lines.push('2. 装卦：六亲、世应、纳甲（如能推断）')
    lines.push('3. 用神选取：根据所问之事确定')
    lines.push('4. 卦象详解 + 动爻分析')
    lines.push('5. 综合断语：吉凶倾向、应期、建议')
    onSubmit(lines.join('\n'))
  }

  return (
    <div className="card p-5 mb-3 divination-panel liuyao-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900 mb-1">六爻起卦</div>
          <div className="text-xs text-ink-500 mb-3">
            点击下方按钮模拟摇铜钱，共需 6 次（从初爻到上爻）。
            约定：三正面=老阳（动），三反面=老阴（动），二正一反=少阴，一正二反=少阳。
          </div>
        </div>
        <div className={`coin-cluster ${throwing ? 'throwing' : ''}`} aria-hidden="true">
          <span>乾</span><span>坤</span><span>变</span>
        </div>
      </div>

      <div className="mb-3">
        <label className="label">所问之事（选填）</label>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：和合伙人这件事能不能成？"
        />
      </div>

      {/* 卦象展示 */}
      <div className="bg-white/85 rounded-xl p-4 border border-ink-200 mb-3 shadow-sm">
        <div className="text-xs text-ink-500 mb-2 text-center">从下往上：第 1-6 爻</div>
        <div className="flex flex-col-reverse gap-2 items-center">
          {Array.from({ length: 6 }).map((_, i) => {
            const y = throws[i]
            return (
              <div
                key={i}
                className={`yao-row flex items-center gap-3 w-full max-w-xs ${y ? 'filled' : ''}`}
              >
                <div className="text-[10px] text-ink-400 w-6">第{i + 1}</div>
                {y ? (
                  <>
                    <div className="font-mono text-xl text-ink-800">{y.symbol}</div>
                    <div className="text-xs text-ink-500">{y.desc}</div>
                  </>
                ) : (
                  <div className="font-mono text-xl text-ink-300">…未摇</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {throws.length < 6 ? (
          <button
            onClick={next}
            disabled={throwing}
            className="btn-primary flex-1"
          >
            {throwing ? '🪙 摇币中…' : `🪙 摇第 ${throws.length + 1} 爻`}
          </button>
        ) : (
          <button onClick={submit} className="btn-primary flex-1">
            ☯️ 让 AI 解卦
          </button>
        )}
        {throws.length > 0 && (
          <button onClick={reset} className="btn-ghost">
            重摇
          </button>
        )}
      </div>
    </div>
  )
}
