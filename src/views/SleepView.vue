<script setup lang="ts">
/**
 * 睡眠辅助系统（Tab 4）
 * PRD 3.2：睡眠辅助系统
 * - AI 睡眠小贴士（流式输出，结合睡眠+饮食数据）
 * - 白噪音混音台（多音轨 + 独立音量 + 定时关闭）
 * - 呼吸引导（CSS3 呼吸球 + 4-7-8/箱式/快速放松）
 * - 睡眠质量记录与趋势（评分 + 7 日折线图 + AI 周报）
 * 重设计：Apple 风格浅色，模块主色 --chart-4（紫）
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, closeToast } from 'vant'
import { useSleepStore } from '@/store/modules/sleep'
import { showAITip, showAILoading } from '@/utils/aiToast'
import EChart from '@/components/EChart.vue'
import WhiteNoiseMixer from '@/components/WhiteNoiseMixer.vue'
import BreathingGuide from '@/components/BreathingGuide.vue'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'
import FeatureTutorial, { type TutorialStep } from '@/components/FeatureTutorial.vue'
import { useFeatureTutorial } from '@/composables/useFeatureTutorial'
import type { ECOption } from '@/types/echarts'

const sleepStore = useSleepStore()
const route = useRoute()

/** 当前 section：tips / noise / breathing / record */
const activeSection = ref<'tips' | 'noise' | 'breathing' | 'record'>('tips')

const sections = [
  { key: 'tips' as const, label: 'AI 小贴士', icon: 'lightbulb' },
  { key: 'noise' as const, label: '白噪音', icon: 'music' },
  { key: 'breathing' as const, label: '呼吸引导', icon: 'wind' },
  { key: 'record' as const, label: '睡眠记录', icon: 'bar-chart' }
]

// ==================== AI 睡眠小贴士 ====================
const sleepTip = computed(() => sleepStore.sleepTip)
const isGeneratingTip = computed(() => sleepStore.isGeneratingTip)

async function handleGenerateTip(): Promise<void> {
  showAITip()
  await sleepStore.generateSleepTip()
}

// ==================== 睡眠质量记录 ====================
const sleepScore = ref(3)
const bedtime = ref('')
const wakeTime = ref('')
const sleepNote = ref('')

const scoreLabels = ['很差', '较差', '一般', '较好', '很好']
const scoreColors = ['#ff3b30', '#ff9500', '#8e8e93', '#34c759', '#34c759']

const todayScore = computed(() => sleepStore.todayRecord?.score ?? null)

async function handleSaveSleep(): Promise<void> {
  await sleepStore.recordSleep(sleepScore.value, bedtime.value || undefined, wakeTime.value || undefined, sleepNote.value || undefined)
  showToast({ type: 'success', message: '已记录今日睡眠' })
  bedtime.value = ''
  wakeTime.value = ''
  sleepNote.value = ''
}

// ==================== 7 日趋势图 ====================
const hasRecords = computed(() => sleepStore.recent7Days.length > 0)

const trendOption = computed<ECOption>(() => {
  const records = sleepStore.recent7Days
  const dates = records.map((r) => {
    const [, month, day] = r.date.split('-')
    return `${month}/${day}`
  })
  const scores = records.map((r) => r.score)
  const colors = records.map((r) => scoreColors[r.score - 1] || '#8e8e93')

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0
        const record = records[idx]
        if (!record) return ''
        return `${record.date}<br/>评分：${record.score}/5 ${scoreLabels[record.score - 1]}`
      }
    },
    grid: { left: 36, right: 16, top: 20, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, color: '#8e8e93' },
      axisLine: { lineStyle: { color: 'rgba(142,142,147,0.2)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5,
      interval: 1,
      axisLabel: { fontSize: 10, color: '#8e8e93' },
      splitLine: { lineStyle: { color: 'rgba(142,142,147,0.2)', type: 'dashed' } }
    },
    series: [
      {
        type: 'line',
        data: scores,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#5856d6', width: 2 },
        itemStyle: {
          color: (params: any) => colors[params.dataIndex] || '#5856d6'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(88, 86, 214, 0.25)' },
              { offset: 1, color: 'rgba(88, 86, 214, 0.02)' }
            ]
          }
        }
      }
    ]
  }
})

// ==================== AI 睡眠周报 ====================
const weeklyReport = ref('')
const showReport = ref(false)
const isGeneratingReport = ref(false)

async function handleGenerateReport(): Promise<void> {
  isGeneratingReport.value = true
  showAILoading('正在生成周报...')
  try {
    weeklyReport.value = await sleepStore.generateWeeklyReport()
    showReport.value = true
  } finally {
    isGeneratingReport.value = false
    closeToast()
  }
}

