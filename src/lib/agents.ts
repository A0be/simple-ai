export interface AgentCategory {
  id: string
  name: string
  emoji: string
  desc: string
}

export interface AgentDef {
  id: string
  cat: string
  emoji: string
  name: string
  nameEn: string
  desc: string
  expertise: string
  whenToUse: string
}

export const AGENT_CATEGORIES: AgentCategory[] = [
  { id: 'academic', name: '学术研究', emoji: '📚', desc: '人文社科、历史、心理学' },
  { id: 'design', name: '设计创意', emoji: '🎨', desc: 'UI/UX、品牌、视觉叙事' },
  { id: 'engineering', name: '软件工程', emoji: '💻', desc: '前后端、架构、DevOps、安全' },
  { id: 'finance', name: '财务金融', emoji: '💰', desc: '记账、分析、税务、投资' },
  { id: 'game-dev', name: '游戏开发', emoji: '🎮', desc: 'Unity/Unreal/Godot/Roblox' },
  { id: 'marketing', name: '营销增长', emoji: '📣', desc: 'SEO、社媒、内容、中国平台' },
  { id: 'paid-media', name: '付费媒体', emoji: '📺', desc: 'PPC、社交广告、追踪归因' },
  { id: 'product', name: '产品管理', emoji: '📦', desc: '产品经理、趋势、反馈、优先级' },
  { id: 'project-mgmt', name: '项目管理', emoji: '📋', desc: '协调、实验、敏捷流程' },
  { id: 'sales', name: '销售', emoji: '🤝', desc: '客户开发、交易、管道分析' },
  { id: 'spatial', name: '空间计算', emoji: '🥽', desc: 'XR/VisionOS/Metal/WebXR' },
  { id: 'specialized', name: '专业领域', emoji: '⚡', desc: '法律、医疗、教育、区块链、HR…' },
  { id: 'support', name: '运营支持', emoji: '🛟', desc: '分析报告、合规、基础设施' },
  { id: 'testing', name: '测试质量', emoji: '🧪', desc: 'API/性能/无障碍/工作流' },
]

