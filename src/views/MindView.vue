<script setup lang="ts">
/**
 * AI 心理疏导（Tab 3）
 * PRD 3.3：心理疏导模块
 * - 首次进入免责声明与欢迎语
 * - 莫兰迪色系低饱和度渐变（营造安全放松氛围）
 * - SSE 流式对话 + 情绪感知
 * - 对话风格定制（温暖的朋友 / 专业顾问 / 正念导师）
 * - 危机干预：自杀/自残倾向检测 → 热线预警
 * - 情绪日记入口（Task #17 接入）
 * 重设计：深色玻璃拟态，柔和绿紫调，保持放松氛围
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
import AuroraButton from '@/components/AuroraButton.vue'
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
        lineStyle: { color: '#a5b4fc', width: 2 },
        itemStyle: {
          color: (params: any) => colors[params.dataIndex] || '#a5b4fc'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(165, 180, 252, 0.25)' },
              { offset: 1, color: 'rgba(165, 180, 252, 0.02)' }
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
    confirmButtonColor: '#a5b4fc'
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
  <div class="mind-page">
    <!-- 顶部导航 -->
    <div class="mind-header safe-area-top">
      <div class="flex items-center">
        <div class="flex-1">
          <div class="text-base font-semibold text-white flex items-center gap-1">
            心理疏导
            <span class="text-xs font-normal opacity-80">· {{ currentRole.icon }}</span>
          </div>
          <div class="text-xs text-white/75 mt-1">
            <span v-if="isResponding" class="status-dot pulsing"></span>
            <span v-else class="status-dot"></span>
            {{ isResponding ? '正在倾听…' : '我在这里陪你' }}
          </div>
        </div>
        <div class="header-action" @click="showEmotionSheet = true">
          <van-icon name="smile-comment-o" size="18" color="#fff" />
        </div>
        <div class="header-action ml-2" @click="showRoleSheet = true">
          <van-icon name="exchange" size="18" color="#fff" />
        </div>
        <div class="header-action ml-2" @click="handleNewSession">
          <van-icon name="plus" size="18" color="#fff" />
        </div>
        <div class="header-action ml-2" @click="handleClearSession">
          <van-icon name="delete-o" size="18" color="#fff" />
        </div>
      </div>
    </div>

    <!-- 边界声明条 -->
    <div class="boundary-bar">
      <van-icon name="info-o" size="12" color="#94a3b8" />
      <span>AI 无法替代专业心理咨询，如有紧急情况请拨打热线</span>
    </div>

    <!-- 消息列表区 -->
    <div ref="messagesEl" class="messages-area">
      <!-- 欢迎卡片（无消息时） -->
      <div v-if="!hasMessages" class="welcome-section">
        <GlassCard padding="lg" gradient-border class="welcome-card">
          <div class="welcome-avatar">💛</div>
          <div class="welcome-title">你好，{{ userStore.profile.nickname || '朋友' }} 🌿</div>
          <div class="welcome-desc">
            这里是一个安全的空间，你可以随时和我聊聊心里的感受。<br />
            无论开心、难过、焦虑还是迷茫，我都会认真倾听。
          </div>
          <div class="welcome-tip">选择一种感受，或者直接告诉我你的心情</div>
        </GlassCard>

        <!-- 情绪快捷表达（无消息时） -->
        <div class="emotion-chats">
          <div
            v-for="item in emotionQuickChats"
            :key="item.emotion"
            class="emotion-chat-item"
            @click="handleQuickChat(item)"
          >
            <span class="emotion-icon">{{ emotionMap[item.emotion].icon }}</span>
            <span class="emotion-text">{{ item.text }}</span>
            <van-icon name="arrow" class="emotion-arrow" />
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
        <div v-if="msg.role === 'assistant'" class="msg-avatar">🌿</div>
        <div class="msg-bubble">
          <div
            v-if="msg.role === 'assistant' && msg.detectedEmotion"
            class="emotion-tag"
          >
            {{ emotionMap[msg.detectedEmotion].icon }} {{ emotionMap[msg.detectedEmotion].label }}
          </div>
          <div class="msg-content">{{ msg.content }}<span v-if="msg.streaming" class="cursor">|</span></div>
        </div>
        <div v-if="msg.role === 'user'" class="msg-avatar user-avatar">
          {{ userStore.profile.nickname?.charAt(0) || '我' }}
        </div>
      </div>

      <!-- 加载指示 -->
      <div v-if="isResponding && messages.length > 0 && !messages[messages.length - 1].content" class="loading-row">
        <div class="msg-avatar">🌿</div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area safe-area-bottom">
      <div class="input-row">
        <van-field
          v-model="inputValue"
          placeholder="说说你现在的感受…"
          class="input-field"
          type="textarea"
          :autosize="{ maxHeight: 80, minHeight: 36 }"
          @keydown.enter.prevent="handleSend()"
        />
        <AuroraButton
          class="send-btn"
          :class="{ disabled: !inputValue.trim() || isResponding }"
          :disabled="!inputValue.trim() || isResponding"
          @click="handleSend()"
        >
          <van-icon name="arrow" size="18" />
        </AuroraButton>
      </div>
    </div>

    <!-- 首次免责声明弹窗 -->
    <van-dialog
      v-model:show="showDisclaimer"
      title="心理疏导 · 欢迎语"
      :show-confirm-button="true"
      :show-cancel-button="false"
      confirm-button-text="我了解了"
      confirm-button-color="#a5b4fc"
      :close-on-click-overlay="false"
      @confirm="handleAcceptDisclaimer"
    >
      <div class="disclaimer-body">
        <div class="disclaimer-emoji">🌿</div>
        <p class="disclaimer-welcome">
          欢迎来到心理疏导空间。<br />
          这里是一个安全、不评判的倾听角落。
        </p>
        <GlassCard padding="md" class="disclaimer-list">
          <p>· AI 会尽最大努力陪伴你、倾听你。</p>
          <p>· <strong>AI 无法替代专业心理咨询或医疗诊断。</strong></p>
          <p>· 如有严重心理困扰，请寻求专业帮助。</p>
          <p>· 对话记录仅保存在你的本地设备，不会上传。</p>
          <p>· 若你出现自伤/自杀念头，请立即拨打心理援助热线。</p>
        </GlassCard>
        <p class="disclaimer-hotline">
          📞 北京心理援助热线：010-82951332<br />
          📞 全国心理援助热线：400-161-9995
        </p>
      </div>
    </van-dialog>

    <!-- 危机干预弹窗 -->
    <van-dialog
      v-model:show="showCrisisModal"
      title="你并不孤单"
      :show-confirm-button="true"
      :show-cancel-button="false"
      confirm-button-text="我知道了"
      confirm-button-color="#fb7185"
      :close-on-click-overlay="false"
    >
      <div class="crisis-body">
        <div class="crisis-emoji">💛</div>
        <p class="crisis-text">
          你愿意说出来，已经很勇敢了。<br />
          你的感受是真实的，也是重要的。
        </p>
        <p class="crisis-text">请立即联系专业的人帮助你：</p>
        <GlassCard padding="md" class="crisis-hotlines">
          <p>📞 北京心理援助热线<br /><strong>010-82951332</strong></p>
          <p>📞 全国心理援助热线<br /><strong>400-161-9995</strong></p>
          <p>📞 希望24热线<br /><strong>400-161-9995</strong></p>
        </GlassCard>
        <p class="crisis-emergency">如处于紧急危险中，请立即拨打 120 或前往最近医院急诊。</p>
      </div>
    </van-dialog>

    <!-- 角色风格选择 -->
    <van-action-sheet
      v-model:show="showRoleSheet"
      title="选择 AI 对话风格"
      :close-on-click-action="true"
    >
      <div class="role-list">
        <div
          v-for="role in roleList"
          :key="role.key"
          class="role-item"
          :class="{ active: role.key === mindStore.roleStyle }"
          @click="handleRoleSelect(role.key)"
        >
          <div class="role-icon">{{ role.icon }}</div>
          <div class="role-info">
            <div class="role-label">{{ role.label }}</div>
            <div class="role-desc">{{ role.desc }}</div>
          </div>
          <van-icon v-if="role.key === mindStore.roleStyle" name="success" color="#a5b4fc" size="18" />
        </div>
      </div>
    </van-action-sheet>

    <!-- 情绪日记记录 + 趋势 -->
    <van-action-sheet
      v-model:show="showEmotionSheet"
      title="情绪日记"
      :close-on-click-action="true"
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
              @click="handleSaveEmotion(emotion.type)"
            >
              <div class="emotion-card-icon">{{ emotion.icon }}</div>
              <div class="emotion-card-label">{{ emotion.label }}</div>
            </div>
          </div>
          <div class="emotion-score">
            <span class="emotion-score-label">情绪强度</span>
            <van-slider v-model="selectedEmotionScore" :min="1" :max="5" :step="1" bar-color="#a5b4fc" inactive-color="rgba(255,255,255,0.08)" />
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
            <div class="trend-empty-icon">📊</div>
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
.mind-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background:
    radial-gradient(ellipse at top right, rgba(163, 230, 53, 0.08) 0%, transparent 45%),
    radial-gradient(ellipse at top left, rgba(167, 139, 250, 0.08) 0%, transparent 45%),
    linear-gradient(180deg, #0b1220 0%, #101225 100%);
}

/* ==================== 顶部导航 ==================== */
.mind-header {
  position: relative;
  padding: 16px 16px 14px;
  background:
    radial-gradient(ellipse at top right, rgba(163, 230, 53, 0.15) 0%, transparent 55%),
    linear-gradient(135deg, rgba(163, 230, 53, 0.35) 0%, rgba(129, 140, 248, 0.45) 100%);
  overflow: hidden;
}