// PRD 7.2 #2：组件卸载时中止 SSE 流，防止内存泄漏
onUnmounted(() => {
  sleepStore.stopGenerating()
})

// ==================== 功能教程 ====================
const { needsTutorial, markTutorialDone } = useFeatureTutorial()
const showTutorial = ref(false)

const tutorialSteps: TutorialStep[] = [
  {
    selector: '',
    position: 'center',
    icon: 'moon',
    title: '欢迎来到睡眠辅助',
    description: '这里有多重助眠工具帮你安心好梦：AI 小贴士、白噪音混音、呼吸引导、睡眠记录。'
  },
  {
    selector: '.section-tabs',
    position: 'auto',
    icon: 'layout-grid',
    title: '功能模块切换',
    description: '点击上方标签，在 AI 小贴士、白噪音、呼吸引导、睡眠记录四个模块间自由切换。'
  },
  {
    selector: '.section-panel',
    position: 'auto',
    icon: 'lightbulb',
    title: 'AI 睡眠小贴士',
    description: '结合你的睡眠评分与饮食数据，AI 生成专属助眠建议，点击按钮即可获取。'
  },
  {
    selector: '.section-tabs',
    position: 'auto',
    icon: 'music',
    title: '更多助眠工具',
    description: '白噪音混音台可混合多音轨助你入睡；呼吸引导提供 4-7-8 等呼吸法放松身心；睡眠记录追踪质量趋势。'
  }
]

function handleTutorialComplete() {
  showTutorial.value = false
  markTutorialDone('sleep')
}

function handleTutorialSkip() {
  showTutorial.value = false
  markTutorialDone('sleep')
}

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!sleepStore.isLoaded) {
    await sleepStore.loadFromStorage()
  }
  // 从首页睡眠打卡跳转来时，直接定位到记录 tab
  const tab = route.query.tab as string | undefined
  if (tab === 'record' || tab === 'noise' || tab === 'breathing' || tab === 'tips') {
    activeSection.value = tab
  }
  // 如果今日已记录，回填评分
  if (sleepStore.todayRecord) {
    sleepScore.value = sleepStore.todayRecord.score
  }
  // 首次进入睡眠页时触发交互式教程（从首页跳转来时不触发）
  if (!tab && await needsTutorial('sleep')) {
    await nextTick()
    showTutorial.value = true
  }
})
</script>

