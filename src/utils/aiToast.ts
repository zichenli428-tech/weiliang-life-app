/**
 * AI 调用统一提示工具
 * 在用户触发云端 AI 调用时，提示高峰时段可能回复速度变慢
 */
import { showToast, showLoadingToast, type ToastOptions } from 'vant'

/** 高峰时段提示文案 */
export const AI_PEAK_TIP = '高峰时段可能回复速度变慢'

/**
 * 显示 AI 调用前的轻量提示（2 秒自动消失）
 * 适用于流式对话、无 loading 遮罩的 AI 调用入口
 */
export function showAITip(message = `AI 正在处理，${AI_PEAK_TIP}`) {
  return showToast({
    message,
    duration: 2000,
    position: 'middle',
    overlay: false,
    className: 'ai-tip-toast'
  })
}

/**
 * 显示 AI 调用的 loading 遮罩（附带高峰提示）
 * 适用于需要 forbidClick 的 AI 调用入口（如拍照识别）
 */
export function showAILoading(message: string, options?: Partial<ToastOptions>) {
  return showLoadingToast({
    message: `${message}\n${AI_PEAK_TIP}`,
    forbidClick: true,
    duration: 0,
    ...options
  })
}
