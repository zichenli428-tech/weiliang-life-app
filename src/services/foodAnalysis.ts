/**
 * 营养膳食分析服务
 * PRD 3.1：AI 智能解析 — 从模糊描述中提取食材清单 + 估算重量
 * PRD 7.3：膳食分析 System Prompt（OpenCode Zen mimo-v2.5-free）
 * PRD 7.4：前端防报错过滤清洗代码
 * PRD 3.1：本地知识库计算 — 匹配 foodLibrary 计算营养值
 * PRD 3.1：人工干预机制 — AI 结果需用户确认/微调后入库
 * PRD 3.1：兜底与容错 — AI 失败时降级为手动模式
 */
import { chat, type ApiMessage, type ApiMessageContent } from './ai'
import { foodLibrary, buildDietFood, type FoodPreset } from '@/constants/foodLibrary'
import type { DietFood, DietRecord } from '@/types/diet'

// 透传 isAIConfigured 供页面层统一从本模块导入 AI 能力
export { isAIConfigured } from './ai'

// ==================== PRD 7.3 System Prompt ====================

/** AI 食物解析的 System Prompt（PRD 7.3） */
const FOOD_ANALYSIS_SYSTEM_PROMPT = `你是一个嵌入在"微量生活"App中的专业膳食数据结构化解析助手。你的核心任务是将用户通过文字、语音转文字或图片多模态输入的模糊饮食描述，精准转化为程序可处理的食材清单与重量估算。

### 核心执行规则

1. 【严格输出】你必须**只输出**一个标准的 JSON 数组，严禁包含任何前言、后记、解释性文字、或者 Markdown 的 \`\`\`json 格式标记。如果完全无法识别，请直接返回空数组 []。

2. 【模糊拆解】当用户给出模糊描述（如"一碗西红柿牛肉面"）时，你必须根据合理的中式膳食比例，将它拆解为具体的独立食材（如：面条、西红柿、牛肉），并估算各自的克数（g）。

3. 【冲突策略】如果输入包含多模态信息，且用户的文本指令与图像内容存在冲突（例如：图片显示是一大碗面，但文本补充说明"只要一小拉溜面，面少一点"），必须以用户的文本补充指令为主进行克数微调。

4. 【字段规范】JSON 数组中的每个对象必须且仅能包含以下两个字段：
   - "font_name": 字符串类型，代表食材的通用中文名称（如 "西红柿"、"牛肉"、"面条"）。
   - "font_g": 数值类型，代表该食材的估算重量（单位：克，纯数字，严禁带单位后缀）。

### 示例输入：
"中午吃了一碗西红柿牛肉面，面稍微有点少"

### 示例输出：
[{"font_name": "面条", "font_g": 100}, {"font_name": "西红柿", "font_g": 100}, {"font_name": "牛肉", "font_g": 50}]`

// ==================== PRD 7.4 JSON 清洗 ====================

/** AI 返回的原始食材项 */
export interface RawFoodItem {
  font_name: string
  font_g: number
}

/**
 * 清洗大模型返回的原始字符串并安全解析为 JSON 数组
 * PRD 7.4：前端防报错过滤清洗代码
 * 利用边界查找法，只掐取最核心的 [ 和 ]，确保即使大模型吐出废话，JSON.parse() 也绝不崩溃
 */
export function cleanAndParseFoodJSON(rawResponse: string): RawFoodItem[] {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return []
  }

  let cleanedText = rawResponse.trim()

  try {
    // 1. 拦截防御：处理大模型经常偷渡的 Markdown 代码块
    const codeBlockRegex = /```(?:json)?\s*(\[[\s\S]*?\])\s*```/
    const match = cleanedText.match(codeBlockRegex)
    if (match && match[1]) {
      cleanedText = match[1].trim()
    }

    // 2. 边界裁剪：防止大模型在 JSON 外面说废话
    const startIndex = cleanedText.indexOf('[')
    const endIndex = cleanedText.lastIndexOf(']')
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      throw new Error('未在返回内容中捕捉到合法的 JSON 数组边界')
    }

    cleanedText = cleanedText.substring(startIndex, endIndex + 1)

    // 3. 基础解析
    const parsedData = JSON.parse(cleanedText)

    // 4. 数据合规性校验与二次清洗
    if (!Array.isArray(parsedData)) {
      throw new Error('解析成功，但返回的数据类型不是数组')
    }

    return parsedData
      .filter(
        (item: unknown) =>
          item !== null &&
          typeof item === 'object' &&
          'font_name' in item
      )
      .map((item: Record<string, unknown>) => ({
        font_name: String(item.font_name).trim(),
        // 下限 1g：0g 食材无意义，且会在 RecordView 重量滑块按比例换算时触发除零（NaN）
        font_g: isNaN(parseFloat(String(item.font_g)))
          ? 100
          : Math.max(1, parseFloat(String(item.font_g)))
      }))
      .filter((item: RawFoodItem) => item.font_name.length > 0)
  } catch (error) {
    console.error('【AI解析膳食失败，触发降级兜底】错误详情:', error)
    return []
  }
}

