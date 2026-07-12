/**
 * AI 心理疏导 Store
 * PRD 3.3：心理疏导模块 - 共情式对话、情绪感知、危机干预
 * PRD 7.1：上下文记忆（最近 N 轮 + 用户画像注入 System Prompt）
 * PRD 7.2：弱网超时降级、SSE 生命周期管理
 * PRD 4.3：对话记录仅存本地 IndexedDB（localforage）
 *
 * 复用 streamChat 但使用心理疏导专属 System Prompt
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'
import {
  generateMindMessageId,
  generateMindSessionId,
  detectCrisis,
  detectEmotion,
  type MindMessage,
  type MindSession,
  type EmotionRecord,
  type EmotionType,
  type MindRoleStyle
} from '@/types/mind'
import { streamChat, isAIConfigured, type ApiMessage } from '@/services/ai'
import { goalLabels } from '@/constants/user'
import { useUserStore } from './user'

const MIND_SESSIONS_KEY = 'mind_sessions'
const MIND_ACTIVE_KEY = 'mind_active_session'
const MIND_EMOTIONS_KEY = 'mind_emotion_records'
const MIND_ROLE_KEY = 'mind_role_style'
/** 上下文窗口：最近 N 条消息 */
const MAX_CONTEXT_MESSAGES = 10
/** 保留最近 N 个会话，超出时自动清理最旧的（防止 IndexedDB 无限膨胀） */
const MAX_SESSIONS = 30

