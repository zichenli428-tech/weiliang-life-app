/**
 * 饮食记录类型定义
 * PRD 3.1：营养膳食分析 - AI 解析食材清单 + 本地知识库计算营养
 * PRD 3.4：健康记录（饮食/运动记录列表、手动/拍照录入）
 */

/** 餐次 */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** 记录来源（PRD 3.1 多模态输入） */
export type RecordSource = 'manual' | 'photo' | 'voice'

/** 单个食物（含营养值，由本地知识库计算） */
export interface DietFood {
  /** 食物名称 */
  name: string
  /** 重量（克） */
  amount: number
  /** 热量 (kcal) */
  calories: number
  /** 蛋白质 (g) */
  protein: number
  /** 脂肪 (g) */
  fat: number
  /** 碳水 (g) */
  carbs: number
}

/** 一条饮食记录 */
export interface DietRecord {
  /** 唯一 ID */
  id: string
  /** 日期 YYYY-MM-DD */
  date: string
  /** 时间 HH:mm */
  time: string
  /** 餐次 */
  mealType: MealType
  /** 食物清单 */
  foods: DietFood[]
  /** 总热量 (kcal) */
  totalCalories: number
  /** 总蛋白质 (g) */
  totalProtein: number
  /** 总脂肪 (g) */
  totalFat: number
  /** 总碳水 (g) */
  totalCarbs: number
  /** 来源 */
  source: RecordSource
  /** 备注 */
  note?: string
  /** 创建时间戳 */
  createdAt: number
}

/** 餐次标签映射 */
export const mealTypeLabels: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: '早餐', icon: '🌅' },
  lunch: { label: '午餐', icon: '☀️' },
  dinner: { label: '晚餐', icon: '🌙' },
  snack: { label: '加餐', icon: '🍎' }
}

/** 来源标签映射 */
export const sourceLabels: Record<RecordSource, string> = {
  manual: '手动',
  photo: '拍照',
  voice: '语音'
}

/** 生成记录 ID */
export function generateRecordId(): string {
  return `diet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取今日日期 YYYY-MM-DD */
export function getTodayDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 获取当前时间 HH:mm */
export function getNowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
