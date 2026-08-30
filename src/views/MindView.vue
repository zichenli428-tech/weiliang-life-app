<script setup lang="ts">
/**
 * AI 心理疏导（Tab 3）
 * PRD 3.3：心理疏导模块
 * - 首次进入免责声明与欢迎语
 * - SSE 流式对话 + 情绪感知
 * - 对话风格定制（温暖的朋友 / 专业顾问 / 正念导师）
 * - 危机干预：自杀/自残倾向检测 → 热线预警
 * - 情绪日记入口（Task #17 接入）
 * 重设计：Apple 风格浅色主题，模块主色 chart-5（品红），实色卡片
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useMindStore } from '@/store/modules/mind'
import { showAITip } from '@/utils/aiToast'
import { useUserStore } from '@/store/modules/user'
import {
  emotionMap,
  roleStyleMap,
  type EmotionType,
  type MindRoleStyle
} from '@/types/mind'
import EChart from '@/components/EChart.vue'
import GlassCard from '@/components/GlassCard.vue'
import AppleIcon from '@/components/AppleIcon.vue'
import type { ECOption } from '@/types/echarts'

const mindStore = useMindStore()
const userStore = useUserStore()

// ==================== 免责声明（首次进入） ====================
const DISCLAIMER_KEY = 'mind_disclaimer_accepted'
const showDisclaimer = ref(false)

// ==================== 角色风格选择 ====================
const showRoleSheet = ref(false)
const roleList = computed(() => Object.values(roleStyleMap))
const currentRole = computed(() => roleStyleMap[mindStore.roleStyle])

async function handleRoleSelect(style: MindRoleStyle) {
  await mindStore.setRoleStyle(style)
  showRoleSheet.value = false
  showToast(`已切换为「${roleStyleMap[style].label}」`)
}

// ==================== 危机干预弹窗 ====================
const showCrisisModal = ref(false)

// ==================== 情绪日记入口（Task #17） ====================
const showEmotionSheet = ref(false)
const emotionList = computed(() => Object.values(emotionMap))
const selectedEmotionScore = ref(3)
/** 情绪日记面板当前 tab：record 记录 / trend 趋势 */
const emotionTab = ref<'record' | 'trend'>('record')
/** 趋势图周期：7 或 30 天 */
const trendPeriod = ref<7 | 30>(7)

async function handleSaveEmotion(emotion: EmotionType) {
  await mindStore.recordEmotion(emotion, selectedEmotionScore.value)
  showEmotionSheet.value = false
  showToast({
    type: 'success',
    message: `已记录今日情绪：${emotionMap[emotion].label}`
  })
}

/** 趋势图展示用的情绪记录（按周期截取） */
const trendEmotionRecords = computed(() => {
  const records = mindStore.emotionRecords
  return records.slice(-trendPeriod.value)
})

/** ECharts 情绪趋势图配置 */
const emotionTrendOption = computed<ECOption>(() => {
  const records = trendEmotionRecords.value
  const dates = records.map((r) => {
    const [, month, day] = r.date.split('-')
    return `${month}/${day}`
  })
  const scores = records.map((r) => r.score)
  const colors = records.map((r) => emotionMap[r.emotion].color)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0
        const record = records[idx]
        if (!record) return ''
        const info = emotionMap[record.emotion]
        return `${record.date}<br/>${info.icon} ${info.label}<br/>强度：${record.score}/5`
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
        lineStyle: { color: '#af52de', width: 2 },
        itemStyle: {
          color: (params: any) => colors[params.dataIndex] || '#af52de'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(175, 82, 222, 0.20)' },
              { offset: 1, color: 'rgba(175, 82, 222, 0.02)' }
            ]
          }
        }
      }
    ]
  }
})

// ==================== 情绪快捷表达（无消息时展示） ====================
const emotionQuickChats = computed(() => [
  { emotion: 'anxious' as EmotionType, text: '最近总是感到焦虑，心里不踏实' },
  { emotion: 'stressed' as EmotionType, text: '工作压力好大，感觉快撑不住了' },
  { emotion: 'sad' as EmotionType, text: '今天心情有点低落，提不起劲' },
  { emotion: 'lonely' as EmotionType, text: '感觉很孤独，好像没人理解我' },
  { emotion: 'angry' as EmotionType, text: '发生了一些事，让我很生气' },
  { emotion: 'tired' as EmotionType, text: '最近总是很疲惫，精力跟不上' }
])