export const useMindStore = defineStore('mind', () => {
  // ==================== State ====================
  const sessions = ref<MindSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isLoaded = ref(false)
  const isResponding = ref(false)
  const emotionRecords = ref<EmotionRecord[]>([])
  const roleStyle = ref<MindRoleStyle>('warm_friend')
  /** 当前请求的 AbortController */
  let currentAbortController: AbortController | null = null

  // ==================== Getters ====================
  const activeSession = computed<MindSession | null>(() => {
    if (!activeSessionId.value) return null
    return sessions.value.find((s) => s.id === activeSessionId.value) || null
  })

  const activeMessages = computed<MindMessage[]>(() => {
    return activeSession.value?.messages || []
  })

  /** 最近 7 天情绪记录 */
  const recentEmotions = computed<EmotionRecord[]>(() => {
    return emotionRecords.value.slice(-7)
  })

  // ==================== Actions ====================
  async function loadFromStorage(): Promise<void> {
    const stored = await getItem<MindSession[]>('mind', MIND_SESSIONS_KEY)
    if (stored && Array.isArray(stored)) {
      sessions.value = stored
    }
    const activeId = await getItem<string>('mind', MIND_ACTIVE_KEY)
    activeSessionId.value = activeId || sessions.value[0]?.id || null

    const emotions = await getItem<EmotionRecord[]>('mind', MIND_EMOTIONS_KEY)
    if (emotions && Array.isArray(emotions)) {
      emotionRecords.value = emotions
    }

    const role = await getItem<MindRoleStyle>('mind', MIND_ROLE_KEY)
    if (role) {
      roleStyle.value = role
    }

    isLoaded.value = true
  }

  async function saveToStorage(): Promise<void> {
    await setItem<MindSession[]>('mind', MIND_SESSIONS_KEY, sessions.value)
    if (activeSessionId.value) {
      await setItem<string>('mind', MIND_ACTIVE_KEY, activeSessionId.value)
    }
  }

  async function saveEmotions(): Promise<void> {
    await setItem<EmotionRecord[]>('mind', MIND_EMOTIONS_KEY, emotionRecords.value)
  }

  async function setRoleStyle(style: MindRoleStyle): Promise<void> {
    roleStyle.value = style
    await setItem<MindRoleStyle>('mind', MIND_ROLE_KEY, style)
  }

  function createSession(): MindSession {
    const now = Date.now()
    const session: MindSession = {
      id: generateMindSessionId(),
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

  function ensureActiveSession(): MindSession {
    if (!activeSession.value) {
      return createSession()
    }
    return activeSession.value
  }

  function addMessage(role: MindMessage['role'], content: string, detectedEmotion?: EmotionType): MindMessage {
    const session = ensureActiveSession()
    const message: MindMessage = {
      id: generateMindMessageId(),
      role,
      content,
      createdAt: Date.now(),
      detectedEmotion
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

  /**
   * PRD 3.3：构建心理疏导专属 System Prompt
   * 共情式+解决方案导向 + CBT 原则 + 角色风格 + 用户画像 + 危机边界
   */
  function buildMindSystemPrompt(): string {
    const userStore = useUserStore()
    const profile = userStore.profile

    const rolePrompts: Record<MindRoleStyle, string> = {
      warm_friend:
        '你的对话风格像一位温暖的朋友，亲切随和，多用生活化的语言，让用户感到被关心和理解。',
      professional:
        '你的对话风格像一位专业心理咨询师，理性但温和，建议基于认知行为疗法（CBT）等循证方法，条理清晰。',
      mindfulness:
        '你的对话风格像一位正念导师，引导用户觉察当下感受，通过呼吸、身体扫描等正念练习帮助用户回归平静。'
    }

    const parts: string[] = [
      '你是"微量生活"App 中的 AI 心理疏导助手，为用户提供情感支持与心理引导。',
      '你的回答应该温暖、共情、不评判，使用中文回复。',
      '回答控制在 300 字以内，先共情用户的感受，再温和地引导或提供建议。',
      rolePrompts[roleStyle.value],
      '',
      '### 核心原则',
      '1. 先共情，后建议：先让用户感到被理解，再引导思考或行动。',
      '2. 不评判：接纳用户的所有情绪，不否定、不说教、不指责。',
      '3. 引导而非命令：用"你可以试试…"而非"你应该…"的语气。',
      '4. 聚焦当下：帮助用户关注此刻能做的事，而非纠结过去或恐惧未来。',
      '5. 适度幽默：在合适的时候用轻松的语气缓解紧张，但不轻浮。',
      '',
      '### 边界与伦理',
      '- 你不能替代专业心理咨询或医疗诊断。',
      '- 如果用户表现出强烈的自杀/自残倾向，温和但明确地建议拨打心理援助热线：北京心理援助热线 010-82951332，全国心理援助热线 400-161-9995。',
      '- 不要给用户贴病理标签（如"你得了抑郁症"），可以描述状态但不下诊断。'
    ]

    // 用户画像注入
    const profileParts: string[] = []
    if (profile.nickname) profileParts.push(`昵称：${profile.nickname}`)
    if (profile.age) profileParts.push(`年龄：${profile.age} 岁`)
    if (profile.gender) profileParts.push(`性别：${profile.gender}`)
    if (profile.goal) profileParts.push(`健康目标：${goalLabels[profile.goal]?.label ?? profile.goal}`)

    if (profileParts.length > 0) {
      parts.push('', '### 用户档案', profileParts.join('；'))
    }

    // 近期情绪记录
    if (recentEmotions.value.length > 0) {
      const lastEmotion = recentEmotions.value[recentEmotions.value.length - 1]
      parts.push('', `### 近期情绪状态`, `最近一次记录：${lastEmotion.emotion}（强度${lastEmotion.score}/5）`)
    }

    return parts.join('\n')
  }

  /** 构建传给 AI 的消息数组 */
  function buildApiMessages(_userContent: string): ApiMessage[] {
    const systemPrompt = buildMindSystemPrompt()
    const messages: ApiMessage[] = [{ role: 'system', content: systemPrompt }]

    const recentMessages = activeMessages.value.slice(-MAX_CONTEXT_MESSAGES)
    for (const msg of recentMessages) {
      messages.push({ role: msg.role, content: msg.content })
    }

    return messages
  }

  /**
   * PRD 3.3：心理疏导 AI 回复（流式）
   * 危机干预：发送前检测危机关键词，若检测到则不调用 AI，直接返回热线信息
   * 降级策略：API 未配置或失败时回退到本地 mock 回复
   */
  async function assistantReply(userContent: string): Promise<{ crisis: boolean }> {
    const session = activeSession.value
    if (!session) return { crisis: false }

    // 并发守卫：上一个回复未结束时忽略新请求，避免旧请求泄漏 + UI 错乱
    if (isResponding.value) return { crisis: false }

    // PRD 3.3 危机干预：检测自杀/自残倾向
    if (detectCrisis(userContent)) {
      const crisisMessage: MindMessage = {
        id: generateMindMessageId(),
        role: 'assistant',
        content:
          '我听到你正在经历非常痛苦的时刻，你的感受是真实的，也是重要的。你现在并不孤单。\n\n请立即拨打心理援助热线，会有专业的人陪伴你：\n📞 北京心理援助热线：010-82951332\n📞 全国心理援助热线：400-161-9995\n📞 希望24热线：400-161-9995\n\n如果你正处于紧急危险中，请立即拨打 120 或前往最近的医院急诊。我在这里陪你，请先保护好自己。💛',
        createdAt: Date.now()
      }
      session.messages.push(crisisMessage)
      session.updatedAt = Date.now()
      saveToStorage()
      return { crisis: true }
    }

    isResponding.value = true
    // 安全：新建 controller 前先 abort 旧的，防止旧 SSE 连接泄漏
    currentAbortController?.abort()
    currentAbortController = new AbortController()

    // 创建 AI 回复消息占位
    const replyMsg: MindMessage = {
      id: generateMindMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true
    }
    session.messages.push(replyMsg)

    // 检测用户情绪并记录
    const detectedEmotion = detectEmotion(userContent)
    if (detectedEmotion) {
      replyMsg.detectedEmotion = detectedEmotion
    }

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
          temperature: 0.8,
          firstByteTimeout: 60000
        })

        if (fullText.trim()) {
          setStreaming(session.id, replyMsg.id, false)
          isResponding.value = false
          currentAbortController = null
          return { crisis: false }
        }
        throw new Error('AI 返回空内容')
      } catch {
        // 降级：移除空 AI 消息，改用 mock
        const msgIndex = session.messages.findIndex((m) => m.id === replyMsg.id)
        if (msgIndex >= 0) {
          session.messages.splice(msgIndex, 1)
        }
        await mockReplyInternal(session, userContent, detectedEmotion)
        isResponding.value = false
        currentAbortController = null
        return { crisis: false }
      }
    }

    // API 未配置，走 mock
    await mockReplyInternal(session, userContent, detectedEmotion)
    isResponding.value = false
    currentAbortController = null
    return { crisis: false }
  }

  /** 手动停止 AI 生成 */
  function stopGenerating(): void {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    isResponding.value = false
    const session = activeSession.value
    if (session) {
      const lastMsg = session.messages[session.messages.length - 1]
      if (lastMsg && lastMsg.streaming) {
        setStreaming(session.id, lastMsg.id, false)
      }
    }
  }

  /** 本地 mock 回复（降级兜底） */
  async function mockReplyInternal(
    session: MindSession,
    userContent: string,
    detectedEmotion?: EmotionType | null
  ): Promise<void> {
    const replyMsg: MindMessage = {
      id: generateMindMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
      detectedEmotion: detectedEmotion || undefined
    }
    session.messages.push(replyMsg)

    const fullReply = generateMindMockReply(userContent, detectedEmotion)
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

  // ==================== 情绪日记 ====================
  async function recordEmotion(emotion: EmotionType, score: number, note?: string): Promise<void> {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // 同一天覆盖之前的记录
    const existIndex = emotionRecords.value.findIndex((r) => r.date === date)
    const record: EmotionRecord = {
      date,
      emotion,
      score,
      note,
      createdAt: Date.now()
    }

    if (existIndex >= 0) {
      emotionRecords.value[existIndex] = record
    } else {
      emotionRecords.value.push(record)
      // 保留最近 90 天
      if (emotionRecords.value.length > 90) {
        emotionRecords.value = emotionRecords.value.slice(-90)
      }
    }

    await saveEmotions()
  }

  return {
    // state
    sessions,
    activeSessionId,
    isLoaded,
    isResponding,
    emotionRecords,
    roleStyle,
    // getters
    activeSession,
    activeMessages,
    recentEmotions,
    // actions
    loadFromStorage,
    saveToStorage,
    setRoleStyle,
    createSession,
    ensureActiveSession,
    addMessage,
    updateMessage,
    setStreaming,
    deleteSession,
    clearAll,
    assistantReply,
    stopGenerating,
    recordEmotion
  }
})

/** 生成心理疏导 mock 回复（降级兜底） */
function generateMindMockReply(_userContent: string, detectedEmotion?: EmotionType | null): string {
  const offlineHint = '\n\n（当前为离线模式，接入网络可获得更专业的 AI 陪伴）'
  if (detectedEmotion === 'sad' || detectedEmotion === 'lonely') {
    return `我能感受到你现在的低落和孤单，这种感觉真的很不好受 🤗\n\n你不是一个人在面对这些，愿意和我说说是什么让你有这种感觉的吗？${offlineHint}`
  }
  if (detectedEmotion === 'anxious' || detectedEmotion === 'stressed') {
    return `听起来你现在压力很大，焦虑的情绪让人很不舒服 😮‍💨\n\n试着深呼吸三次——吸气4秒，呼气6秒。等你准备好了，告诉我具体是什么在困扰你？${offlineHint}`
  }
  if (detectedEmotion === 'angry') {
    return `你的愤怒是合理的，有这种感受很正常 🫂\n\n先给自己一点冷静的时间，然后我们一起看看发生了什么、能做些什么。${offlineHint}`
  }
  if (detectedEmotion === 'happy') {
    return `看到你心情不错，我也很开心！😊\n\n是什么好事让你今天心情这么好呀？${offlineHint}`
  }
  return `谢谢你愿意和我分享。我在这儿倾听你 🤗\n\n能告诉我更多关于你现在的感受吗？${offlineHint}`
}
