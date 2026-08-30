<script setup lang="ts">
/**
 * AI 健康顾问（Tab 2）
 * PRD 3.4：聊天界面、预设快捷问题 | 大模型流式对话、System Prompt 注入用户档案
 * P2 阶段：完整聊天 UI + mock 流式回复；P3 阶段接入大模型流式接口
 * 重设计：Apple 风格，模块主色 --chart-2（蓝）
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useChatStore } from '@/store/modules/chat'
import { showAITip } from '@/utils/aiToast'
import { useUserStore } from '@/store/modules/user'
import { quickQuestions, categoryLabels } from '@/constants/quickQuestions'
import type { QuickQuestionCategory } from '@/types/chat'
import GlassCard from '@/components/GlassCard.vue'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'

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
  { key: 'all' as const, label: '全部' },
  ...(Object.keys(categoryLabels) as QuickQuestionCategory[]).map((k) => ({
    key: k,
    label: categoryLabels[k].label
  }))
])

const messages = computed(() => chatStore.activeMessages)
const hasMessages = computed(() => messages.value.length > 0)
const isResponding = computed(() => chatStore.isResponding)

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

// 重设计：分类 → AppleIcon 名称映射（替换静态 emoji 为线框图标）
const categoryIconMap: Record<QuickQuestionCategory | 'all', string> = {
  all: 'clipboard-list',
  diet: 'utensils',
  exercise: 'dumbbell',
  sleep: 'moon',
  mental: 'heart',
  general: 'lightbulb'
}

const handleSend = async (text?: string) => {
  const content = (text ?? inputValue.value).trim()
  if (!content || isResponding.value) return

  // 确保有激活会话
  chatStore.ensureActiveSession()
  chatStore.addMessage('user', content)
  inputValue.value = ''
  await nextTick()
  scrollToBottom()

  // P3 阶段：调用真实大模型流式接口（OpenCode Zen），降级时自动回退 mock
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
    confirmButtonColor: '#007AFF'
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
  <div class="page-container advisor-page">
    <!-- 顶部 Header -->
    <header class="advisor-header">
      <div class="header-avatar">
        <AppleIcon name="sparkles" :size="20" />
      </div>
      <div class="header-info">
        <div class="header-title">AI 健康顾问</div>
        <div class="header-subtitle">
          <span class="status-dot" :class="{ pulsing: isResponding }"></span>
          <span>{{ isResponding ? '正在思考…' : '随时为你服务' }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="header-btn"
          type="button"
          aria-label="新建会话"
          @click="handleNewSession"
        >
          <AppleIcon name="plus" :size="18" />
        </button>
        <button
          class="header-btn"
          type="button"
          aria-label="清空会话"
          @click="handleClearSession"
        >
          <AppleIcon name="trash-2" :size="18" />
        </button>
      </div>
    </header>

    <!-- 消息列表区 -->
    <div ref="messagesEl" class="messages-area">
      <!-- 欢迎卡片 -->
      <div v-if="!hasMessages" class="welcome-section">
        <GlassCard padding="lg" radius="lg" class="welcome-card">
          <div class="welcome-avatar">
            <AppleIcon name="sparkles" :size="24" />
          </div>
          <div class="welcome-title">
            你好，{{ userStore.profile.nickname || '健康用户' }}
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
        <div v-if="msg.role === 'assistant'" class="msg-avatar assistant-avatar">
          <AppleIcon name="sparkles" :size="18" />
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
        <div v-if="msg.role === 'user'" class="msg-avatar user-avatar">
          {{ userStore.profile.nickname?.charAt(0) || '我' }}
        </div>
      </div>

      <!-- 加载指示 -->
      <div
        v-if="isResponding && messages.length > 0 && !messages[messages.length - 1].content"
        class="message-row is-assistant loading-row"
      >
        <div class="msg-avatar assistant-avatar">
          <AppleIcon name="sparkles" :size="18" />
        </div>
        <div class="msg-bubble">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>

    <!-- 快捷问题区（无消息时展开） -->
    <div v-if="!hasMessages" class="quick-panel">
      <div class="quick-categories">
        <button
          v-for="cat in categoryList"
          :key="cat.key"
          type="button"
          class="category-chip"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <AppleIcon :name="categoryIconMap[cat.key]" :size="14" />
          <span>{{ cat.label }}</span>
        </button>
      </div>
      <div class="quick-list">
        <button
          v-for="q in filteredQuestions"
          :key="q.text"
          type="button"
          class="quick-item"
          @click="handleQuickQuestion(q)"
        >
          <span class="quick-icon">
            <AppleIcon :name="categoryIconMap[q.category]" :size="16" />
          </span>
          <span class="quick-text">{{ q.text }}</span>
          <AppleIcon name="chevron-right" :size="16" class="quick-arrow" />
        </button>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
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
          type="primary"
          :disabled="!inputValue.trim() || isResponding"
          @click="handleSend()"
        >
          <AppleIcon name="send-horizontal" :size="20" />
        </AuroraButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.advisor-page {
  /* 覆盖 page-container 的 min-height: 100vh，适配聊天满高布局 */
  min-height: 0;
  height: calc(100vh - 56px - env(safe-area-inset-bottom));
  height: calc(100dvh - 56px - env(safe-area-inset-bottom));
  max-width: 480px;
  margin: 0 auto;
  background: var(--background);
  display: flex;
  flex-direction: column;
}

