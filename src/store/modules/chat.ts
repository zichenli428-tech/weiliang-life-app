/**
 * AI 对话 Store
 * PRD 3.2：AI 健康顾问 - 多轮上下文 + System Prompt 注入用户档案
 * PRD 3.4：聊天界面消息管理
 * PRD 4.3：对话记录仅存本地 IndexedDB（通过 localforage 持久化）
 * PRD 7.2：弱网超时降级
 *
 * P3 阶段：接入 OpenCode Zen 大模型流式接口
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'
import {
  generateMessageId,
  generateSessionId,
  type ChatMessage,
  type ChatSession
} from '@/types/chat'
import {
  streamChat,
  buildHealthAdvisorPrompt,
  isAIConfigured,
  type ApiMessage
} from '@/services/ai'
import { useUserStore } from './user'
import { genderLabels, goalLabels, activityLabels } from '@/constants/user'

const CHAT_SESSIONS_KEY = 'sessions'
const ACTIVE_SESSION_KEY = 'activeSessionId'
/** 上下文窗口：最近 N 条消息作为对话历史传给 AI */
const MAX_CONTEXT_MESSAGES = 10
/** 保留最近 N 个会话，超出时自动清理最旧的（防止 IndexedDB 无限膨胀） */
const MAX_SESSIONS = 30

export const useChatStore = defineStore('chat', () => {
  // ==================== State ====================
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isLoaded = ref(false)
  const isResponding = ref(false)
  /** 当前请求的 AbortController（用于手动停止生成） */
  let currentAbortController: AbortController | null = null

  // ==================== Getters ====================
  const activeSession = computed<ChatSession | null>(() => {
    if (!activeSessionId.value) return null
    return sessions.value.find((s) => s.id === activeSessionId.value) || null
  })

  const activeMessages = computed<ChatMessage[]>(() => {
    return activeSession.value?.messages.filter((m) => m.role !== 'system') || []
  })

  // ==================== Actions ====================
  async function loadFromStorage(): Promise<void> {
    const stored = await getItem<ChatSession[]>('chat', CHAT_SESSIONS_KEY)
    if (stored && Array.isArray(stored)) {
      sessions.value = stored
    }
    const activeId = await getItem<string>('chat', ACTIVE_SESSION_KEY)
    activeSessionId.value = activeId || sessions.value[0]?.id || null
    isLoaded.value = true
  }

  async function saveToStorage(): Promise<void> {
    await setItem<ChatSession[]>('chat', CHAT_SESSIONS_KEY, sessions.value)
    if (activeSessionId.value) {
      await setItem<string>('chat', ACTIVE_SESSION_KEY, activeSessionId.value)
    }
  }

  function createSession(): ChatSession {
    const now = Date.now()
    const session: ChatSession = {
      id: generateSessionId(),
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    sessions.value.unshift(session)
    // 限制会话数量，清理最旧的（按 updatedAt 升序删除）
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
      sessions.value = sessions.value.slice(0, MAX_SESSIONS)
    }
    activeSessionId.value = session.id
    saveToStorage()
    return session
  }

  function switchSession(id: string): void {
    activeSessionId.value = id
    saveToStorage()
  }

  async function deleteSession(id: string): Promise<void> {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0]?.id || null
    }
    await saveToStorage()
  }

  async function clearAll(): Promise<void> {
    sessions.value = []
    activeSessionId.value = null
    await saveToStorage()
  }

  function ensureActiveSession(): ChatSession {
    if (!activeSession.value) {
      return createSession()
    }
    return activeSession.value
  }

  function addMessage(role: ChatMessage['role'], content: string): ChatMessage {
    const session = ensureActiveSession()
    const message: ChatMessage = {
      id: generateMessageId(),
      role,
      content,
      createdAt: Date.now()
    }
    session.messages.push(message)
    session.updatedAt = Date.now()
    if (role === 'user' && (session.title === '新对话' || session.messages.length === 1)) {
      session.title = content.slice(0, 20) + (content.length > 20 ? '…' : '')
    }
    saveToStorage()
    return message
  }

  function updateMessage(sessionId: string, messageId: string, content: string): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return
    const msg = session.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.content = content
      session.updatedAt = Date.now()
    }
  }

  function setStreaming(sessionId: string, messageId: string, streaming: boolean): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return
    const msg = session.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.streaming = streaming
      if (!streaming) {
        session.updatedAt = Date.now()
        saveToStorage()
      }
    }
  }

  /**
   * 构建传给 AI 的消息数组
   * PRD 3.4：System Prompt 注入用户档案 + 最近 N 条对话历史
   */
  function buildApiMessages(_userContent: string): ApiMessage[] {
    const userStore = useUserStore()
    const profile = userStore.profile

    const systemPrompt = buildHealthAdvisorPrompt({
      nickname: profile.nickname,
      gender: profile.gender ? genderLabels[profile.gender] : undefined,
      age: profile.age ?? undefined,
      height: profile.height ?? undefined,
      weight: profile.weight ?? undefined,
      targetWeight: profile.targetWeight ?? undefined,
      healthGoal: profile.goal ? goalLabels[profile.goal].label : undefined,
      activityLevel: profile.activityLevel
        ? activityLabels[profile.activityLevel].label
        : undefined
    })

    const messages: ApiMessage[] = [{ role: 'system', content: systemPrompt }]

    // 取最近 N 条对话历史（不含 system 消息）
    const recentMessages = activeMessages.value.slice(-MAX_CONTEXT_MESSAGES)
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    return messages
  }

  /**
   * PRD 3.4：AI 健康顾问回复（流式）
   * P3 阶段接入 OpenCode Zen 大模型
   * 降级策略：API 未配置或失败时回退到本地 mock 回复
   */
  async function assistantReply(userContent: string): Promise<void> {
    const session = activeSession.value
    if (!session) return

    // 并发守卫：上一个回复未结束时忽略新请求，避免旧请求泄漏 + UI 错乱
    if (isResponding.value) return

    isResponding.value = true
    // 安全：新建 controller 前先 abort 旧的，防止旧 SSE 连接泄漏
    currentAbortController?.abort()
    currentAbortController = new AbortController()

    // 创建 AI 回复消息占位
    const replyMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true
    }
    session.messages.push(replyMsg)

    // 优先尝试真实 AI 流式对话
    if (isAIConfigured()) {
      try {
        const apiMessages = buildApiMessages(userContent)
        let fullText = ''

        await streamChat(apiMessages, {
          onChunk: (chunk) => {
            fullText += chunk
            updateMessage(session.id, replyMsg.id, fullText)
          },
          signal: currentAbortController.signal,
          temperature: 0.7,
          firstByteTimeout: 60000
        })

        // 流式完成
        if (fullText.trim()) {
          setStreaming(session.id, replyMsg.id, false)
          isResponding.value = false
          currentAbortController = null
          return
        }
        // 如果 AI 返回空内容，走降级
        throw new Error('AI 返回空内容')
      } catch (error) {
        // 降级：移除空的 AI 消息，改用 mock 回复
        const msgIndex = session.messages.findIndex((m) => m.id === replyMsg.id)
        if (msgIndex >= 0) {
          session.messages.splice(msgIndex, 1)
        }
        // 用 mock 回复兜底
        await mockReplyInternal(session, userContent)
        isResponding.value = false
        currentAbortController = null
        return
      }
    }

    // API 未配置，直接走 mock
    await mockReplyInternal(session, userContent)
    isResponding.value = false
    currentAbortController = null
  }

  /** 手动停止 AI 生成 */
  function stopGenerating(): void {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    isResponding.value = false
    // 标记当前流式消息为已完成
    const session = activeSession.value
    if (session) {
      const lastMsg = session.messages[session.messages.length - 1]
      if (lastMsg && lastMsg.streaming) {
        setStreaming(session.id, lastMsg.id, false)
      }
    }
  }

  /**
   * 本地 mock 回复（降级兜底）
   * API 未配置或请求失败时使用
   */
  async function mockReplyInternal(session: ChatSession, userContent: string): Promise<void> {
    const replyMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true
    }
    session.messages.push(replyMsg)

    const fullReply = generateMockReply(userContent)
    const chunks = fullReply.split('')
    let current = ''
    for (let i = 0; i < chunks.length; i++) {
      current += chunks[i]
      updateMessage(session.id, replyMsg.id, current)
      if (i % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
    }
    setStreaming(session.id, replyMsg.id, false)
  }

  return {
    // state
    sessions,
    activeSessionId,
    isLoaded,
    isResponding,
    // getters
    activeSession,
    activeMessages,
    // actions
    loadFromStorage,
    saveToStorage,
    createSession,
    switchSession,
    deleteSession,
    clearAll,
    ensureActiveSession,
    addMessage,
    updateMessage,
    setStreaming,
    assistantReply,
    stopGenerating
  }
})

