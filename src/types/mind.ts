/**
 * AI 心理疏导模块类型定义
 * PRD 3.3：心理疏导 - 情绪感知、共情式对话、危机干预、情绪日记
 */

/** 情绪类型（用于情绪感知与日记记录） */
export type EmotionType =
  | 'happy' // 开心
  | 'calm' // 平静
  | 'anxious' // 焦虑
  | 'sad' // 悲伤
  | 'angry' // 愤怒
  | 'stressed' // 压力大
  | 'tired' // 疲惫
  | 'lonely' // 孤独

/** 情绪标签信息 */
export interface EmotionInfo {
  type: EmotionType
  label: string
  icon: string
  color: string
}

/** 一条心理疏导对话消息 */
export interface MindMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  streaming?: boolean
  /** AI 感知到的用户情绪（仅 assistant 消息可选） */
  detectedEmotion?: EmotionType
}

/** 心理疏导会话 */
export interface MindSession {
  id: string
  title: string
  messages: MindMessage[]
  createdAt: number
  updatedAt: number
}

/** 情绪日记记录 */
export interface EmotionRecord {
  /** 日期 key：YYYY-MM-DD */
  date: string
  /** 情绪类型 */
  emotion: EmotionType
  /** 情绪强度 1-5 */
  score: number
  /** 可选备注 */
  note?: string
  /** 记录时间戳 */
  createdAt: number
}

/** 对话角色风格 */
export type MindRoleStyle =
  | 'warm_friend' // 温暖的朋友
  | 'professional' // 专业顾问
  | 'mindfulness' // 正念导师

/** 角色风格信息 */
export interface MindRoleInfo {
  key: MindRoleStyle
  label: string
  desc: string
  icon: string
}

/** 生成消息 ID */
export function generateMindMessageId(): string {
  return `mind_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 生成会话 ID */
export function generateMindSessionId(): string {
  return `mind_sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 情绪类型映射表 */
export const emotionMap: Record<EmotionType, EmotionInfo> = {
  happy: { type: 'happy', label: '开心', icon: '😊', color: '#f59e0b' },
  calm: { type: 'calm', label: '平静', icon: '😌', color: '#22c55e' },
  anxious: { type: 'anxious', label: '焦虑', icon: '😰', color: '#8b5cf6' },
  sad: { type: 'sad', label: '悲伤', icon: '😢', color: '#3b82f6' },
  angry: { type: 'angry', label: '愤怒', icon: '😤', color: '#ef4444' },
  stressed: { type: 'stressed', label: '压力大', icon: '😣', color: '#f97316' },
  tired: { type: 'tired', label: '疲惫', icon: '😴', color: '#64748b' },
  lonely: { type: 'lonely', label: '孤独', icon: '🥺', color: '#a855f7' }
}

/** 角色风格映射表 */
export const roleStyleMap: Record<MindRoleStyle, MindRoleInfo> = {
  warm_friend: { key: 'warm_friend', label: '温暖的朋友', desc: '亲切随和，像好友聊天', icon: '🤗' },
  professional: { key: 'professional', label: '专业顾问', desc: '理性专业，循证建议', icon: '🎯' },
  mindfulness: { key: 'mindfulness', label: '正念导师', desc: '引导觉察，专注当下', icon: '🧘' }
}

/**
 * PRD 3.3 危机干预：自杀/自残倾向关键词检测
 * 检测到时立即触发预警，提供心理热线
 */
export const CRISIS_KEYWORDS: string[] = [
  '不想活',
  '活不下去',
  '想死',
  '自杀',
  '自残',
  '伤害自己',
  '了结',
  '解脱',
  '跳楼',
  '割腕',
  '吃药了结',
  '没有意义',
  '活着没意思',
  '消失',
  '结束生命'
]

/** 情绪关键词映射（用于情绪感知） */
export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  happy: ['开心', '高兴', '快乐', '幸福', '满意', '棒', '好开心'],
  calm: ['平静', '放松', '安宁', '舒服', '安心'],
  anxious: ['焦虑', '紧张', '担心', '害怕', '恐惧', '不安', '心慌'],
  sad: ['难过', '悲伤', '伤心', '哭', '失落', '低落', '抑郁'],
  angry: ['生气', '愤怒', '恼火', '气愤', '烦', '讨厌', '恨'],
  stressed: ['压力大', '累', '崩溃', '撑不住', '喘不过气', '焦躁'],
  tired: ['疲惫', '困', '乏力', '没力气', '精疲力尽'],
  lonely: ['孤独', '寂寞', '一个人', '没人理', '被抛弃', '孤单']
}

/** 检测文本中是否包含危机关键词 */
export function detectCrisis(text: string): boolean {
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw))
}

/** 从文本中感知情绪 */
export function detectEmotion(text: string): EmotionType | null {
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return emotion as EmotionType
    }
  }
  return null
}
