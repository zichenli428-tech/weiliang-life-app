/**
 * AI 大模型服务层
 * PRD 3.2/3.4：AI 健康顾问流式对话、System Prompt 注入用户档案
 * PRD 5.2：大模型 API 封装（OpenAI 兼容，当前接入 OpenCode Zen mimo-v2.5-free）
 * PRD 4.3：API Key 仅开发环境使用，存于 .env
 * PRD 7.2：弱网超时降级（60 秒首字超时阈值）
 *
 * OpenCode Zen API 兼容 OpenAI 格式：
 * POST {baseURL}/chat/completions
 * Authorization: Bearer {apiKey}
 * stream: true 时返回 SSE 格式 data: {json}\n\n
 *
 * APK 环境（Capacitor）：CapacitorHttp 拦截 fetch 绕过 CORS，
 * 但不支持 SSE 流式响应，streamChat 在原生环境自动降级为非流式 + 模拟打字效果
 */
import { Capacitor } from '@capacitor/core'

/** API 消息格式（OpenAI 兼容） */
export interface ApiTextContent {
  type: 'text'
  text: string
}

export interface ApiImageContent {
  type: 'image_url'
  image_url: { url: string }
}

export type ApiMessageContent = ApiTextContent | ApiImageContent

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ApiMessageContent[]
}

/** 流式回调选项 */
export interface StreamChatOptions {
  /** 收到文本块时的回调 */
  onChunk: (chunk: string) => void
  /** 流结束时的回调 */
  onDone?: (fullText: string) => void
  /** 出错时的回调 */
  onError?: (error: Error) => void
  /** AbortController 信号（用于手动取消） */
  signal?: AbortSignal
  /** 温度参数，默认 0.7 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 首字超时阈值（毫秒），默认 60000（高峰时段推理可能较慢，PRD 7.2 降级策略） */
  firstByteTimeout?: number
}

/** 非流式请求选项 */
export interface ChatOptions {
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  /** 整体超时（毫秒），默认 60000 */
  timeout?: number
}

// ==================== 配置读取 ====================

const API_KEY = import.meta.env.VITE_AI_API_KEY as string | undefined
const MODEL = (import.meta.env.VITE_AI_MODEL as string | undefined) || 'mimo-v2.5-free'

// 原生平台（APK）通过 CapacitorHttp 绕过 CORS 直连 API
// Web 环境统一走 /ai-proxy 代理（开发由 Vite dev server 转发，生产 demo 由 server.js 转发）
const isNative = Capacitor.isNativePlatform()
const BASE_URL = isNative
  ? 'https://opencode.ai/zen/v1'
  : (import.meta.env.VITE_AI_BASE_URL as string | undefined) || '/ai-proxy/v1'

/**
 * 检查 API 是否已配置
 * - APK 端：必须本地持有密钥（直连 OpenCode Zen API）
 * - Web 端：密钥由 server.js 代理注入，前端不持有，总是可用
 * - Mock 模式：VITE_MOCK_AI=true 时返回 false，触发各 store 内置 mock 兜底（离线即时响应）
 */
export function isAIConfigured(): boolean {
  if (import.meta.env.VITE_MOCK_AI === 'true') {
    return false
  }
  if (isNative) {
    return !!API_KEY && API_KEY.length > 0
  }
  // Web 端密钥在服务端（server.js / Vite proxy），前端无需配置
  return true
}

/**
 * 构造请求头
 * - APK 端：直连需携带 Authorization
 * - Web 端：由 server.js 代理注入 Authorization，前端不带（防止密钥通过请求头泄露）
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (isNative && API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }
  return headers
}

/**
 * 网络状态检查：离线时直接抛错，避免用户苦等 60 秒超时
 * navigator.onLine 在 WebView 中可能不准确，但作为快速失败的第一道防线仍有价值
 */
function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('网络连接已断开，请检查网络后重试')
  }
}

