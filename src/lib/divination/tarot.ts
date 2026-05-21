/**
 * 22 张大阿卡纳 + 简化牌意。占卜面板用于 simple-ai web 版抽卡动画。
 * 不引入图片资源，纯 SVG 符号 + 关键词。
 */

export type Orientation = 'upright' | 'reversed'

export interface MajorArcanaCard {
  id: number
  name: string
  nameChinese: string
  emoji: string
  keywords: string[]
  upright: string
  reversed: string
}

export const MAJOR_ARCANA: MajorArcanaCard[] = [
  { id: 0, name: 'The Fool', nameChinese: '愚者', emoji: '🌅',
    keywords: ['新开始', '冒险', '纯真', '自由'],
    upright: '崭新的旅程，跟随直觉勇敢出发',
    reversed: '鲁莽冲动，准备不足' },
  { id: 1, name: 'The Magician', nameChinese: '魔术师', emoji: '🎩',
    keywords: ['创造', '行动力', '专注', '展现'],
    upright: '掌握资源，主动创造',
    reversed: '操弄、缺乏专注、潜力未发挥' },
  { id: 2, name: 'The High Priestess', nameChinese: '女祭司', emoji: '🌙',
    keywords: ['直觉', '潜意识', '神秘', '内省'],
    upright: '聆听内心声音，潜在的智慧',
    reversed: '忽视直觉、信息隐藏' },
  { id: 3, name: 'The Empress', nameChinese: '皇后', emoji: '🌷',
    keywords: ['丰盛', '滋养', '母性', '创造力'],
    upright: '丰收、爱与关怀',
    reversed: '依赖、缺乏自我' },
  { id: 4, name: 'The Emperor', nameChinese: '皇帝', emoji: '👑',
    keywords: ['秩序', '权威', '父性', '稳固'],
    upright: '建立结构、稳定的领导',
    reversed: '专制、僵化' },
  { id: 5, name: 'The Hierophant', nameChinese: '教皇', emoji: '⛪',
    keywords: ['传统', '指引', '信仰', '体制'],
    upright: '寻求传统智慧的指引',
    reversed: '反叛常规、需要新视角' },
  { id: 6, name: 'The Lovers', nameChinese: '恋人', emoji: '💕',
    keywords: ['爱', '选择', '结合', '价值观'],
    upright: '深刻的连结、重要选择',
    reversed: '关系失衡、错误选择' },
  { id: 7, name: 'The Chariot', nameChinese: '战车', emoji: '🏛️',
    keywords: ['前进', '意志', '掌控', '胜利'],
    upright: '坚定意志带来胜利',
    reversed: '失控、方向迷失' },
  { id: 8, name: 'Strength', nameChinese: '力量', emoji: '🦁',
    keywords: ['内在力量', '勇气', '耐心', '柔韧'],
    upright: '以柔克刚的真正力量',
    reversed: '自我怀疑、力量被压抑' },
  { id: 9, name: 'The Hermit', nameChinese: '隐士', emoji: '🕯️',
    keywords: ['独处', '内省', '智慧', '寻找'],
    upright: '退一步，向内寻找答案',
    reversed: '孤立、过度封闭' },
  { id: 10, name: 'Wheel of Fortune', nameChinese: '命运之轮', emoji: '🎡',
    keywords: ['转变', '机遇', '循环', '宿命'],
    upright: '命运转折，把握机遇',
    reversed: '抗拒变化、运势低迷' },
  { id: 11, name: 'Justice', nameChinese: '正义', emoji: '⚖️',
    keywords: ['公平', '因果', '诚实', '决断'],
    upright: '公正的判断、为行为负责',
    reversed: '偏颇、逃避责任' },
  { id: 12, name: 'The Hanged Man', nameChinese: '倒吊人', emoji: '🪢',
    keywords: ['暂停', '换视角', '牺牲', '顿悟'],
    upright: '换个角度，得到新洞察',
    reversed: '停滞、徒劳的牺牲' },
  { id: 13, name: 'Death', nameChinese: '死神', emoji: '🦋',
    keywords: ['终结', '蜕变', '放下', '重生'],
    upright: '旧的结束，新的开始',
    reversed: '抗拒改变、无法放下' },
  { id: 14, name: 'Temperance', nameChinese: '节制', emoji: '🕊️',
    keywords: ['平衡', '调和', '耐心', '中道'],
    upright: '协调融合、找到中庸',
    reversed: '失衡、极端' },
  { id: 15, name: 'The Devil', nameChinese: '恶魔', emoji: '😈',
    keywords: ['束缚', '欲望', '执着', '阴影'],
    upright: '看清束缚、面对阴影',
    reversed: '挣脱束缚、获得自由' },
  { id: 16, name: 'The Tower', nameChinese: '高塔', emoji: '🗼',
    keywords: ['崩塌', '突变', '揭示', '解放'],
    upright: '突如其来的剧变、旧结构崩塌',
    reversed: '勉强维持、避免必要的变革' },
  { id: 17, name: 'The Star', nameChinese: '星星', emoji: '⭐',
    keywords: ['希望', '指引', '疗愈', '信念'],
    upright: '希望降临、心灵疗愈',
    reversed: '失去信念、悲观' },
  { id: 18, name: 'The Moon', nameChinese: '月亮', emoji: '🌒',
    keywords: ['幻象', '潜意识', '不安', '想象'],
    upright: '迷雾中的真相、聆听潜意识',
    reversed: '焦虑消散、看清幻象' },
  { id: 19, name: 'The Sun', nameChinese: '太阳', emoji: '☀️',
    keywords: ['喜悦', '成功', '活力', '光明'],
    upright: '光明圆满、充满活力',
    reversed: '过度乐观、能量耗尽' },
  { id: 20, name: 'Judgement', nameChinese: '审判', emoji: '📯',
    keywords: ['觉醒', '召唤', '宽恕', '重生'],
    upright: '内在的觉醒与重新评估',
    reversed: '自我批判、错过召唤' },
  { id: 21, name: 'The World', nameChinese: '世界', emoji: '🌍',
    keywords: ['圆满', '完成', '整合', '成就'],
    upright: '一个周期圆满完成',
    reversed: '未竟之事、临门一脚的延宕' }
]

