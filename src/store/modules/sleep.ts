/**
 * 睡眠辅助 Store
 * PRD 3.2：睡眠质量记录与趋势
 * PRD 4.3：数据仅存本地 IndexedDB（localforage）
 * PRD 7.1：AI 睡眠小贴士（结合昨日睡眠评分 + 饮食数据）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'
import { streamChat, isAIConfigured, chat, type ApiMessage } from '@/services/ai'
import { useUserStore } from './user'
import { useDietStore } from './diet'
import { getTodayKey, type SleepRecord } from '@/types/sleep'

const SLEEP_RECORDS_KEY = 'sleep_records'
/** 保留天数 */
const MAX_RECORDS = 90

export const useSleepStore = defineStore('sleep', () => {
  // ==================== State ====================
  const records = ref<SleepRecord[]>([])
  const isLoaded = ref(false)
  const isGeneratingTip = ref(false)
  const sleepTip = ref('')
  /** 当前请求的 AbortController */
  let currentAbortController: AbortController | null = null

  // ==================== Getters ====================
  /** 最近 7 天记录 */
  const recent7Days = computed<SleepRecord[]>(() => {
    return records.value.slice(-7)
  })

  /** 今日记录 */
  const todayRecord = computed<SleepRecord | null>(() => {
    const today = getTodayKey()
    return records.value.find((r) => r.date === today) || null
  })

  /** 平均睡眠评分 */
  const averageScore = computed<number>(() => {
    if (records.value.length === 0) return 0
    const sum = records.value.reduce((s, r) => s + r.score, 0)
    return Math.round((sum / records.value.length) * 10) / 10
  })

  // ==================== Actions ====================
  async function loadFromStorage(): Promise<void> {
    const stored = await getItem<SleepRecord[]>('sleep', SLEEP_RECORDS_KEY)
    if (stored && Array.isArray(stored)) {
      records.value = stored
    }
    isLoaded.value = true
  }

  async function saveToStorage(): Promise<void> {
    await setItem<SleepRecord[]>('sleep', SLEEP_RECORDS_KEY, records.value)
  }

  /** 添加或更新今日睡眠记录（同日覆盖） */
  async function recordSleep(
    score: number,
    bedtime?: string,
    wakeTime?: string,
    note?: string
  ): Promise<void> {
    const today = getTodayKey()
    const existIndex = records.value.findIndex((r) => r.date === today)
    const record: SleepRecord = {
      date: today,
      score,
      bedtime,
      wakeTime,
      note,
      createdAt: Date.now()
    }

    if (existIndex >= 0) {
      records.value[existIndex] = record
    } else {
      records.value.push(record)
      records.value.sort((a, b) => a.date.localeCompare(b.date))
      if (records.value.length > MAX_RECORDS) {
        records.value = records.value.slice(-MAX_RECORDS)
      }
    }

    await saveToStorage()
  }

  /**
   * PRD 3.2：AI 睡眠小贴士（流式输出）
   * 结合昨日睡眠评分 + 饮食数据生成专属贴士
   */
  async function generateSleepTip(): Promise<void> {
    if (isGeneratingTip.value) return
    isGeneratingTip.value = true
    sleepTip.value = ''
    // 安全：新建 controller 前先 abort 旧的，防止旧 SSE 连接泄漏
    currentAbortController?.abort()
    currentAbortController = new AbortController()

    // 构建系统提示
    const userStore = useUserStore()
    const dietStore = useDietStore()
    const profile = userStore.profile

    // 优先取昨日记录（"昨晚睡眠评分"），找不到则回退到最近一条非今日记录，最后回退到最新记录
    const todayKey = getTodayKey()
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayKey = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`
    const yesterdayRecord =
      records.value.find((r) => r.date === yesterdayKey) ||
      records.value.find((r) => r.date !== todayKey) ||
      records.value[records.value.length - 1]
    const todayDiet = dietStore.getRecordsByDate(getTodayKey())
    const todayFat = todayDiet.reduce((sum, r) => sum + r.totalFat, 0)
    const todayCalories = todayDiet.reduce((sum, r) => sum + r.totalCalories, 0)

    const systemPrompt = `你是"微量生活"App 的睡眠助手，为用户提供简短、温暖的睡眠小贴士。
要求：
1. 回答控制在 150 字以内
2. 语气温暖、关怀，像朋友间的提醒
3. 结合用户的睡眠和饮食数据给出具体建议
4. 不要使用 markdown 格式`

    const userContent = `请根据以下数据生成今晚的睡眠小贴士：
${yesterdayRecord ? `- 昨晚睡眠评分：${yesterdayRecord.score}/5` : '- 暂无睡眠记录'}
- 今日饮食：摄入 ${Math.round(todayCalories)} 千卡，脂肪 ${Math.round(todayFat)}g
${profile.nickname ? `- 用户：${profile.nickname}` : ''}
${profile.goal ? `- 健康目标：${profile.goal}` : ''}

请给出一句话的睡眠建议。`

    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]

    if (isAIConfigured()) {
      try {
        await streamChat(messages, {
          onChunk: (chunk) => {
            sleepTip.value += chunk
          },
          signal: currentAbortController.signal,
          temperature: 0.7,
          firstByteTimeout: 60000
        })

        if (!sleepTip.value.trim()) {
          throw new Error('AI 返回空内容')
        }
        isGeneratingTip.value = false
        currentAbortController = null
        return
      } catch {
        sleepTip.value = generateMockTip(yesterdayRecord, todayFat)
        isGeneratingTip.value = false
        currentAbortController = null
        return
      }
    }

    // API 未配置，走 mock
    sleepTip.value = generateMockTip(yesterdayRecord, todayFat)
    isGeneratingTip.value = false
    currentAbortController = null
  }

  /** 停止生成 */
  function stopGenerating(): void {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    isGeneratingTip.value = false
  }

  /** 清空所有睡眠记录 */
  async function clearAll(): Promise<void> {
    records.value = []
    sleepTip.value = ''
    await saveToStorage()
  }

  /**
   * PRD 3.2：AI 睡眠周报（非流式）
   * 一键生成深度分析与改善计划
   */
  async function generateWeeklyReport(): Promise<string> {
    const userStore = useUserStore()
    const profile = userStore.profile
    const recentRecords = recent7Days.value

    if (recentRecords.length === 0) {
      return '本周暂无睡眠记录，请先记录几天的睡眠数据再来生成周报吧～'
    }

    const avgScore = recentRecords.reduce((s, r) => s + r.score, 0) / recentRecords.length
    const recordsSummary = recentRecords
      .map((r) => `${r.date}：${r.score}分`)
      .join('；')

    const systemPrompt = `你是"微量生活"App 的睡眠分析师，为用户提供本周睡眠周报。
要求：
1. 回答控制在 400 字以内
2. 包含：本周睡眠概况、问题分析、下周改善建议
3. 语气专业但温暖
4. 不要使用 markdown 格式，用纯文本和换行`

    const userContent = `请生成本周睡眠周报：
- 用户：${profile.nickname || '健康用户'}
- 本周平均睡眠评分：${avgScore.toFixed(1)}/5
- 每日记录：${recordsSummary}

请包含概况、分析和建议三部分。`

    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]

    if (isAIConfigured()) {
      try {
        const result = await chat(messages, { temperature: 0.6 })
        return result.trim() || generateMockReport(avgScore)
      } catch {
        return generateMockReport(avgScore)
      }
    }

    return generateMockReport(avgScore)
  }

  return {
    // state
    records,
    isLoaded,
    isGeneratingTip,
    sleepTip,
    // getters
    recent7Days,
    todayRecord,
    averageScore,
    // actions
    loadFromStorage,
    saveToStorage,
    recordSleep,
    generateSleepTip,
    stopGenerating,
    generateWeeklyReport,
    clearAll
  }
})

/** 生成 mock 睡眠小贴士（降级兜底） */
function generateMockTip(
  yesterdayRecord: SleepRecord | undefined,
  todayFat: number
): string {
  const tips: string[] = []
  if (yesterdayRecord && yesterdayRecord.score <= 3) {
    tips.push('昨晚睡眠质量不太理想，今晚建议提前 30 分钟上床，给自己一个放松的过渡时间。')
  }
  if (todayFat > 60) {
    tips.push('今日脂肪摄入偏高，可能影响入睡。晚餐后可以散散步，帮助消化。')
  }
  if (tips.length === 0) {
    tips.push('今天的状态不错！今晚保持规律作息，睡前远离手机，让身心慢慢沉静下来。🌙')
  }
  return tips.join('') + '（当前为离线模式）'
}

/** 生成 mock 睡眠周报（降级兜底） */
function generateMockReport(avgScore: number): string {
  let status = ''
  if (avgScore >= 4) {
    status = '本周整体睡眠质量较好，继续保持规律作息。'
  } else if (avgScore >= 3) {
    status = '本周睡眠质量一般，存在改善空间。'
  } else {
    status = '本周睡眠质量不佳，需要重点关注。'
  }
  return `${status}\n\n建议下周尝试：\n1. 固定入睡和起床时间\n2. 睡前 1 小时远离电子屏幕\n3. 卧室温度保持 18-22℃\n4. 可配合白噪音或呼吸引导助眠\n\n（当前为离线模式，接入网络可获得更详细分析）`
}
