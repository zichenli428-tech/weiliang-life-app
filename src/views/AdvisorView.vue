<script setup lang="ts">
/**
 * AI 健康顾问（Tab 2）
 * PRD 3.4：聊天界面、预设快捷问题 | 大模型流式对话、System Prompt 注入用户档案
 * P2 阶段：完整聊天 UI + mock 流式回复；P3 阶段接入大模型流式接口
 * 重设计：科技蓝暗色玻璃风格，强化 AI 科技感
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { useChatStore } from '@/store/modules/chat'
import { showAITip } from '@/utils/aiToast'
import { useUserStore } from '@/store/modules/user'
import { quickQuestions, categoryLabels } from '@/constants/quickQuestions'
import type { QuickQuestionCategory } from '@/types/chat'
import GlassCard from '@/components/GlassCard.vue'
import AuroraButton from '@/components/AuroraButton.vue'

const chatStore = useChatStore()
const userStore = useUserStore()

// ==================== 输入与发送 ====================
const inputValue = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const activeCategory = ref<QuickQuestionCategory | 'all'>('all')

const filteredQuestions = computed(() => {
  if (activeCategory.value === 'all') return quickQuestions
  return quickQuestions.filter((q) => q.category === activeCategory.value)
})

const categoryList = computed(() => [
  { key: 'all' as const, label: '全部', icon: '📋' },
  ...(Object.keys(categoryLabels) as QuickQuestionCategory[]).map((k) => ({
    key: k,
    label: categoryLabels[k].label,
    icon: categoryLabels[k].icon
  }))
])

const messages = computed(() => chatStore.activeMessages)
const hasMessages = computed(() => messages.value.length > 0)
const isResponding = computed(() => chatStore.isResponding)

const handleSend = async (text?: string) => {
  const content = (text ?? inputValue.value).trim()
  if (!content || isResponding.value) return

  // 确保有激活会话
  chatStore.ensureActiveSession()
  chatStore.addMessage('user', content)
  inputValue.value = ''
  await nextTick()
  scrollToBottom()

  // P3 阶段：调用真实大模型流式接口（SenseNova），降级时自动回退 mock
  showAITip()
  await chatStore.assistantReply(content)
  await nextTick()
  scrollToBottom()
}

const handleQuickQuestion = (q: typeof quickQuestions[number]) => {
  handleSend(q.text)
}

// ==================== 自动滚动到底部 ====================
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

// 监听流式回复内容变化，自动滚动
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
  chatStore.createSession()
  inputValue.value = ''
}

const handleClearSession = () => {
  if (!hasMessages.value) return
  showConfirmDialog({
    title: '清空当前对话',
    message: '将清空当前对话的所有消息，确定吗？',
    confirmButtonColor: '#0ea5e9'
  })
    .then(async () => {
      const session = chatStore.activeSession
      if (session) {
        session.messages = []
        session.title = '新对话'
        session.updatedAt = Date.now()
        await chatStore.saveToStorage()
      }
    })
    .catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!chatStore.isLoaded) {
    await chatStore.loadFromStorage()
  }
  // 如果没有会话，创建一个新会话
  if (!chatStore.activeSession) {
    chatStore.createSession()
  }
  await nextTick()
  scrollToBottom()
})

// PRD 7.2 #2：组件卸载时中止 SSE 流，防止内存泄漏
onUnmounted(() => {
  chatStore.stopGenerating()
})
</script>

<template>
  <div class="advisor-page">
    <!-- 顶部导航 -->
    <div class="advisor-header safe-area-top">
      <div class="flex items-center justify-between">
        <div class="header-avatar glow-advisor">AI</div>
        <div class="flex-1 ml-3">
          <div class="text-base font-semibold text-white">AI 健康顾问</div>
          <div class="text-xs text-white/80 mt-1">
            <span v-if="isResponding" class="status-dot pulsing"></span>
            <span v-else class="status-dot"></span>
            {{ isResponding ? '正在思考…' : '随时为你服务' }}
          </div>
        </div>
        <div class="header-action press-effect" @click="handleNewSession">
          <van-icon name="plus" size="18" />
        </div>
        <div class="header-action ml-2 press-effect" @click="handleClearSession">
          <van-icon name="delete-o" size="18" />
        </div>
      </div>
    </div>

    <!-- 消息列表区 -->
    <div ref="messagesEl" class="messages-area">
      <!-- 欢迎卡片 -->
      <div v-if="!hasMessages" class="welcome-section">
        <GlassCard padding="lg" gradient-border class="welcome-card">
          <div class="welcome-avatar glow-advisor">AI</div>
          <div class="welcome-title">
            你好，{{ userStore.profile.nickname || '健康用户' }} 👋
          </div>
          <div class="welcome-desc">
            我是你的 AI 健康顾问，可以为你提供饮食建议、运动方案、睡眠指导、心理疏导等全方位健康陪伴。
          </div>
          <div class="welcome-tip">试试下面的问题，或直接输入你想问的内容</div>
        </GlassCard>
      </div>

      <!-- 消息气泡 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
      >
        <div v-if="msg.role === 'assistant'" class="msg-avatar glow-advisor">AI</div>
        <div class="msg-bubble">
          <div class="msg-content">
            {{ msg.content }}<span v-if="msg.streaming" class="cursor">|</span>
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
        <div class="msg-avatar glow-advisor">AI</div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 快捷问题区（无消息时展开） -->
    <div v-if="!hasMessages" class="quick-panel">
      <div class="quick-categories">
        <div
          v-for="cat in categoryList"
          :key="cat.key"
          class="category-chip"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <span class="mr-1">{{ cat.icon }}</span>{{ cat.label }}
        </div>
      </div>
      <div class="quick-list">
        <div
          v-for="q in filteredQuestions"
          :key="q.text"
          class="quick-item press-effect"
          @click="handleQuickQuestion(q)"
        >
          <span class="quick-icon">{{ q.icon }}</span>
          <span class="quick-text">{{ q.text }}</span>
          <van-icon name="arrow" size="12" class="text-content-tertiary" />
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area safe-area-bottom">
      <div class="input-row">
        <van-field
          v-model="inputValue"
          placeholder="输入你的健康问题…"
          class="input-field"
          type="textarea"
          :autosize="{ maxHeight: 80, minHeight: 36 }"
          @keydown.enter.prevent="handleSend()"
        />
        <AuroraButton
          class="send-btn"
          :disabled="!inputValue.trim() || isResponding"
          @click="handleSend()"
        >
          <van-icon name="arrow" size="18" />
        </AuroraButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.advisor-page {
  display: flex;
  flex-direction: column;
  /* 减去玻璃 Dock 高度（72px）+ 底部安全区 */
  height: calc(100vh - 72px - env(safe-area-inset-bottom));
  height: calc(100dvh - 72px - env(safe-area-inset-bottom));
  background:
    radial-gradient(ellipse at top right, rgba(14, 165, 233, 0.12) 0%, transparent 45%),
    radial-gradient(ellipse at bottom left, rgba(37, 99, 235, 0.06) 0%, transparent 45%),
    linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
}

