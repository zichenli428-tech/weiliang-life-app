/**
 * AI 健康顾问预置快捷问题
 * PRD 3.4：预设快捷问题降低用户输入成本
 * 分类覆盖饮食/运动/睡眠/心理/综合，引导用户开启对话
 */
import type { QuickQuestion, QuickQuestionCategory } from '@/types/chat'

export const categoryLabels: Record<QuickQuestionCategory, { label: string; icon: string }> = {
  diet: { label: '饮食', icon: '🥗' },
  exercise: { label: '运动', icon: '🏃' },
  sleep: { label: '睡眠', icon: '😴' },
  mental: { label: '心理', icon: '💚' },
  general: { label: '综合', icon: '💡' }
}

export const quickQuestions: QuickQuestion[] = [
  {
    text: '我今天吃什么比较健康？',
    icon: '🥗',
    category: 'diet'
  },
  {
    text: '想减脂，三餐应该怎么搭配？',
    icon: '🥗',
    category: 'diet'
  },
  {
    text: '蛋白质摄入不足怎么办？',
    icon: '🥗',
    category: 'diet'
  },
  {
    text: '上班族每天 20 分钟怎么运动？',
    icon: '🏃',
    category: 'exercise'
  },
  {
    text: '跑步和跳绳哪个更减脂？',
    icon: '🏃',
    category: 'exercise'
  },
  {
    text: '最近总失眠，有什么改善方法？',
    icon: '😴',
    category: 'sleep'
  },
  {
    text: '睡前玩手机真的影响睡眠吗？',
    icon: '😴',
    category: 'sleep'
  },
  {
    text: '压力大的时候怎么自我调节？',
    icon: '💚',
    category: 'mental'
  },
  {
    text: '如何建立长期的健身习惯？',
    icon: '💡',
    category: 'general'
  },
  {
    text: '帮我制定一周健康计划',
    icon: '💡',
    category: 'general'
  }
]
