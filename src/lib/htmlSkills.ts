/**
 * html-anything integration — 75 skill templates for HTML generation.
 * Metadata from https://github.com/nexu-io/html-anything
 */

export interface HtmlSkill {
  id: string
  name: string
  emoji: string
  desc: string
  category: string
}

export const SKILL_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'all', label: '全部', emoji: '' },
  { id: 'slides', label: '幻灯片', emoji: '🎬' },
  { id: 'article', label: '文章', emoji: '📖' },
  { id: 'card', label: '卡片', emoji: '🃏' },
  { id: 'dashboard', label: '仪表板', emoji: '📊' },
  { id: 'doc', label: '文档', emoji: '📄' },
  { id: 'poster', label: '海报', emoji: '🖼️' },
  { id: 'video', label: '动效帧', emoji: '🎞️' },
  { id: 'prototype', label: '原型', emoji: '🛠️' },
  { id: 'finance', label: '财务', emoji: '💼' },
  { id: 'mobile', label: '移动端', emoji: '📱' },
  { id: 'email', label: '邮件', emoji: '📧' },
  { id: 'resume', label: '简历', emoji: '📄' },
  { id: 'data', label: '数据', emoji: '📊' },
]

export const HTML_SKILLS: HtmlSkill[] = [
  { id: 'article-magazine', name: '杂志文章', emoji: '📖', desc: 'Substack/Medium 高级感长文排版', category: 'article' },
  { id: 'blog-post', name: '博客长文', emoji: '📰', desc: '杂志感长文, 含 hero、figures、pull quote', category: 'article' },
  { id: 'digital-eguide', name: '电子指南', emoji: '📚', desc: '两页跨页电子指南, 封面+课程页+步骤列表', category: 'article' },
  { id: 'card-twitter', name: '推特卡片', emoji: '🐦', desc: '推特金句/数据卡, 适合配推文', category: 'card' },
  { id: 'card-xiaohongshu', name: '小红书卡片', emoji: '📱', desc: '小红书风格知识卡片, 多张联排', category: 'card' },
  { id: 'social-carousel', name: '社交轮播', emoji: '🎠', desc: '三张方形卡片轮播, 标题串联', category: 'card' },
  { id: 'social-reddit-card', name: 'Reddit 卡片', emoji: '🔺', desc: '拟真 Reddit 帖子卡+投票+评论', category: 'card' },
  { id: 'social-spotify-card', name: 'Spotify 卡片', emoji: '🎵', desc: 'Now Playing 风格卡: 封面+进度条', category: 'card' },
  { id: 'social-x-post-card', name: 'X 推文卡片', emoji: '𝕏', desc: '拟真 X 推文卡片+互动数据', category: 'card' },
  { id: 'frame-macos-notification', name: 'macOS 通知', emoji: '🔔', desc: '拟真 macOS 通知 banner', category: 'card' },
  { id: 'dashboard', name: '管理后台', emoji: '🎛️', desc: '侧栏+顶栏+KPI 网格+图表', category: 'dashboard' },
  { id: 'dating-web', name: '配对仪表板', emoji: '💞', desc: '信号 ticker+KPI+柱状+趋势', category: 'dashboard' },
  { id: 'flowai-team-dashboard', name: '团队后台', emoji: '🌊', desc: '三 tab 管理: 成员、详情、日志', category: 'dashboard' },
  { id: 'kanban-board', name: '看板', emoji: '📌', desc: 'To do/In progress/Done 四列看板', category: 'dashboard' },
  { id: 'live-dashboard', name: '实时看板', emoji: '📈', desc: 'Notion 风 KPI+sparkline+任务表', category: 'dashboard' },
  { id: 'social-media-dashboard', name: '社媒分析', emoji: '📡', desc: '平台切换+粉丝+增长曲线', category: 'dashboard' },
  { id: 'social-media-matrix', name: '社媒矩阵', emoji: '🛰️', desc: '电影感多平台社媒分析', category: 'dashboard' },
  { id: 'team-okrs', name: '团队 OKR', emoji: '🎯', desc: '季度 banner+目标+KR 进度条', category: 'dashboard' },
  { id: 'data-report', name: '数据报告', emoji: '📊', desc: 'CSV/Excel/JSON 转可视化报告', category: 'data' },
  { id: 'docs-page', name: '文档页', emoji: '📘', desc: '三栏: 侧导航+正文+TOC', category: 'doc' },
  { id: 'doc-kami-parchment', name: '羊皮纸文档', emoji: '📜', desc: '暖底+墨蓝 accent+衬线字体', category: 'doc' },
  { id: 'eng-runbook', name: '运维手册', emoji: '📕', desc: '服务概述+alerts+操作命令+事故清单', category: 'doc' },
  { id: 'hr-onboarding', name: '入职指南', emoji: '👋', desc: '首周日程+buddy+学习路径', category: 'doc' },
  { id: 'meeting-notes', name: '会议纪要', emoji: '🗒️', desc: '标题+出席+议程+决议+行动项', category: 'doc' },
  { id: 'pm-spec', name: '产品规格', emoji: '🧭', desc: '问题+指标+范围+用户故事+发布', category: 'doc' },
  { id: 'email-marketing', name: '营销邮件', emoji: '📧', desc: '产品发布邮件, hero+CTA+规格', category: 'email' },
  { id: 'finance-report', name: '财务报告', emoji: '💼', desc: 'KPI+收入图+P&L 表+展望', category: 'finance' },
  { id: 'invoice', name: '发票', emoji: '🧾', desc: '标准发票: 明细+税+总额+付款指引', category: 'finance' },
  { id: 'mobile-app', name: '手机截图', emoji: '📲', desc: 'iPhone 15 Pro 边框, 一屏 app 截图', category: 'mobile' },
  { id: 'mobile-onboarding', name: '引导页', emoji: '🪂', desc: '三个手机框: splash/value-prop/sign-in', category: 'mobile' },
  { id: 'gamified-app', name: '游戏化 App', emoji: '🕹️', desc: '三屏: 封面/任务/详情, 暗色舞台', category: 'mobile' },
  { id: 'magazine-poster', name: '报纸海报', emoji: '🗞️', desc: 'Sunday-paper 风格大字 serif+双栏', category: 'poster' },
  { id: 'poster-hero', name: '竖版海报', emoji: '🖼️', desc: '朋友圈分享图, 强视觉冲击', category: 'poster' },
  { id: 'sprite-animation', name: '像素动画', emoji: '🕹️', desc: '像素美术+kinetic 字体, CSS 循环', category: 'poster' },
  { id: 'frame-liquid-bg-hero', name: '流体背景', emoji: '🌊', desc: 'WebGL 流体置换+金句叠加', category: 'poster' },
  { id: 'mockup-device-3d', name: '3D 设备展架', emoji: '📱', desc: 'iPhone+MacBook 展架, 屏幕嵌入 HTML', category: 'poster' },
  { id: 'deck-simple', name: '简约 Deck', emoji: '▫️', desc: '通用水平滑动 HTML deck', category: 'slides' },
  { id: 'deck-pitch', name: '融资 Deck', emoji: '🚀', desc: '10 页融资: hero+traction+ask', category: 'slides' },
  { id: 'deck-tech-sharing', name: '技术分享', emoji: '💻', desc: 'GitHub-dark+终端代码块+Q&A', category: 'slides' },
  { id: 'deck-product-launch', name: '产品发布', emoji: '🎉', desc: '暗 hero+亮内容+特性卡+定价', category: 'slides' },
  { id: 'deck-magazine-web', name: '杂志 Deck', emoji: '📰', desc: '电子墨水风+WebGL 流体背景', category: 'slides' },
  { id: 'deck-guizang-editorial', name: '归藏编辑', emoji: '🖋️', desc: '杂志×电子墨水, 10 版面+5 调色板', category: 'slides' },
  { id: 'deck-swiss-international', name: '瑞士国际', emoji: '🟦', desc: '16 列网格+单色 accent+22 版面', category: 'slides' },
  { id: 'deck-obsidian-claude', name: 'Obsidian 暗', emoji: '🌃', desc: 'GitHub-dark+紫蓝环境光+渐变标题', category: 'slides' },
  { id: 'deck-hermes-cyber', name: '赛博终端', emoji: '🟢', desc: '黑底+CRT 扫描线+命令行标题', category: 'slides' },
  { id: 'deck-graphify-dark', name: '深夜图谱', emoji: '🌌', desc: '深夜渐变+浮动 orbs+力导向图', category: 'slides' },
  { id: 'deck-blueprint', name: '蓝图', emoji: '📐', desc: '奶油纸+锈红+蓝图网格 mask', category: 'slides' },
  { id: 'deck-course-module', name: '课程模块', emoji: '🎓', desc: '暖纸背景+学习目标+MCQ 自测', category: 'slides' },
  { id: 'deck-safety-alert', name: '安全警报', emoji: '⚠️', desc: '红琥珀警示色+hazard 条纹', category: 'slides' },
  { id: 'deck-presenter-mode', name: '演示模式', emoji: '🎤', desc: 'tokyo-night+5 主题切换+提词器', category: 'slides' },
  { id: 'deck-xhs-pastel', name: '小红书柔粉', emoji: '🍡', desc: '奶油底+马卡龙圆角卡片', category: 'slides' },
  { id: 'deck-xhs-post', name: '小红书竖版', emoji: '🎀', desc: '9 页 3:4 竖版图文+暖 pastel', category: 'slides' },
  { id: 'deck-xhs-white', name: '小红书白', emoji: '🌈', desc: '纯白+彩虹 bar+马卡龙卡片', category: 'slides' },
  { id: 'deck-dir-key-nav', name: '极简方向键', emoji: '▶︎', desc: '8 页单色+160px display+箭头列表', category: 'slides' },
  { id: 'deck-replit', name: 'Replit 主题', emoji: '🟣', desc: 'Replit Slides 八套主题', category: 'slides' },
  { id: 'deck-open-slide-canvas', name: '自由画布', emoji: '🎨', desc: '1920×1080 自由组合, 不绑模板', category: 'slides' },
  { id: 'weekly-update', name: '周报', emoji: '🗓️', desc: '6-8 页横向滑动: 已发布/进行中/阻塞', category: 'slides' },
  { id: 'ppt-keynote', name: 'Keynote 级', emoji: '🎬', desc: '苹果 Keynote 级幻灯片, 键盘切换', category: 'slides' },
  { id: 'prototype-web', name: 'Web 原型', emoji: '🛠️', desc: '可点击功能性原型: 导航+英雄+CTA', category: 'prototype' },
  { id: 'pricing-page', name: '定价页', emoji: '💳', desc: '三档定价+特性对比+FAQ', category: 'prototype' },
  { id: 'saas-landing', name: 'SaaS 落地页', emoji: '🚀', desc: '单页: hero+features+pricing+CTA', category: 'prototype' },
  { id: 'waitlist-page', name: '等候名单页', emoji: '✉️', desc: '极简预发布页+邮箱捕获', category: 'prototype' },
  { id: 'web-proto-brutalist', name: '粗野主义', emoji: '⬛', desc: 'Swiss industrial+巨数字+ASCII', category: 'prototype' },
  { id: 'web-proto-editorial', name: '编辑风', emoji: '📜', desc: '暖色+serif display+grotesque body', category: 'prototype' },
  { id: 'web-proto-soft', name: '柔软苹果风', emoji: '🫧', desc: 'Apple 调: 银/奶+双层斜面卡片', category: 'prototype' },
  { id: 'wireframe-sketch', name: '线框草图', emoji: '✏️', desc: '网格背景+marker 笔触+sticky note', category: 'prototype' },
  { id: 'resume-modern', name: '现代简历', emoji: '📄', desc: '极简 A4 单页, 适合打印/PDF', category: 'resume' },
  { id: 'frame-data-chart-nyt', name: 'NYT 图表帧', emoji: '📈', desc: 'NYT 排版+编辑级图表动画', category: 'video' },
  { id: 'frame-flowchart-sticky', name: '便签流程图', emoji: '📝', desc: 'SVG 曲线连接+便利贴节点', category: 'video' },
  { id: 'frame-glitch-title', name: '故障标题', emoji: '⚡', desc: '数字故障/像散偏移, cyberpunk hero', category: 'video' },
  { id: 'frame-light-leak-cinema', name: '胶片漏光', emoji: '🎞️', desc: '胶片漏光+颗粒+letterbox+电影感', category: 'video' },
  { id: 'frame-logo-outro', name: 'Logo 片尾', emoji: '🎬', desc: 'Logo 组装入场+glow bloom+tagline', category: 'video' },
  { id: 'vfx-text-cursor', name: '光标拖光', emoji: '✨', desc: '光标逐字揭示+彩色像散射线', category: 'video' },
  { id: 'video-hyperframes', name: 'Hyperframes', emoji: '🎞️', desc: 'Remotion 兼容连续帧, 可自动播放', category: 'video' },
  { id: 'motion-frames', name: '动效组合', emoji: '🌀', desc: '旋转环/地球仪/计时器, CSS 循环', category: 'video' },
]

