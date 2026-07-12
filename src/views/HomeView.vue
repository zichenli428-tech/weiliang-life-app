<script setup lang="ts">
/**
 * 健康看板（Tab 1）
 * PRD 3.4：今日数据概览、快捷打卡、健康雷达图 | AI 每日寄语（基于昨日数据生成）
 * 重设计：极光琉璃暗色风格，Bento 玻璃卡片布局
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import EChart from '@/components/EChart.vue'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import { useUserStore } from '@/store/modules/user'
import { useDietStore } from '@/store/modules/diet'
import { useSleepStore } from '@/store/modules/sleep'
import { goalLabels } from '@/constants/user'
import { chat, buildDailyMessagePrompt, isAIConfigured, type ApiMessage } from '@/services/ai'
import { showAITip } from '@/utils/aiToast'
import type { ECOption } from '@/types/echarts'

const router = useRouter()
const userStore = useUserStore()
const dietStore = useDietStore()
const sleepStore = useSleepStore()

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

const nutritionItems = computed(() => [
  { key: 'calories', label: '热量', ...todayNutrition.value.calories, color: '#34d399' },
  { key: 'protein', label: '蛋白质', ...todayNutrition.value.protein, color: '#22d3ee' },
  { key: 'fat', label: '脂肪', ...todayNutrition.value.fat, color: '#fbbf24' },
  { key: 'carbs', label: '碳水', ...todayNutrition.value.carbs, color: '#a78bfa' }
])

const percent = (v: number, t: number) => Math.min(100, Math.round((v / t) * 100))

/** 格式化数值：四舍五入到 1 位小数 */
const formatNum = (v: number) => Math.round(v * 10) / 10

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
    axisName: { color: '#64748b', fontSize: 10 },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    splitArea: {
      areaStyle: {
        color: ['rgba(52,211,153,0.04)', 'rgba(52,211,153,0.02)', 'rgba(52,211,153,0.04)', 'rgba(52,211,153,0.02)']
      }
    },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
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
            55,
            40
          ],
          name: '今日摄入',
          areaStyle: { color: 'rgba(52, 211, 153, 0.25)' },
          lineStyle: { color: '#34d399', width: 2 },
          itemStyle: { color: '#34d399' }
        }
      ]
    }
  ]
}))

// ==================== 快捷打卡 ====================
// 饮水/运动打卡持久化到 localStorage，按日期 key 存储，新一天自动重置为 0
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

// 从 sleepStore 读取今日睡眠时长（bedtime→wakeTime 计算）
function calcSleepHours(bedtime?: string, wakeTime?: string): number {
  if (!bedtime || !wakeTime) return 0
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  if (Number.isNaN(bh) || Number.isNaN(wh)) return 0
  let minutes = wh * 60 + wm - (bh * 60 + bm)
  if (minutes < 0) minutes += 24 * 60 // 跨天（如 23:30 → 07:00）
  return Math.round((minutes / 60) * 10) / 10
}

const sleepHours = computed(() => {
  const record = sleepStore.todayRecord
  if (!record) return 0
  return calcSleepHours(record.bedtime, record.wakeTime)
})

