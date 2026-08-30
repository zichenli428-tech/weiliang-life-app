<script setup lang="ts">
/**
 * 健康看板（Tab 1）
 * PRD 3.4：今日数据概览、快捷打卡、健康雷达图 | AI 每日寄语（基于昨日数据生成）
 * 重设计：Apple 风格，浅色默认，实色卡片 + chart token 配色
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import EChart from '@/components/EChart.vue'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AppleIcon from '@/components/AppleIcon.vue'
import { useUserStore } from '@/store/modules/user'
import { useDietStore } from '@/store/modules/diet'
import { useSleepStore } from '@/store/modules/sleep'
import { goalLabels } from '@/constants/user'
import { chat, buildDailyMessagePrompt, isAIConfigured, type ApiMessage } from '@/services/ai'
import { getCurrentWeather, isWeatherConfigured, type WeatherInfo } from '@/services/weather'
import { showAITip } from '@/utils/aiToast'
import type { ECOption } from '@/types/echarts'

const router = useRouter()
const userStore = useUserStore()
const dietStore = useDietStore()
const sleepStore = useSleepStore()

// ==================== 实时天气 ====================
const weather = ref<WeatherInfo | null>(null)
const weatherVisible = computed(() => isWeatherConfigured())

async function fetchWeather() {
  if (!isWeatherConfigured()) return
  try {
    weather.value = await getCurrentWeather()
  } catch {
    // 定位被拒绝或 API 失败时静默处理，不显示天气
  }
}

// ==================== 今日营养汇总 ====================
const todayCalories = computed(() => dietStore.todayCalories)
const todayProtein = computed(() =>
  dietStore.todayRecords.reduce((s, r) => s + r.totalProtein, 0)
)
const todayFat = computed(() =>
  dietStore.todayRecords.reduce((s, r) => s + r.totalFat, 0)
)
const todayCarbs = computed(() =>
  dietStore.todayRecords.reduce((s, r) => s + r.totalCarbs, 0)
)

const todayNutrition = computed(() => ({
  calories: { value: todayCalories.value, target: 1800, unit: 'kcal' },
  protein: { value: todayProtein.value, target: 80, unit: 'g' },
  fat: { value: todayFat.value, target: 60, unit: 'g' },
  carbs: { value: todayCarbs.value, target: 240, unit: 'g' }
}))

const percent = (v: number, t: number) => Math.min(100, Math.round((v / t) * 100))

// 维生素 & 微量元素：食物数据库无此两项数据，基于食物种类丰富度与餐次覆盖度动态估算
// 无饮食记录时为 0；记录越多、餐次越全，得分越高（上限 100）
const todayFoodCount = computed(() =>
  dietStore.todayRecords.reduce((s, r) => s + r.foods.length, 0)
)
const todayMealTypes = computed(() =>
  new Set(dietStore.todayRecords.map((r) => r.mealType)).size
)
const vitaminScore = computed(() =>
  Math.min(100, Math.round(todayFoodCount.value * 14 + todayMealTypes.value * 6))
)
const traceElementScore = computed(() =>
  Math.min(100, Math.round(todayFoodCount.value * 11 + todayMealTypes.value * 5))
)

// ==================== 健康雷达图 ====================
const radarOption = computed<ECOption>(() => ({
  tooltip: {},
  radar: {
    indicator: [
      { name: '热量', max: 100 },
      { name: '蛋白质', max: 100 },
      { name: '脂肪', max: 100 },
      { name: '碳水', max: 100 },
      { name: '维生素', max: 100 },
      { name: '微量元素', max: 100 }
    ],
    radius: '62%',
    splitNumber: 4,
    axisName: { color: '#8e8e93', fontSize: 10 },
    splitLine: { lineStyle: { color: 'rgba(142,142,147,0.2)' } },
    splitArea: {
      areaStyle: {
        color: ['rgba(52,199,89,0.04)', 'rgba(52,199,89,0.02)', 'rgba(52,199,89,0.04)', 'rgba(52,199,89,0.02)']
      }
    },
    axisLine: { lineStyle: { color: 'rgba(142,142,147,0.2)' } }
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: [
            percent(todayNutrition.value.calories.value, todayNutrition.value.calories.target),
            percent(todayNutrition.value.protein.value, todayNutrition.value.protein.target),
            percent(todayNutrition.value.fat.value, todayNutrition.value.fat.target),
            percent(todayNutrition.value.carbs.value, todayNutrition.value.carbs.target),
            vitaminScore.value,
            traceElementScore.value
          ],
          name: '今日摄入',
          areaStyle: { color: 'rgba(52, 199, 89, 0.18)' },
          lineStyle: { color: '#34c759', width: 2 },
          itemStyle: { color: '#34c759' }
        }
      ]
    }
  ]
}))

// ==================== 快捷打卡 ====================
interface CheckinData {
  water: number
  exercise: number
}

function loadCheckinData(): CheckinData {
  const key = `checkins_${getTodayKey()}`
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return {
        water: typeof parsed.water === 'number' ? parsed.water : 0,
        exercise: typeof parsed.exercise === 'number' ? parsed.exercise : 0
      }
    } catch {
      // 数据损坏，返回默认值
    }
  }
  return { water: 0, exercise: 0 }
}

function saveCheckinData(data: CheckinData): void {
  const key = `checkins_${getTodayKey()}`
  localStorage.setItem(key, JSON.stringify(data))
}

const checkinData = ref<CheckinData>(loadCheckinData())

function calcSleepHours(bedtime?: string, wakeTime?: string): number {
  if (!bedtime || !wakeTime) return 0
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  if (Number.isNaN(bh) || Number.isNaN(wh)) return 0
  let minutes = wh * 60 + wm - (bh * 60 + bm)
  if (minutes < 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 10) / 10
}

const sleepHours = computed(() => {
  const record = sleepStore.todayRecord
  if (!record) return 0
  return calcSleepHours(record.bedtime, record.wakeTime)
})

const checkins = computed(() => ({
  water: { count: checkinData.value.water, target: 8, unit: '杯', icon: 'droplet', color: 'var(--chart-2)' },
  exercise: { count: checkinData.value.exercise, target: 30, unit: '分钟', icon: 'dumbbell', color: 'var(--chart-3)' },
  sleep: { count: sleepHours.value, target: 8, unit: '小时', icon: 'moon', color: 'var(--chart-4)' }
}))

const handleCheckin = (key: 'water' | 'exercise' | 'sleep') => {
  if (key === 'water') {
    checkinData.value.water = Math.min(16, checkinData.value.water + 1)
    saveCheckinData(checkinData.value)
    showToast(`+1 杯水，今日已饮 ${checkinData.value.water} 杯`)
  } else if (key === 'exercise') {
    checkinData.value.exercise = Math.min(180, checkinData.value.exercise + 15)
    saveCheckinData(checkinData.value)
    showToast(`+15 分钟运动，今日已运动 ${checkinData.value.exercise} 分钟`)
  } else if (key === 'sleep') {
    router.push('/sleep?tab=record')
  }
}

// ==================== AI 每日寄语 ====================
const aiMessage = ref('正在生成今日专属寄语…')
const aiLoading = ref(false)

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCachedMessage(): string | null {
  const key = `ai_daily_${getTodayKey()}`
  return localStorage.getItem(key)
}

function cacheMessage(msg: string): void {
  const key = `ai_daily_${getTodayKey()}`
  localStorage.setItem(key, msg)
}

function getDefaultMessage(): string {
  const hour = new Date().getHours()
  const nickname = userStore.profile.nickname || '朋友'
  if (hour < 11) return `早上好，${nickname}！新的一天，记得吃一顿营养丰富的早餐哦`
  if (hour < 14) return `中午好，${nickname}！午餐记得搭配蔬菜和优质蛋白`
  if (hour < 18) return `下午好，${nickname}！适当补充水分，保持活力`
  return `晚上好，${nickname}！晚餐清淡为主，睡前远离手机`
}

const refreshAiMessage = async () => {
  const cached = getCachedMessage()
  if (cached && !aiLoading.value) {
    aiMessage.value = cached
    return
  }

  if (!isAIConfigured()) {
    aiMessage.value = getDefaultMessage()
    return
  }

  aiLoading.value = true
  showAITip()
  try {
    const systemPrompt = buildDailyMessagePrompt(
      {
        nickname: userStore.profile.nickname,
        healthGoal: userStore.profile.goal ? goalLabels[userStore.profile.goal]?.label : undefined,
        weight: userStore.profile.weight ?? undefined,
        targetWeight: userStore.profile.targetWeight ?? undefined
      },
      {
        calories: todayCalories.value,
        protein: todayProtein.value,
        waterCount: checkins.value.water.count
      }
    )

    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请生成今日寄语' }
    ]

    const result = await chat(messages, {
      temperature: 0.8,
      maxTokens: 100,
      timeout: 60000
    })

    const msg = result.trim() || getDefaultMessage()
    aiMessage.value = msg
    cacheMessage(msg)
  } catch {
    aiMessage.value = getDefaultMessage()
  } finally {
    aiLoading.value = false
  }
}

const handleRefreshMessage = () => {
  const key = `ai_daily_${getTodayKey()}`
  localStorage.removeItem(key)
  refreshAiMessage()
}

// ==================== 快捷入口 ====================
const goalLabel = computed(() =>
  userStore.profile.goal ? goalLabels[userStore.profile.goal] : null
)

const goToMind = () => router.push({ name: 'mind' })
const goToRecord = () => router.push({ name: 'record' })
const goToSleep = () => router.push({ name: 'sleep' })

const quickEntries = computed(() => [
  { title: '记录饮食', desc: '拍照 / 文字 / 语音识别', icon: 'utensils', action: goToRecord, color: 'var(--chart-3)' },
  { title: '心理疏导', desc: 'AI 陪伴，倾听心声', icon: 'heart', action: goToMind, color: 'var(--chart-5)' },
  { title: '睡眠辅助', desc: '白噪音 · 呼吸引导 · 睡眠记录', icon: 'moon', action: goToSleep, color: 'var(--chart-4)' }
])

onMounted(async () => {
  if (!dietStore.isLoaded) {
    await dietStore.loadFromStorage()
  }
  if (!sleepStore.isLoaded) {
    await sleepStore.loadFromStorage()
  }
  refreshAiMessage()
  fetchWeather()
})
</script>

<template>
  <div class="page-container home-page">
    <!-- 顶部 Hero -->
    <section class="home-hero safe-area-top">
      <div class="hero-row">
        <div class="hero-left">
          <span class="goal-chip">
            <AppleIcon :name="goalLabel?.icon || 'sparkles'" :size="13" />
            {{ goalLabel?.label || '健康生活' }}
          </span>
          <div class="hero-greeting">你好，{{ userStore.profile.nickname || '健康用户' }}</div>
          <div class="hero-subtitle">今天也是向目标靠近的一天</div>
        </div>
        <span v-if="weatherVisible" class="weather-chip">
          <AppleIcon v-if="weather" :name="weather.icon" :size="15" :style="{ color: weather.color }" />
          <AppleIcon v-else name="cloud" :size="15" style="color: var(--muted-foreground)" />
          {{ weather ? `${weather.text} ${weather.temp}°` : '获取中…' }}
        </span>
      </div>
    </section>

    <div class="page-body stagger-fade-up">
      <!-- AI 每日寄语 -->
      <GlassCard class="ai-card">
        <div class="ai-head">
          <span class="ai-avatar"><AppleIcon name="sparkles" :size="16" /></span>
          <span class="ai-label">每日寄语</span>
          <button class="ai-refresh" aria-label="刷新寄语" @click="handleRefreshMessage">
            <AppleIcon name="rotate-ccw" :size="16" />
          </button>
        </div>
        <div class="ai-text">
          <van-loading v-if="aiLoading" type="spinner" size="16px" color="var(--primary)" />
          <span v-else>{{ aiMessage }}</span>
        </div>
      </GlassCard>

      <!-- 快捷入口 -->
      <SectionTitle title="快捷入口" icon="zap" color="var(--chart-1)" class="section-wrap" />
      <div class="entry-list">
        <a
          v-for="entry in quickEntries"
          :key="entry.title"
          class="entry-card"
          @click="entry.action"
        >
          <span class="entry-icon" :style="{ background: `color-mix(in srgb, ${entry.color} 10%, transparent)` }">
            <AppleIcon :name="entry.icon" :size="20" :style="{ color: entry.color }" />
          </span>
          <span class="entry-text">
            <span class="entry-title">{{ entry.title }}</span>
            <span class="entry-desc">{{ entry.desc }}</span>
          </span>
          <span class="entry-chevron"><AppleIcon name="chevron-right" :size="18" /></span>
        </a>
      </div>

      <!-- 快捷打卡 -->
      <SectionTitle title="快捷打卡" icon="circle-check" color="var(--chart-1)" class="section-wrap" />
      <div class="checkin-grid">
        <div
          v-for="(item, key) in checkins"
          :key="key"
          class="checkin-card"
          @click="handleCheckin(key as 'water' | 'exercise' | 'sleep')"
        >
          <AppleIcon :name="item.icon" :size="24" :style="{ color: item.color }" />
          <span class="checkin-val">{{ item.count }}/{{ item.target }} {{ item.unit }}</span>
          <span class="checkin-btn">+ 打卡</span>
        </div>
      </div>

      <!-- 健康雷达图 -->
      <SectionTitle title="健康雷达" icon="radar" color="var(--chart-1)" class="section-wrap" />
      <GlassCard class="radar-card" padding="sm">
        <EChart :option="radarOption" height="260px" />
      </GlassCard>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  background: var(--background);
  max-width: 480px;
  margin: 0 auto;
}

/* Hero */
.home-hero {
  position: relative;
  padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px 20px;
  background: var(--background);
  overflow: hidden;
}
.home-hero::before {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: var(--chart-1);
  opacity: 0.06;
  pointer-events: none;
}
.hero-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.hero-left {
  min-width: 0;
}
.goal-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--chart-1) 10%, transparent);
  color: var(--chart-1);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 10px;
}
.hero-greeting {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
}
.hero-subtitle {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.weather-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 9999px;
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  font-size: 12px;
  color: var(--foreground);
  min-height: 36px;
  flex-shrink: 0;
}