// ==================== 输入与发送 ====================
const inputValue = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const messages = computed(() => mindStore.activeMessages)
const hasMessages = computed(() => messages.value.length > 0)
const isResponding = computed(() => mindStore.isResponding)

// 复制回复
const copiedId = ref<string | null>(null)
const copyMessage = async (id: string, text: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    copiedId.value = id
    setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 2000)
  } catch {
    showToast('复制失败，请长按文字手动复制')
  }
}

const handleSend = async (text?: string) => {
  const content = (text ?? inputValue.value).trim()
  if (!content || isResponding.value) return

  mindStore.ensureActiveSession()
  mindStore.addMessage('user', content)
  inputValue.value = ''
  await nextTick()
  scrollToBottom()

  // 调用 AI 流式回复（store 内部会检测危机关键词）
  showAITip()
  const result = await mindStore.assistantReply(content)
  await nextTick()
  scrollToBottom()

  // 危机干预：弹出热线预警弹窗
  if (result.crisis) {
    showCrisisModal.value = true
  }
}

const handleQuickChat = (item: { emotion: EmotionType; text: string }) => {
  handleSend(item.text)
}

// ==================== 自动滚动 ====================
function scrollToBottom() {
  const el = messagesEl.value
  if (el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

watch(
  () => messages.value.length,
  () => nextTick(scrollToBottom)
)

watch(
  () => messages.value.map((m) => m.content).join(''),
  () => {
    if (isResponding.value) {
      nextTick(scrollToBottom)
    }
  }
)

// ==================== 会话管理 ====================
const handleNewSession = () => {
  mindStore.createSession()
  inputValue.value = ''
}

const handleClearSession = () => {
  if (!hasMessages.value) return
  showConfirmDialog({
    title: '清空当前对话',
    message: '将清空当前心理疏导对话的所有消息，确定吗？',
    confirmButtonColor: '#af52de'
  })
    .then(async () => {
      const session = mindStore.activeSession
      if (session) {
        session.messages = []
        session.title = '新对话'
        session.updatedAt = Date.now()
        await mindStore.saveToStorage()
      }
    })
    .catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!mindStore.isLoaded) {
    await mindStore.loadFromStorage()
  }
  if (!mindStore.activeSession) {
    mindStore.createSession()
  }

  // 首次进入展示免责声明
  const accepted = localStorage.getItem(DISCLAIMER_KEY)
  if (!accepted) {
    showDisclaimer.value = true
  }

  await nextTick()
  scrollToBottom()
})

const handleAcceptDisclaimer = () => {
  localStorage.setItem(DISCLAIMER_KEY, '1')
  showDisclaimer.value = false
}

// PRD 7.2 #2：组件卸载时中止 SSE 流，防止内存泄漏
onUnmounted(() => {
  mindStore.stopGenerating()
})
</script>