/**
 * 本地 mock 回复生成（降级兜底用）
 */
function generateMockReply(userContent: string): string {
  const content = userContent.toLowerCase()
  if (content.includes('吃') || content.includes('饮食') || content.includes('三餐')) {
    return '关于饮食，建议遵循"一高二低"原则：高蛋白、低油、低糖。\n\n早餐可以搭配全麦面包 + 鸡蛋 + 牛奶 + 一份水果；午餐保证主食 + 优质蛋白（鸡胸肉/鱼虾）+ 两份蔬菜；晚餐清淡为主，适当减少碳水。\n\n建议每餐吃 7-8 分饱，细嚼慢咽。（当前为离线模式，接入网络后可获得更精准的 AI 建议）'
  }
  if (content.includes('运动') || content.includes('跑步') || content.includes('跳绳') || content.includes('健身')) {
    return '关于运动，建议每周至少 150 分钟中等强度有氧 + 2 次力量训练。\n\n上班族可以利用碎片时间：午休 15 分钟快走，下班后 20 分钟跳绳或 HIIT。坚持 21 天就能养成习惯！（当前为离线模式）'
  }
  if (content.includes('睡眠') || content.includes('失眠') || content.includes('睡不着')) {
    return '关于睡眠：睡前 1 小时远离手机蓝光，保持固定作息，卧室温度 18-22℃ 最佳。\n\n如果持续失眠超过 2 周，建议就医排查。（当前为离线模式）'
  }
  if (content.includes('压力') || content.includes('焦虑') || content.includes('心情')) {
    return '压力大时试试"4-7-8 呼吸法"：吸气 4 秒，屏息 7 秒，呼气 8 秒。\n\n如果情绪持续低落，建议寻求专业心理咨询。（当前为离线模式）'
  }
  return '收到你的问题～ 当前处于离线模式（AI 服务未连接），我先用预设建议回复你。\n\n你可以问我关于饮食搭配、运动方案、睡眠改善、心理调节等健康话题。接入网络后将获得更专业的个性化建议。'
}