/**
 * 合并外部 AbortSignal 与超时控制（兼容旧版 Chromium，不依赖 AbortSignal.any()）
 * AbortSignal.any() 仅 Chrome 124+ 支持，Trae 预览窗口的 Chromium 可能较旧
 */
function createCombinedController(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // 外部 signal 已中止 → 立即中止
  if (externalSignal?.aborted) {
    controller.abort()
  } else if (externalSignal) {
    // 外部 signal 中止时联动
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId)
  }
}

// ==================== 核心请求 ====================

/**
 * 流式对话（SSE）
 * PRD 3.4：大模型流式对话，打字机效果
 * PRD 7.2：首字超时降级（高峰时段可能较慢，默认 60 秒）
 */
export async function streamChat(
  messages: ApiMessage[],
  options: StreamChatOptions
): Promise<string> {
  if (!isAIConfigured()) {
    throw new Error('AI API 未配置，请检查 .env 文件中的 VITE_AI_API_KEY')
  }

  // 离线快速失败，避免用户苦等 60 秒超时
  assertOnline()

  const {
    onChunk,
    onDone,
    onError,
    signal,
    temperature = 0.7,
    firstByteTimeout = 60000
  } = options

  // 原生平台（APK）：CapacitorHttp 不支持 SSE 流式读取（response.body.getReader()），
  // 降级为非流式请求 + 模拟打字效果，保证功能可用
  if (isNative) {
    try {
      const fullResponse = await chat(messages, {
        signal,
        temperature,
        timeout: 60000
      })

      // 模拟流式输出：按 2 字符分块，每块间隔 30ms
      const chunkSize = 2
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        if (signal?.aborted) break
        const chunk = fullResponse.slice(i, i + chunkSize)
        onChunk(chunk)
        await new Promise(resolve => setTimeout(resolve, 30))
      }

      onDone?.(fullResponse)
      return fullResponse
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      onError?.(err)
      throw err
    }
  }

  // 首字超时控制（PRD 7.2），兼容旧版 Chromium 不用 AbortSignal.any()
  const combined = createCombinedController(signal, firstByteTimeout)

  let fullText = ''

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        temperature
        // 不传 max_tokens：保持与各 OpenAI 兼容端点的最大兼容性，使用模型默认输出长度上限
      }),
      signal: combined.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`AI API 返回 ${response.status}: ${errText.slice(0, 200)}`)
    }

    if (!response.body) {
      throw new Error('AI API 未返回响应体')
    }

    // 首字已到达，清除超时
    combined.cleanup()

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let firstChunkReceived = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue

        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)

        if (data === '[DONE]') {
          onDone?.(fullText)
          return fullText
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            if (!firstChunkReceived) {
              firstChunkReceived = true
            }
            fullText += content
            onChunk(content)
          }
        } catch {
          // 跳过无法解析的 SSE 行（可能是 keep-alive 或部分数据）
          continue
        }
      }
    }

    onDone?.(fullText)
    return fullText
  } catch (error) {
    combined.cleanup()

    // AbortError 是预期行为（用户切换 Tab / 手动停止 / 超时降级），不记 error 日志
    const isAbort = error instanceof DOMException && error.name === 'AbortError'
    if (!isAbort) {
      console.error('[streamChat] 请求失败:', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        url: `${BASE_URL}/chat/completions`
      })
    }

    if (isAbort) {
      const err = new Error('AI 响应超时，请检查网络后重试')
      onError?.(err)
      throw err
    }

    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}

/**
 * 非流式对话（用于 JSON 模式 / 短回复）
 * PRD 3.1：营养膳食分析需要 JSON 结构化输出
 */