<template>
  <div class="page-container mind-page">
    <!-- 顶部 Hero -->
    <header class="mind-hero safe-area-top">
      <div class="hero-row">
        <div class="hero-left">
          <span class="role-chip">
            <AppleIcon
              :name="({ warm_friend: 'heart', professional: 'target', mindfulness: 'leaf' } as Record<string, string>)[currentRole.key]"
              :size="13"
            />
            {{ currentRole.label }}
          </span>
          <h1 class="hero-title">心理疏导</h1>
          <div class="hero-status">
            <span class="status-dot" :class="{ pulsing: isResponding }"></span>
            <span>{{ isResponding ? '正在倾听…' : '我在这里陪你' }}</span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="act-btn" aria-label="情绪日记" @click="showEmotionSheet = true">
            <AppleIcon name="smile" :size="18" />
          </button>
          <button class="act-btn" aria-label="切换对话风格" @click="showRoleSheet = true">
            <AppleIcon name="user" :size="18" />
          </button>
          <button class="act-btn" aria-label="新会话" @click="handleNewSession">
            <AppleIcon name="plus" :size="18" />
          </button>
          <button class="act-btn" aria-label="清空会话" @click="handleClearSession">
            <AppleIcon name="trash-2" :size="18" />
          </button>
        </div>
      </div>
    </header>

    <!-- 边界声明条 -->
    <div class="boundary-bar">
      <AppleIcon name="info" :size="12" :style="{ color: 'var(--muted-foreground)' }" />
      <span>AI 无法替代专业心理咨询，如有紧急情况请拨打热线</span>
    </div>

    <!-- 消息列表区 -->
    <div ref="messagesEl" class="messages-area">
      <!-- 欢迎卡片（无消息时） -->
      <div v-if="!hasMessages" class="welcome-section">
        <GlassCard padding="lg" class="welcome-card">
          <div class="welcome-avatar">
            <AppleIcon name="heart" :size="30" :style="{ color: 'var(--chart-5)' }" />
          </div>
          <div class="welcome-title-row">
            <h2 class="welcome-title">你好，{{ userStore.profile.nickname || '朋友' }}</h2>
            <AppleIcon name="leaf" :size="16" :style="{ color: 'var(--chart-5)' }" />
          </div>
          <p class="welcome-desc">
            这里是一个安全的空间，你可以随时和我聊聊心里的感受。无论开心、难过、焦虑还是迷茫，我都会认真倾听。
          </p>
          <p class="welcome-tip">选择一种感受，或者直接告诉我你的心情</p>
        </GlassCard>

        <!-- 情绪快捷表达（无消息时） -->
        <div class="emotion-chats">
          <div
            v-for="item in emotionQuickChats"
            :key="item.emotion"
            class="emo-row"
            role="button"
            tabindex="0"
            @click="handleQuickChat(item)"
          >
            <span
              class="emo-ico"
              :style="{
                background: `color-mix(in srgb, ${emotionMap[item.emotion].color} 14%, transparent)`,
                color: emotionMap[item.emotion].color
              }"
            >
              <AppleIcon
                :name="({ happy: 'smile', calm: 'leaf', anxious: 'circle-alert', sad: 'droplet', angry: 'flame', stressed: 'zap', tired: 'moon', lonely: 'user' } as Record<string, string>)[item.emotion]"
                :size="18"
              />
            </span>
            <span class="emo-text">{{ item.text }}</span>
            <AppleIcon name="chevron-right" :size="18" class="emo-chevron" />
          </div>
        </div>
      </div>

      <!-- 消息气泡 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
      >
        <div v-if="msg.role === 'assistant'" class="msg-avatar assistant-avatar">
          <AppleIcon name="leaf" :size="18" :style="{ color: 'var(--chart-5)' }" />
        </div>
        <div class="msg-bubble-wrap">
          <div
            v-if="msg.role === 'assistant' && msg.detectedEmotion"
            class="emotion-tag"
          >
            <AppleIcon
              :name="({ happy: 'smile', calm: 'leaf', anxious: 'circle-alert', sad: 'droplet', angry: 'flame', stressed: 'zap', tired: 'moon', lonely: 'user' } as Record<string, string>)[msg.detectedEmotion]"
              :size="11"
            />
            <span>感知到：{{ emotionMap[msg.detectedEmotion].label }}</span>
          </div>
          <div class="msg-bubble">
            <div class="msg-content">{{ msg.content }}<span v-if="msg.streaming" class="cursor">|</span></div>
            <button
              v-if="msg.role === 'assistant' && msg.content && !msg.streaming"
              class="copy-btn"
              @click="copyMessage(msg.id, msg.content)"
            >
              <AppleIcon :name="copiedId === msg.id ? 'check' : 'copy'" :size="12" />
              {{ copiedId === msg.id ? '已复制' : '复制' }}
            </button>
          </div>
        </div>
        <div v-if="msg.role === 'user'" class="msg-avatar user-avatar">
          {{ userStore.profile.nickname?.charAt(0) || '我' }}
        </div>
      </div>

      <!-- 加载指示 -->
      <div
        v-if="isResponding && messages.length > 0 && !messages[messages.length - 1].content"
        class="loading-row"
      >
        <div class="msg-avatar assistant-avatar">
          <AppleIcon name="leaf" :size="18" :style="{ color: 'var(--chart-5)' }" />
        </div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
      <div class="input-row">
        <van-field
          v-model="inputValue"
          placeholder="说说你现在的感受…"
          class="input-field"
          type="textarea"
          :autosize="{ maxHeight: 96, minHeight: 48 }"
          @keydown.enter.prevent="handleSend()"
        />
        <button
          class="send-btn"
          :disabled="!inputValue.trim() || isResponding"
          aria-label="发送"
          @click="handleSend()"
        >
          <AppleIcon name="send-horizontal" :size="18" />
        </button>
      </div>
    </div>

    <!-- 首次免责声明弹窗 -->
    <van-dialog
      v-model:show="showDisclaimer"
      title="心理疏导 · 欢迎语"
      :show-confirm-button="true"
      :show-cancel-button="false"
      confirm-button-text="我了解了"
      confirm-button-color="#af52de"
      :close-on-click-overlay="false"
      @confirm="handleAcceptDisclaimer"
    >
      <div class="disclaimer-body">
        <div class="dialog-icon">
          <AppleIcon name="leaf" :size="32" :style="{ color: 'var(--chart-5)' }" />
        </div>
        <p class="disclaimer-welcome">
          欢迎来到心理疏导空间。<br />这里是一个安全、不评判的倾听角落。
        </p>
        <GlassCard padding="md" class="disclaimer-list">
          <p>AI 会尽最大努力陪伴你、倾听你。</p>
          <p><strong>AI 无法替代专业心理咨询或医疗诊断。</strong></p>
          <p>如有严重心理困扰，请寻求专业帮助。</p>
          <p>对话记录仅保存在你的本地设备，不会上传。</p>
          <p>若你出现自伤/自杀念头，请立即拨打心理援助热线。</p>
        </GlassCard>
        <div class="hotline-block">
          <div class="hotline-row">
            <AppleIcon name="message-circle" :size="14" :style="{ color: 'var(--chart-5)' }" />
            <span>北京心理援助热线 <strong>010-82951332</strong></span>
          </div>
          <div class="hotline-row">
            <AppleIcon name="message-circle" :size="14" :style="{ color: 'var(--chart-5)' }" />
            <span>全国心理援助热线 <strong>400-161-9995</strong></span>
          </div>
        </div>
      </div>
    </van-dialog>

    <!-- 危机干预弹窗 -->
    <van-dialog
      v-model:show="showCrisisModal"
      title="你并不孤单"
      :show-confirm-button="true"
      :show-cancel-button="false"
      confirm-button-text="我知道了"
      confirm-button-color="#ff3b30"
      :close-on-click-overlay="false"
    >
      <div class="crisis-body">
        <div class="dialog-icon">
          <AppleIcon name="heart" :size="34" :style="{ color: 'var(--destructive)' }" />
        </div>
        <p class="crisis-text">
          你愿意说出来，已经很勇敢了。<br />你的感受是真实的，也是重要的。
        </p>
        <p class="crisis-text">请立即联系专业的人帮助你：</p>
        <GlassCard padding="md" class="crisis-hotlines">
          <div class="hotline-row">
            <AppleIcon name="message-circle" :size="14" :style="{ color: 'var(--destructive)' }" />
            <span>北京心理援助热线<br /><strong>010-82951332</strong></span>
          </div>
          <div class="hotline-row">
            <AppleIcon name="message-circle" :size="14" :style="{ color: 'var(--destructive)' }" />
            <span>全国心理援助热线<br /><strong>400-161-9995</strong></span>
          </div>
          <div class="hotline-row">
            <AppleIcon name="message-circle" :size="14" :style="{ color: 'var(--destructive)' }" />
            <span>希望24热线<br /><strong>400-161-9995</strong></span>
          </div>
        </GlassCard>
        <p class="crisis-emergency">如处于紧急危险中，请立即拨打 120 或前往最近医院急诊。</p>
      </div>
    </van-dialog>

    <!-- 角色风格选择 -->
    <van-action-sheet
      v-model:show="showRoleSheet"
      title="选择 AI 对话风格"
      :close-on-click-action="true"
      :style="{ '--van-action-sheet-max-height': '90dvh' }"
    >
      <div class="role-list">
        <div
          v-for="role in roleList"
          :key="role.key"
          class="role-item"
          :class="{ active: role.key === mindStore.roleStyle }"
          role="button"
          tabindex="0"
          @click="handleRoleSelect(role.key)"
        >
          <div class="role-ico">
            <AppleIcon
              :name="({ warm_friend: 'heart', professional: 'target', mindfulness: 'leaf' } as Record<string, string>)[role.key]"
              :size="20"
              :style="{ color: 'var(--chart-5)' }"
            />
          </div>
          <div class="role-info">
            <div class="role-label">{{ role.label }}</div>
            <div class="role-desc">{{ role.desc }}</div>
          </div>
          <AppleIcon
            v-if="role.key === mindStore.roleStyle"
            name="circle-check"
            :size="20"
            :style="{ color: 'var(--chart-5)' }"
          />
        </div>
      </div>
    </van-action-sheet>

    <!-- 情绪日记记录 + 趋势 -->
    <van-action-sheet
      v-model:show="showEmotionSheet"
      title="情绪日记"
      :close-on-click-action="true"
      :style="{ '--van-action-sheet-max-height': '90dvh' }"
    >
      <div class="emotion-diary">
        <!-- Tab 切换 -->
        <div class="emotion-tabs">
          <div
            class="emotion-tab"
            :class="{ active: emotionTab === 'record' }"
            @click="emotionTab = 'record'"
          >
            记录今日
          </div>
          <div
            class="emotion-tab"
            :class="{ active: emotionTab === 'trend' }"
            @click="emotionTab = 'trend'"
          >
            情绪趋势
          </div>
        </div>

        <!-- 记录 Tab -->
        <div v-if="emotionTab === 'record'">
          <p class="emotion-diary-hint">选择一个最贴近你此刻感受的情绪</p>
          <div class="emotion-grid">
            <div
              v-for="emotion in emotionList"
              :key="emotion.type"
              class="emotion-card"
              role="button"
              tabindex="0"
              @click="handleSaveEmotion(emotion.type)"
            >
              <span
                class="emotion-card-ico"
                :style="{
                  background: `color-mix(in srgb, ${emotion.color} 14%, transparent)`,
                  color: emotion.color
                }"
              >
                <AppleIcon
                  :name="({ happy: 'smile', calm: 'leaf', anxious: 'circle-alert', sad: 'droplet', angry: 'flame', stressed: 'zap', tired: 'moon', lonely: 'user' } as Record<string, string>)[emotion.type]"
                  :size="20"
                />
              </span>
              <div class="emotion-card-label">{{ emotion.label }}</div>
            </div>
          </div>
          <div class="emotion-score">
            <span class="emotion-score-label">情绪强度</span>
            <van-slider
              v-model="selectedEmotionScore"
              :min="1"
              :max="5"
              :step="1"
              bar-color="#af52de"
              inactive-color="#e5e5ea"
            />
            <span class="emotion-score-value">{{ selectedEmotionScore }}/5</span>
          </div>
          <p v-if="mindStore.recentEmotions.length > 0" class="emotion-history-tip">
            已记录 {{ mindStore.emotionRecords.length }} 天情绪日记
          </p>
        </div>

        <!-- 趋势 Tab -->
        <div v-else class="emotion-trend">
          <div class="trend-period-switch">
            <div
              class="period-chip"
              :class="{ active: trendPeriod === 7 }"
              @click="trendPeriod = 7"
            >
              近 7 天
            </div>
            <div
              class="period-chip"
              :class="{ active: trendPeriod === 30 }"
              @click="trendPeriod = 30"
            >
              近 30 天
            </div>
          </div>
          <GlassCard v-if="trendEmotionRecords.length > 0" padding="sm" class="trend-chart-wrap">
            <EChart :option="emotionTrendOption" height="220px" />
          </GlassCard>
          <div v-else class="trend-empty">
            <div class="trend-empty-icon">
              <AppleIcon name="bar-chart" :size="36" :style="{ color: 'var(--muted-foreground)' }" />
            </div>
            <p class="trend-empty-text">还没有情绪记录</p>
            <p class="trend-empty-hint">去"记录今日"写下你的第一份情绪日记吧</p>
          </div>
          <div v-if="trendEmotionRecords.length > 0" class="trend-summary">
            <GlassCard padding="sm" class="trend-summary-item">
              <span class="trend-summary-label">记录天数</span>
              <span class="trend-summary-value">{{ mindStore.emotionRecords.length }} 天</span>
            </GlassCard>
            <GlassCard padding="sm" class="trend-summary-item">
              <span class="trend-summary-label">平均强度</span>
              <span class="trend-summary-value">
                {{ trendEmotionRecords.length > 0
                  ? (trendEmotionRecords.reduce((s, r) => s + r.score, 0) / trendEmotionRecords.length).toFixed(1)
                  : '-' }}/5
              </span>
            </GlassCard>
          </div>
        </div>
      </div>
    </van-action-sheet>
  </div>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.mind-page {
  min-height: 0;
  height: calc(100dvh - 56px - env(safe-area-inset-bottom, 0px));
  max-width: 480px;
  margin: 0 auto;
  background: var(--background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

/* ==================== 顶部 Hero ==================== */
.mind-hero {
  position: relative;
  padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px 14px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  flex-shrink: 0;
}
.mind-hero::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: var(--chart-5);
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
  flex: 1;
}
.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--chart-5) 12%, transparent);
  color: var(--chart-5);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
}
.hero-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
  margin: 0;
}
.hero-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent);
  flex-shrink: 0;
}
.status-dot.pulsing {
  background: var(--chart-3);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--chart-3) 20%, transparent);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.act-btn {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.act-btn:active {
  opacity: 0.55;
  transform: scale(0.96);
}

/* ==================== 边界声明条 ==================== */
.boundary-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--muted);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted-foreground);
  line-height: 1.4;
  flex-shrink: 0;
}

