/**
 * AI 健康顾问对话类型定义
 * PRD 3.4：AI 健康顾问聊天界面 | 大模型流式对话
 * PRD 3.2：AI 健康顾问 - System Prompt 注入用户档案
 */

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 一条对话消息 */
export interface ChatMessage {
  /** 唯一 ID */
  id: string
  /** 角色 */
  role: MessageRole
  /** 文本内容 */
  content: string
  /** 创建时间戳 */
  createdAt: number
  /** 是否正在流式输出（仅 assistant 消息使用） */
  streaming?: boolean
}

/** 一轮对话会话 */
export interface ChatSession {
  /** 唯一 ID */
  id: string
  /** 会话标题（取首条用户消息前 20 字符） */
  title: string
  /** 消息列表 */
  messages: ChatMessage[]
  /** 创建时间戳 */
  createdAt: number
  /** 最近更新时间戳 */
  updatedAt: number
}

/** 预置快捷问题 */
export interface QuickQuestion {
  /** 问题文本 */
  text: string
  /** 图标 */
  icon: string
  /** 分类 */
  category: QuickQuestionCategory
}

/** 快捷问题分类 */
export type QuickQuestionCategory =
  | 'diet' // 饮食
  | 'exercise' // 运动
  | 'sleep' // 睡眠
  | 'mental' // 心理
  | 'general' // 综合

/** 生成消息 ID */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 生成会话 ID */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
