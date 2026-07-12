/**
 * 用户身体档案类型定义
 * PRD 3.4（我的页面）：身体档案、目标设定
 * PRD 7.1（新手引导）：首启快速建档流程（3 步内选完），让后续 AI 建议真正个性化
 */

/** 性别 */
export type Gender = 'male' | 'female'

/** 健康目标 */
export type HealthGoal = 'lose_fat' | 'gain_muscle' | 'maintain' | 'improve_sleep' | 'relieve_stress'

/** 活动水平 */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

/** 用户身体档案 */
export interface UserProfile {
  /** 昵称 */
  nickname: string
  /** 性别 */
  gender: Gender | null
  /** 年龄 */
  age: number | null
  /** 身高 (cm) */
  height: number | null
  /** 体重 (kg) */
  weight: number | null
  /** 活动水平 */
  activityLevel: ActivityLevel
  /** 健康目标 */
  goal: HealthGoal
  /** 目标体重 (kg) */
  targetWeight: number | null
  /** 建档时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}

/** 默认空档案（首启状态） */
export const createEmptyProfile = (): UserProfile => ({
  nickname: '',
  gender: null,
  age: null,
  height: null,
  weight: null,
  activityLevel: 'sedentary',
  goal: 'maintain',
  targetWeight: null,
  createdAt: 0,
  updatedAt: 0
})