/* ==================== 消息列表 ==================== */
.messages-area {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 16px 14px 20px;
}

.welcome-section {
  margin-bottom: 8px;
}
.welcome-card {
  text-align: center;
  margin-bottom: 16px;
}
.welcome-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--chart-5) 14%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}
.welcome-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
}
.welcome-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}
.welcome-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.7;
  margin: 0 0 10px;
}
.welcome-tip {
  font-size: 12px;
  color: var(--muted-foreground);
  margin: 0;
}

/* ==================== 情绪快捷表达 ==================== */
.emotion-chats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.emo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.emo-row:active {
  opacity: 0.7;
  transform: scale(0.99);
}
.emo-ico {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.emo-text {
  flex: 1;
  font-size: 13px;
  color: var(--foreground);
  line-height: 1.5;
  min-width: 0;
}
.emo-chevron {
  color: var(--muted-foreground);
  flex-shrink: 0;
}

/* ==================== 消息气泡 ==================== */
.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}
.message-row.is-user {
  flex-direction: row-reverse;
}
.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}
.assistant-avatar {
  background: color-mix(in srgb, var(--chart-5) 16%, transparent);
}
.user-avatar {
  background: var(--chart-1);
  color: var(--primary-foreground);
}
.msg-bubble-wrap {
  min-width: 0;
  max-width: calc(78% + 40px);
}
.msg-bubble {
  display: inline-block;
  max-width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  word-break: break-word;
}
.is-assistant .msg-bubble {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border-top-left-radius: var(--radius-sm);
}
.is-user .msg-bubble {
  background: var(--chart-1);
  color: var(--primary-foreground);
  border-top-right-radius: var(--radius-sm);
}
.emotion-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--chart-5);
  background: color-mix(in srgb, var(--chart-5) 12%, transparent);
  padding: 3px 8px;
  border-radius: 9999px;
  margin-bottom: 6px;
}
.msg-content {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.is-user .msg-content {
  font-weight: 500;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--muted-foreground);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 24px;
}
.copy-btn:active {
  transform: scale(0.95);
  background: var(--secondary);
}
.cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--chart-5);
  animation: blink 1s steps(2, start) infinite;
}
@keyframes blink {
  to { visibility: hidden; }
}

