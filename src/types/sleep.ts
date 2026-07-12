/**
 * 睡眠辅助系统类型定义
 * PRD 3.2：睡眠辅助 - 白噪音混音台、呼吸引导、睡眠质量记录与趋势
 */

/** 睡眠质量记录 */
export interface SleepRecord {
  /** 日期 key：YYYY-MM-DD */
  date: string
  /** 睡眠评分 1-5 */
  score: number
  /** 入睡时间 HH:mm（可选） */
  bedtime?: string
  /** 起床时间 HH:mm（可选） */
  wakeTime?: string
  /** 备注（可选） */
  note?: string
  /** 记录时间戳 */
  createdAt: number
}

/** 白噪音音轨信息 */
export interface WhiteNoiseTrack {
  /** 音轨 ID */
  id: string
  /** 显示名称 */
  name: string
  /** 图标 emoji */
  icon: string
  /** 主题色（莫兰迪色系） */
  color: string
  /** 音频文件路径（public/sounds 下的相对路径） */
  src: string
}

/** 呼吸引导模式 */
export type BreathingPattern = '478' | 'box' | 'relax'

/** 呼吸阶段 */
export type BreathingPhase = 'inhale' | 'hold' | 'exhale' | 'hold2'

/** 呼吸引导模式信息 */
export interface BreathingModeInfo {
  /** 模式 key */
  key: BreathingPattern
  /** 名称 */
  label: string
  /** 描述 */
  desc: string
  /** 图标 */
  icon: string
  /** 各阶段时长（秒） */
  phases: { phase: BreathingPhase; duration: number; label: string }[]
}

/** 白噪音音轨列表 */
export const whiteNoiseTracks: WhiteNoiseTrack[] = [
  { id: 'rain', name: '雨声', icon: '🌧️', color: '#b8c5d6', src: '/sounds/rain.mp3' },
  { id: 'ocean', name: '海浪', icon: '🌊', color: '#a8c0a0', src: '/sounds/ocean.mp3' },
  { id: 'forest', name: '森林', icon: '🌳', color: '#c9b8a8', src: '/sounds/forest.mp3' },
  { id: 'fire', name: '篝火', icon: '🔥', color: '#d4b5b0', src: '/sounds/fire.mp3' },
  { id: 'wind', name: '风声', icon: '🌬️', color: '#d4c5a9', src: '/sounds/wind.mp3' },
  { id: 'stream', name: '溪流', icon: '💧', color: '#a0c4c8', src: '/sounds/stream.mp3' }
]

/** 呼吸引导模式列表 */
export const breathingModes: BreathingModeInfo[] = [
  {
    key: '478',
    label: '4-7-8 助眠法',
    desc: '吸气4秒 · 屏息7秒 · 呼气8秒，深度放松助眠',
    icon: '🌙',
    phases: [
      { phase: 'inhale', duration: 4, label: '吸气' },
      { phase: 'exhale', duration: 8, label: '呼气' }
    ]
  },
  {
    key: 'box',
    label: '箱式呼吸法',
    desc: '吸4秒 · 屏4秒 · 呼4秒 · 屏4秒，缓解焦虑',
    icon: '📦',
    phases: [
      { phase: 'inhale', duration: 4, label: '吸气' },
      { phase: 'hold', duration: 4, label: '屏息' },
      { phase: 'exhale', duration: 4, label: '呼气' },
      { phase: 'hold2', duration: 4, label: '屏息' }
    ]
  },
  {
    key: 'relax',
    label: '快速放松法',
    desc: '吸3秒 · 呼6秒，快速平复情绪',
    icon: '🍃',
    phases: [
      { phase: 'inhale', duration: 3, label: '吸气' },
      { phase: 'exhale', duration: 6, label: '呼气' }
    ]
  }
]

/** 生成睡眠记录 ID */
export function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