// 统一的打卡数据（computed 保证 sleep 时长实时同步）
const checkins = computed(() => ({
  water: { count: checkinData.value.water, target: 8, unit: '杯', icon: '💧' },
  exercise: { count: checkinData.value.exercise, target: 30, unit: '分钟', icon: '🏃' },
  sleep: { count: sleepHours.value, target: 8, unit: '小时', icon: '😴' }
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
    // 睡眠需要记录就寝/起床时间，跳转到睡眠记录页（直接定位到记录 tab）
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
  if (hour < 11) return `早上好，${nickname}！新的一天，记得吃一顿营养丰富的早餐哦 🌅`
  if (hour < 14) return `中午好，${nickname}！午餐记得搭配蔬菜和优质蛋白 🥗`
  if (hour < 18) return `下午好，${nickname}！适当补充水分，保持活力 💧`
  return `晚上好，${nickname}！晚餐清淡为主，睡前远离手机 🌙`
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

onMounted(async () => {
  if (!dietStore.isLoaded) {
    await dietStore.loadFromStorage()
  }
  if (!sleepStore.isLoaded) {
    await sleepStore.loadFromStorage()
  }
  refreshAiMessage()
})
</script>

<template>
  <div class="page-container home-page">
    <!-- 顶部 Aurora Hero -->
    <div class="home-hero safe-area-top">
      <div class="flex items-center justify-between">
        <div>
          <div class="glass-chip mb-2">
            <span>{{ goalLabel?.icon || '✨' }}</span>
            <span>{{ goalLabel?.label || '健康生活' }}</span>
          </div>
          <div class="text-2xl font-bold text-content-primary">
            你好，{{ userStore.profile.nickname || '健康用户' }}
          </div>
          <div class="text-xs text-content-secondary mt-1">
            今天也是向目标靠近的一天
          </div>
        </div>
        <div class="weather-capsule">
          <span class="text-xl">☀️</span>
          <span class="text-xs text-content-primary mt-0.5">今日晴</span>
        </div>
      </div>
    </div>

    <div class="page-body stagger-fade-up">
      <!-- AI 每日寄语 -->
      <GlassCard class="mx-4 mb-4 gradient-border" padding="md">
        <div class="flex items-center gap-2 mb-2">
          <div class="ai-avatar">AI</div>
          <span class="text-sm font-semibold aurora-text">每日寄语</span>
          <van-icon name="replay" class="ml-auto text-aurora-green" @click="handleRefreshMessage" />
        </div>
        <div class="ai-message">
          <van-loading v-if="aiLoading" type="spinner" size="16px" color="#34d399" />
          <span v-else class="text-content-primary text-sm leading-relaxed">{{ aiMessage }}</span>
        </div>
      </GlassCard>

      <!-- 今日数据概览 -->
      <SectionTitle title="今日营养" icon="🥗" class="px-4" />
      <div class="grid grid-cols-2 gap-3 px-4 mb-4">
        <GlassCard
          v-for="item in nutritionItems"
          :key="item.key"
          padding="sm"
          glow="green"
          class="nutrition-card"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-content-secondary">{{ item.label }}</span>
            <span class="text-[10px] text-content-tertiary">{{ percent(item.value, item.target) }}%</span>
          </div>
          <div class="flex items-baseline gap-1 mb-2">
            <span class="text-xl font-bold" :style="{ color: item.color }">{{ formatNum(item.value) }}</span>
            <span class="text-[10px] text-content-tertiary">/ {{ item.target }} {{ item.unit }}</span>
          </div>
          <van-progress
            :percentage="percent(item.value, item.target)"
            stroke-width="5"
            :color="item.color"
            track-color="rgba(255,255,255,0.08)"
            :show-pivot="false"
          />
        </GlassCard>
      </div>

      <!-- 健康雷达图 -->
      <SectionTitle title="健康雷达" icon="📊" class="px-4" />
      <GlassCard class="mx-4 mb-4" padding="sm" glow="green">
        <EChart :option="radarOption" height="260px" />
      </GlassCard>

      <!-- 快捷打卡 -->
      <SectionTitle title="快捷打卡" icon="✅" class="px-4" />
      <div class="grid grid-cols-3 gap-3 px-4 mb-4">
        <GlassCard
          v-for="(item, key) in checkins"
          :key="key"
          padding="sm"
          glow="cyan"
          class="checkin-card"
          @click="handleCheckin(key as 'water' | 'exercise' | 'sleep')"
        >
          <div class="text-2xl mb-1">{{ item.icon }}</div>
          <div class="text-[10px] text-content-secondary">
            {{ item.count }}/{{ item.target }} {{ item.unit }}
          </div>
          <div class="checkin-btn">+ 打卡</div>
        </GlassCard>
      </div>

      <!-- 快捷入口 -->
      <SectionTitle title="快捷入口" icon="🚀" class="px-4" />
      <div class="px-4 pb-4 space-y-3">
        <div
          v-for="entry in [
            { title: '记录饮食', desc: '拍照 / 文字 / 语音识别', icon: '🍽️', action: goToRecord, color: '#f59e0b' },
            { title: '心理疏导', desc: 'AI 陪伴，倾听心声', icon: '💛', action: goToMind, color: '#a3e635' },
            { title: '睡眠辅助', desc: '白噪音 · 呼吸引导 · 睡眠记录', icon: '🌙', action: goToSleep, color: '#818cf8' }
          ]"
          :key="entry.title"
          class="quick-entry"
          @click="entry.action"
        >
          <div class="quick-entry-icon" :style="{ background: `linear-gradient(135deg, ${entry.color}, transparent)`, boxShadow: `0 0 16px ${entry.color}30` }">
            {{ entry.icon }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-content-primary">{{ entry.title }}</div>
            <div class="text-xs text-content-secondary">{{ entry.desc }}</div>
          </div>
          <van-icon name="arrow" class="text-content-tertiary" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  background-color: #0b1220;
}

.home-hero {
  position: relative;
  padding: 20px 16px 28px;
  background:
    radial-gradient(ellipse at top right, rgba(52, 211, 153, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at bottom left, rgba(34, 211, 238, 0.12) 0%, transparent 50%),
    linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
  overflow: hidden;
}

.home-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, rgba(167, 139, 250, 0.06) 100%);
  pointer-events: none;
}

.weather-capsule {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  backdrop-filter: blur(12px);
}

.ai-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
  color: #0b1220;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-message {
  min-height: 20px;
}

.nutrition-card {
  position: relative;
  overflow: hidden;
}

.nutrition-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle at top right, rgba(52, 211, 153, 0.08), transparent 70%);
  pointer-events: none;
}

.checkin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
}

.checkin-btn {
  margin-top: 6px;
  padding: 2px 10px;
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.quick-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(2, 8, 20, 0.36);
  transition: all 0.2s ease;
  cursor: pointer;
}

.quick-entry:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.1);
}

.quick-entry-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
</style>
