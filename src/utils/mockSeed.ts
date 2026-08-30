/**
 * 开发环境 Mock 数据种子
 * 用于本地快速预览 UI 交互效果，无需真实数据或网络
 *
 * 覆盖：用户档案、饮食记录（7天）、睡眠记录（7天）、
 *       AI 顾问会话、心理疏导会话、情绪日记（7天）、今日打卡
 *
 * 触发方式：环境变量 VITE_MOCK_SEED=true
 * 幂等保护：通过 localStorage 标记避免重复注入；URL 加 ?seed=reset 强制重置
 */
import { setItem } from '@/utils/storage'
import type { UserProfile } from '@/types/user'
import type { DietRecord, DietFood, MealType, RecordSource } from '@/types/diet'
import type { SleepRecord } from '@/types/sleep'
import type { ChatSession, ChatMessage } from '@/types/chat'
import type { MindSession, MindMessage, EmotionRecord, EmotionType } from '@/types/mind'

const SEED_FLAG = 'mock_seeded_v1'

/** 格式化日期 YYYY-MM-DD */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 获取距今天 n 天的日期 key */
function dateOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return fmtDate(d)
}

/** 简易食物库（每 100g 营养值） */
const FOOD_DB: Record<string, DietFood> = {
  米饭: { name: '米饭', amount: 100, calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9 },
  全麦面包: { name: '全麦面包', amount: 100, calories: 247, protein: 9, fat: 3.4, carbs: 41 },
  鸡蛋: { name: '鸡蛋', amount: 60, calories: 78, protein: 6.3, fat: 5.3, carbs: 0.6 },
  牛奶: { name: '牛奶', amount: 250, calories: 163, protein: 8.5, fat: 9.3, carbs: 12.5 },
  鸡胸肉: { name: '鸡胸肉', amount: 120, calories: 133, protein: 27.7, fat: 1.6, carbs: 0 },
  西兰花: { name: '西兰花', amount: 150, calories: 51, protein: 4.1, fat: 0.6, carbs: 9 },
  番茄: { name: '番茄', amount: 100, calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
  苹果: { name: '苹果', amount: 200, calories: 104, protein: 0.4, fat: 0.4, carbs: 27.6 },
  燕麦: { name: '燕麦', amount: 50, calories: 190, protein: 6.5, fat: 3.5, carbs: 33 },
  三文鱼: { name: '三文鱼', amount: 100, calories: 208, protein: 20, fat: 13, carbs: 0 },
  糙米饭: { name: '糙米饭', amount: 150, calories: 165, protein: 3.5, fat: 1.2, carbs: 34.8 },
  酸奶: { name: '酸奶', amount: 150, calories: 100, protein: 3.5, fat: 3.3, carbs: 13 },
  香蕉: { name: '香蕉', amount: 150, calories: 134, protein: 1.6, fat: 0.5, carbs: 34.2 },
  豆腐: { name: '豆腐', amount: 100, calories: 73, protein: 8, fat: 3.7, carbs: 1.9 },
  菠菜: { name: '菠菜', amount: 150, calories: 39, protein: 3.3, fat: 0.7, carbs: 4.8 },
  虾仁: { name: '虾仁', amount: 80, calories: 60, protein: 12, fat: 0.6, carbs: 0.3 },
  紫薯: { name: '紫薯', amount: 150, calories: 150, protein: 2.4, fat: 0.3, carbs: 35 },
  核桃: { name: '核桃', amount: 30, calories: 196, protein: 4.3, fat: 19.5, carbs: 4.2 }
}

/** 按餐次组合食物 */
function buildMeal(meal: MealType, daySeed: number): DietFood[] {
  const menus: Record<MealType, string[][]> = {
    breakfast: [
      ['全麦面包', '鸡蛋', '牛奶'],
      ['燕麦', '牛奶', '苹果'],
      ['全麦面包', '鸡蛋', '酸奶']
    ],
    lunch: [
      ['糙米饭', '鸡胸肉', '西兰花', '番茄'],
      ['米饭', '三文鱼', '菠菜', '番茄'],
      ['糙米饭', '虾仁', '豆腐', '西兰花']
    ],
    dinner: [
      ['紫薯', '鸡胸肉', '菠菜'],
      ['糙米饭', '豆腐', '西兰花'],
      ['紫薯', '虾仁', '番茄']
    ],
    snack: [
      ['苹果'],
      ['酸奶', '核桃'],
      ['香蕉']
    ]
  }
  const options = menus[meal]
  const pick = options[daySeed % options.length]
  return pick.map((name) => ({ ...FOOD_DB[name] }))
}

/** 计算一条记录的营养汇总 */
function sumNutrition(foods: DietFood[]) {
  return {
    totalCalories: Math.round(foods.reduce((s, f) => s + f.calories, 0)),
    totalProtein: Math.round(foods.reduce((s, f) => s + f.protein, 0) * 10) / 10,
    totalFat: Math.round(foods.reduce((s, f) => s + f.fat, 0) * 10) / 10,
    totalCarbs: Math.round(foods.reduce((s, f) => s + f.carbs, 0) * 10) / 10
  }
}

/** 生成 7 天饮食记录 */
function buildDietRecords(): DietRecord[] {
  const records: DietRecord[] = []
  const mealTimes: Record<MealType, string> = {
    breakfast: '08:00',
    lunch: '12:30',
    dinner: '19:00',
    snack: '15:30'
  }
  for (let i = 0; i < 7; i++) {
    const date = dateOffset(-i)
    const daySeed = i + 1
    const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
    meals.forEach((meal, idx) => {
      const foods = buildMeal(meal, daySeed)
      const sum = sumNutrition(foods)
      records.push({
        id: `mock_diet_${date}_${meal}`,
        date,
        time: mealTimes[meal],
        mealType: meal,
        foods,
        ...sum,
        source: (idx % 3 === 0 ? 'photo' : 'manual') as RecordSource,
        note: meal === 'breakfast' ? '元气早餐' : undefined,
        createdAt: new Date(`${date}T${mealTimes[meal]}:00`).getTime()
      })
    })
  }
  return records
}

/** 生成 7 天睡眠记录 */
function buildSleepRecords(): SleepRecord[] {
  const scores = [4, 3, 5, 4, 3, 4, 5]
  const records: SleepRecord[] = []
  for (let i = 0; i < 7; i++) {
    const date = dateOffset(-i)
    const score = scores[i]
    const bedtime = score >= 4 ? '23:00' : '00:30'
    const wakeTime = '07:30'
    records.push({
      date,
      score,
      bedtime,
      wakeTime,
      note: score <= 3 ? '入睡较晚，感觉没睡够' : score >= 5 ? '一夜好眠，精力充沛' : undefined,
      createdAt: new Date(`${date}T08:00:00`).getTime()
    })
  }
  return records
}

/** 生成 AI 顾问示例会话 */
function buildChatSessions(): ChatSession[] {
  const now = Date.now()
  const messages: ChatMessage[] = [
    { id: 'mock_msg_1', role: 'user', content: '我今天想减脂，晚餐该怎么吃？', createdAt: now - 600000 },
    {
      id: 'mock_msg_2',
      role: 'assistant',
      content:
        '减脂期晚餐建议遵循"高蛋白、低碳水、多蔬菜"的原则～\n\n推荐搭配：150g 紫薯 + 120g 鸡胸肉 + 150g 西兰花，总热量约 330kcal，蛋白质 30g，既能饱腹又控制热量。\n\n睡前 3 小时吃完，避免影响睡眠。加油，你离目标 55kg 越来越近了！💪',
      createdAt: now - 540000
    },
    { id: 'mock_msg_3', role: 'user', content: '运动方面呢，一周练几次比较好？', createdAt: now - 300000 },
    {
      id: 'mock_msg_4',
      role: 'assistant',
      content:
        '减脂推荐每周 4-5 次运动，有氧 + 力量结合效果最佳：\n\n• 3 次有氧（快走/慢跑/跳绳，每次 30 分钟）\n• 2 次力量训练（深蹲/俯卧撑/核心，每次 20 分钟）\n\n运动日多喝 2 杯水，注意拉伸放松。坚持 4 周就能看到明显变化！',
      createdAt: now - 240000
    }
  ]
  return [
    {
      id: 'mock_sess_1',
      title: '减脂饮食与运动建议',
      messages,
      createdAt: now - 600000,
      updatedAt: now - 240000
    }
  ]
}

/** 生成心理疏导示例会话 + 情绪日记 */
function buildMindData(): { sessions: MindSession[]; emotions: EmotionRecord[] } {
  const now = Date.now()
  const messages: MindMessage[] = [
    { id: 'mock_mind_1', role: 'user', content: '最近工作压力好大，总觉得喘不过气', createdAt: now - 800000, detectedEmotion: 'stressed' },
    {
      id: 'mock_mind_2',
      role: 'assistant',
      content:
        '我能感受到你承受的压力，那种喘不过气的感觉真的很辛苦 🤗\n\n先和我一起做个深呼吸——吸气 4 秒，慢慢呼气 6 秒。感受一下肩膀是不是放松了一点？\n\n压力是身体在提醒我们需要休息了。能和我说说最近最让你焦虑的事吗？',
      createdAt: now - 740000,
      detectedEmotion: 'stressed'
    },
    { id: 'mock_mind_3', role: 'user', content: '主要是项目deadline太多，感觉做不完', createdAt: now - 400000, detectedEmotion: 'anxious' },
    {
      id: 'mock_mind_4',
      role: 'assistant',
      content:
        'deadline 堆在一起确实让人焦虑 😮‍💨 不过你已经在主动面对了，这本身就很棒。\n\n试试这个方法：把所有任务列出来，按紧急程度排个序，每次只专注做一件事。完成一项就划掉，看着清单变短会很有成就感。\n\n记住，你不是一个人在面对，累了就歇会儿，深呼吸，慢慢来 🌿',
      createdAt: now - 340000,
      detectedEmotion: 'anxious'
    }
  ]
  const sessions: MindSession[] = [
    {
      id: 'mock_mind_sess_1',
      title: '工作压力疏导',
      messages,
      createdAt: now - 800000,
      updatedAt: now - 340000
    }
  ]

  const emotionCycle: { emotion: EmotionType; score: number }[] = [
    { emotion: 'stressed', score: 4 },
    { emotion: 'anxious', score: 3 },
    { emotion: 'tired', score: 4 },
    { emotion: 'calm', score: 3 },
    { emotion: 'happy', score: 2 },
    { emotion: 'calm', score: 2 },
    { emotion: 'happy', score: 1 }
  ]
  const emotions: EmotionRecord[] = emotionCycle.map((e, i) => ({
    date: dateOffset(-i),
    emotion: e.emotion,
    score: e.score,
    note: i < 2 ? '工作压力大' : i === 6 ? '今天心情不错，散步后放松了很多' : undefined,
    createdAt: new Date(`${dateOffset(-i)}T21:00:00`).getTime()
  }))

  return { sessions, emotions }
}

/** 写入今日打卡数据到 localStorage */
function seedCheckins() {
  const key = `checkins_${dateOffset(0)}`
  localStorage.setItem(key, JSON.stringify({ water: 5, exercise: 30 }))
}

/** 写入每日寄语缓存，避免 HomeView 触发真实 AI 请求 */
function seedDailyMessage() {
  const key = `ai_daily_${dateOffset(0)}`
  localStorage.setItem(key, '早上好，林小微！距离目标体重还有 3kg，坚持记录每一餐，你做得很棒 🌿')
}

/**
 * 执行 mock 数据注入（幂等，已注入则跳过）
 * @returns 是否实际执行了注入
 */
export async function seedMockData(force = false): Promise<boolean> {
  if (!force && localStorage.getItem(SEED_FLAG)) {
    return false
  }

  const now = Date.now()

  // 1. 用户档案 + 建档标记
  const profile: UserProfile = {
    nickname: '林小微',
    gender: 'female',
    age: 26,
    height: 165,
    weight: 58,
    targetWeight: 55,
    goal: 'lose_fat',
    activityLevel: 'moderate',
    createdAt: now - 7 * 24 * 60 * 60 * 1000,
    updatedAt: now - 24 * 60 * 60 * 1000
  }
  await setItem<UserProfile>('user', 'profile', profile)
  await setItem<boolean>('user', 'onboarded', true)

  // 2. 饮食记录
  await setItem<DietRecord[]>('diet', 'records', buildDietRecords())

  // 3. 睡眠记录
  await setItem<SleepRecord[]>('sleep', 'sleep_records', buildSleepRecords())

  // 4. AI 顾问会话
  const chatSessions = buildChatSessions()
  await setItem<ChatSession[]>('chat', 'sessions', chatSessions)
  await setItem<string>('chat', 'activeSessionId', chatSessions[0].id)

  // 5. 心理疏导会话 + 情绪日记 + 角色风格
  const { sessions: mindSessions, emotions } = buildMindData()
  await setItem<MindSession[]>('mind', 'mind_sessions', mindSessions)
  await setItem<string>('mind', 'mind_active_session', mindSessions[0].id)
  await setItem<EmotionRecord[]>('mind', 'mind_emotion_records', emotions)
  await setItem<string>('mind', 'mind_role_style', 'warm_friend')

  // 6. localStorage：打卡 + 寄语缓存
  seedCheckins()
  seedDailyMessage()

  localStorage.setItem(SEED_FLAG, '1')
  console.info('[mockSeed] mock 数据注入完成，共 7 天饮食/睡眠/情绪记录 + 示例会话')
  return true
}

/** 清空所有 mock 数据（用于重置） */
export async function clearMockData(): Promise<void> {
  const { clearStore } = await import('@/utils/storage')
  await clearStore('user')
  await clearStore('diet')
  await clearStore('sleep')
  await clearStore('chat')
  await clearStore('mind')
  localStorage.removeItem(SEED_FLAG)
  // 清理打卡与寄语缓存
  for (let i = 0; i < 7; i++) {
    const d = dateOffset(-i)
    localStorage.removeItem(`checkins_${d}`)
    localStorage.removeItem(`ai_daily_${d}`)
  }
  console.info('[mockSeed] 已清空所有 mock 数据')
}
