/**
 * 用户档案展示用标签映射
 * 供「我的」页面、建档页等共用
 * 图标使用 AppleIcon 名称（Lucide 风格 SVG），不再使用 emoji
 */
import type { Gender, HealthGoal, ActivityLevel } from '@/types/user'

export const genderLabels: Record<Gender, string> = {
  male: '男',
  female: '女'
}

export const goalLabels: Record<HealthGoal, { label: string; icon: string; desc: string }> = {
  lose_fat: { label: '减脂塑形', icon: 'flame', desc: '减少体脂，线条更清晰' },
  gain_muscle: { label: '增肌增重', icon: 'dumbbell', desc: '增加肌肉，提升力量' },
  maintain: { label: '保持健康', icon: 'target', desc: '维持现状，均衡饮食' },
  improve_sleep: { label: '改善睡眠', icon: 'moon', desc: '提升睡眠质量' },
  relieve_stress: { label: '缓解压力', icon: 'leaf', desc: '放松身心，调节情绪' }
}

export const activityLabels: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: '久坐', desc: '几乎不运动' },
  light: { label: '轻度', desc: '每周 1-3 次轻运动' },
  moderate: { label: '中度', desc: '每周 3-5 次中等运动' },
  active: { label: '高度', desc: '每周 6-7 次剧烈运动' },
  very_active: { label: '极高', desc: '体力工作或每天高强度训练' }
}

/** BMI 评级（颜色使用 Apple 语义令牌） */
export function getBmiLevel(bmi: number | null): { label: string; color: string } {
  if (bmi === null) return { label: '-', color: 'var(--muted-foreground)' }
  if (bmi < 18.5) return { label: '偏瘦', color: 'var(--chart-3)' }
  if (bmi < 24) return { label: '正常', color: 'var(--chart-1)' }
  if (bmi < 28) return { label: '超重', color: 'var(--chart-3)' }
  return { label: '肥胖', color: 'var(--destructive)' }
}