<template>
  <div class="page-container sleep-page">
    <!-- 顶部 Hero -->
    <header class="sleep-hero">
      <div class="hero-row">
        <div class="hero-icon-box">
          <AppleIcon name="moon" :size="24" :style="{ color: 'var(--chart-4)' }" />
        </div>
        <div class="hero-text">
          <h1 class="hero-title">睡眠辅助</h1>
          <p class="hero-subtitle">
            {{ sleepStore.averageScore > 0 ? `平均睡眠 ${sleepStore.averageScore}/5` : '科学助眠 · 安心好梦' }}
          </p>
        </div>
      </div>
    </header>

    <!-- Section 切换（pill 样式） -->
    <div class="section-tabs-wrapper">
      <div class="section-tabs">
        <button
          v-for="sec in sections"
          :key="sec.key"
          class="section-tab"
          :class="{ active: activeSection === sec.key }"
          @click="activeSection = sec.key"
        >
          <AppleIcon :name="sec.icon" :size="14" />
          <span class="section-label">{{ sec.label }}</span>
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="page-body sleep-content">
      <!-- AI 睡眠小贴士 -->
      <div v-if="activeSection === 'tips'" class="section-panel">
        <GlassCard padding="md">
          <SectionTitle title="AI 睡眠小贴士" icon="lightbulb" color="var(--chart-4)" />
          <p class="panel-desc">结合你的睡眠评分与饮食数据，生成专属助眠建议</p>

          <div v-if="!sleepTip && !isGeneratingTip" class="tip-empty">
            <AppleIcon name="moon" :size="48" :style="{ color: 'var(--muted-foreground)', opacity: 0.5 }" />
            <p class="tip-empty-text">点击下方按钮，获取今晚的睡眠小贴士</p>
          </div>

          <div v-if="isGeneratingTip && !sleepTip" class="tip-loading">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <p class="tip-loading-text">AI 正在思考...</p>
          </div>

          <div v-if="sleepTip" class="tip-content">
            <div class="tip-text">{{ sleepTip }}<span v-if="isGeneratingTip" class="cursor">|</span></div>
          </div>

          <div class="tip-actions">
            <AuroraButton
              v-if="isGeneratingTip"
              type="secondary"
              size="lg"
              block
              @click="sleepStore.stopGenerating()"
            >
              停止生成
            </AuroraButton>
            <AuroraButton v-else size="lg" block @click="handleGenerateTip">
              {{ sleepTip ? '重新生成' : '生成小贴士' }}
            </AuroraButton>
          </div>
        </GlassCard>
      </div>

      <!-- 白噪音混音台 -->
      <div v-if="activeSection === 'noise'" class="section-panel">
        <GlassCard padding="md">
          <SectionTitle title="白噪音混音台" icon="music" color="var(--chart-4)" />
          <WhiteNoiseMixer />
        </GlassCard>
      </div>

      <!-- 呼吸引导 -->
      <div v-if="activeSection === 'breathing'" class="section-panel">
        <GlassCard padding="md">
          <SectionTitle title="呼吸引导" icon="wind" color="var(--chart-4)" />
          <BreathingGuide />
        </GlassCard>
      </div>

      <!-- 睡眠质量记录与趋势 -->
      <div v-if="activeSection === 'record'" class="section-panel record-stack">
        <!-- 今日记录 -->
        <GlassCard padding="md">
          <SectionTitle title="今日睡眠记录" icon="bar-chart" color="var(--chart-4)" />
          <div v-if="todayScore" class="today-badge">
            今日已记录：{{ todayScore }}/5 {{ scoreLabels[todayScore - 1] }}
          </div>

          <div class="score-section">
            <div class="score-section-label">睡眠评分</div>
            <div class="score-display">
              <span class="score-value" :style="{ color: scoreColors[sleepScore - 1] }">{{ sleepScore }}</span>
              <span class="score-max">/5</span>
              <span class="score-text">{{ scoreLabels[sleepScore - 1] }}</span>
            </div>
            <van-slider
              v-model="sleepScore"
              :min="1"
              :max="5"
              :step="1"
              bar-color="var(--chart-4)"
            />
          </div>

          <div class="time-section">
            <div class="time-item">
              <label class="time-label" for="sleep-bedtime">入睡时间</label>
              <input
                id="sleep-bedtime"
                v-model="bedtime"
                type="time"
                class="time-input"
                placeholder="如 23:30"
              />
            </div>
            <div class="time-item">
              <label class="time-label" for="sleep-wake">起床时间</label>
              <input
                id="sleep-wake"
                v-model="wakeTime"
                type="time"
                class="time-input"
                placeholder="如 07:00"
              />
            </div>
          </div>

          <div class="note-section">
            <label class="note-label" for="sleep-note">备注（可选）</label>
            <textarea
              id="sleep-note"
              v-model="sleepNote"
              class="note-input"
              placeholder="记录影响睡眠的因素，如咖啡、运动等"
              rows="2"
            ></textarea>
          </div>

          <AuroraButton size="lg" block class="save-btn" @click="handleSaveSleep">
            保存今日记录
          </AuroraButton>
        </GlassCard>

        <!-- 7 日趋势 -->
        <GlassCard padding="md">
          <SectionTitle title="近 7 日睡眠趋势" icon="activity" color="var(--chart-4)" />
          <div v-if="hasRecords" class="trend-chart">
            <EChart :option="trendOption" height="200px" />
          </div>
          <div v-else class="trend-empty">
            <AppleIcon name="bar-chart" :size="36" :style="{ color: 'var(--muted-foreground)', opacity: 0.5 }" />
            <p class="trend-empty-text">还没有睡眠记录</p>
            <p class="trend-empty-hint">坚持记录，查看你的睡眠趋势</p>
          </div>

          <div v-if="hasRecords" class="trend-summary">
            <div class="summary-tile">
              <span class="summary-label">记录天数</span>
              <span class="summary-value">{{ sleepStore.records.length }} 天</span>
            </div>
            <div class="summary-tile">
              <span class="summary-label">平均评分</span>
              <span class="summary-value summary-value-accent">{{ sleepStore.averageScore }}/5</span>
            </div>
          </div>

          <AuroraButton
            v-if="hasRecords"
            type="secondary"
            size="lg"
            block
            class="report-btn"
            :loading="isGeneratingReport"
            @click="handleGenerateReport"
          >
            {{ isGeneratingReport ? '生成中...' : '生成 AI 睡眠周报' }}
          </AuroraButton>
        </GlassCard>
      </div>
    </div>

    <!-- AI 周报弹窗 -->
    <van-dialog
      v-model:show="showReport"
      title="AI 睡眠周报"
      :show-confirm-button="true"
      :show-cancel-button="false"
      confirm-button-text="知道了"
      confirm-button-color="var(--chart-4)"
    >
      <div class="report-body">
        <div class="report-text">{{ weeklyReport }}</div>
      </div>
    </van-dialog>

    <!-- 功能教程 -->
    <FeatureTutorial
      :steps="tutorialSteps"
      :visible="showTutorial"
      @complete="handleTutorialComplete"
      @skip="handleTutorialSkip"
    />
  </div>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.sleep-page {
  max-width: 480px;
  margin: 0 auto;
  background-color: var(--background);
  /* chart-4 低透明度 tint（图标背景 / 标签底色） */
  --tint-4-01: color-mix(in srgb, var(--chart-4) 1%, transparent);
  --tint-4-04: color-mix(in srgb, var(--chart-4) 4%, transparent);
  --tint-4-10: color-mix(in srgb, var(--chart-4) 10%, transparent);
  --tint-4-12: color-mix(in srgb, var(--chart-4) 12%, transparent);
  --tint-4-15: color-mix(in srgb, var(--chart-4) 15%, transparent);
}