.mind-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 100%);
  pointer-events: none;
}

.header-action {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.header-action:active {
  background: rgba(255, 255, 255, 0.22);
  transform: scale(0.94);
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4c5a9;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot.pulsing {
  background: #fbbf24;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ==================== 边界声明条 ==================== */
.boundary-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: #94a3b8;
}

/* ==================== 消息列表 ==================== */
.messages-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px 12px calc(16px + env(safe-area-inset-bottom));
}

.welcome-section {
  margin-bottom: 16px;
}

.welcome-card {
  text-align: center;
  margin-bottom: 16px;
}

.welcome-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(163, 230, 53, 0.6), rgba(129, 140, 248, 0.6));
  color: #fff;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  box-shadow: 0 0 24px rgba(163, 230, 53, 0.2);
}

.welcome-title {
  font-size: 17px;
  font-weight: 600;
  color: #f8fafc;
}

.welcome-desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.7;
  margin-top: 10px;
}

.welcome-tip {
  font-size: 12px;
  color: #64748b;
  margin-top: 14px;
}

/* ==================== 情绪快捷表达 ==================== */
.emotion-chats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.emotion-chat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.emotion-chat-item:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.1);
}

.emotion-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.emotion-text {
  font-size: 13px;
  color: #f8fafc;
  flex: 1;
  line-height: 1.5;
}