export async function chat(
  messages: ApiMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!isAIConfigured()) {
    throw new Error('AI API 未配置，请检查 .env 文件中的 VITE_AI_API_KEY')
  }

  // 离线快速失败，避免用户苦等 60 秒超时
  assertOnline()

  const {
    signal,
    temperature = 0.3,
    timeout = 60000
  } = options

  const combined = createCombinedController(signal, timeout)

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        temperature
        // 不传 max_tokens：保持与各 OpenAI 兼容端点的最大兼容性
      }),
      signal: combined.signal
    })

    combined.cleanup()

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`AI API 返回 ${response.status}: ${errText.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('AI API 返回内容为空')
    }
    return content as string
  } catch (error) {
    combined.cleanup()

    // AbortError 是预期行为（超时降级 / 用户离开页面），不记 error 日志
    const isAbort = error instanceof DOMException && error.name === 'AbortError'
    if (!isAbort) {
      console.error('[chat] 请求失败:', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        url: `${BASE_URL}/chat/completions`
      })
    }

    if (isAbort) {
      throw new Error('AI 请求超时，请检查网络后重试')
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

// ==================== System Prompt 构建 ====================

/**
 * PRD 3.4：System Prompt 注入用户档案
 * 根据用户身体数据、健康目标构建个性化系统提示
 */
export function buildHealthAdvisorPrompt(profile: {
  nickname?: string
  gender?: string
  age?: number
  height?: number
  weight?: number
  targetWeight?: number
  healthGoal?: string
  activityLevel?: string
}): string {
  const parts: string[] = [
    '你是"微量生活"App 中的 AI 健康顾问，为用户提供个性化健康指导。',
    '你的回答应该专业、温暖、简洁，使用中文回复。',
    '回答控制在 300 字以内，使用自然的对话语气，可以适当使用 emoji 增加亲和力。',
    '如果用户的问题超出健康领域，温和地引导回健康话题。'
  ]

  const profileParts: string[] = []
  if (profile.nickname) profileParts.push(`昵称：${profile.nickname}`)
  if (profile.gender) profileParts.push(`性别：${profile.gender}`)
  if (profile.age) profileParts.push(`年龄：${profile.age} 岁`)
  if (profile.height) profileParts.push(`身高：${profile.height} cm`)
  if (profile.weight) profileParts.push(`体重：${profile.weight} kg`)
  if (profile.targetWeight) profileParts.push(`目标体重：${profile.targetWeight} kg`)
  if (profile.healthGoal) profileParts.push(`健康目标：${profile.healthGoal}`)
  if (profile.activityLevel) profileParts.push(`活动水平：${profile.activityLevel}`)

  if (profileParts.length > 0) {
    parts.push(`\n以下是用户的身体档案，请基于此提供个性化建议：\n${profileParts.join('；\n')}`)
  }

  return parts.join('\n')
}

/**
 * PRD 3.1：每日寄语 System Prompt
 * 基于用户当日数据生成简短的健康寄语
 */
export function buildDailyMessagePrompt(profile: {
  nickname?: string
  healthGoal?: string
  weight?: number
  targetWeight?: number
}, todayData: {
  calories?: number
  protein?: number
  waterCount?: number
}): string {
  const parts: string[] = [
    '你是"微量生活"App 的每日健康寄语生成器。',
    '请根据用户的身体档案和今日数据，生成一句温暖的健康寄语（30-50 字）。',
    '要求：正面积极、有具体针对性、像朋友间的关心，不要说教。',
    '只输出寄语本身，不要加引号、前缀或解释。'
  ]

  const dataParts: string[] = []
  if (profile.nickname) dataParts.push(`用户：${profile.nickname}`)
  if (profile.healthGoal) dataParts.push(`目标：${profile.healthGoal}`)
  if (profile.weight && profile.targetWeight) {
    const diff = profile.weight - profile.targetWeight
    dataParts.push(`当前${profile.weight}kg，目标${profile.targetWeight}kg，差距${diff.toFixed(1)}kg`)
  }
  if (todayData.calories !== undefined) dataParts.push(`今日已摄入${todayData.calories}kcal`)
  if (todayData.protein !== undefined) dataParts.push(`蛋白质${todayData.protein}g`)
  if (todayData.waterCount !== undefined) dataParts.push(`饮水${todayData.waterCount}杯`)

  if (dataParts.length > 0) {
    parts.push(`\n用户数据：\n${dataParts.join('；')}`)
  }

  return parts.join('\n')
}