export const AGENTS: AgentDef[] = [
  // ── Academic ──
  { id: 'academic-anthropologist', cat: 'academic', emoji: '🏛️', name: '人类学家', nameEn: 'Anthropologist', desc: '文化系统、亲属关系、仪式与信仰体系', expertise: '文化人类学、民族志方法、跨文化比较', whenToUse: '理解文化背景、分析社会结构时' },
  { id: 'academic-geographer', cat: 'academic', emoji: '🌍', name: '地理学家', nameEn: 'Geographer', desc: '自然/人文地理、气候与地图学', expertise: '区域分析、GIS、气候系统、城市地理', whenToUse: '区域研究、环境分析、地缘策略时' },
  { id: 'academic-historian', cat: 'academic', emoji: '📜', name: '历史学家', nameEn: 'Historian', desc: '历史分析、分期与物质文化', expertise: '历史考证、史料分析、比较历史学', whenToUse: '历史研究、时代背景梳理时' },
  { id: 'academic-narratologist', cat: 'academic', emoji: '📖', name: '叙事学家', nameEn: 'Narratologist', desc: '叙事理论、故事结构与角色弧线', expertise: '叙事分析、故事设计、角色发展理论', whenToUse: '故事创作、剧本分析、叙事策略时' },
  { id: 'academic-psychologist', cat: 'academic', emoji: '🧠', name: '心理学家', nameEn: 'Psychologist', desc: '人格理论、动机与认知模式', expertise: '人格心理学、认知科学、行为分析', whenToUse: '心理分析、用户行为研究、团队动力时' },

  // ── Design ──
  { id: 'design-brand-guardian', cat: 'design', emoji: '🛡️', name: '品牌守护者', nameEn: 'Brand Guardian', desc: '品牌一致性、身份与定位', expertise: '品牌战略、视觉识别系统、品牌审计', whenToUse: '品牌建设、品牌规范检查时' },
  { id: 'design-image-prompt', cat: 'design', emoji: '🖼️', name: 'AI 图像提示词师', nameEn: 'Image Prompt Engineer', desc: 'AI 图像生成提示词与摄影构图', expertise: 'Midjourney/DALL-E/SD 提示词、摄影美学', whenToUse: '编写 AI 绘图提示词、优化生成效果时' },
  { id: 'design-inclusive-visuals', cat: 'design', emoji: '🌈', name: '包容性视觉专家', nameEn: 'Inclusive Visuals Specialist', desc: '代表性、偏见消除与真实意象', expertise: '多元化设计、无障碍视觉、文化敏感性', whenToUse: '确保设计的包容性和多样性时' },
  { id: 'design-ui', cat: 'design', emoji: '🎯', name: 'UI 设计师', nameEn: 'UI Designer', desc: '视觉设计、组件库与设计系统', expertise: '界面设计、设计系统、组件规范、配色', whenToUse: '界面设计、组件库搭建、视觉优化时' },
  { id: 'design-ux-architect', cat: 'design', emoji: '🏗️', name: 'UX 架构师', nameEn: 'UX Architect', desc: '技术架构、CSS 系统与实现', expertise: '前端架构、CSS 工程化、设计到代码', whenToUse: '设计系统技术落地、前端架构设计时' },
  { id: 'design-ux-researcher', cat: 'design', emoji: '🔍', name: 'UX 研究员', nameEn: 'UX Researcher', desc: '用户测试、行为分析与研究', expertise: '用户访谈、可用性测试、数据驱动设计', whenToUse: '用户研究、产品体验评估时' },
  { id: 'design-visual-storyteller', cat: 'design', emoji: '🎬', name: '视觉叙事师', nameEn: 'Visual Storyteller', desc: '视觉叙事与多媒体内容', expertise: '信息可视化、多媒体编排、视觉传达', whenToUse: '内容可视化、演示设计、故事化呈现时' },
  { id: 'design-whimsy', cat: 'design', emoji: '✨', name: '趣味注入师', nameEn: 'Whimsy Injector', desc: '个性化、愉悦感与趣味交互', expertise: '微交互、动效设计、情感化设计', whenToUse: '为产品增加趣味性和情感共鸣时' },

  // ── Engineering ──
  { id: 'eng-ai-data', cat: 'engineering', emoji: '🔄', name: 'AI 数据修复工程师', nameEn: 'AI Data Remediation Engineer', desc: '自愈管道、语义聚类与数据修复', expertise: '数据管道、SLM 隔离、语义聚类、自愈系统', whenToUse: '数据质量问题、管道异常修复时' },
  { id: 'eng-ai', cat: 'engineering', emoji: '🤖', name: 'AI 工程师', nameEn: 'AI Engineer', desc: 'ML 模型部署与 AI 系统集成', expertise: '机器学习、模型部署、AI 管道、提示词工程', whenToUse: '构建或集成 AI/ML 功能时' },
  { id: 'eng-auto-optim', cat: 'engineering', emoji: '⚡', name: '自主优化架构师', nameEn: 'Autonomous Optimization Architect', desc: 'LLM 路由、成本优化与影子测试', expertise: 'LLM 编排、成本优化、A/B 测试、模型选型', whenToUse: '优化 AI 系统成本与性能时' },
  { id: 'eng-backend', cat: 'engineering', emoji: '🖧', name: '后端架构师', nameEn: 'Backend Architect', desc: 'API 设计、数据库架构与可扩展性', expertise: '系统设计、API 规范、数据库建模、微服务', whenToUse: '后端架构设计、API 规划时' },
  { id: 'eng-cms', cat: 'engineering', emoji: '📝', name: 'CMS 开发者', nameEn: 'CMS Developer', desc: 'WordPress/Drupal 主题与插件开发', expertise: 'WordPress/Drupal、PHP、主题/插件开发', whenToUse: '搭建或定制 CMS 网站时' },
  { id: 'eng-code-review', cat: 'engineering', emoji: '🔎', name: '代码审查员', nameEn: 'Code Reviewer', desc: '建设性代码审查、安全与可维护性', expertise: '代码质量、安全审查、设计模式、重构建议', whenToUse: '代码审查、质量把关时' },
  { id: 'eng-onboarding', cat: 'engineering', emoji: '🗺️', name: '代码库导航师', nameEn: 'Codebase Onboarding Engineer', desc: '快速开发者入职与代码探索', expertise: '代码考古、架构理解、知识传递', whenToUse: '新成员入职、理解陌生代码库时' },
  { id: 'eng-data', cat: 'engineering', emoji: '🛢️', name: '数据工程师', nameEn: 'Data Engineer', desc: '数据管道、湖仓架构与 ETL/ELT', expertise: 'Spark/Flink、数据仓库、ETL、数据建模', whenToUse: '数据管道建设、数仓架构设计时' },
  { id: 'eng-db-optim', cat: 'engineering', emoji: '⚙️', name: '数据库优化师', nameEn: 'Database Optimizer', desc: 'Schema 设计、查询与索引优化', expertise: 'SQL 优化、索引策略、Schema 设计、分库分表', whenToUse: '数据库性能调优、Schema 重构时' },
  { id: 'eng-devops', cat: 'engineering', emoji: '🚀', name: 'DevOps 自动化师', nameEn: 'DevOps Automator', desc: 'CI/CD、基础设施自动化与云运维', expertise: 'CI/CD、Docker/K8s、Terraform、云平台', whenToUse: '搭建部署流水线、基础设施自动化时' },
  { id: 'eng-email-intel', cat: 'engineering', emoji: '📧', name: '邮件智能工程师', nameEn: 'Email Intelligence Engineer', desc: '邮件解析、MIME 提取与结构化', expertise: '邮件协议、MIME 解析、NLP 提取', whenToUse: '邮件数据处理、智能解析时' },
  { id: 'eng-embedded', cat: 'engineering', emoji: '🔌', name: '嵌入式固件工程师', nameEn: 'Embedded Firmware Engineer', desc: '裸机/RTOS、ESP32/STM32/Nordic', expertise: 'C/C++ 嵌入式、RTOS、外设驱动、低功耗', whenToUse: 'IoT/嵌入式开发、固件编写时' },
  { id: 'eng-feishu', cat: 'engineering', emoji: '🐦', name: '飞书集成开发者', nameEn: 'Feishu Integration Developer', desc: '飞书/Lark 开放平台、机器人与工作流', expertise: '飞书 API、机器人开发、审批/消息集成', whenToUse: '飞书应用开发、工作流自动化时' },
  { id: 'eng-filament', cat: 'engineering', emoji: '🧩', name: 'Filament 优化专家', nameEn: 'Filament Optimization Specialist', desc: 'Filament PHP 管理面板 UX 优化', expertise: 'Filament/Laravel、管理面板、表单/表格优化', whenToUse: '优化 Filament 管理面板体验时' },
  { id: 'eng-frontend', cat: 'engineering', emoji: '🖥️', name: '前端开发者', nameEn: 'Frontend Developer', desc: 'React/Vue/Angular 与 UI 实现', expertise: 'React/Vue、TypeScript、CSS、性能优化', whenToUse: '前端开发、UI 实现、性能调优时' },
  { id: 'eng-git', cat: 'engineering', emoji: '🌿', name: 'Git 工作流大师', nameEn: 'Git Workflow Master', desc: '分支策略、约定式提交与高级 Git', expertise: 'Git 分支模型、约定式提交、rebase/merge 策略', whenToUse: 'Git 流程规范、分支策略制定时' },
  { id: 'eng-incident', cat: 'engineering', emoji: '🚨', name: '事件响应指挥官', nameEn: 'Incident Response Commander', desc: '事件管理、事后复盘与值班体系', expertise: '事件分级、响应流程、复盘方法论', whenToUse: '故障处理、建立 oncall 体系时' },
  { id: 'eng-minimal', cat: 'engineering', emoji: '✂️', name: '最小变更工程师', nameEn: 'Minimal Change Engineer', desc: '最小化代码变更、精准修复', expertise: '精准定位、最小 diff、安全重构', whenToUse: '需要最小侵入式修改、精准修复时' },
  { id: 'eng-mobile', cat: 'engineering', emoji: '📱', name: '移动应用开发者', nameEn: 'Mobile App Builder', desc: 'iOS/Android、React Native、Flutter', expertise: 'React Native/Flutter、原生开发、跨平台', whenToUse: '移动应用开发、跨平台方案选型时' },
  { id: 'eng-prototype', cat: 'engineering', emoji: '⚡', name: '快速原型师', nameEn: 'Rapid Prototyper', desc: '快速 POC 开发与 MVP 验证', expertise: '快速验证、原型搭建、技术选型', whenToUse: '快速验证想法、搭建 MVP 时' },
  { id: 'eng-security', cat: 'engineering', emoji: '🔒', name: '安全工程师', nameEn: 'Security Engineer', desc: '威胁建模与安全代码审查', expertise: 'OWASP、威胁建模、渗透测试、安全编码', whenToUse: '安全审计、威胁建模、安全加固时' },
  { id: 'eng-senior', cat: 'engineering', emoji: '👨‍💻', name: '高级开发者', nameEn: 'Senior Developer', desc: 'Laravel/Livewire 与高级模式', expertise: 'Laravel 生态、设计模式、代码质量', whenToUse: 'Laravel 项目开发、架构决策时' },
  { id: 'eng-architect', cat: 'engineering', emoji: '🏛️', name: '软件架构师', nameEn: 'Software Architect', desc: '系统设计、DDD 与架构模式', expertise: '领域驱动设计、微服务、事件驱动、架构评审', whenToUse: '系统架构设计、技术选型、DDD 实践时' },
  { id: 'eng-solidity', cat: 'engineering', emoji: '⛓️', name: '智能合约工程师', nameEn: 'Solidity Smart Contract Engineer', desc: 'EVM 合约、Gas 优化与 DeFi', expertise: 'Solidity、EVM、Gas 优化、DeFi 协议', whenToUse: '智能合约开发、链上应用时' },
  { id: 'eng-sre', cat: 'engineering', emoji: '📊', name: '站点可靠性工程师', nameEn: 'SRE', desc: 'SLO、错误预算与可观测性', expertise: 'SLO/SLI、可观测性、混沌工程、容量规划', whenToUse: '系统可靠性建设、监控告警设计时' },
  { id: 'eng-tech-writer', cat: 'engineering', emoji: '📄', name: '技术写作师', nameEn: 'Technical Writer', desc: '开发者文档、API 参考与教程', expertise: '技术文档、API 文档、教程写作、文档架构', whenToUse: '编写技术文档、API 文档时' },
  { id: 'eng-threat', cat: 'engineering', emoji: '🕵️', name: '威胁检测工程师', nameEn: 'Threat Detection Engineer', desc: 'SIEM 规则、威胁狩猎与 ATT&CK', expertise: 'SIEM/SOAR、检测规则、威胁情报、ATT&CK', whenToUse: '安全检测规则编写、威胁狩猎时' },
  { id: 'eng-voice-ai', cat: 'engineering', emoji: '🎤', name: '语音 AI 集成工程师', nameEn: 'Voice AI Integration Engineer', desc: '语音转文字管道、Whisper/ASR', expertise: 'Whisper、ASR 管道、语音处理、TTS', whenToUse: '语音识别/合成集成、音频处理时' },
  { id: 'eng-wechat-mini', cat: 'engineering', emoji: '💚', name: '微信小程序开发者', nameEn: 'WeChat Mini Program Developer', desc: '微信生态、小程序与支付集成', expertise: '小程序框架、微信支付、公众号、云开发', whenToUse: '微信小程序开发、微信生态集成时' },

  // ── Finance ──
  { id: 'fin-bookkeeper', cat: 'finance', emoji: '📒', name: '记账审计师', nameEn: 'Bookkeeper & Controller', desc: '月末结账、对账与 GAAP 合规', expertise: '会计准则、月末结账、银行对账、内控', whenToUse: '财务记账、月末结账、合规审查时' },
  { id: 'fin-analyst', cat: 'finance', emoji: '📈', name: '财务分析师', nameEn: 'Financial Analyst', desc: '财务建模、预测与情景分析', expertise: '财务建模、DCF、情景分析、估值方法', whenToUse: '财务分析、投资评估、建模时' },
  { id: 'fin-fpa', cat: 'finance', emoji: '📊', name: '财务规划分析师', nameEn: 'FP&A Analyst', desc: '预算、滚动预测与差异分析', expertise: '预算编制、滚动预测、KPI 分析', whenToUse: '年度预算、财务规划、差异分析时' },
  { id: 'fin-investment', cat: 'finance', emoji: '🏦', name: '投资研究员', nameEn: 'Investment Researcher', desc: '尽职调查、投资组合与资产估值', expertise: '尽职调查、行业研究、组合分析', whenToUse: '投资分析、资产估值、行业研究时' },
  { id: 'fin-tax', cat: 'finance', emoji: '🧾', name: '税务策略师', nameEn: 'Tax Strategist', desc: '税务优化与多辖区合规', expertise: '税务筹划、跨境税务、合规策略', whenToUse: '税务规划、跨境合规、节税方案时' },

  // ── Game Development: Cross-engine ──
  { id: 'game-designer', cat: 'game-dev', emoji: '🎲', name: '游戏设计师', nameEn: 'Game Designer', desc: '系统设计、GDD、经济平衡', expertise: '游戏机制、经济系统、核心循环、GDD', whenToUse: '游戏系统设计、数值平衡时' },
  { id: 'game-level', cat: 'game-dev', emoji: '🗺️', name: '关卡设计师', nameEn: 'Level Designer', desc: '布局理论、节奏与遭遇设计', expertise: '关卡布局、节奏控制、遭遇设计', whenToUse: '关卡设计、难度曲线调整时' },
  { id: 'game-tech-art', cat: 'game-dev', emoji: '🎨', name: '技术美术师', nameEn: 'Technical Artist', desc: '着色器、VFX 与 LOD 管线', expertise: '着色器编写、VFX 系统、性能优化管线', whenToUse: '着色器开发、视效制作、美术管线优化时' },
  { id: 'game-audio', cat: 'game-dev', emoji: '🔊', name: '游戏音频工程师', nameEn: 'Game Audio Engineer', desc: 'FMOD/Wwise、自适应音乐与空间音频', expertise: 'FMOD/Wwise、自适应音乐、3D 空间音频', whenToUse: '游戏音效系统设计、音频中间件集成时' },
  { id: 'game-narrative', cat: 'game-dev', emoji: '📝', name: '叙事设计师', nameEn: 'Narrative Designer', desc: '分支对话、世界观与故事系统', expertise: '分支叙事、对话树、世界观搭建', whenToUse: '游戏剧情设计、对话系统搭建时' },
  // Unity
  { id: 'game-unity-arch', cat: 'game-dev', emoji: '🔷', name: 'Unity 架构师', nameEn: 'Unity Architect', desc: 'ScriptableObjects、DOTS/ECS', expertise: 'Unity 架构、ECS/DOTS、ScriptableObjects', whenToUse: 'Unity 项目架构设计、性能优化时' },
  { id: 'game-unity-shader', cat: 'game-dev', emoji: '💎', name: 'Unity Shader 美术师', nameEn: 'Unity Shader Graph Artist', desc: 'Shader Graph、HLSL、URP/HDRP', expertise: 'Shader Graph、HLSL、渲染管线', whenToUse: 'Unity 着色器开发、视觉效果定制时' },
  { id: 'game-unity-mp', cat: 'game-dev', emoji: '🔗', name: 'Unity 多人联网工程师', nameEn: 'Unity Multiplayer Engineer', desc: 'Netcode、Unity Relay/Lobby', expertise: 'Netcode for GameObjects、Relay、Lobby', whenToUse: 'Unity 多人游戏联网开发时' },
  { id: 'game-unity-editor', cat: 'game-dev', emoji: '🔧', name: 'Unity 编辑器工具开发', nameEn: 'Unity Editor Tool Developer', desc: 'EditorWindow、资源后处理器', expertise: 'Unity 编辑器扩展、自定义工具、管线工具', whenToUse: '自定义 Unity 编辑器工具时' },
  // Unreal
  { id: 'game-ue-sys', cat: 'game-dev', emoji: '🔴', name: '虚幻引擎系统工程师', nameEn: 'Unreal Systems Engineer', desc: 'C++/Blueprint、GAS、Nanite', expertise: 'UE C++、Blueprint、GAS、Nanite/Lumen', whenToUse: 'UE 核心系统开发、Gameplay 框架时' },
  { id: 'game-ue-art', cat: 'game-dev', emoji: '🎭', name: '虚幻引擎技术美术', nameEn: 'Unreal Technical Artist', desc: 'Material Editor、Niagara、PCG', expertise: 'UE 材质、Niagara 特效、PCG 程序化', whenToUse: 'UE 材质/特效开发、程序化生成时' },
  { id: 'game-ue-mp', cat: 'game-dev', emoji: '🌐', name: '虚幻引擎多人架构师', nameEn: 'Unreal Multiplayer Architect', desc: 'Actor 复制、GameMode 层级', expertise: 'UE 网络同步、Replication、Dedicated Server', whenToUse: 'UE 多人游戏架构设计时' },
  { id: 'game-ue-world', cat: 'game-dev', emoji: '🏔️', name: '虚幻引擎世界构建师', nameEn: 'Unreal World Builder', desc: 'World Partition、Landscape、HLOD', expertise: 'World Partition、地形系统、HLOD、流式加载', whenToUse: 'UE 大世界场景搭建时' },
  // Godot
  { id: 'game-godot-script', cat: 'game-dev', emoji: '🟣', name: 'Godot 游戏脚本师', nameEn: 'Godot Gameplay Scripter', desc: 'GDScript 2.0、信号与组合', expertise: 'GDScript、信号系统、节点组合、场景树', whenToUse: 'Godot 游戏逻辑编写时' },
  { id: 'game-godot-mp', cat: 'game-dev', emoji: '🔮', name: 'Godot 多人联网工程师', nameEn: 'Godot Multiplayer Engineer', desc: 'MultiplayerAPI、ENet/WebRTC', expertise: 'Godot 网络 API、ENet、WebRTC', whenToUse: 'Godot 多人游戏开发时' },
  { id: 'game-godot-shader', cat: 'game-dev', emoji: '💠', name: 'Godot 着色器开发者', nameEn: 'Godot Shader Developer', desc: 'Godot 着色语言、VisualShader', expertise: 'Godot Shader Language、VisualShader 编辑器', whenToUse: 'Godot 着色器与视觉效果开发时' },
  // Blender
  { id: 'game-blender', cat: 'game-dev', emoji: '🟠', name: 'Blender 插件工程师', nameEn: 'Blender Addon Engineer', desc: 'Blender Python (bpy) 与自定义操作', expertise: 'Blender bpy API、自定义操作器、管线工具', whenToUse: 'Blender 插件开发、自动化管线时' },
  // Roblox
  { id: 'game-roblox-script', cat: 'game-dev', emoji: '🟩', name: 'Roblox 系统脚本师', nameEn: 'Roblox Systems Scripter', desc: 'Luau、RemoteEvents、DataStore', expertise: 'Luau 编程、RemoteEvents、DataStore', whenToUse: 'Roblox 游戏脚本开发时' },
  { id: 'game-roblox-exp', cat: 'game-dev', emoji: '🎪', name: 'Roblox 体验设计师', nameEn: 'Roblox Experience Designer', desc: '参与循环、变现与留存', expertise: 'Roblox 经济系统、参与循环、变现策略', whenToUse: 'Roblox 体验设计、变现优化时' },
  { id: 'game-roblox-avatar', cat: 'game-dev', emoji: '👤', name: 'Roblox 虚拟形象师', nameEn: 'Roblox Avatar Creator', desc: 'UGC 管线与配饰绑定', expertise: 'Roblox UGC、配饰建模、虚拟形象管线', whenToUse: 'Roblox 虚拟形象/UGC 创作时' },

  // ── Marketing ──
  { id: 'mkt-agentic-seo', cat: 'marketing', emoji: '🤖', name: 'AI 搜索优化师', nameEn: 'Agentic Search Optimizer', desc: 'AI 搜索引擎优化', expertise: 'AI 搜索排名、RAG 引用优化、答案引擎', whenToUse: '优化内容在 AI 搜索中的可见性时' },
  { id: 'mkt-citation', cat: 'marketing', emoji: '📌', name: 'AI 引用策略师', nameEn: 'AI Citation Strategist', desc: 'AEO/GEO 与 AI 推荐可见性', expertise: 'AEO、GEO、AI 推荐算法、品牌可见性', whenToUse: '提升品牌在 AI 推荐中的曝光时' },
  { id: 'mkt-aso', cat: 'marketing', emoji: '📲', name: '应用商店优化师', nameEn: 'App Store Optimizer', desc: 'ASO 与转化优化', expertise: 'ASO、关键词优化、截图/描述 A/B 测试', whenToUse: 'App 上架优化、提升下载转化时' },
  { id: 'mkt-baidu', cat: 'marketing', emoji: '🔍', name: '百度 SEO 专家', nameEn: 'Baidu SEO Specialist', desc: '百度优化与中国搜索市场', expertise: '百度收录、ICP 备案、中文 SEO、百度指数', whenToUse: '中国市场搜索引擎优化时' },
  { id: 'mkt-bilibili', cat: 'marketing', emoji: '📺', name: 'B站内容策略师', nameEn: 'Bilibili Content Strategist', desc: 'B站算法与弹幕文化', expertise: 'B站推荐算法、弹幕互动、UP 主运营', whenToUse: 'B站内容运营、UP 主增长时' },
  { id: 'mkt-book', cat: 'marketing', emoji: '📕', name: '书籍合著者', nameEn: 'Book Co-Author', desc: '思想领导力书籍与代笔', expertise: '图书策划、章节结构、代笔写作', whenToUse: '出版书籍、建立思想领导力时' },
  { id: 'mkt-carousel', cat: 'marketing', emoji: '🎠', name: '轮播增长引擎', nameEn: 'Carousel Growth Engine', desc: 'TikTok/Instagram 轮播内容', expertise: '轮播内容设计、病毒传播机制、视觉叙事', whenToUse: '制作高传播率的轮播内容时' },
  { id: 'mkt-china-ecom', cat: 'marketing', emoji: '🛒', name: '中国电商运营师', nameEn: 'China E-Commerce Operator', desc: '淘宝、天猫、拼多多、直播电商', expertise: '淘系/拼多多运营、直播带货、店铺优化', whenToUse: '国内电商平台运营、直播电商时' },
  { id: 'mkt-china-local', cat: 'marketing', emoji: '🇨🇳', name: '中国市场本地化师', nameEn: 'China Market Localization Strategist', desc: '全栈中国市场本地化', expertise: '中国市场进入策略、本地化、合规、渠道', whenToUse: '品牌进入中国市场、本地化时' },
  { id: 'mkt-content', cat: 'marketing', emoji: '✏️', name: '内容创作者', nameEn: 'Content Creator', desc: '多平台内容与编辑日历', expertise: '内容策略、编辑日历、多平台分发', whenToUse: '内容规划、多平台内容运营时' },
  { id: 'mkt-cross-ecom', cat: 'marketing', emoji: '🌏', name: '跨境电商专家', nameEn: 'Cross-Border E-Commerce Specialist', desc: 'Amazon/Shopee/Lazada 与跨境履约', expertise: '亚马逊/Shopee/Lazada、FBA、跨境物流', whenToUse: '跨境电商运营、海外仓布局时' },
  { id: 'mkt-douyin', cat: 'marketing', emoji: '🎵', name: '抖音策略师', nameEn: 'Douyin Strategist', desc: '抖音平台与短视频营销', expertise: '抖音算法、短视频内容、抖店、DOU+', whenToUse: '抖音运营、短视频营销时' },
  { id: 'mkt-growth', cat: 'marketing', emoji: '🚀', name: '增长黑客', nameEn: 'Growth Hacker', desc: '快速用户获取与病毒循环', expertise: '增长实验、病毒传播、转化漏斗、留存', whenToUse: '快速增长、用户获取优化时' },
  { id: 'mkt-instagram', cat: 'marketing', emoji: '📸', name: 'Instagram 策展人', nameEn: 'Instagram Curator', desc: '视觉叙事与社区建设', expertise: 'Instagram 算法、视觉品牌、Reels、Stories', whenToUse: 'Instagram 品牌运营、社区建设时' },
  { id: 'mkt-kuaishou', cat: 'marketing', emoji: '⚡', name: '快手策略师', nameEn: 'Kuaishou Strategist', desc: '快手老铁社区与草根增长', expertise: '快手算法、老铁文化、私域、直播', whenToUse: '快手运营、下沉市场营销时' },
  { id: 'mkt-linkedin', cat: 'marketing', emoji: '💼', name: 'LinkedIn 内容创作者', nameEn: 'LinkedIn Content Creator', desc: '个人品牌与思想领导力', expertise: 'LinkedIn 算法、个人品牌、B2B 内容', whenToUse: '职业品牌建设、B2B 营销时' },
  { id: 'mkt-livestream', cat: 'marketing', emoji: '🎙️', name: '直播电商教练', nameEn: 'Livestream Commerce Coach', desc: '主播培训与直播间优化', expertise: '直播话术、选品排品、直播间数据优化', whenToUse: '直播带货培训、直播间运营时' },
  { id: 'mkt-podcast', cat: 'marketing', emoji: '🎧', name: '播客策略师', nameEn: 'Podcast Strategist', desc: '播客内容策略与平台优化', expertise: '播客内容策划、分发策略、听众增长', whenToUse: '播客节目策划、增长运营时' },
  { id: 'mkt-private', cat: 'marketing', emoji: '🔐', name: '私域运营师', nameEn: 'Private Domain Operator', desc: '企微、私域流量与社群运营', expertise: '企业微信、社群裂变、用户分层、复购', whenToUse: '私域流量搭建、社群精细化运营时' },
  { id: 'mkt-reddit', cat: 'marketing', emoji: '🟧', name: 'Reddit 社区建设者', nameEn: 'Reddit Community Builder', desc: '真实社区参与与价值驱动内容', expertise: 'Reddit 规则、Karma 增长、子版块运营', whenToUse: 'Reddit 社区运营、品牌推广时' },
  { id: 'mkt-seo', cat: 'marketing', emoji: '🔎', name: 'SEO 专家', nameEn: 'SEO Specialist', desc: '技术 SEO、内容策略与链接建设', expertise: '技术 SEO、内容优化、外链建设、Core Web Vitals', whenToUse: '网站 SEO 优化、搜索排名提升时' },
  { id: 'mkt-video-edit', cat: 'marketing', emoji: '🎬', name: '短视频剪辑教练', nameEn: 'Short-Video Editing Coach', desc: '后期制作与剪辑工作流', expertise: '短视频剪辑、节奏把控、字幕/特效', whenToUse: '短视频后期制作、剪辑技巧指导时' },
  { id: 'mkt-social', cat: 'marketing', emoji: '📱', name: '社交媒体策略师', nameEn: 'Social Media Strategist', desc: '跨平台策略与活动', expertise: '多平台运营、活动策划、社媒矩阵', whenToUse: '社交媒体整体策略制定时' },
  { id: 'mkt-tiktok', cat: 'marketing', emoji: '🎶', name: 'TikTok 策略师', nameEn: 'TikTok Strategist', desc: '病毒内容与算法优化', expertise: 'TikTok 算法、创作者经济、TikTok Shop', whenToUse: 'TikTok 运营、海外短视频营销时' },
  { id: 'mkt-twitter', cat: 'marketing', emoji: '🐦', name: 'Twitter/X 互动专家', nameEn: 'Twitter Engager', desc: '实时互动与思想领导力', expertise: 'Twitter/X 算法、互动策略、热点借势', whenToUse: 'Twitter/X 品牌运营、热点营销时' },
  { id: 'mkt-video-optim', cat: 'marketing', emoji: '▶️', name: '视频优化专家', nameEn: 'Video Optimization Specialist', desc: 'YouTube 算法、章节与缩略图', expertise: 'YouTube SEO、缩略图优化、长视频策略', whenToUse: 'YouTube 频道运营、视频 SEO 时' },
  { id: 'mkt-wechat', cat: 'marketing', emoji: '💬', name: '公众号运营师', nameEn: 'WeChat Official Account Manager', desc: '订阅者互动与内容营销', expertise: '公众号运营、图文排版、粉丝增长', whenToUse: '微信公众号运营、内容营销时' },
  { id: 'mkt-weibo', cat: 'marketing', emoji: '🌟', name: '微博策略师', nameEn: 'Weibo Strategist', desc: '新浪微博热搜与粉丝互动', expertise: '微博运营、热搜借势、粉丝互动、KOL 合作', whenToUse: '微博品牌运营、热点营销时' },
  { id: 'mkt-xiaohongshu', cat: 'marketing', emoji: '📕', name: '小红书运营专家', nameEn: 'Xiaohongshu Specialist', desc: '小红书生活方式内容与趋势', expertise: '小红书算法、种草笔记、达人合作', whenToUse: '小红书品牌种草、内容运营时' },
  { id: 'mkt-zhihu', cat: 'marketing', emoji: '💡', name: '知乎策略师', nameEn: 'Zhihu Strategist', desc: '知乎思想领导力与知识驱动', expertise: '知乎运营、高赞回答、盐选专栏', whenToUse: '知乎内容运营、知识营销时' },

  // ── Paid Media ──
  { id: 'pm-auditor', cat: 'paid-media', emoji: '🔍', name: '付费媒体审计师', nameEn: 'Paid Media Auditor', desc: '200+ 项账户审计与竞争分析', expertise: '广告账户审计、竞品分析、预算优化', whenToUse: '广告账户诊断、竞争分析时' },
  { id: 'pm-creative', cat: 'paid-media', emoji: '🎨', name: '广告创意策略师', nameEn: 'Ad Creative Strategist', desc: 'RSA 文案与 Meta 创意', expertise: '广告文案、创意测试、素材优化', whenToUse: '广告创意策划、文案优化时' },
  { id: 'pm-social', cat: 'paid-media', emoji: '📣', name: '付费社交策略师', nameEn: 'Paid Social Strategist', desc: 'Meta/LinkedIn/TikTok 社交广告', expertise: 'Meta Ads、LinkedIn Ads、TikTok Ads', whenToUse: '社交媒体广告投放策略制定时' },
  { id: 'pm-ppc', cat: 'paid-media', emoji: '💹', name: 'PPC 竞价策略师', nameEn: 'PPC Campaign Strategist', desc: 'Google/Microsoft/Amazon 广告', expertise: 'Google Ads、微软广告、亚马逊广告', whenToUse: '搜索广告投放、竞价策略优化时' },
  { id: 'pm-programmatic', cat: 'paid-media', emoji: '🖥️', name: '程序化购买师', nameEn: 'Programmatic & Display Buyer', desc: 'GDN、DSP 与 ABM 展示广告', expertise: '程序化购买、DSP、GDN、ABM 策略', whenToUse: '展示广告投放、程序化购买时' },
  { id: 'pm-query', cat: 'paid-media', emoji: '🔤', name: '搜索词分析师', nameEn: 'Search Query Analyst', desc: '搜索词分析与否定关键词', expertise: '搜索词报告、否定词管理、意图分类', whenToUse: '搜索广告关键词优化时' },
  { id: 'pm-tracking', cat: 'paid-media', emoji: '📏', name: '追踪归因专家', nameEn: 'Tracking & Measurement Specialist', desc: 'GTM、GA4 与转化跟踪', expertise: 'GTM、GA4、转化跟踪、归因模型', whenToUse: '广告效果追踪、归因分析时' },

  // ── Product ──
  { id: 'prod-nudge', cat: 'product', emoji: '🧲', name: '行为助推引擎', nameEn: 'Behavioral Nudge Engine', desc: '行为心理学与助推设计', expertise: '行为经济学、助推理论、默认值设计', whenToUse: '提升用户参与度、引导行为决策时' },
  { id: 'prod-feedback', cat: 'product', emoji: '📥', name: '反馈综合师', nameEn: 'Feedback Synthesizer', desc: '用户反馈分析与洞察提取', expertise: '反馈分类、情感分析、需求提炼', whenToUse: '大量用户反馈整理、洞察提取时' },
  { id: 'prod-pm', cat: 'product', emoji: '🎯', name: '产品经理', nameEn: 'Product Manager', desc: '全生命周期产品管理', expertise: 'PRD、需求管理、路线图、跨团队协调', whenToUse: '产品规划、需求梳理、优先级决策时' },
  { id: 'prod-sprint', cat: 'product', emoji: '🏃', name: 'Sprint 优先级师', nameEn: 'Sprint Prioritizer', desc: '敏捷规划与功能优先级排序', expertise: 'RICE/ICE 评分、Sprint 规划、Backlog 管理', whenToUse: 'Sprint 规划、需求排期、优先级排序时' },
  { id: 'prod-trend', cat: 'product', emoji: '📡', name: '趋势研究员', nameEn: 'Trend Researcher', desc: '市场情报与竞争分析', expertise: '市场趋势、竞品分析、行业洞察', whenToUse: '市场调研、竞品分析、行业趋势研究时' },

  // ── Project Management ──
  { id: 'pjm-experiment', cat: 'project-mgmt', emoji: '🧪', name: '实验追踪师', nameEn: 'Experiment Tracker', desc: 'A/B 测试与假设验证', expertise: 'A/B 测试、假设验证、实验文档', whenToUse: '实验管理、A/B 测试分析时' },
  { id: 'pjm-jira', cat: 'project-mgmt', emoji: '📋', name: 'Jira 工作流管家', nameEn: 'Jira Workflow Steward', desc: 'Git 工作流、分支策略与可追溯性', expertise: 'Jira 工作流、Git 集成、可追溯性', whenToUse: 'Jira 流程优化、工作流设计时' },
  { id: 'pjm-shepherd', cat: 'project-mgmt', emoji: '🐑', name: '项目牧羊人', nameEn: 'Project Shepherd', desc: '跨职能协调与时间线管理', expertise: '跨团队协调、时间线管理、风险识别', whenToUse: '跨团队项目协调、进度管理时' },
  { id: 'pjm-ops', cat: 'project-mgmt', emoji: '⚙️', name: '工作室运营', nameEn: 'Studio Operations', desc: '日常效率与流程优化', expertise: '流程优化、工具选型、日常效率', whenToUse: '团队效率提升、流程标准化时' },
  { id: 'pjm-producer', cat: 'project-mgmt', emoji: '🎬', name: '工作室制片人', nameEn: 'Studio Producer', desc: '高层编排与投资组合管理', expertise: '项目组合管理、资源分配、里程碑', whenToUse: '多项目管理、资源调配时' },
  { id: 'pjm-senior', cat: 'project-mgmt', emoji: '📊', name: '高级项目经理', nameEn: 'Senior Project Manager', desc: '现实范围界定与任务转换', expertise: '范围管理、风险评估、干系人管理', whenToUse: '项目范围评估、风险管理时' },

  // ── Sales ──
  { id: 'sales-account', cat: 'sales', emoji: '🏢', name: '客户策略师', nameEn: 'Account Strategist', desc: '落地扩展、QBR 与干系人映射', expertise: '大客户管理、QBR、扩展策略', whenToUse: '大客户关系管理、账户扩展时' },
  { id: 'sales-coach', cat: 'sales', emoji: '🏅', name: '销售教练', nameEn: 'Sales Coach', desc: '销售代表发展与通话辅导', expertise: '通话复盘、话术优化、技能提升', whenToUse: '销售团队培训、通话质量提升时' },
  { id: 'sales-deal', cat: 'sales', emoji: '🎯', name: '交易策略师', nameEn: 'Deal Strategist', desc: 'MEDDPICC 资格审查与竞争定位', expertise: 'MEDDPICC、竞争分析、交易推进', whenToUse: '复杂交易策略制定、竞争应对时' },
  { id: 'sales-discovery', cat: 'sales', emoji: '🔍', name: '需求挖掘教练', nameEn: 'Discovery Coach', desc: 'SPIN、Gap Selling、Sandler', expertise: 'SPIN/Gap/Sandler 方法论、需求挖掘', whenToUse: '销售需求挖掘、提问技巧训练时' },
  { id: 'sales-engineer', cat: 'sales', emoji: '🔧', name: '售前工程师', nameEn: 'Sales Engineer', desc: '技术演示与 POC 范围界定', expertise: '技术方案演示、POC、技术异议处理', whenToUse: '技术售前、POC 规划、方案演示时' },
  { id: 'sales-outbound', cat: 'sales', emoji: '📞', name: '外呼策略师', nameEn: 'Outbound Strategist', desc: '基于信号的客户开发', expertise: '信号驱动开发、序列设计、多渠道触达', whenToUse: '外呼策略设计、客户开发时' },
  { id: 'sales-pipeline', cat: 'sales', emoji: '📊', name: '管道分析师', nameEn: 'Pipeline Analyst', desc: '预测、管道健康与交易速度', expertise: '管道分析、预测模型、转化率优化', whenToUse: '销售预测、管道健康评估时' },
  { id: 'sales-proposal', cat: 'sales', emoji: '📄', name: '提案策略师', nameEn: 'Proposal Strategist', desc: 'RFP 响应与赢面主题', expertise: 'RFP/RFI 响应、提案写作、差异化定位', whenToUse: '撰写投标方案、RFP 响应时' },
  { id: 'sales-outreach', cat: 'sales', emoji: '✉️', name: '销售外联专家', nameEn: 'Sales Outreach', desc: '冷开发、多触点节奏与异议处理', expertise: '冷邮件/冷电话、序列设计、异议处理', whenToUse: '冷启动客户开发、外联策略时' },

  // ── Spatial Computing ──
  { id: 'sp-macos-metal', cat: 'spatial', emoji: '🖥️', name: 'macOS Metal 工程师', nameEn: 'macOS Spatial/Metal Engineer', desc: 'Swift、Metal 与高性能 3D', expertise: 'Swift、Metal API、高性能渲染', whenToUse: 'macOS 原生 3D/GPU 编程时' },
  { id: 'sp-terminal', cat: 'spatial', emoji: '⌨️', name: '终端集成专家', nameEn: 'Terminal Integration Specialist', desc: '终端集成与命令行工具', expertise: '终端 UI、CLI 工具、TUI 框架', whenToUse: '命令行工具开发、终端集成时' },
  { id: 'sp-visionos', cat: 'spatial', emoji: '🍎', name: 'visionOS 空间工程师', nameEn: 'visionOS Spatial Engineer', desc: 'Apple Vision Pro 开发', expertise: 'visionOS、RealityKit、SwiftUI 空间', whenToUse: 'Vision Pro 应用开发时' },
  { id: 'sp-xr-cockpit', cat: 'spatial', emoji: '🛩️', name: 'XR 座舱交互专家', nameEn: 'XR Cockpit Interaction Specialist', desc: '驾驶舱控制与沉浸式系统', expertise: '座舱 HMI、手势交互、空间控件', whenToUse: 'XR 座舱/工业控制界面设计时' },
  { id: 'sp-xr-web', cat: 'spatial', emoji: '🌐', name: 'XR 沉浸式开发者', nameEn: 'XR Immersive Developer', desc: 'WebXR 与浏览器 AR/VR', expertise: 'WebXR、Three.js、A-Frame、浏览器 XR', whenToUse: 'Web 端 AR/VR 开发时' },
  { id: 'sp-xr-arch', cat: 'spatial', emoji: '🏗️', name: 'XR 交互架构师', nameEn: 'XR Interface Architect', desc: '空间交互设计与沉浸式 UX', expertise: '空间 UI 设计、手势语言、沉浸式体验', whenToUse: 'XR 交互架构设计、空间 UX 时' },

  // ── Specialized ──
  { id: 'spec-ap', cat: 'specialized', emoji: '💳', name: '应付账款代理', nameEn: 'Accounts Payable Agent', desc: '支付处理与供应商管理', expertise: '应付流程、供应商对账、支付合规', whenToUse: '应付款管理、供应商对账时' },
  { id: 'spec-identity-trust', cat: 'specialized', emoji: '🔐', name: 'Agent 身份信任架构师', nameEn: 'Agentic Identity & Trust Architect', desc: 'Agent 身份认证与信任验证', expertise: 'Agent 身份管理、OAuth、信任链', whenToUse: '多 Agent 系统身份与权限设计时' },
  { id: 'spec-orchestrator', cat: 'specialized', emoji: '🎼', name: 'Agent 编排师', nameEn: 'Agents Orchestrator', desc: '多 Agent 协调与工作流管理', expertise: '多 Agent 编排、工作流设计、状态管理', whenToUse: '多 Agent 系统设计与编排时' },
  { id: 'spec-auto-gov', cat: 'specialized', emoji: '📜', name: '自动化治理架构师', nameEn: 'Automation Governance Architect', desc: '自动化治理、n8n 与工作流审计', expertise: 'n8n/Zapier 治理、工作流审计、权限控制', whenToUse: '自动化流程治理、安全审计时' },
  { id: 'spec-blockchain-audit', cat: 'specialized', emoji: '🔗', name: '区块链安全审计师', nameEn: 'Blockchain Security Auditor', desc: '智能合约审计与漏洞分析', expertise: '合约审计、漏洞扫描、形式化验证', whenToUse: '智能合约安全审计时' },
  { id: 'spec-compliance', cat: 'specialized', emoji: '✅', name: '合规审计师', nameEn: 'Compliance Auditor', desc: 'SOC 2、ISO 27001、HIPAA、PCI-DSS', expertise: '合规框架、审计准备、差距分析', whenToUse: '合规审计准备、差距评估时' },
  { id: 'spec-training', cat: 'specialized', emoji: '🎓', name: '企业培训设计师', nameEn: 'Corporate Training Designer', desc: '企业培训与课程开发', expertise: '教学设计、培训课程、混合学习', whenToUse: '企业培训课程设计、学习方案时' },
  { id: 'spec-cs', cat: 'specialized', emoji: '🎧', name: '客服代表', nameEn: 'Customer Service', desc: '全渠道支持、投诉处理与留存', expertise: '客服话术、投诉处理、客户留存', whenToUse: '客服流程设计、投诉应对策略时' },
  { id: 'spec-data-consol', cat: 'specialized', emoji: '📊', name: '数据整合代理', nameEn: 'Data Consolidation Agent', desc: '销售数据聚合与仪表板报告', expertise: '数据聚合、仪表板设计、自动报告', whenToUse: '数据整合、自动化报告生成时' },
  { id: 'spec-gov-presales', cat: 'specialized', emoji: '🏛️', name: '政府数字化售前顾问', nameEn: 'Government Digital Presales Consultant', desc: '中国 ToG 售前与数字化转型', expertise: '政务数字化、ToG 方案、招投标', whenToUse: '政府项目售前、数字化方案编写时' },
  { id: 'spec-healthcare-cs', cat: 'specialized', emoji: '🏥', name: '医疗客服', nameEn: 'Healthcare Customer Service', desc: 'HIPAA 合规患者支持', expertise: 'HIPAA 合规、患者沟通、医疗术语', whenToUse: '医疗机构客服流程设计时' },
  { id: 'spec-healthcare-mkt', cat: 'specialized', emoji: '⚕️', name: '医疗营销合规', nameEn: 'Healthcare Marketing Compliance', desc: '中国医疗广告合规', expertise: '医疗广告法、审查标准、合规策略', whenToUse: '医疗广告审查、合规营销时' },
  { id: 'spec-hospitality', cat: 'specialized', emoji: '🏨', name: '酒店宾客服务', nameEn: 'Hospitality Guest Services', desc: '预订、礼宾与投诉恢复', expertise: '酒店运营、礼宾服务、服务恢复', whenToUse: '酒店服务流程设计、服务培训时' },
  { id: 'spec-hr', cat: 'specialized', emoji: '👥', name: 'HR 入职专家', nameEn: 'HR Onboarding', desc: '入职准备、合规与福利注册', expertise: '入职流程、劳动合规、新员工体验', whenToUse: '新员工入职流程设计、HR 合规时' },
  { id: 'spec-id-graph', cat: 'specialized', emoji: '🕸️', name: '身份图谱运营', nameEn: 'Identity Graph Operator', desc: '多 Agent 系统共享身份解析', expertise: '身份解析、实体关联、图谱构建', whenToUse: '多系统身份统一、用户画像整合时' },
  { id: 'spec-translator', cat: 'specialized', emoji: '🌐', name: '语言翻译师', nameEn: 'Language Translator', desc: '西英翻译与方言感知', expertise: '西班牙语/英语翻译、方言处理、本地化', whenToUse: '西语/英语翻译、本地化需求时' },
  { id: 'spec-legal-billing', cat: 'specialized', emoji: '⏱️', name: '法律计费专家', nameEn: 'Legal Billing & Time Tracking', desc: '时间捕获与 IOLTA 合规', expertise: '律所计费、时间追踪、IOLTA 合规', whenToUse: '律所计费系统设计、合规时' },
  { id: 'spec-legal-intake', cat: 'specialized', emoji: '📝', name: '法律接案专家', nameEn: 'Legal Client Intake', desc: '潜客资格审查与冲突筛查', expertise: '客户资格审查、冲突检查、接案流程', whenToUse: '律所接案流程设计、客户筛查时' },
  { id: 'spec-legal-review', cat: 'specialized', emoji: '📋', name: '法律文件审查', nameEn: 'Legal Document Review', desc: '合同审查与风险标记', expertise: '合同审查、条款分析、风险评估', whenToUse: '合同审查、法律文件分析时' },
  { id: 'spec-loan', cat: 'specialized', emoji: '🏦', name: '贷款助理', nameEn: 'Loan Officer Assistant', desc: '借款人接待与 TRID 合规', expertise: '贷款流程、TRID 合规、资格评估', whenToUse: '贷款审批流程设计、合规时' },
  { id: 'spec-lsp', cat: 'specialized', emoji: '🔌', name: 'LSP 索引工程师', nameEn: 'LSP/Index Engineer', desc: '语言服务器协议与代码智能', expertise: 'LSP 实现、代码索引、智能补全', whenToUse: '开发 IDE 插件、代码智能功能时' },
  { id: 'spec-real-estate', cat: 'specialized', emoji: '🏠', name: '房产经纪', nameEn: 'Real Estate Buyer & Seller', desc: '买卖方代理与交易协调', expertise: '房产交易、市场分析、谈判策略', whenToUse: '房产交易咨询、市场分析时' },
  { id: 'spec-recruit', cat: 'specialized', emoji: '🎯', name: '招聘专家', nameEn: 'Recruitment Specialist', desc: '人才获取与招聘运营', expertise: '简历筛选、面试设计、招聘漏斗', whenToUse: '招聘流程设计、人才获取策略时' },
  { id: 'spec-report-dist', cat: 'specialized', emoji: '📤', name: '报告分发代理', nameEn: 'Report Distribution Agent', desc: '自动报告分发', expertise: '报告自动化、分发规则、模板管理', whenToUse: '自动化报告分发流程设计时' },
  { id: 'spec-returns', cat: 'specialized', emoji: '🔄', name: '零售退货处理', nameEn: 'Retail Customer Returns', desc: '退货处理与欺诈防范', expertise: '退货流程、欺诈检测、客户体验', whenToUse: '退货流程设计、欺诈防范时' },
  { id: 'spec-sales-data', cat: 'specialized', emoji: '📈', name: '销售数据提取', nameEn: 'Sales Data Extraction Agent', desc: 'Excel 监控与销售指标提取', expertise: 'Excel/CSV 解析、指标提取、数据标准化', whenToUse: '销售数据自动提取、指标汇总时' },
  { id: 'spec-cos', cat: 'specialized', emoji: '🎩', name: '幕僚长', nameEn: 'Chief of Staff', desc: '创始人/高管协调与流程管理', expertise: '高管支持、跨部门协调、OKR 推进', whenToUse: '高管助理事务、跨部门协调时' },
  { id: 'spec-civil', cat: 'specialized', emoji: '🏗️', name: '土木工程师', nameEn: 'Civil Engineer', desc: '结构分析与岩土设计', expertise: '结构力学、岩土工程、基础设计', whenToUse: '土木/结构工程计算、方案评审时' },
  { id: 'spec-cultural', cat: 'specialized', emoji: '🌍', name: '文化智能策略师', nameEn: 'Cultural Intelligence Strategist', desc: '全球 UX 与文化代表性', expertise: '跨文化设计、本地化策略、文化敏感度', whenToUse: '全球化产品设计、文化适配时' },
  { id: 'spec-devrel', cat: 'specialized', emoji: '💬', name: '开发者布道师', nameEn: 'Developer Advocate', desc: '社区建设与开发者体验', expertise: '开发者社区、技术内容、DevRel 策略', whenToUse: '开发者关系建设、技术社区运营时' },
  { id: 'spec-docgen', cat: 'specialized', emoji: '📄', name: '文档生成器', nameEn: 'Document Generator', desc: 'PDF/PPTX/DOCX/XLSX 生成', expertise: '文档模板、自动生成、格式转换', whenToUse: '批量文档生成、模板设计时' },
  { id: 'spec-french', cat: 'specialized', emoji: '🇫🇷', name: '法国咨询市场导航', nameEn: 'French Consulting Market Navigator', desc: '法国 IT 自由咨询市场', expertise: '法国 IT 市场、自由职业、TJM 定价', whenToUse: '法国 IT 咨询市场进入策略时' },
  { id: 'spec-korean', cat: 'specialized', emoji: '🇰🇷', name: '韩国商务导航', nameEn: 'Korean Business Navigator', desc: '韩国商业文化与品议流程', expertise: '韩国商务礼仪、品议体系、财阀文化', whenToUse: '韩国市场商务合作、文化理解时' },
  { id: 'spec-mcp', cat: 'specialized', emoji: '🔧', name: 'MCP 构建师', nameEn: 'MCP Builder', desc: 'Model Context Protocol 服务器', expertise: 'MCP 协议、工具服务器、LLM 集成', whenToUse: '构建 MCP 服务器、扩展 LLM 工具时' },
  { id: 'spec-model-qa', cat: 'specialized', emoji: '🔬', name: '模型 QA 专家', nameEn: 'Model QA Specialist', desc: 'ML 审计、特征分析与可解释性', expertise: 'ML 质量审计、偏差检测、可解释性', whenToUse: 'ML 模型质量评估、偏差审计时' },
  { id: 'spec-salesforce', cat: 'specialized', emoji: '☁️', name: 'Salesforce 架构师', nameEn: 'Salesforce Architect', desc: '多云 Salesforce 设计', expertise: 'Salesforce 多云架构、Apex、集成设计', whenToUse: 'Salesforce 架构设计、多云集成时' },
  { id: 'spec-workflow', cat: 'specialized', emoji: '🔀', name: '工作流架构师', nameEn: 'Workflow Architect', desc: '工作流发现、映射与规范', expertise: '流程建模、BPMN、工作流优化', whenToUse: '业务流程梳理、自动化工作流设计时' },
  { id: 'spec-study-abroad', cat: 'specialized', emoji: '✈️', name: '留学顾问', nameEn: 'Study Abroad Advisor', desc: '国际教育与申请规划', expertise: '留学申请、选校策略、文书辅导', whenToUse: '留学规划、选校咨询、申请指导时' },
  { id: 'spec-supply-chain', cat: 'specialized', emoji: '🚚', name: '供应链策略师', nameEn: 'Supply Chain Strategist', desc: '供应链管理与采购策略', expertise: '供应链优化、采购策略、库存管理', whenToUse: '供应链规划、采购策略制定时' },
  { id: 'spec-zk', cat: 'specialized', emoji: '🗂️', name: '知识管理师', nameEn: 'ZK Steward', desc: '知识管理与 Zettelkasten', expertise: 'Zettelkasten、知识图谱、笔记系统', whenToUse: '知识管理体系搭建、笔记方法论时' },

  // ── Support ──
  { id: 'sup-analytics', cat: 'support', emoji: '📊', name: '分析报告师', nameEn: 'Analytics Reporter', desc: '数据分析、仪表板与洞察', expertise: '数据可视化、仪表板设计、业务洞察', whenToUse: '数据报告编制、业务分析时' },
  { id: 'sup-exec-summary', cat: 'support', emoji: '📝', name: '高管摘要生成器', nameEn: 'Executive Summary Generator', desc: 'C-suite 沟通与战略摘要', expertise: '高管汇报、战略摘要、关键指标提炼', whenToUse: '向高管汇报、编写战略摘要时' },
  { id: 'sup-finance', cat: 'support', emoji: '💰', name: '财务追踪师', nameEn: 'Finance Tracker', desc: '财务规划与预算管理', expertise: '预算跟踪、支出分析、财务报告', whenToUse: '日常财务跟踪、预算管理时' },
  { id: 'sup-infra', cat: 'support', emoji: '🖥️', name: '基础设施维护师', nameEn: 'Infrastructure Maintainer', desc: '系统可靠性与性能优化', expertise: '服务器运维、性能调优、容量管理', whenToUse: '基础设施运维、系统优化时' },
  { id: 'sup-legal', cat: 'support', emoji: '⚖️', name: '法律合规检查', nameEn: 'Legal Compliance Checker', desc: '合规、法规与法律审查', expertise: '合规检查、法规解读、风险预警', whenToUse: '日常合规检查、法规咨询时' },
  { id: 'sup-responder', cat: 'support', emoji: '🆘', name: '支持响应员', nameEn: 'Support Responder', desc: '客户服务与问题解决', expertise: '工单处理、问题诊断、客户沟通', whenToUse: '客户支持流程设计、问题排查时' },

  // ── Testing ──
  { id: 'test-a11y', cat: 'testing', emoji: '♿', name: '无障碍审计师', nameEn: 'Accessibility Auditor', desc: 'WCAG 审计与辅助技术测试', expertise: 'WCAG 标准、屏幕阅读器测试、键盘导航', whenToUse: '无障碍合规审计、可访问性优化时' },
  { id: 'test-api', cat: 'testing', emoji: '🔌', name: 'API 测试师', nameEn: 'API Tester', desc: 'API 验证与集成测试', expertise: 'API 测试、契约测试、自动化测试脚本', whenToUse: 'API 接口测试、集成验证时' },
  { id: 'test-evidence', cat: 'testing', emoji: '📸', name: '证据收集师', nameEn: 'Evidence Collector', desc: '截图 QA 与视觉证据', expertise: '截图对比、视觉回归、证据归档', whenToUse: '视觉 QA、测试证据收集时' },
  { id: 'test-perf', cat: 'testing', emoji: '⚡', name: '性能基准师', nameEn: 'Performance Benchmarker', desc: '性能测试与优化', expertise: '负载测试、性能基准、瓶颈分析', whenToUse: '性能测试、基准评估、瓶颈定位时' },
  { id: 'test-reality', cat: 'testing', emoji: '🎯', name: '现实核查员', nameEn: 'Reality Checker', desc: '基于证据的认证与质量门控', expertise: '质量门控、事实核查、假设验证', whenToUse: '质量把关、假设验证、事实核查时' },
  { id: 'test-results', cat: 'testing', emoji: '📋', name: '测试结果分析师', nameEn: 'Test Results Analyzer', desc: '测试评估与指标分析', expertise: '测试报告分析、通过率趋势、缺陷分类', whenToUse: '测试结果解读、质量度量分析时' },
  { id: 'test-tool-eval', cat: 'testing', emoji: '🔍', name: '工具评估师', nameEn: 'Tool Evaluator', desc: '技术评估与工具选型', expertise: '工具对比、POC 评估、技术选型方法', whenToUse: '技术工具选型、评估对比时' },
  { id: 'test-workflow', cat: 'testing', emoji: '🔄', name: '工作流优化师', nameEn: 'Workflow Optimizer', desc: '流程分析与工作流改进', expertise: '流程瓶颈分析、自动化改进、效率提升', whenToUse: '测试流程优化、自动化改进时' },
]

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id)
}

export function agentsByCategory(catId: string): AgentDef[] {
  return AGENTS.filter((a) => a.cat === catId)
}

export function getCategory(catId: string): AgentCategory | undefined {
  return AGENT_CATEGORIES.find((c) => c.id === catId)
}