// ==================== 本地知识库匹配 ====================

/**
 * PRD 3.1：本地知识库计算
 * 将 AI 提取的食材匹配到预置食物库，计算营养值
 * 匹配策略：精确匹配 → 包含匹配 → 模糊匹配 → 未匹配（默认营养值）
 */
export function matchLocalFoodDB(items: RawFoodItem[]): DietFood[] {
  return items.map((item) => {
    const preset = findFoodPreset(item.font_name)
    if (preset) {
      // 匹配成功：用食物库的营养值按重量计算
      return buildDietFood(preset, item.font_g)
    } else {
      // 未匹配：使用默认热量估算（约 150 kcal/100g 中等值）
      return {
        name: item.font_name,
        amount: item.font_g,
        calories: Math.round((item.font_g / 100) * 150),
        protein: 0,
        fat: 0,
        carbs: 0
      }
    }
  })
}

/**
 * 在预置食物库中查找匹配项
 * 支持精确匹配、包含匹配、别名匹配
 */
function findFoodPreset(name: string): FoodPreset | null {
  const lowerName = name.toLowerCase().trim()

  // 1. 精确匹配
  const exact = foodLibrary.find(
    (f) => f.name.toLowerCase() === lowerName
  )
  if (exact) return exact

  // 2. 包含匹配（食物库中的名称是输入的子串，或反之）
  const contains = foodLibrary.find(
    (f) =>
      lowerName.includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(lowerName)
  )
  if (contains) return contains

  // 3. 常见别名匹配
  const aliasMap: Record<string, string> = {
    鸡蛋: '鸡蛋',
    鸡蛋壳: '鸡蛋',
    米: '米饭',
    饭: '米饭',
    白米饭: '米饭',
    面: '面条',
    馒头片: '馒头',
    红薯块: '红薯',
    地瓜: '红薯',
    番茄: '番茄',
    西红柿: '番茄',
    洋芋: '土豆',
    土豆: '土豆',
    马铃薯: '土豆'
  }
  const aliasTarget = aliasMap[name]
  if (aliasTarget) {
    const aliasMatch = foodLibrary.find((f) => f.name === aliasTarget)
    if (aliasMatch) return aliasMatch
  }

  return null
}

// ==================== 对外接口 ====================

/** AI 食物分析结果 */
export interface FoodAnalysisResult {
  /** 是否成功识别 */
  success: boolean
  /** 解析出的食物列表（含营养值） */
  foods: DietFood[]
  /** 原始 AI 返回（调试用） */
  rawResponse?: string
  /** 错误信息（失败时） */
  error?: string
}

/**
 * PRD 3.1：AI 智能解析入口
 * 输入模糊文字描述 → AI 提取食材清单 → 本地知识库匹配营养值
 * 包含兜底容错：AI 失败时返回 success: false，由上层降级为手动模式
 */
export async function analyzeFoodText(input: string): Promise<FoodAnalysisResult> {
  if (!input.trim()) {
    return { success: false, foods: [], error: '输入为空' }
  }

  try {
    const messages: ApiMessage[] = [
      { role: 'system', content: FOOD_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: input }
    ]

    const rawResponse = await chat(messages, {
      temperature: 0.1,
      timeout: 60000
    })

    const rawItems = cleanAndParseFoodJSON(rawResponse)

    if (rawItems.length === 0) {
      return {
        success: false,
        foods: [],
        rawResponse,
        error: 'AI 未能识别食物，请尝试更详细的描述或手动添加'
      }
    }

    const foods = matchLocalFoodDB(rawItems)

    return {
      success: true,
      foods,
      rawResponse
    }
  } catch (error) {
    return {
      success: false,
      foods: [],
      error: error instanceof Error ? error.message : 'AI 分析失败，请检查网络后重试'
    }
  }
}