.advisor-header {
  position: relative;
  padding: 16px 16px 14px;
  background:
    radial-gradient(ellipse at top right, rgba(14, 165, 233, 0.25) 0%, transparent 55%),
    linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  overflow: hidden;
}

.advisor-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%);
  pointer-events: none;
}

.header-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-action {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.header-action:active {
  background: rgba(255, 255, 255, 0.24);
  transform: scale(0.94);
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
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

.messages-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px 12px;
}

.welcome-section {
  margin-bottom: 16px;
}

.welcome-card {
  text-align: center;
}

.welcome-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
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
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
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
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
  color: #0b1220;
  border-top-right-radius: 4px;
}

.msg-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.is-user .msg-content {
  font-weight: 500;
}

.cursor {
  display: inline-block;
  margin-left: 1px;
  color: #0ea5e9;
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
  background: #0ea5e9;
  animation: bounce 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.quick-panel {
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 12px 8px;
  max-height: 260px;
  overflow-y: auto;
}

.quick-categories {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}

.quick-categories::-webkit-scrollbar {
  display: none;
}

.category-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.category-chip.active {
  background: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.35);
  color: #38bdf8;
  font-weight: 500;
  box-shadow: 0 0 14px rgba(14, 165, 233, 0.18);
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quick-item {
  display: flex;
  align-items: center;
  padding: 11px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  gap: 8px;
  transition: all 0.2s ease;
}

.quick-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.quick-icon {
  font-size: 16px;
}

.quick-text {
  flex: 1;
  font-size: 13px;
  color: #f8fafc;
}

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
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 4px 14px;
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
</style>