/* AI 寄语卡片 */
.ai-card {
  margin: 0 16px 16px;
  border-left: 4px solid var(--chart-2);
  padding: 14px 16px;
}
.ai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  background: var(--chart-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-foreground);
  flex-shrink: 0;
}
.ai-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  flex: 1;
}
.ai-refresh {
  min-width: 48px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
}
.ai-text {
  min-height: 20px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
}

/* Section 标题外边距 */
.section-wrap {
  margin: 0 16px 8px;
}

/* 雷达图卡片 */
.radar-card {
  margin: 0 16px 16px;
}

/* 快捷打卡 */
.checkin-grid {
  display: flex;
  gap: 12px;
  padding: 0 16px;
  margin-bottom: 16px;
}
.checkin-card {
  flex: 1;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.checkin-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
}
.checkin-card:active {
  transform: scale(0.97);
}
.checkin-val {
  font-size: 10px;
  color: var(--muted-foreground);
}
.checkin-btn {
  padding: 2px 10px;
  background: color-mix(in srgb, var(--chart-1) 12%, transparent);
  color: var(--chart-1);
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  transition: background 0.2s ease;
}
.checkin-card:hover .checkin-btn {
  background: color-mix(in srgb, var(--chart-1) 22%, transparent);
}

/* 快捷入口 */
.entry-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px;
  margin-bottom: 16px;
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 12px;
  min-height: 64px;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.entry-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}
.entry-card:active {
  transform: scale(0.99);
  background: var(--accent);
}
.entry-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.entry-card:hover .entry-icon {
  transform: scale(1.1);
}
.entry-text {
  flex: 1;
  min-width: 0;
}
.entry-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}
.entry-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.entry-chevron {
  color: var(--muted-foreground);
  display: inline-flex;
  transition: transform 0.2s ease, color 0.2s ease;
}
.entry-card:hover .entry-chevron {
  transform: translateX(3px);
  color: var(--primary);
}

/* 小屏适配 */
@media (max-width: 360px) {
  .home-hero {
    padding-left: 12px;
    padding-right: 12px;
  }
  .section-wrap,
  .ai-card,
  .radar-card {
    margin-left: 12px;
    margin-right: 12px;
  }
  .checkin-grid,
  .entry-list {
    padding-left: 12px;
    padding-right: 12px;
    gap: 8px;
  }
}
</style>