// ==================== PRD 3.1：拍照识别（多模态） ====================

/**
 * PRD 3.1：AI 拍照识别入口
 * 输入图片 base64 → AI 多模态识别食材清单 → 本地知识库匹配营养值
 * mimo-v2.5-free 支持文字+图片输入，文字输出
 */
export async function analyzeFoodImage(
  imageBase64: string,
  textHint?: string
): Promise<FoodAnalysisResult> {
  try {
    const userPrompt = textHint?.trim()
      ? `请识别图中的食物并估算各食材重量。用户补充说明：${textHint.trim()}`
      : '请识别图中的食物并估算各食材重量（单位：克）。'

    const content: ApiMessageContent[] = [
      { type: 'text', text: userPrompt },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]

    const messages: ApiMessage[] = [
      { role: 'system', content: FOOD_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content }
    ]

    const rawResponse = await chat(messages, {
      temperature: 0.1,
      timeout: 60000
    })

    const rawItems = cleanAndParseFoodJSON(rawResponse)

    if (rawItems.length === 0) {
      return {
        success: false,
        foods: [],
        rawResponse,
        error: 'AI 未能从图片中识别食物，请尝试手动添加或重新拍照'
      }
    }

    const foods = matchLocalFoodDB(rawItems)

    return {
      success: true,
      foods,
      rawResponse
    }
  } catch (error) {
    return {
      success: false,
      foods: [],
      error: error instanceof Error ? error.message : 'AI 图片识别失败，请检查网络后重试'
    }
  }
}

// ==================== PRD 3.1 & 4.4：每日营养分析 ====================

/** 营养状态标识（PRD 4.4 红/黄/绿三色） */
export type NutritionStatus = 'green' | 'yellow' | 'red'

/** 每日营养分析结果 */
export interface DailyNutritionAnalysisResult {
  success: boolean
  /** 总体状态 */
  status: NutritionStatus
  /** AI 分析建议 */
  advice: string
  /** 各营养素评估 */
  details: {
    label: string
    value: string
    status: NutritionStatus
  }[]
  error?: string
}

