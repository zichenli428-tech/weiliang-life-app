<script setup lang="ts">
/**
 * 睡眠辅助系统（Tab 4）
 * PRD 3.2：睡眠辅助系统
 * - AI 睡眠小贴士（流式输出，结合睡眠+饮食数据）
 * - 白噪音混音台（多音轨 + 独立音量 + 定时关闭）
 * - 呼吸引导（CSS3 呼吸球 + 4-7-8/箱式/快速放松）
 * - 睡眠质量记录与趋势（评分 + 7 日折线图 + AI 周报）
 * 重设计：暮光紫蓝暗色风格，玻璃拟态卡片
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import type { ECOption } from '@/types/echarts'

const sleepStore = useSleepStore()
const route = useRoute()

/** 当前 section：tips / noise / breathing / record */
const activeSection = ref<'tips' | 'noise' | 'breathing' | 'record'>('tips')

const sections = [
  { key: 'tips' as const, label: 'AI 小贴士', icon: '💡' },
  { key: 'noise' as const, label: '白噪音', icon: '🎵' },
  { key: 'breathing' as const, label: '呼吸引导', icon: '🫁' },
  { key: 'record' as const, label: '睡眠记录', icon: '📊' }
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

const scoreLabels = ['😴 很差', '😪 较差', '😐 一般', '😊 较好', '😴 很好']
const scoreColors = ['#fb7185', '#fbbf24', '#94a3b8', '#34d399', '#34d399']

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
  const colors = records.map((r) => scoreColors[r.score - 1] || '#94a3b8')

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
      axisLabel: { fontSize: 10, color: '#64748b' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5,
      interval: 1,
      axisLabel: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } }
    },
    series: [
      {
        type: 'line',
        data: scores,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#818cf8', width: 2 },
        itemStyle: {
          color: (params: any) => colors[params.dataIndex] || '#818cf8'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(129, 140, 248, 0.25)' },
              { offset: 1, color: 'rgba(129, 140, 248, 0.02)' }
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
})
</script>

<template>
  <div class="page-container sleep-page">
    <!-- 顶部导航 -->
    <div class="sleep-hero safe-area-top">
      <div class="flex items-center">
        <div class="flex-1">
          <div class="text-2xl font-bold text-white">睡眠辅助</div>
          <div class="text-sm text-white/80 mt-1">
            {{ sleepStore.averageScore > 0 ? `平均睡眠 ${sleepStore.averageScore}/5` : '科学助眠 · 安心好梦' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Section 切换 -->
    <div class="section-tabs-wrapper">
      <div class="section-tabs">
        <div
          v-for="sec in sections"
          :key="sec.key"
          class="section-tab"
          :class="{ active: activeSection === sec.key }"
          @click="activeSection = sec.key"
        >
          <span class="section-icon">{{ sec.icon }}</span>
          <span class="section-label">{{ sec.label }}</span>
        </div>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="page-body sleep-content">
      <!-- AI 睡眠小贴士 -->
      <div v-if="activeSection === 'tips'" class="section-panel">
        <GlassCard padding="md" glow="sleep" class="h-full">
          <SectionTitle title="AI 睡眠小贴士" icon="💡" class="!mb-3" />
          <p class="text-xs text-content-secondary mb-4">结合你的睡眠评分与饮食数据，生成专属助眠建议</p>

          <div v-if="!sleepTip && !isGeneratingTip" class="tip-empty">
            <div class="tip-empty-icon">🌙</div>
            <p class="tip-empty-text">点击下方按钮，获取今晚的睡眠小贴士</p>
          </div>

          <div v-if="isGeneratingTip && !sleepTip" class="tip-loading">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <p class="text-content-secondary">AI 正在思考...</p>
          </div>

          <div v-if="sleepTip" class="tip-content">
            <div class="tip-text">{{ sleepTip }}<span v-if="isGeneratingTip" class="cursor">|</span></div>
          </div>

          <div class="tip-actions">
            <AuroraButton
              v-if="isGeneratingTip"
              type="glass"
              block
              @click="sleepStore.stopGenerating()"
            >
              停止生成
            </AuroraButton>
            <AuroraButton v-else block @click="handleGenerateTip">
              {{ sleepTip ? '重新生成' : '生成小贴士' }}
            </AuroraButton>
          </div>
        </GlassCard>
      </div>

      <!-- 白噪音混音台 -->
      <div v-if="activeSection === 'noise'" class="section-panel">
        <GlassCard padding="md" glow="sleep" class="h-full">
          <SectionTitle title="白噪音混音台" icon="🎵" class="!mb-3" />
          <WhiteNoiseMixer />
        </GlassCard>
      </div>

      <!-- 呼吸引导 -->
      <div v-if="activeSection === 'breathing'" class="section-panel">
        <GlassCard padding="md" glow="sleep" class="h-full">
          <SectionTitle title="呼吸引导" icon="🫁" class="!mb-3" />
          <BreathingGuide />
        </GlassCard>
      </div>

      <!-- 睡眠质量记录与趋势 -->
      <div v-if="activeSection === 'record'" class="section-panel space-y-4">
        <!-- 今日记录 -->
        <GlassCard padding="md" glow="sleep">
          <SectionTitle title="今日睡眠记录" icon="📊" class="!mb-3" />
          <div v-if="todayScore" class="today-badge">
            今日已记录：{{ todayScore }}/5 {{ scoreLabels[todayScore - 1] }}
          </div>

          <div class="score-section">
            <div class="text-xs text-content-secondary mb-2">睡眠评分</div>
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
              bar-color="#818cf8"
            />
          </div>

          <div class="time-section">
            <div class="time-item">
              <div class="time-label">入睡时间</div>
              <input v-model="bedtime" type="time" class="time-input" placeholder="如 23:30" />
            </div>
            <div class="time-item">
              <div class="time-label">起床时间</div>
              <input v-model="wakeTime" type="time" class="time-input" placeholder="如 07:00" />
            </div>
          </div>

          <div class="note-section">
            <div class="note-label">备注（可选）</div>
            <textarea
              v-model="sleepNote"
              class="note-input"
              placeholder="记录影响睡眠的因素，如咖啡、运动等"
              rows="2"
            ></textarea>
          </div>

          <AuroraButton block class="mt-4" @click="handleSaveSleep">
            保存今日记录
          </AuroraButton>
        </GlassCard>

        <!-- 7 日趋势 -->
        <GlassCard padding="md" glow="sleep">
          <SectionTitle title="近 7 日睡眠趋势" icon="📈" class="!mb-3" />
          <div v-if="hasRecords" class="trend-chart">
            <EChart :option="trendOption" height="200px" />
          </div>
          <div v-else class="trend-empty">
            <div class="trend-empty-icon">📊</div>
            <p class="trend-empty-text">还没有睡眠记录</p>
            <p class="trend-empty-hint">坚持记录，查看你的睡眠趋势</p>
          </div>

          <div v-if="hasRecords" class="trend-summary">
            <GlassCard padding="sm" class="summary-item">
              <span class="summary-label">记录天数</span>
              <span class="summary-value">{{ sleepStore.records.length }} 天</span>
            </GlassCard>
            <GlassCard padding="sm" class="summary-item">
              <span class="summary-label">平均评分</span>
              <span class="summary-value">{{ sleepStore.averageScore }}/5</span>
            </GlassCard>
          </div>

          <AuroraButton
            v-if="hasRecords"
            type="glass"
            block
            class="mt-4"
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
      confirm-button-color="#818cf8"
    >
      <div class="report-body">
        <div class="report-text">{{ weeklyReport }}</div>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped>
.sleep-page {
  background:
    radial-gradient(ellipse at top right, rgba(129, 140, 248, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at bottom left, rgba(192, 132, 252, 0.08) 0%, transparent 50%),
    linear-gradient(180deg, #0b1220 0%, #13102a 100%);
}

/* ==================== 顶部 Hero ==================== */
.sleep-hero {
  position: relative;
  padding: 20px 16px 24px;
  background:
    radial-gradient(ellipse at top right, rgba(129, 140, 248, 0.2) 0%, transparent 55%),
    linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
  overflow: hidden;
}

.sleep-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 100%);
  pointer-events: none;
}

/* ==================== Section 切换 ==================== */
.section-tabs-wrapper {
  padding: 12px 16px;
}

.section-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.section-tabs::-webkit-scrollbar {
  display: none;
}

.section-tab {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: #94a3b8;
  font-size: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.section-tab:active {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.1);
}

.section-tab.active {
  background: rgba(129, 140, 248, 0.12);
  border-color: rgba(129, 140, 248, 0.35);
  color: #a5b4fc;
  box-shadow: 0 0 16px rgba(129, 140, 248, 0.2);
}

.section-icon {
  font-size: 16px;
  line-height: 1;
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

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ==================== AI 小贴士 ==================== */
.tip-empty {
  text-align: center;
  padding: 36px 20px;
}

.tip-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.8;
}

.tip-empty-text {
  font-size: 13px;
  color: #94a3b8;
}

.tip-loading {
  text-align: center;
  padding: 36px 20px;
}

.loading-dots {
  display: inline-flex;
  gap: 4px;
  margin-bottom: 10px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #818cf8;
  animation: bounce 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.tip-content {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.tip-text {
  font-size: 14px;
  line-height: 1.8;
  color: #f8fafc;
  white-space: pre-wrap;
}

.cursor {
  display: inline-block;
  margin-left: 1px;
  color: #a5b4fc;
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
  color: #a5b4fc;
  background: rgba(129, 140, 248, 0.12);
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 14px;
}

.score-section {
  margin-bottom: 18px;
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 8px 0 14px;
}

.score-value {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}

.score-max {
  font-size: 16px;
  color: #64748b;
}

.score-text {
  font-size: 14px;
  color: #94a3b8;
  margin-left: auto;
}

.time-section {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.time-item {
  flex: 1;
}

.time-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.time-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 14px;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.06);
  outline: none;
}

.time-input:focus {
  border-color: rgba(129, 140, 248, 0.4);
}

.note-section {
  margin-bottom: 6px;
}

.note-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.note-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 13px;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.06);
  resize: none;
  font-family: inherit;
  outline: none;
}

.note-input:focus {
  border-color: rgba(129, 140, 248, 0.4);
}

/* ==================== 趋势图 ==================== */
.trend-chart {
  margin: 10px 0;
}

.trend-empty {
  text-align: center;
  padding: 30px 20px;
}

.trend-empty-icon {
  font-size: 36px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.trend-empty-text {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.trend-empty-hint {
  font-size: 12px;
  color: #64748b;
}

.trend-summary {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.summary-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}

/* ==================== 周报弹窗 ==================== */
.report-body {
  padding: 8px 20px 20px;
  max-height: 400px;
  overflow-y: auto;
}

.report-text {
  font-size: 13px;
  line-height: 1.8;
  color: #f8fafc;
  white-space: pre-wrap;
}
</style>
