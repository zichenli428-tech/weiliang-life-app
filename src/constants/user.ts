/**
 * 用户档案展示用标签映射
 * 供「我的」页面、建档页等共用
 */
import type { Gender, HealthGoal, ActivityLevel } from '@/types/user'

export const genderLabels: Record<Gender, string> = {
  male: '男',
  female: '女'
}

export const goalLabels: Record<HealthGoal, { label: string; icon: string; desc: string }> = {
  lose_fat: { label: '减脂塑形', icon: '🔥', desc: '减少体脂，线条更清晰' },
  gain_muscle: { label: '增肌增重', icon: '💪', desc: '增加肌肉，提升力量' },
  maintain: { label: '保持健康', icon: '⚖️', desc: '维持现状，均衡饮食' },
  improve_sleep: { label: '改善睡眠', icon: '🌙', desc: '提升睡眠质量' },
  relieve_stress: { label: '缓解压力', icon: '🧘', desc: '放松身心，调节情绪' }
}

export const activityLabels: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: '久坐', desc: '几乎不运动' },
  light: { label: '轻度', desc: '每周 1-3 次轻运动' },
  moderate: { label: '中度', desc: '每周 3-5 次中等运动' },
  active: { label: '高度', desc: '每周 6-7 次剧烈运动' },
  very_active: { label: '极高', desc: '体力工作或每天高强度训练' }
}

/** BMI 评级 */
export function getBmiLevel(bmi: number | null): { label: string; color: string } {
  if (bmi === null) return { label: '-', color: '#94a3b8' }
  if (bmi < 18.5) return { label: '偏瘦', color: '#f59e0b' }
  if (bmi < 24) return { label: '正常', color: '#22c55e' }
  if (bmi < 28) return { label: '超重', color: '#f59e0b' }
  return { label: '肥胖', color: '#ef4444' }
}
