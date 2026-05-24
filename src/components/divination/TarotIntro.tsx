import { useState } from 'react'
import {
  TAROT_SPREADS,
  drawCards,
  type SpreadDef,
  type DrawnCard
} from '@/lib/divination/tarot'

interface Props {
  /** 抽完牌后调用，组件会把 spread + 抽到的牌 + 问题拼成自然语言提交给 AI */
  onSubmit: (text: string) => void
}

type Phase = 'choose-spread' | 'shuffle' | 'pick' | 'reveal'

const FAN_SIZE = 22 // 显示在选牌区的牌堆牌数

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI']

const CARD_HUES = [200, 40, 260, 140, 25, 280, 340, 210, 30, 50, 170, 220, 300, 270, 180, 350, 15, 190, 240, 45, 310, 150]

export default function TarotIntro({ onSubmit }: Props) {
  const [question, setQuestion] = useState('')
  const [spread, setSpread] = useState<SpreadDef | null>(null)
  const [phase, setPhase] = useState<Phase>('choose-spread')
  const [shuffling, setShuffling] = useState(false)
  /** 用户选中的索引（在 fan 中） */
  const [picked, setPicked] = useState<number[]>([])
  /** 抽到的实际牌（按用户选择顺序对应到 spread.positions） */
  const [drawn, setDrawn] = useState<DrawnCard[]>([])
  /** 控制翻面 */
  const [revealedCount, setRevealedCount] = useState(0)

  const startShuffle = (s: SpreadDef) => {
    setSpread(s)
    setPicked([])
    setDrawn([])
    setRevealedCount(0)
    setPhase('shuffle')
    setShuffling(true)
    // 洗牌动画 1.6 秒后进入挑选
    setTimeout(() => {
      setShuffling(false)
      setPhase('pick')
    }, 1600)
  }

  const onPick = (fanIdx: number) => {
    if (!spread) return
    if (picked.includes(fanIdx)) return
    if (picked.length >= spread.positions.length) return
    const next = [...picked, fanIdx]
    setPicked(next)
    if (next.length === spread.positions.length) {
      // 已选满，进入揭示阶段
      const cards = drawCards(spread)
      setDrawn(cards)
      setPhase('reveal')
      // 依次翻牌
      cards.forEach((_, i) => {
        setTimeout(() => setRevealedCount(i + 1), 400 + i * 350)
      })
    }
  }

  const submit = () => {
    if (!spread || drawn.length === 0) return
    const lines = [
      `请按【${spread.name}】牌阵为我解读。`,
      question.trim() ? `我的问题：${question.trim()}` : '我没有特定问题，请给一个综合指引。',
      '',
      '抽到的牌：'
    ]
    drawn.forEach((d, i) => {
      lines.push(
        `${i + 1}. ${d.position.name}（${d.position.meaning}）— ${d.card.nameChinese} ${d.card.name}（${
          d.orientation === 'upright' ? '正位' : '逆位'
        }）`
      )
    })
    lines.push('')
    lines.push('请按以下结构详细解读：')
    lines.push('1. 每张牌：在该位置的具体含义（结合关键词与正/逆位）')
    lines.push('2. 综合解读：把所有牌串成一个完整故事')
    lines.push('3. 行动建议：具体可执行的 2-3 条建议')
    onSubmit(lines.join('\n'))
  }

  const reset = () => {
    setSpread(null)
    setPhase('choose-spread')
    setPicked([])
    setDrawn([])
    setRevealedCount(0)
    setShuffling(false)
  }

  return (
    <div className="card p-5 mb-3 divination-panel tarot-panel">
      {/* 顶部：问题输入 */}
      <div className="mb-4">
        <label className="label">心中默念你想问的事（选填）</label>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：我接下来三个月的事业会怎样？"
          disabled={phase !== 'choose-spread' && phase !== 'pick'}
        />
      </div>

      {/* 阶段 1：选牌阵 */}
      {phase === 'choose-spread' && (
        <div>
          <div className="label">选择牌阵</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TAROT_SPREADS.map((s) => (
              <button
                key={s.id}
                onClick={() => startShuffle(s)}
                className="divination-choice p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-900">{s.name}</span>
                  <span className="chip">{s.positions.length} 张</span>
                </div>
                <div className="text-xs text-ink-500 mt-1 line-clamp-2">
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 阶段 2：洗牌动画 */}
      {phase === 'shuffle' && (
        <div className="flex flex-col items-center py-8">
          <div className="tarot-stage flex justify-center">
            <div className={`tarot-deck ${shuffling ? 'shuffle-deck' : ''}`} />
          </div>
          <div className="mt-5 text-sm text-ink-600 animate-pulse">
            🌟 正在洗牌，请凝神想着你的问题…
          </div>
        </div>
      )}

      {/* 阶段 3：扇形展开，让用户挑牌 */}
      {phase === 'pick' && spread && (
        <div>
          <div className="text-center text-sm text-ink-700 mb-3">
            已展开 22 张大阿卡纳。请<strong>凭直觉</strong>点击
            <strong className="text-indigo-700"> {spread.positions.length} </strong>
            张（已选 {picked.length}）。
          </div>
          <div className="tarot-stage relative h-44 sm:h-56 flex items-end justify-center overflow-x-auto pb-2">
            <div className="flex items-end gap-[-30px] sm:gap-[-40px]">
              {Array.from({ length: FAN_SIZE }).map((_, i) => {
                const center = (FAN_SIZE - 1) / 2
                const offset = i - center
                const rot = offset * 4
                const ty = Math.abs(offset) * 1.5
                const isPicked = picked.includes(i)
                const isFull = picked.length >= spread.positions.length
                return (
                  <div
                    key={i}
                    onClick={() => !isPicked && !isFull && onPick(i)}
                    className={`tarot-fan-card ${isPicked ? 'picked' : ''}`}
                    style={{
                      marginLeft: i === 0 ? 0 : '-32px',
                      transform: `translateY(${
                        isPicked ? -28 : ty
                      }px) rotate(${rot}deg)`,
                      cursor: isPicked || isFull ? 'default' : 'pointer',
                      opacity: isPicked ? 0.45 : 1,
                      zIndex: i
                    }}
                  >
                    <div className="tarot-card">
                      <div className="face back" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {picked.length > 0 && (
            <div className="text-center mt-3">
              <button onClick={reset} className="btn-ghost text-xs">
                重选牌阵
              </button>
            </div>
          )}
        </div>
      )}

      {/* 阶段 4：揭示翻牌 */}
      {phase === 'reveal' && spread && drawn.length > 0 && (
        <div>
          <div className="text-center text-sm text-ink-700 mb-4">
            🎴 已为你抽出 <strong>{spread.name}</strong>
          </div>
          <div className="tarot-stage flex flex-wrap justify-center gap-3 sm:gap-4">
            {drawn.map((d, i) => {
              const flipped = i < revealedCount
              const hue = CARD_HUES[d.card.id] ?? 0
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-[10px] sm:text-xs text-ink-500 mb-1.5 text-center max-w-[120px] truncate">
                    {d.position.name}
                  </div>
                  <div
                    className={`tarot-card deal-in ${flipped ? 'flipped' : ''} ${
                      d.orientation === 'reversed' ? 'reversed' : ''
                    }`}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  >
                    <div className="face back" />
                    <div
                      className="face front"
                      style={{ background: `linear-gradient(150deg, hsl(${hue}, 35%, 95%) 0%, hsl(${hue}, 45%, 85%) 100%)` }}
                    >
                      <div className="text-[8px] sm:text-[9px] font-semibold tracking-widest text-amber-700/60 mb-0.5">
                        {ROMAN[d.card.id]}
                      </div>
                      <div className="tarot-art" style={{ ['--tarot-hue' as string]: hue }}>
                        <div className="tarot-art-orbit" />
                        <div className="tarot-art-glyph">{d.card.emoji}</div>
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-amber-900 leading-tight">
                        {d.card.nameChinese}
                      </div>
                      <div className={`text-[9px] sm:text-[10px] mt-0.5 font-semibold ${
                        d.orientation === 'upright' ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {d.orientation === 'upright' ? '正位' : '逆位 ↻'}
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-ink-500 mt-0.5 line-clamp-2 leading-tight">
                        {d.card.keywords.slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {revealedCount === drawn.length && (
            <div className="text-center mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={submit} className="btn-primary">
                ✨ 让 AI 解读
              </button>
              <button onClick={reset} className="btn-ghost">
                重新洗牌
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