.emotion-arrow {
  color: #64748b;
  font-size: 12px;
}

/* ==================== 消息气泡 ==================== */
.message-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 8px;
}

.message-row.is-user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(129, 140, 248, 0.7), rgba(167, 139, 250, 0.7));
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #34d399, #22d3ee);
  font-size: 13px;
  font-weight: 600;
}

.msg-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 16px;
  word-break: break-word;
}

.is-assistant .msg-bubble {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-top-left-radius: 4px;
}

.is-user .msg-bubble {
  background: linear-gradient(135deg, #34d399, #22d3ee);
  color: #0b1220;
  border-top-right-radius: 4px;
}

.emotion-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #a5b4fc;
  background: rgba(129, 140, 248, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
  margin-bottom: 6px;
}

.msg-content {
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.is-user .msg-content {
  font-weight: 500;
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

.loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.loading-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 16px;
  border-top-left-radius: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a5b4fc;
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
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.input-field {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 4px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.input-field :deep(.van-field__control) {
  font-size: 14px;
  line-height: 1.5;
  color: #f8fafc;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  padding: 0;
  flex-shrink: 0;
}

.send-btn :deep(.van-icon) {
  margin: 0;
}

/* ==================== 免责声明弹窗 ==================== */
.disclaimer-body {
  padding: 8px 20px 20px;
  text-align: center;
}

.disclaimer-emoji {
  font-size: 40px;
  margin-bottom: 8px;
}

.disclaimer-welcome {
  font-size: 14px;
  color: #f8fafc;
  line-height: 1.7;
  margin-bottom: 14px;
}

.disclaimer-list {
  text-align: left;
  margin-bottom: 14px;
}

.disclaimer-list :deep(p) {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.8;
  margin: 0;
}

.disclaimer-list :deep(strong) {
  color: #a5b4fc;
}

.disclaimer-hotline {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.8;
  background: rgba(129, 140, 248, 0.1);
  padding: 10px;
  border-radius: 10px;
}

/* ==================== 危机干预弹窗 ==================== */
.crisis-body {
  padding: 8px 20px 20px;
  text-align: center;
}

.crisis-emoji {
  font-size: 44px;
  margin-bottom: 8px;
}

.crisis-text {
  font-size: 13px;
  color: #f8fafc;
  line-height: 1.7;
  margin: 8px 0;
}

.crisis-hotlines {
  text-align: center;
  margin: 12px 0;
}

.crisis-hotlines :deep(p) {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
  margin: 6px 0;
}

.crisis-hotlines :deep(strong) {
  font-size: 15px;
  color: #fb7185;
}

.crisis-emergency {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  margin-top: 8px;
}

/* ==================== 角色风格选择 ==================== */
.role-list {
  padding: 8px 16px 20px;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.role-item.active {
  background: rgba(129, 140, 248, 0.1);
  border-color: rgba(129, 140, 248, 0.35);
}

.role-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.role-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.role-info {
  flex: 1;
}

.role-label {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.role-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

/* ==================== 情绪日记 ==================== */
.emotion-diary {
  padding: 8px 16px 20px;
}

.emotion-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 4px;
}

.emotion-tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  font-size: 13px;
  color: #94a3b8;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.emotion-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
}

.emotion-diary-hint {
  font-size: 13px;
  color: #94a3b8;
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
  padding: 14px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  transition: all 0.2s ease;
}

.emotion-card:active {
  transform: scale(0.95);
  background: rgba(129, 140, 248, 0.1);
}

.emotion-card-icon {
  font-size: 26px;
  margin-bottom: 4px;
}

.emotion-card-label {
  font-size: 11px;
  color: #94a3b8;
}

.emotion-score {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}

.emotion-score-label {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.emotion-score-value {
  font-size: 12px;
  color: #a5b4fc;
  font-weight: 600;
  flex-shrink: 0;
}

.emotion-history-tip {
  font-size: 11px;
  color: #64748b;
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
  padding: 6px 16px;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  transition: all 0.2s ease;
}

.period-chip.active {
  background: rgba(129, 140, 248, 0.15);
  border-color: rgba(129, 140, 248, 0.4);
  color: #a5b4fc;
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
  font-size: 40px;
  margin-bottom: 10px;
  opacity: 0.5;
}

.trend-empty-text {
  font-size: 14px;
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
}

.trend-summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.trend-summary-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.trend-summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}
</style>