/* ==================== 顶部 Hero ==================== */
.sleep-hero {
  padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px 16px;
  background: linear-gradient(180deg, var(--tint-4-04) 0%, var(--tint-4-01) 100%);
}

.hero-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--tint-4-12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
  margin: 0;
}

.hero-subtitle {
  font-size: 14px;
  color: var(--muted-foreground);
  margin: 2px 0 0 0;
}

/* ==================== Section 切换 ==================== */
.section-tabs-wrapper {
  padding: 12px 16px;
}

.section-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.section-tabs::-webkit-scrollbar {
  display: none;
}

.section-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  min-height: 44px;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.section-tab:active {
  transform: scale(0.96);
  background: var(--accent);
}

.section-tab.active {
  background: var(--tint-4-12);
  border-color: var(--chart-4);
  color: var(--chart-4);
}

.section-label {
  line-height: 1;
  font-weight: 500;
}

/* ==================== 内容区 ==================== */
.sleep-content {
  padding: 0 16px 24px;
}

.section-panel {
  animation: fadeIn 0.3s ease-out;
}

.record-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin: 0 0 16px 0;
  line-height: 1.4;
}

/* ==================== AI 小贴士 ==================== */
.tip-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 20px 20px;
}

.tip-empty-text {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0;
  text-align: center;
}

.tip-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 20px;
}

.loading-dots {
  display: inline-flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chart-4);
  animation: bounce 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.tip-loading-text {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0;
}

.tip-content {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
}

.tip-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--foreground);
  white-space: pre-wrap;
}

.cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--chart-4);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to { visibility: hidden; }
}

.tip-actions {
  display: flex;
  justify-content: center;
}

/* ==================== 睡眠记录 ==================== */
.today-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--chart-4);
  background: var(--tint-4-12);
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 14px;
}

.score-section {
  margin-bottom: 18px;
}

.score-section-label {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0 0 14px;
}

.score-value {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}

.score-max {
  font-size: 16px;
  color: var(--muted-foreground);
}

.score-text {
  font-size: 14px;
  color: var(--muted-foreground);
  margin-left: auto;
}

.time-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.time-item {
  flex: 1;
  min-width: 0;
}

.time-label {
  display: block;
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 6px;
}

.time-input {
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--foreground);
  background: var(--muted);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  -webkit-appearance: none;
}

.time-input:focus {
  border-color: var(--chart-4);
}

.note-section {
  margin-bottom: 16px;
}

.note-label {
  display: block;
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 6px;
}

.note-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--foreground);
  background: var(--muted);
  resize: none;
  font-family: inherit;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
}

.note-input:focus {
  border-color: var(--chart-4);
}

.save-btn {
  margin-top: 4px;
}

/* ==================== 趋势图 ==================== */
.trend-chart {
  margin: 4px 0 0;
}

.trend-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 20px;
}

.trend-empty-text {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0;
}

.trend-empty-hint {
  font-size: 12px;
  color: var(--muted-foreground);
  opacity: 0.8;
  margin: 0;
}

.trend-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.summary-tile {
  background: var(--muted);
  border-radius: var(--radius-md);
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--foreground);
}

.summary-value-accent {
  color: var(--chart-4);
}

.report-btn {
  margin-top: 16px;
}

/* ==================== 周报弹窗 ==================== */
.report-body {
  padding: 8px 20px 20px;
  max-height: 60dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.report-text {
  font-size: 13px;
  line-height: 1.8;
  color: var(--foreground);
  white-space: pre-wrap;
}

/* ==================== 小屏适配 ==================== */
@media (max-width: 360px) {
  .sleep-hero {
    padding-left: 12px;
    padding-right: 12px;
  }
  .section-tabs-wrapper {
    padding-left: 12px;
    padding-right: 12px;
  }
  .sleep-content {
    padding-left: 12px;
    padding-right: 12px;
  }
  .time-section {
    gap: 8px;
  }
}
</style>