export const SHARED_DESIGN_DIRECTIVES = `
你是世界级的视觉设计师 + 资深前端工程师。请输出一份**自包含的单文件 HTML**，要求：

【内容驱动数量 — 最高优先级】
- 输出的 slide/frame/card/section 数量**完全由用户内容的实际长度和信息结构决定**。
- 必须**完整覆盖**用户内容的每一个要点，**不许总结、压缩、丢弃信息**。

【硬性技术要求】
- 直接把完整的 HTML 文档作为回复正文流式输出。
- 文档以 \`<!DOCTYPE html>\` 开头, 末尾以 \`</html>\` 结束。
- 在 <head> 中通过 CDN 引入 Tailwind v3 Play (https://cdn.tailwindcss.com) 与所需的 Google Fonts。
- 不要引用任何外部图片 URL, 优先使用 CSS/SVG 内联绘制。
- 必要的脚本通过 jsdelivr CDN 引入; 保持单文件可双击打开即用。
- 输出**纯 HTML**, 不要用 markdown 代码围栏包裹, 不要任何解释性文字。第一个字符必须是 \`<\`。

【设计准则】
- 排版: 中文优先 Noto Sans SC/Noto Serif SC, 英文 Inter/Manrope。
- 色彩: 1 个主色+2 个中性色+至多 1 个强调色; 大胆留白; 不用纯黑纯白。
- 网格: 8px 基线; 段落最大宽度 65ch; 标题与正文有清晰层级。
- 圆角统一, 投影柔和, 动效克制。
- 无障碍: 对比度 ≥ 4.5。

【内容真实性】
- 必须使用用户提供的真实数据, 不要编造、不要 lorem ipsum。
- 中英文混排时中英文之间留半角空格。
`

export function buildHtmlPrompt(skillId: string, content: string, format: string): string {
  const skill = HTML_SKILLS.find(s => s.id === skillId)
  const styleHint = skill ? `【模板风格】: ${skill.name} — ${skill.desc}` : ''
  return `${SHARED_DESIGN_DIRECTIVES}

${styleHint}

【输入格式】: ${format || 'markdown'}
【用户内容】:
${content}
`
}