/* ==================== 顶部 Header ==================== */
.advisor-header {
  flex-shrink: 0;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10;
}

.header-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--chart-2);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  line-height: 1.3;
}

.header-subtitle {
  font-size: 12px;
  color: var(--muted-foreground);
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.3;
  margin-top: 2px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chart-1);
  flex-shrink: 0;
}

.status-dot.pulsing {
  background: var(--chart-3);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.header-btn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: var(--muted);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--foreground);
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.15s ease;
}

.header-btn:active {
  background: var(--accent);
  transform: scale(0.94);
}

/* ==================== 消息列表区 ==================== */
.messages-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ==================== 欢迎卡片 ==================== */
.welcome-section {
  margin-bottom: 4px;
}

.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.welcome-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--chart-2);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.welcome-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
}

.welcome-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.7;
}

.welcome-tip {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}

/* ==================== 消息气泡 ==================== */
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.message-row.is-user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-foreground);
}

.assistant-avatar {
  background: var(--chart-2);
}

.user-avatar {
  background: var(--chart-1);
}

.msg-bubble {
  max-width: 75%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.is-assistant .msg-bubble {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border-radius: 16px;
  border-top-left-radius: 6px;
}

.is-user .msg-bubble {
  background: var(--chart-2);
  color: var(--primary-foreground);
  border-radius: 16px;
  border-top-right-radius: 6px;
  font-weight: 500;
}

.msg-content {
  white-space: pre-wrap;
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
  color: var(--chart-2);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to { visibility: hidden; }
}

/* 加载指示 */
.loading-row .msg-bubble {
  padding: 14px 16px;
}

.loading-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted-foreground);
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

/* ==================== 快捷问题区 ==================== */
.quick-panel {
  flex-shrink: 0;
  background: var(--muted);
  border-top: 1px solid var(--border);
  max-height: 260px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 12px 0;
}

.quick-categories {
  display: flex;
  gap: 8px;
  padding: 0 12px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.quick-categories::-webkit-scrollbar {
  display: none;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--muted-foreground);
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.category-chip.active {
  background: var(--tint-chart-2-10);
  color: var(--chart-2);
  border-color: var(--chart-2);
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px;
}

.quick-item {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 0 14px;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.15s ease;
}

.quick-item:active {
  background: var(--accent);
  transform: scale(0.98);
}

.quick-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--tint-chart-2-10);
  color: var(--chart-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-text {
  flex: 1;
  font-size: 13px;
  color: var(--foreground);
  line-height: 1.4;
  text-align: left;
}

.quick-arrow {
  color: var(--muted-foreground);
  flex-shrink: 0;
}

/* ==================== 输入区 ==================== */
/* MainLayout 的 main-content.with-dock 已通过 padding-bottom 预留 Dock + 安全区空间，
   此处不再重复添加 safe-area-inset-bottom，避免双重间距 */
.input-area {
  flex-shrink: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  padding: 10px 12px;
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
  border-radius: 20px;
  padding: 4px 14px;
}

.input-field :deep(.van-field__control) {
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
  background: transparent;
}

.send-btn {
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-foreground);
}

.send-btn :deep(.van-icon) {
  margin: 0;
}

/* ==================== 小屏适配 ==================== */
@media (max-width: 360px) {
  .advisor-header {
    padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 12px;
  }
  .messages-area {
    padding: 12px 8px;
  }
  .quick-categories {
    padding: 0 8px 12px;
  }
  .quick-list {
    padding: 0 8px;
  }
  .input-area {
    padding: 10px 8px;
  }
}
</style>