export interface SpreadPosition {
  name: string
  meaning: string
}

export interface SpreadDef {
  id: string
  name: string
  description: string
  positions: SpreadPosition[]
}

export const TAROT_SPREADS: SpreadDef[] = [
  {
    id: 'single',
    name: '单张指引',
    description: '抽一张牌，看当下需要关注什么',
    positions: [{ name: '今日指引', meaning: '当下最需要看见的信息' }]
  },
  {
    id: 'three',
    name: '三牌阵：过去 / 现在 / 未来',
    description: '看一件事的时间线发展',
    positions: [
      { name: '过去', meaning: '事件起源 / 已成形的力量' },
      { name: '现在', meaning: '当下处境 / 关键焦点' },
      { name: '未来', meaning: '若顺势走，可能的方向' }
    ]
  },
  {
    id: 'situation-action-outcome',
    name: '三牌阵：处境 / 行动 / 结果',
    description: '看具体决策的方向',
    positions: [
      { name: '处境', meaning: '当前的客观情况' },
      { name: '建议行动', meaning: '推荐采取的态度或行动' },
      { name: '可能结果', meaning: '若依此行动可能的发展' }
    ]
  },
  {
    id: 'celtic-cross',
    name: '凯尔特十字',
    description: '深度议题十张牌完整解读',
    positions: [
      { name: '现况', meaning: '问题的核心情境' },
      { name: '挑战', meaning: '横亘在面前的障碍' },
      { name: '过去', meaning: '影响现在的根源' },
      { name: '近期', meaning: '即将发生或已在发生的' },
      { name: '可能未来', meaning: '若不改变可能的走向' },
      { name: '更远未来', meaning: '更深层的发展趋势' },
      { name: '自我', meaning: '你内在的真实态度' },
      { name: '环境', meaning: '他人 / 外部的态度与影响' },
      { name: '希望与恐惧', meaning: '你内心的期待与不安' },
      { name: '最终结果', meaning: '综合一切，最可能的结局' }
    ]
  },
  {
    id: 'love-seven',
    name: '爱情七张阵',
    description: '看两人关系的全貌',
    positions: [
      { name: '你的状态', meaning: '你目前的内在' },
      { name: '对方状态', meaning: 'Ta 目前的内在' },
      { name: '关系基础', meaning: '你们之间已经建立的' },
      { name: '阻碍', meaning: '关系中的卡点' },
      { name: '你的期待', meaning: '你内心希望什么' },
      { name: '对方的期待', meaning: 'Ta 内心希望什么' },
      { name: '关系走向', meaning: '若顺势发展的可能性' }
    ]
  }
]

export interface DrawnCard {
  card: MajorArcanaCard
  orientation: Orientation
  position: SpreadPosition
}

/** 不放回随机抽 N 张，每张独立决定正/逆位。 */
export function drawCards(spread: SpreadDef): DrawnCard[] {
  const pool = [...MAJOR_ARCANA]
  const drawn: DrawnCard[] = []
  for (const pos of spread.positions) {
    const idx = Math.floor(Math.random() * pool.length)
    const card = pool.splice(idx, 1)[0]
    const orientation: Orientation = Math.random() < 0.3 ? 'reversed' : 'upright'
    drawn.push({ card, orientation, position: pos })
  }
  return drawn
}

export function getSpread(id: string): SpreadDef | undefined {
  return TAROT_SPREADS.find((s) => s.id === id)
}