/** 计算今日总营养 */
function sumNutrition(records: DietRecord[]) {
  const total = records.reduce(
    (acc, r) => ({
      calories: acc.calories + r.totalCalories,
      protein: acc.protein + r.totalProtein,
      fat: acc.fat + r.totalFat,
      carbs: acc.carbs + r.totalCarbs
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  )
  return total
}

/**
 * PRD 3.1 & 4.4：AI 每日营养分析
 * 基于今日饮食记录，AI 分析营养均衡度并给出红/黄/绿状态和建议
 */
export async function analyzeDailyNutrition(
  records: DietRecord[]
): Promise<DailyNutritionAnalysisResult> {
  if (records.length === 0) {
    return {
      success: false,
      status: 'green',
      advice: '',
      details: [],
      error: '今日还没有饮食记录，添加记录后即可进行 AI 营养分析'
    }
  }

  const total = sumNutrition(records)

  const foodList = records
    .map((r) => `${r.mealType}: ${r.foods.map((f) => `${f.name}(${f.amount}g/${f.calories}kcal)`).join('、')}`)
    .join('\n')

  const systemPrompt = `你是"微量生活"App 的营养分析师。请根据用户今日的饮食记录，分析营养均衡度并给出建议。

### 输出要求
只输出一个 JSON 对象，不要包含任何其他文字或 Markdown 标记。格式如下：
{
  "status": "green" | "yellow" | "red",
  "advice": "总体建议，50-100字，温暖专业的语气",
  "details": [
    {"label": "热量", "value": "XXX kcal", "status": "green" | "yellow" | "red"},
    {"label": "蛋白质", "value": "XX g", "status": "green" | "yellow" | "red"},
    {"label": "脂肪", "value": "XX g", "status": "green" | "yellow" | "red"},
    {"label": "碳水", "value": "XX g", "status": "green" | "yellow" | "red"}
  ]
}

### 状态标准
- green（健康）：营养素在合理范围内
- yellow（注意）：略偏高或偏低，需关注
- red（警示）：明显超标或严重不足

### 热量参考
成人每日推荐热量约 1800-2200 kcal，蛋白质 50-65g，脂肪 40-60g，碳水 200-300g。请结合用户实际数据评估。`

  const userPrompt = `今日饮食记录：
${foodList}

今日总营养：热量 ${total.calories} kcal，蛋白质 ${total.protein}g，脂肪 ${total.fat}g，碳水 ${total.carbs}g

请分析营养均衡度。`

  try {
    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const rawResponse = await chat(messages, {
      temperature: 0.3,
      timeout: 60000
    })

    const result = parseNutritionJSON(rawResponse, total)

    return {
      success: true,
      ...result
    }
  } catch (error) {
    // 降级：返回本地估算结果
    return {
      success: true,
      ...localNutritionEstimate(total),
      error: error instanceof Error ? error.message : 'AI 分析失败，使用本地估算'
    }
  }
}

/** 解析 AI 返回的营养分析 JSON */
function parseNutritionJSON(
  raw: string,
  total: { calories: number; protein: number; fat: number; carbs: number }
): { status: NutritionStatus; advice: string; details: { label: string; value: string; status: NutritionStatus }[] } {
  try {
    let text = raw.trim()
    // 提取 JSON 对象
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('no JSON')
    text = text.substring(start, end + 1)

    const parsed = JSON.parse(text)

    const status = (['green', 'yellow', 'red'] as const).includes(parsed.status)
      ? parsed.status
      : 'green'

    const advice = typeof parsed.advice === 'string' ? parsed.advice : ''

    const details = Array.isArray(parsed.details)
      ? parsed.details
          .filter((d: unknown) => d && typeof d === 'object' && 'label' in d)
          .map((d: Record<string, unknown>) => ({
            label: String(d.label),
            value: String(d.value ?? ''),
            status: (['green', 'yellow', 'red'] as const).includes(d.status as NutritionStatus)
              ? (d.status as NutritionStatus)
              : 'green'
          }))
      : []

    // 如果 AI 没返回 details，用本地数据补全
    if (details.length === 0) {
      return localNutritionEstimate(total)
    }

    return { status, advice, details }
  } catch {
    return localNutritionEstimate(total)
  }
}

/** 本地营养估算（降级方案） */
function localNutritionEstimate(total: { calories: number; protein: number; fat: number; carbs: number }) {
  const calStatus: NutritionStatus =
    total.calories > 2500 ? 'red' : total.calories > 2200 || total.calories < 1200 ? 'yellow' : 'green'
  const proteinStatus: NutritionStatus =
    total.protein > 80 ? 'red' : total.protein < 30 ? 'yellow' : 'green'
  const fatStatus: NutritionStatus =
    total.fat > 70 ? 'red' : total.fat > 60 ? 'yellow' : 'green'
  const carbsStatus: NutritionStatus =
    total.carbs > 350 ? 'red' : total.carbs > 300 || total.carbs < 100 ? 'yellow' : 'green'

  const statuses = [calStatus, proteinStatus, fatStatus, carbsStatus]
  const overall: NutritionStatus = statuses.includes('red')
    ? 'red'
    : statuses.includes('yellow')
      ? 'yellow'
      : 'green'

  return {
    status: overall,
    advice: overall === 'green'
      ? '今日营养摄入均衡，继续保持！建议保持多样化的饮食结构，多吃蔬菜水果。'
      : overall === 'yellow'
        ? '今日部分营养素略有偏差，建议下餐适当调整：注意控制总热量，保证蛋白质摄入，减少高油高糖食物。'
        : '今日部分营养素明显超标或不足，建议调整饮食结构：控制热量摄入，增加蔬菜和优质蛋白，减少油腻食物。',
    details: [
      { label: '热量', value: `${total.calories} kcal`, status: calStatus },
      { label: '蛋白质', value: `${total.protein} g`, status: proteinStatus },
      { label: '脂肪', value: `${total.fat} g`, status: fatStatus },
      { label: '碳水', value: `${total.carbs} g`, status: carbsStatus }
    ]
  }
}