.loading-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}
.loading-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--secondary);
  border-radius: var(--radius-lg);
  border-top-left-radius: var(--radius-sm);
}
.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chart-5);
  animation: bounce 1.2s ease-in-out infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ==================== 输入区 ==================== */
.input-area {
  flex-shrink: 0;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--card);
  border-top: 1px solid var(--border);
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.input-field {
  flex: 1;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 4px 14px;
}
.input-field :deep(.van-field__control) {
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
}
.send-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--chart-5);
  color: var(--primary-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.send-btn:active {
  opacity: 0.7;
  transform: scale(0.96);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==================== 弹窗通用 ==================== */
.dialog-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--chart-5) 14%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 4px auto 12px;
}
.crisis-body .dialog-icon {
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

/* ==================== 免责声明弹窗 ==================== */
.disclaimer-body {
  padding: 8px 20px 20px;
  text-align: center;
}
.disclaimer-welcome {
  font-size: 14px;
  color: var(--foreground);
  line-height: 1.7;
  margin: 0 0 14px;
}
.disclaimer-list {
  text-align: left;
  margin-bottom: 14px;
}
.disclaimer-list :deep(p) {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.8;
  margin: 0;
  padding-left: 14px;
  position: relative;
}
.disclaimer-list :deep(p)::before {
  content: '·';
  position: absolute;
  left: 4px;
  color: var(--muted-foreground);
}
.disclaimer-list :deep(strong) {
  color: var(--chart-5);
  font-weight: 600;
}
.hotline-block {
  background: color-mix(in srgb, var(--chart-5) 8%, transparent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.hotline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.6;
  padding: 4px 0;
}
.hotline-row strong {
  color: var(--chart-5);
  font-size: 14px;
  font-weight: 600;
}

/* ==================== 危机干预弹窗 ==================== */
.crisis-body {
  padding: 8px 20px 20px;
  text-align: center;
}
.crisis-text {
  font-size: 13px;
  color: var(--foreground);
  line-height: 1.7;
  margin: 8px 0;
}
.crisis-hotlines {
  text-align: left;
  margin: 12px 0;
}
.crisis-hotlines .hotline-row {
  margin: 6px 0;
}
.crisis-hotlines .hotline-row strong {
  color: var(--destructive);
  font-size: 15px;
}
.crisis-emergency {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin-top: 8px;
}

/* ==================== 角色风格选择 ==================== */
.role-list {
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
}
.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 14px;
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.role-item.active {
  background: color-mix(in srgb, var(--chart-5) 8%, transparent);
  border-color: color-mix(in srgb, var(--chart-5) 40%, transparent);
}
.role-item:active {
  background: var(--muted);
}
.role-ico {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--chart-5) 12%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.role-info {
  flex: 1;
  min-width: 0;
}
.role-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
.role-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}

/* ==================== 情绪日记 ==================== */
.emotion-diary {
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  max-height: 78dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.emotion-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 4px;
}
.emotion-tab {
  flex: 1;
  text-align: center;
  padding: 14px 10px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--muted-foreground);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  cursor: pointer;
}
.emotion-tab.active {
  background: var(--card);
  color: var(--foreground);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.emotion-diary-hint {
  font-size: 13px;
  color: var(--muted-foreground);
  text-align: center;
  margin-bottom: 16px;
}
.emotion-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.emotion-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 6px;
  min-height: 48px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.emotion-card:active {
  transform: scale(0.95);
}
.emotion-card-ico {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.emotion-card-label {
  font-size: 11px;
  color: var(--muted-foreground);
}
.emotion-score {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}
.emotion-score-label {
  font-size: 12px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}
.emotion-score-value {
  font-size: 12px;
  color: var(--chart-5);
  font-weight: 600;
  flex-shrink: 0;
}
.emotion-history-tip {
  font-size: 11px;
  color: var(--muted-foreground);
  text-align: center;
  margin-top: 12px;
}

/* ==================== 情绪趋势 ==================== */
.emotion-trend {
  min-height: 280px;
}
.trend-period-switch {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}
.period-chip {
  padding: 12px 20px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--muted-foreground);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 9999px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s ease;
}
.period-chip.active {
  background: color-mix(in srgb, var(--chart-5) 12%, transparent);
  border-color: color-mix(in srgb, var(--chart-5) 45%, transparent);
  color: var(--chart-5);
  font-weight: 600;
}
.trend-chart-wrap {
  margin-bottom: 16px;
}
.trend-empty {
  text-align: center;
  padding: 40px 20px;
}
.trend-empty-icon {
  display: inline-flex;
  margin-bottom: 10px;
  opacity: 0.55;
}
.trend-empty-text {
  font-size: 14px;
  color: var(--muted-foreground);
  margin-bottom: 4px;
}
.trend-empty-hint {
  font-size: 12px;
  color: var(--muted-foreground);
}
.trend-summary {
  display: flex;
  gap: 10px;
}
.trend-summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}
.trend-summary-label {
  font-size: 11px;
  color: var(--muted-foreground);
}
.trend-summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
}

/* ==================== 小屏适配 ==================== */
@media (max-width: 360px) {
  .mind-hero {
    padding-left: 12px;
    padding-right: 12px;
  }
  .messages-area {
    padding-left: 12px;
    padding-right: 12px;
  }
  .input-area {
    padding-left: 12px;
    padding-right: 12px;
  }
  .hero-actions {
    gap: 4px;
  }
  .role-list,
  .emotion-diary {
    padding-left: 12px;
    padding-right: 12px;
  }
  .emotion-grid {
    gap: 8px;
  }
}
</style>
