<script setup lang="ts">
/**
 * 健康记录（Tab 3）
 * PRD 3.4：饮食/运动记录列表、手动/拍照录入 | 图像识别估算、JSON 结构化解析
 * PRD 3.1：营养膳食分析核心亮点
 * 重设计：Apple 风格，浅色默认，实色卡片 + chart-3（橙）模块色
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { showToast, showConfirmDialog, showLoadingToast } from 'vant'
import { showAITip, showAILoading } from '@/utils/aiToast'
import { useDietStore } from '@/store/modules/diet'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'
import {
  mealTypeLabels,
  sourceLabels,
  type DietFood,
  type DietRecord,
  type MealType
} from '@/types/diet'
import {
  foodLibrary,
  categoryLabels,
  buildDietFood,
  buildCustomFood,
  type FoodPreset,
  type FoodCategory
} from '@/constants/foodLibrary'
import {
  analyzeFoodText,
  analyzeFoodImage,
  analyzeDailyNutrition,
  isAIConfigured,
  type NutritionStatus,
  type DailyNutritionAnalysisResult
} from '@/services/foodAnalysis'
import FeatureTutorial, { type TutorialStep } from '@/components/FeatureTutorial.vue'
import { useFeatureTutorial } from '@/composables/useFeatureTutorial'

const dietStore = useDietStore()

// ==================== 今日汇总 ====================
const todayCalories = computed(() => dietStore.todayCalories)
const todayCount = computed(() => dietStore.todayRecords.length)

// ==================== 按日期分组展示 ====================
const groupedDates = computed(() => {
  const groups = dietStore.recordsByDate
  const today = new Date()
  const todayStr = formatDate(today)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)

  return Object.keys(groups).map((date) => {
    let label = ''
    if (date === todayStr) label = '今日'
    else if (date === yesterdayStr) label = '昨日'
    else label = formatDateLabel(date)
    return { date, label, records: groups[date] }
  })
})

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}月${d}日`
}

function getMealInfo(mealType: MealType) {
  return mealTypeLabels[mealType]
}

function foodsSummary(record: DietRecord): string {
  const names = record.foods.map((f) => f.name).join('、')
  return names.length > 24 ? names.slice(0, 24) + '…' : names
}

/** 格式化数值：四舍五入到 1 位小数 */
const formatNum = (v: number) => Math.round(v * 10) / 10

// ==================== 删除记录 ====================
const handleDelete = (record: DietRecord) => {
  showConfirmDialog({
    title: '删除记录',
    message: `确定删除 ${getMealInfo(record.mealType).label} 记录（${record.totalCalories} kcal）吗？`,
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
    .then(async () => {
      await dietStore.removeRecord(record.id)
      showToast({ type: 'success', message: '已删除' })
    })
    .catch(() => {})
}

// ==================== 添加记录弹窗 ====================
const addVisible = ref(false)
const activeMealType = ref<MealType>('breakfast')
const selectedFoods = ref<DietFood[]>([])
const searchKeyword = ref('')
const activeCategory = ref<FoodCategory | 'all'>('all')

// 自定义食物输入
const customVisible = ref(false)
const customForm = ref({ name: '', amount: 100, calories: 0 })

const mealTypeList: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const filteredFoods = computed(() => {
  let list = foodLibrary
  if (activeCategory.value !== 'all') {
    list = list.filter((f) => f.category === activeCategory.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter((f) => f.name.toLowerCase().includes(kw))
  }
  return list
})

const categoryList = computed(() => {
  return [
    { key: 'all' as const, label: '全部', icon: '📋' },
    ...(Object.keys(categoryLabels) as FoodCategory[]).map((k) => ({
      key: k,
      label: categoryLabels[k].label,
      icon: categoryLabels[k].icon
    }))
  ]
})

const totalPreview = computed(() => {
  const calories = selectedFoods.value.reduce((s, f) => s + f.calories, 0)
  const protein = selectedFoods.value.reduce((s, f) => s + f.protein, 0)
  const fat = selectedFoods.value.reduce((s, f) => s + f.fat, 0)
  const carbs = selectedFoods.value.reduce((s, f) => s + f.carbs, 0)
  return { calories, protein, fat, carbs }
})

const openAddPopup = (mealType?: MealType) => {
  activeMealType.value = mealType || guessMealTypeByTime()
  selectedFoods.value = []
  searchKeyword.value = ''
  activeCategory.value = 'all'
  addVisible.value = true
}

function guessMealTypeByTime(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 17) return 'snack'
  if (h < 21) return 'dinner'
  return 'snack'
}

const addPresetFood = (preset: FoodPreset) => {
  const food = buildDietFood(preset)
  selectedFoods.value.push(food)
  showToast(`已添加 ${food.name}（${food.amount}g / ${food.calories} kcal）`)
}

const removeSelectedFood = (index: number) => {
  selectedFoods.value.splice(index, 1)
}

const openCustomFood = () => {
  customForm.value = { name: '', amount: 100, calories: 0 }
  customVisible.value = true
}

const confirmCustomFood = () => {
  const { name, amount, calories } = customForm.value
  if (!name.trim()) {
    showToast('请输入食物名称')
    return
  }
  if (amount <= 0) {
    showToast('请输入有效分量')
    return
  }
  if (calories < 0) {
    showToast('请输入有效热量')
    return
  }
  const food = buildCustomFood(name.trim(), amount, calories)
  selectedFoods.value.push(food)
  customVisible.value = false
  showToast(`已添加 ${food.name}（${food.calories} kcal）`)
}

const handleSaveRecord = async () => {
  if (selectedFoods.value.length === 0) {
    showToast('请至少添加一种食物')
    return
  }
  await dietStore.addRecord({
    foods: [...selectedFoods.value],
    mealType: activeMealType.value,
    source: 'manual'
  })
  addVisible.value = false
  showToast({ type: 'success', message: '记录已保存' })
}

// ==================== AI 文字识别 ====================
const aiTextVisible = ref(false)
const aiTextInput = ref('')
const aiAnalyzing = ref(false)
const aiResultVisible = ref(false)
const aiFoods = ref<DietFood[]>([])
const aiMealType = ref<MealType>('breakfast')
const aiConfigured = computed(() => isAIConfigured())
/** 标记 AI 识别是否从「手动添加」弹窗内调用，决定识别完成后是合并到已选食物还是直接入库 */
const aiFromAddPopup = ref(false)

const aiTotalPreview = computed(() => {
  const calories = aiFoods.value.reduce((s, f) => s + f.calories, 0)
  const protein = aiFoods.value.reduce((s, f) => s + f.protein, 0)
  const fat = aiFoods.value.reduce((s, f) => s + f.fat, 0)
  const carbs = aiFoods.value.reduce((s, f) => s + f.carbs, 0)
  return { calories, protein, fat, carbs }
})

const openAITextInput = (mealType?: MealType) => {
  if (!aiConfigured.value) {
    showToast('AI 服务未配置，请检查 .env 文件')
    return
  }
  aiFromAddPopup.value = false
  aiMealType.value = mealType || guessMealTypeByTime()
  aiTextInput.value = ''
  aiTextVisible.value = true
}

/** 从「手动添加」弹窗内调用 AI 识别：隐藏手动弹窗（保留已选食物），识别完成后合并回已选列表 */
const openAIFromAdd = () => {
  if (!aiConfigured.value) {
    showToast('AI 服务未配置，请检查 .env 文件')
    return
  }
  aiFromAddPopup.value = true
  aiMealType.value = activeMealType.value
  aiTextInput.value = ''
  photoPreview.value = ''
  photoHint.value = ''
  aiMode.value = 'text'
  addVisible.value = false
  aiTextVisible.value = true
}

const handleAIAnalysis = async () => {
  const text = aiTextInput.value.trim()
  if (!text) {
    showToast('请描述你吃了什么')
    return
  }

  aiAnalyzing.value = true
  const loading = showAILoading('AI 正在分析...')

  try {
    const result = await analyzeFoodText(text)
    loading.close()

    if (result.success && result.foods.length > 0) {
      aiFoods.value = result.foods
      aiTextVisible.value = false
      aiResultVisible.value = true
    } else {
      showToast(result.error || 'AI 未能识别，请手动添加')
      aiTextVisible.value = false
      if (aiFromAddPopup.value) {
        aiFromAddPopup.value = false
        addVisible.value = true
      } else {
        openAddPopup(aiMealType.value)
      }
    }
  } catch {
    loading.close()
    showToast('AI 分析失败，请手动添加')
    aiTextVisible.value = false
    if (aiFromAddPopup.value) {
      aiFromAddPopup.value = false
      addVisible.value = true
    } else {
      openAddPopup(aiMealType.value)
    }
  } finally {
    aiAnalyzing.value = false
  }
}

const updateAIFoodAmount = (index: number, newAmount: number) => {
  const food = aiFoods.value[index]
  if (!food) return
  const ratio = newAmount / food.amount
  food.amount = newAmount
  food.calories = Math.round(food.calories * ratio)
  food.protein = Math.round(food.protein * ratio * 10) / 10
  food.fat = Math.round(food.fat * ratio * 10) / 10
  food.carbs = Math.round(food.carbs * ratio * 10) / 10
}

const removeAIFood = (index: number) => {
  aiFoods.value.splice(index, 1)
}

const confirmAIFoods = async () => {
  if (aiFoods.value.length === 0) {
    showToast('没有可保存的食物')
    return
  }
  if (aiFromAddPopup.value) {
    // 从手动添加弹窗进入：将 AI 识别结果合并到已选食物，返回手动添加弹窗
    const count = aiFoods.value.length
    selectedFoods.value.push(...aiFoods.value)
    aiResultVisible.value = false
    aiFromAddPopup.value = false
    addVisible.value = true
    showToast({ type: 'success', message: `已添加 ${count} 项 AI 识别食物` })
    return
  }
  await dietStore.addRecord({
    foods: [...aiFoods.value],
    mealType: aiMealType.value,
    source: 'manual'
  })
  aiResultVisible.value = false
  showToast({ type: 'success', message: 'AI 识别记录已保存' })
}

// ==================== 拍照识别 ====================
const aiMode = ref<'text' | 'photo'>('text')
const photoPreview = ref<string>('')
const photoHint = ref('')
const photoAnalyzing = ref(false)
const cameraInput = ref<HTMLInputElement | null>(null)
const albumInput = ref<HTMLInputElement | null>(null)

/** 读取文件为 DataURL */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 加载图片元素（用于 canvas 绘制） */
function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** canvas 转 Blob */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob 失败'))),
      type,
      quality
    )
  })
}

/** Blob 转 DataURL */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('blob 读取失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 压缩图片至 maxBytes 以内（默认 5MB）
 * 策略：长边先限 2048px；再以「尺寸 × 质量」双维度逐步降级
 *   - 同一尺寸下质量从 0.9 降到 0.2
 *   - 仍超标则尺寸按 0.75 倍缩小，重新降质
 *   - 尺寸下限 320px（再小会严重影响食物识别准确度）
 * 兜底：320px @ 0.2 的 JPEG 体积必然远小于 5MB，故一定能满足上限
 * 返回 JPEG DataURL
 */
async function compressImage(file: File, maxBytes = 5 * 1024 * 1024): Promise<string> {
  const dataUrl = await readFileAsDataURL(file)
  const img = await loadImageEl(dataUrl)

  let width = img.naturalWidth
  let height = img.naturalHeight
  const MAX_DIM = 2048
  if (Math.max(width, height) > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  // 尺寸下限：再小会严重影响食物识别准确度
  const MIN_DIM = 320

  let blob: Blob | null = null
  // 阶段一 + 阶段二：尺寸 × 质量双维度降级
  while (Math.max(width, height) >= MIN_DIM) {
    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)

    // 同一尺寸下逐步降低质量 0.9 → 0.2
    let quality = 0.9
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    while (blob.size > maxBytes && quality > 0.2) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }
    if (blob.size <= maxBytes) break

    // 当前尺寸降到 0.2 仍超标，缩小尺寸继续
    width = Math.round(width * 0.75)
    height = Math.round(height * 0.75)
  }

  // 兜底：极端情况下仍超标（理论上 320px@0.2 不可能 >5MB），
  // 强制按原图比例缩到 320px 长边并以最低质量编码，确保不超限
  if (!blob || blob.size > maxBytes) {
    const longest = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = MIN_DIM / longest
    width = Math.max(1, Math.round(img.naturalWidth * scale))
    height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.2)
  }

  return blobToDataURL(blob)
}

const handlePhotoSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件')
    target.value = ''
    return
  }

  const loading = showLoadingToast({ message: '处理图片中...', forbidClick: true, duration: 0 })
  try {
    // 原图超过 5MB 则自动压缩；否则原样读取，避免无谓重编码损失
    photoPreview.value =
      file.size > 5 * 1024 * 1024
        ? await compressImage(file, 5 * 1024 * 1024)
        : await readFileAsDataURL(file)
  } catch {
    showToast('图片处理失败，请重试')
  } finally {
    loading.close()
    target.value = ''
  }
}

const clearPhoto = () => {
  photoPreview.value = ''
  photoHint.value = ''
}

const triggerCamera = () => {
  cameraInput.value?.click()
}

const triggerAlbum = () => {
  albumInput.value?.click()
}

const handlePhotoAnalysis = async () => {
  if (!photoPreview.value) {
    showToast('请先拍照或选择图片')
    return
  }

  photoAnalyzing.value = true
  const loading = showAILoading('AI 正在识别图片...')

  try {
    const result = await analyzeFoodImage(photoPreview.value, photoHint.value)
    loading.close()

    if (result.success && result.foods.length > 0) {
      aiFoods.value = result.foods
      aiTextVisible.value = false
      aiResultVisible.value = true
      clearPhoto()
    } else {
      showToast(result.error || 'AI 未能识别，请手动添加')
      aiTextVisible.value = false
      if (aiFromAddPopup.value) {
        aiFromAddPopup.value = false
        addVisible.value = true
      } else {
        openAddPopup(aiMealType.value)
      }
      clearPhoto()
    }
  } catch {
    loading.close()
    showToast('AI 图片识别失败，请手动添加')
    aiTextVisible.value = false
    if (aiFromAddPopup.value) {
      aiFromAddPopup.value = false
      addVisible.value = true
    } else {
      openAddPopup(aiMealType.value)
    }
    clearPhoto()
  } finally {
    photoAnalyzing.value = false
  }
}

// ==================== AI 每日营养分析 ====================
const nutritionVisible = ref(false)
const nutritionAnalyzing = ref(false)
const nutritionResult = ref<DailyNutritionAnalysisResult | null>(null)

const statusColorMap: Record<NutritionStatus, { bg: string; text: string; label: string; icon: string }> = {
  green: { bg: 'rgba(52, 211, 153, 0.12)', text: '#34d399', label: '健康', icon: '✅' },
  yellow: { bg: 'rgba(251, 191, 36, 0.12)', text: '#fbbf24', label: '注意', icon: '⚠️' },
  red: { bg: 'rgba(251, 113, 133, 0.12)', text: '#fb7185', label: '警示', icon: '🔴' }
}

const getStatusStyle = (status: NutritionStatus) => statusColorMap[status]

const openNutritionAnalysis = async () => {
  if (!aiConfigured.value) {
    showToast('AI 服务未配置，请检查 .env 文件')
    return
  }

  const todayRecords = dietStore.todayRecords
  if (todayRecords.length === 0) {
    showToast('今日还没有饮食记录，先添加一条记录吧')
    return
  }

  nutritionVisible.value = true
  nutritionAnalyzing.value = true
  nutritionResult.value = null

  showAITip()

  try {
    const result = await analyzeDailyNutrition(todayRecords)
    nutritionResult.value = result
  } catch {
    nutritionResult.value = {
      success: false,
      status: 'green',
      advice: '',
      details: [],
      error: 'AI 分析失败，请稍后重试'
    }
  } finally {
    nutritionAnalyzing.value = false
  }
}

// ==================== 功能教程 ====================
const { needsTutorial, markTutorialDone } = useFeatureTutorial()
const showTutorial = ref(false)

const tutorialSteps: TutorialStep[] = [
  {
    selector: '',
    position: 'center',
    icon: 'utensils',
    title: '欢迎来到健康记录',
    description: '这里是你管理每一餐饮食的地方。记录食物、查看营养、AI 智能识别，让每一餐都值得被记录。'
  },
  {
    selector: '.calories-card',
    position: 'auto',
    icon: 'flame',
    title: '今日热量总览',
    description: '顶部卡片实时展示今日摄入热量和记录条数，一眼掌握饮食进度。'
  },
  {
    selector: '.quick-add-grid',
    position: 'auto',
    icon: 'plus-circle',
    title: '快速添加餐次',
    description: '点击早餐、午餐、晚餐或加餐按钮，快速打开添加窗口记录食物。'
  },
  {
    selector: '.ai-entry-card:first-child',
    position: 'auto',
    icon: 'sparkles',
    title: 'AI 智能识别',
    description: '描述或拍摄你吃了什么，AI 自动解析食材和营养成分，拍照识别更轻松。'
  },
  {
    selector: '.ai-entry-card:last-child',
    position: 'auto',
    icon: 'bar-chart',
    title: 'AI 营养分析',
    description: '基于今日饮食数据，红黄绿三色评估营养均衡度，给出改善建议。'
  },
  {
    selector: '.page-body',
    position: 'auto',
    icon: 'list',
    title: '记录列表',
    description: '所有记录按日期分组展示，左滑可删除。开始记录你的第一餐吧！'
  }
]

function handleTutorialComplete() {
  showTutorial.value = false
  markTutorialDone('record')
}

function handleTutorialSkip() {
  showTutorial.value = false
  markTutorialDone('record')
}

// ==================== 弹窗返回处理 ====================
// 用户点击 X 按钮关闭 AI 识别弹窗（非程序式关闭）时，若来自手动添加弹窗则返回之
watch(aiTextVisible, (newVal, oldVal) => {
  if (oldVal && !newVal && aiFromAddPopup.value && !aiResultVisible.value) {
    aiFromAddPopup.value = false
    addVisible.value = true
  }
})
// 用户关闭 AI 结果确认弹窗（未点确认入库）时，若来自手动添加弹窗则返回之
watch(aiResultVisible, (newVal, oldVal) => {
  if (oldVal && !newVal && aiFromAddPopup.value) {
    aiFromAddPopup.value = false
    addVisible.value = true
  }
})

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!dietStore.isLoaded) {
    await dietStore.loadFromStorage()
  }
  // 首次进入记录页时触发交互式教程
  if (await needsTutorial('record')) {
    await nextTick()
    showTutorial.value = true
  }
})
</script>

<template>
  <div class="page-container record-page">
    <!-- 顶部 Hero -->
    <section class="record-hero safe-area-top">
      <div class="hero-content">
        <h1 class="hero-title">健康记录</h1>
        <p class="hero-subtitle">每一餐都值得被记录</p>
        <GlassCard padding="md" class="calories-card">
          <span class="calories-icon">
            <AppleIcon name="flame" :size="24" :style="{ color: 'var(--chart-3)' }" />
          </span>
          <div class="calories-info">
            <div class="calories-label">今日热量</div>
            <div class="calories-value-row">
              <span class="calories-value">{{ todayCalories }}</span>
              <span class="calories-unit">kcal</span>
            </div>
            <div class="calories-count">{{ todayCount }} 条记录</div>
          </div>
        </GlassCard>
      </div>
    </section>

    <!-- 快速添加餐次 -->
    <div class="quick-add-grid">
      <div
        v-for="meal in mealTypeList"
        :key="meal"
        class="quick-add-btn"
        @click="openAddPopup(meal)"
      >
        <AppleIcon
          :name="meal === 'breakfast' ? 'coffee' : meal === 'lunch' ? 'sun' : meal === 'dinner' ? 'utensils' : 'apple'"
          :size="20"
          :style="{ color: 'var(--chart-3)' }"
        />
        <span class="quick-add-label">{{ getMealInfo(meal).label }}</span>
        <span class="quick-add-text">+ 添加</span>
      </div>
    </div>

    <!-- AI 智能入口 -->
    <div class="ai-entry-list">
      <GlassCard padding="none" class="ai-entry-card" hover @click="openAITextInput()">
        <span class="ai-entry-icon">
          <AppleIcon name="sparkles" :size="20" :style="{ color: 'var(--chart-3)' }" />
        </span>
        <span class="ai-entry-text">
          <span class="ai-entry-title">AI 智能识别</span>
          <span class="ai-entry-desc">描述或拍摄你吃了什么，AI 自动解析食材和营养</span>
        </span>
        <span class="ai-entry-chevron"><AppleIcon name="chevron-right" :size="18" /></span>
      </GlassCard>
      <GlassCard padding="none" class="ai-entry-card" hover @click="openNutritionAnalysis()">
        <span class="ai-entry-icon">
          <AppleIcon name="bar-chart" :size="20" :style="{ color: 'var(--chart-2)' }" />
        </span>
        <span class="ai-entry-text">
          <span class="ai-entry-title">AI 营养分析</span>
          <span class="ai-entry-desc">分析今日饮食营养均衡度，红黄绿三色健康状态</span>
        </span>
        <span class="ai-entry-chevron"><AppleIcon name="chevron-right" :size="18" /></span>
      </GlassCard>
    </div>

    <div class="page-body stagger-fade-up">
      <!-- 记录列表 -->
      <template v-if="groupedDates.length > 0">
        <SectionTitle title="今日记录" icon="utensils" color="var(--chart-3)" class="section-wrap" />
        <div v-for="group in groupedDates" :key="group.date" class="date-group">
          <div class="date-group-label">{{ group.label }} · {{ group.date }}</div>
          <div class="record-list">
            <van-swipe-cell v-for="record in group.records" :key="record.id">
              <GlassCard padding="none" class="record-card">
                <div class="record-header">
                  <span class="meal-icon">
                    <AppleIcon
                      :name="record.mealType === 'breakfast' ? 'coffee' : record.mealType === 'lunch' ? 'sun' : record.mealType === 'dinner' ? 'utensils' : 'apple'"
                      :size="16"
                      :style="{ color: 'var(--chart-3)' }"
                    />
                  </span>
                  <span class="record-meal">{{ getMealInfo(record.mealType).label }}</span>
                  <span class="record-time">{{ record.time }}</span>
                  <span class="source-tag">{{ sourceLabels[record.source] }}</span>
                </div>
                <div class="record-foods">{{ foodsSummary(record) }}</div>
                <div class="nutrition-line">
                  <span class="nutri-item">
                    <AppleIcon name="flame" :size="13" :style="{ color: 'var(--chart-1)' }" />
                    <span class="calories-val">{{ record.totalCalories }} kcal</span>
                  </span>
                  <span class="nutrition-sep">·</span>
                  <span class="nutri-item">蛋白质 <span class="protein-val">{{ formatNum(record.totalProtein) }}g</span></span>
                  <span class="nutrition-sep">·</span>
                  <span class="nutri-item">脂肪 <span class="fat-val">{{ formatNum(record.totalFat) }}g</span></span>
                  <span class="nutrition-sep">·</span>
                  <span class="nutri-item">碳水 <span class="carbs-val">{{ formatNum(record.totalCarbs) }}g</span></span>
                </div>
              </GlassCard>
              <template #right>
                <van-button square type="danger" text="删除" class="delete-btn" @click="handleDelete(record)" />
              </template>
            </van-swipe-cell>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <AppleIcon name="utensils" :size="32" :style="{ color: 'var(--chart-3)' }" />
        </div>
        <div class="empty-title">还没有记录</div>
        <div class="empty-desc">点击下方按钮，开始记录你的第一餐</div>
        <AuroraButton class="empty-btn" @click="openAddPopup()">
          <AppleIcon name="plus" :size="18" />添加第一条记录
        </AuroraButton>
      </div>
    </div>

    <!-- 浮动添加按钮 -->
    <button v-if="groupedDates.length > 0" class="fab" aria-label="添加记录" @click="openAddPopup()">
      <AppleIcon name="plus" :size="26" :stroke-width="2" />
    </button>

    <!-- 添加记录弹窗 -->
    <van-popup v-model:show="addVisible" position="bottom" round closeable :style="{ height: '85dvh' }">
      <div class="popup-container">
        <div class="popup-title">添加饮食记录</div>

        <!-- 餐次选择 -->
        <div class="add-section">
          <div class="add-section-title">餐次</div>
          <div class="meal-row">
            <div
              v-for="meal in mealTypeList"
              :key="meal"
              class="meal-item"
              :class="{ active: activeMealType === meal }"
              @click="activeMealType = meal"
            >
              <AppleIcon
                :name="meal === 'breakfast' ? 'coffee' : meal === 'lunch' ? 'sun' : meal === 'dinner' ? 'utensils' : 'apple'"
                :size="20"
              />
              <span class="meal-label">{{ getMealInfo(meal).label }}</span>
            </div>
          </div>
        </div>

        <!-- AI 智能识别入口（在手动添加中调用，识别结果合并到已选食物） -->
        <div class="add-section">
          <div class="ai-inline-entry" @click="openAIFromAdd">
            <span class="ai-inline-icon">
              <AppleIcon name="sparkles" :size="18" :style="{ color: 'var(--chart-3)' }" />
            </span>
            <span class="ai-inline-text">
              <span class="ai-inline-title">AI 智能识别</span>
              <span class="ai-inline-desc">描述或拍摄食物，AI 自动解析食材与营养</span>
            </span>
            <span class="ai-inline-chevron"><AppleIcon name="chevron-right" :size="16" /></span>
          </div>
        </div>

        <!-- 已选食物 -->
        <div v-if="selectedFoods.length > 0" class="add-section">
          <div class="add-section-title">
            已选食物
            <span class="section-hint">共 {{ totalPreview.calories }} kcal</span>
          </div>
          <div class="selected-list">
            <div v-for="(food, idx) in selectedFoods" :key="idx" class="selected-item">
              <div class="selected-info">
                <div class="selected-name">{{ food.name }}</div>
                <div class="selected-meta">
                  {{ food.amount }}g · {{ food.calories }} kcal · P{{ food.protein }} F{{ food.fat }} C{{ food.carbs }}
                </div>
              </div>
              <button class="icon-btn" aria-label="移除" @click="removeSelectedFood(idx)">
                <AppleIcon name="x" :size="18" />
              </button>
            </div>
          </div>
        </div>

        <!-- 食物搜索 -->
        <div class="add-section add-section-flex">
          <div class="add-section-title">
            选择食物
            <span class="custom-link" @click="openCustomFood">+ 自定义食物</span>
          </div>
          <van-search
            v-model="searchKeyword"
            placeholder="搜索食物名称"
            shape="round"
            :show-action="false"
          />
          <!-- 分类筛选 -->
          <div class="category-row">
            <div
              v-for="cat in categoryList"
              :key="cat.key"
              class="category-item"
              :class="{ active: activeCategory === cat.key }"
              @click="activeCategory = cat.key"
            >
              {{ cat.label }}
            </div>
          </div>
          <!-- 食物列表 -->
          <div class="food-list">
            <div
              v-for="food in filteredFoods"
              :key="food.name"
              class="food-item"
              @click="addPresetFood(food)"
            >
              <div class="food-info">
                <div class="food-name">{{ food.name }}</div>
                <div class="food-meta">
                  {{ food.defaultAmount }}g · {{ Math.round(food.caloriesPer100g * food.defaultAmount / 100) }} kcal
                </div>
              </div>
              <div class="food-add-btn">
                <AppleIcon name="plus" :size="16" :style="{ color: 'var(--chart-1)' }" />
              </div>
            </div>
            <div v-if="filteredFoods.length === 0" class="food-empty">
              没有找到相关食物
            </div>
          </div>
        </div>

        <!-- 保存按钮 -->
        <div class="popup-footer">
          <div class="footer-summary">
            <span class="footer-label">合计</span>
            <span class="footer-calories">{{ totalPreview.calories }} kcal</span>
            <span class="footer-macro">
              P{{ totalPreview.protein }} F{{ totalPreview.fat }} C{{ totalPreview.carbs }}
            </span>
          </div>
          <AuroraButton block :disabled="selectedFoods.length === 0" @click="handleSaveRecord">保存记录</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- 自定义食物弹窗 -->
    <van-popup v-model:show="customVisible" position="bottom" round closeable :style="{ height: '55dvh' }">
      <div class="popup-container">
        <div class="popup-title">自定义食物</div>
        <p class="popup-tip">
          手动输入食物信息（蛋白质/脂肪/碳水暂不计入，留待 P3 AI 分析补全）
        </p>
        <van-cell-group inset>
          <van-field v-model="customForm.name" label="食物名称" placeholder="例如：自制炒饭" />
          <van-field v-model.number="customForm.amount" type="digit" label="分量(克)" placeholder="克数" />
          <van-field v-model.number="customForm.calories" type="digit" label="热量(kcal)" placeholder="热量" />
        </van-cell-group>
        <div class="popup-footer">
          <AuroraButton block @click="confirmCustomFood">添加</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- AI 智能识别弹窗 -->
    <van-popup v-model:show="aiTextVisible" position="bottom" round closeable :style="{ height: '70dvh' }">
      <div class="popup-container">
        <div class="popup-title">AI 智能识别</div>

        <!-- 模式切换 -->
        <div class="ai-mode-tabs">
          <div class="ai-mode-tab" :class="{ active: aiMode === 'text' }" @click="aiMode = 'text'">
            <AppleIcon name="pen-line" :size="16" />文字描述
          </div>
          <div class="ai-mode-tab" :class="{ active: aiMode === 'photo' }" @click="aiMode = 'photo'">
            <AppleIcon name="camera" :size="16" />拍照识别
          </div>
        </div>

        <!-- 餐次选择 -->
        <div class="ai-meal-select">
          <div
            v-for="meal in mealTypeList"
            :key="meal"
            class="meal-item"
            :class="{ active: aiMealType === meal }"
            @click="aiMealType = meal"
          >
            <AppleIcon
              :name="meal === 'breakfast' ? 'coffee' : meal === 'lunch' ? 'sun' : meal === 'dinner' ? 'utensils' : 'apple'"
              :size="20"
            />
            <span class="meal-label">{{ getMealInfo(meal).label }}</span>
          </div>
        </div>

        <!-- 文字模式 -->
        <template v-if="aiMode === 'text'">
          <p class="popup-tip">
            描述你吃了什么，AI 会自动拆解食材并估算重量
          </p>
          <div class="ai-examples">
            <span @click="aiTextInput = '中午吃了一碗西红柿牛肉面，面稍微有点少'">一碗西红柿牛肉面</span>
            <span @click="aiTextInput = '早餐吃了两个鸡蛋一杯牛奶一片全麦面包'">鸡蛋牛奶面包</span>
            <span @click="aiTextInput = '下午茶喝了一杯拿铁配一小块黑巧克力'">拿铁配黑巧</span>
          </div>
          <van-field
            v-model="aiTextInput"
            type="textarea"
            placeholder="例如：中午吃了一碗西红柿牛肉面，还加了一个煎蛋"
            :autosize="{ minHeight: 80, maxHeight: 120 }"
            class="ai-text-input"
          />
          <div class="popup-footer">
            <AuroraButton block :loading="aiAnalyzing" @click="handleAIAnalysis">
              {{ aiAnalyzing ? 'AI 分析中…' : '开始 AI 分析' }}
            </AuroraButton>
          </div>
        </template>

        <!-- 拍照模式 -->
        <template v-else>
          <p class="popup-tip">
            拍摄食物照片，AI 自动识别食材并估算重量
          </p>
          <div v-if="!photoPreview" class="photo-upload-area">
            <AppleIcon name="camera" :size="36" :style="{ color: 'var(--chart-3)' }" />
            <div class="photo-upload-text">拍照或从相册选择</div>
            <div class="photo-upload-hint">支持 JPG / PNG，过大自动压缩至 5MB 以内</div>
            <div class="photo-source-row">
              <AuroraButton type="secondary" size="sm" class="photo-source-btn" @click="triggerCamera">
                <AppleIcon name="camera" :size="16" />拍照
              </AuroraButton>
              <AuroraButton type="secondary" size="sm" class="photo-source-btn" @click="triggerAlbum">
                从相册选择
              </AuroraButton>
            </div>
          </div>
          <div v-else class="photo-preview-wrap">
            <img :src="photoPreview" class="photo-preview-img" alt="食物照片" />
            <AuroraButton type="secondary" size="sm" class="photo-retake-btn" @click="clearPhoto">
              重新选择
            </AuroraButton>
          </div>
          <van-field
            v-model="photoHint"
            type="textarea"
            placeholder="补充说明（可选）：例如面少一点、多加了蛋"
            :autosize="{ minHeight: 50, maxHeight: 80 }"
            class="ai-text-input"
          />
          <div class="popup-footer">
            <AuroraButton block :loading="photoAnalyzing" :disabled="!photoPreview" @click="handlePhotoAnalysis">
              {{ photoAnalyzing ? 'AI 识别中…' : '开始拍照识别' }}
            </AuroraButton>
          </div>
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            style="display: none"
            @change="handlePhotoSelect"
          />
          <input
            ref="albumInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handlePhotoSelect"
          />
        </template>
      </div>
    </van-popup>

    <!-- AI 结果确认弹窗 -->
    <van-popup v-model:show="aiResultVisible" position="bottom" round closeable :style="{ height: '82dvh' }">
      <div class="popup-container">
        <div class="popup-title">AI 识别结果</div>
        <p class="popup-tip">
          请确认或微调食物重量后入库
        </p>
        <div class="ai-meal-select">
          <div
            v-for="meal in mealTypeList"
            :key="meal"
            class="meal-item"
            :class="{ active: aiMealType === meal }"
            @click="aiMealType = meal"
          >
            <AppleIcon
              :name="meal === 'breakfast' ? 'coffee' : meal === 'lunch' ? 'sun' : meal === 'dinner' ? 'utensils' : 'apple'"
              :size="20"
            />
            <span class="meal-label">{{ getMealInfo(meal).label }}</span>
          </div>
        </div>
        <div class="ai-foods-list">
          <div v-for="(food, idx) in aiFoods" :key="idx" class="ai-food-item">
            <div class="ai-food-header">
              <div class="selected-info">
                <div class="selected-name">{{ food.name }}</div>
                <div class="selected-meta">
                  {{ food.amount }}g · {{ food.calories }} kcal · P{{ food.protein }} F{{ food.fat }} C{{ food.carbs }}
                </div>
              </div>
              <button class="icon-btn" aria-label="移除" @click="removeAIFood(idx)">
                <AppleIcon name="x" :size="18" />
              </button>
            </div>
            <div class="ai-slider-row">
              <span class="slider-label">重量</span>
              <van-slider
                :model-value="food.amount"
                :min="10"
                :max="500"
                :step="10"
                bar-height="4px"
                class="ai-slider"
                @update:model-value="(v: number) => updateAIFoodAmount(idx, v)"
              />
              <span class="slider-value">{{ food.amount }}g</span>
            </div>
          </div>
        </div>
        <div class="popup-footer">
          <div class="footer-summary">
            <span class="footer-label">合计</span>
            <span class="footer-calories">{{ aiTotalPreview.calories }} kcal</span>
            <span class="footer-macro">
              P{{ aiTotalPreview.protein }} F{{ aiTotalPreview.fat }} C{{ aiTotalPreview.carbs }}
            </span>
          </div>
          <AuroraButton block @click="confirmAIFoods">确认入库</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- AI 营养分析弹窗 -->
    <van-popup v-model:show="nutritionVisible" position="bottom" round closeable :style="{ height: '75dvh' }">
      <div class="popup-container nutrition-popup">
        <div class="popup-title">AI 营养分析</div>

        <!-- 加载中 -->
        <div v-if="nutritionAnalyzing" class="nutrition-loading">
          <van-loading size="36px" color="var(--chart-3)">AI 正在分析今日营养...</van-loading>
          <p class="loading-tip">
            大模型推理约需 30-60 秒，请耐心等待
          </p>
        </div>

        <!-- 分析结果 -->
        <template v-else-if="nutritionResult && nutritionResult.success">
          <div class="nutrition-status-card" :class="`status-${nutritionResult.status}`">
            <span class="nutrition-status-icon">
              <AppleIcon
                :name="nutritionResult.status === 'green' ? 'circle-check' : nutritionResult.status === 'yellow' ? 'triangle-alert' : 'circle-alert'"
                :size="28"
              />
            </span>
            <div class="nutrition-status-body">
              <div class="nutrition-status-label">
                今日营养状态：{{ getStatusStyle(nutritionResult.status).label }}
              </div>
              <div class="nutrition-status-advice">
                {{ nutritionResult.advice }}
              </div>
            </div>
          </div>

          <!-- 各营养素详情 -->
          <div class="nutrition-details">
            <div
              v-for="(detail, idx) in nutritionResult.details"
              :key="idx"
              class="nutrition-detail-item"
              :class="`status-${detail.status}`"
            >
              <div class="nutrition-detail-label">{{ detail.label }}</div>
              <div class="nutrition-detail-value">{{ detail.value }}</div>
              <div class="nutrition-detail-tag" :class="`tag-${detail.status}`">
                {{ getStatusStyle(detail.status).label }}
              </div>
            </div>
          </div>

          <!-- 今日记录概览 -->
          <div class="nutrition-records-section">
            <div class="nutrition-records-title">今日饮食记录（{{ todayCount }} 条）</div>
            <div
              v-for="record in dietStore.todayRecords"
              :key="record.id"
              class="nutrition-record-item"
            >
              <span class="nutrition-record-meal">{{ getMealInfo(record.mealType).label }}</span>
              <span class="nutrition-record-foods">{{ foodsSummary(record) }}</span>
              <span class="nutrition-record-calories">{{ record.totalCalories }} kcal</span>
            </div>
          </div>
        </template>

        <!-- 错误状态 -->
        <div v-else class="nutrition-loading">
          <AppleIcon name="circle-alert" :size="40" :style="{ color: 'var(--muted-foreground)' }" />
          <p class="loading-tip error-tip">{{ nutritionResult?.error || '分析失败，请稍后重试' }}</p>
        </div>
      </div>
    </van-popup>

    <!-- 功能教程 -->
    <FeatureTutorial
      :steps="tutorialSteps"
      :visible="showTutorial"
      @complete="handleTutorialComplete"
      @skip="handleTutorialSkip"
    />
  </div>
</template>

<style scoped>
.record-page {
  max-width: 480px;
  margin: 0 auto;
  background: var(--background);
}

/* ===== Hero ===== */
.record-hero {
  position: relative;
  padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px 16px;
  background: var(--background);
  overflow: hidden;
}
.record-hero::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -60px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: var(--chart-3);
  opacity: 0.06;
  pointer-events: none;
}
.hero-content {
  position: relative;
  z-index: 1;
}
.hero-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
  font-family: var(--font-sans);
}
.hero-subtitle {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.calories-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
}
.calories-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.calories-info {
  flex: 1;
  min-width: 0;
}
.calories-label {
  font-size: 12px;
  color: var(--muted-foreground);
}
.calories-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
}
.calories-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1;
}
.calories-unit {
  font-size: 13px;
  color: var(--muted-foreground);
}
.calories-count {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}

/* ===== 快速添加 ===== */
.quick-add-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 16px;
  margin-bottom: 20px;
}
.quick-add-btn {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 4px;
  background: var(--accent);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.1s ease;
}
.quick-add-btn:active {
  transform: scale(0.96);
}
.quick-add-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
}
.quick-add-text {
  font-size: 10px;
  color: var(--chart-3);
  font-weight: 600;
}

/* ===== AI 入口 ===== */
.ai-entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px;
  margin-bottom: 8px;
}
.ai-entry-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  min-height: 64px;
  cursor: pointer;
}
.ai-entry-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ai-entry-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ai-entry-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
.ai-entry-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.ai-entry-chevron {
  color: var(--muted-foreground);
  display: inline-flex;
}

/* ===== 区块标题 ===== */
.section-wrap {
  margin: 0 16px 8px;
}

/* ===== 记录列表 ===== */
.date-group {
  margin-bottom: 16px;
}
.date-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin: 0 16px 8px;
  padding: 4px 0;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px;
}
.record-card {
  padding: 14px;
}
.record-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.meal-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.record-meal {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  flex: 1;
}
.record-time {
  font-size: 12px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}
.source-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--muted);
  font-size: 10px;
  color: var(--muted-foreground);
}
.record-foods {
  font-size: 14px;
  color: var(--foreground);
  margin-bottom: 8px;
  line-height: 1.4;
}
.nutrition-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.nutri-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.calories-val {
  color: var(--chart-1);
  font-weight: 600;
}
.protein-val {
  color: var(--chart-2);
}
.fat-val {
  color: var(--chart-3);
}
.carbs-val {
  color: var(--chart-4);
}
.nutrition-sep {
  color: var(--border);
}
.delete-btn {
  height: 100%;
  background: var(--destructive);
  color: var(--destructive-foreground);
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 6px;
}
.empty-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 20px;
}
.empty-btn {
  background: var(--chart-3);
  color: var(--primary-foreground);
}

/* ===== FAB ===== */
.fab {
  position: fixed;
  bottom: calc(84px + env(safe-area-inset-bottom));
  right: max(16px, calc((100vw - 480px) / 2 + 16px));
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: var(--chart-3);
  border: none;
  box-shadow: var(--shadow-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-foreground);
  cursor: pointer;
  z-index: 40;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s ease;
}
.fab:active {
  transform: scale(0.92);
}

/* ===== 弹窗通用 ===== */
.popup-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 0 0;
  background: var(--popover);
  color: var(--popover-foreground);
}
.popup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  text-align: center;
  padding: 0 0 12px;
}
.popup-tip {
  font-size: 12px;
  color: var(--muted-foreground);
  padding: 0 16px;
  margin-bottom: 12px;
}
.add-section {
  padding: 0 16px 12px;
}
.add-section-flex {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.add-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}
.section-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted-foreground);
}
.custom-link {
  margin-left: auto;
  color: var(--chart-3);
  font-size: 12px;
  font-weight: 600;
}

/* AI 内联识别入口（手动添加弹窗内） */
.ai-inline-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--tint-chart-3-10);
  border: 1px solid color-mix(in srgb, var(--chart-3) 20%, transparent);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.1s ease;
}
.ai-inline-entry:active {
  transform: scale(0.99);
}
.ai-inline-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--popover);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ai-inline-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ai-inline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
.ai-inline-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.ai-inline-chevron {
  color: var(--chart-3);
  display: inline-flex;
}

/* 餐次选择 */
.meal-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.ai-meal-select {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 16px 12px;
}
.meal-item {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  background: var(--accent);
  border-radius: var(--radius-md);
  border: 1.5px solid transparent;
  color: var(--muted-foreground);
  transition: all 0.2s;
  cursor: pointer;
}
.meal-item.active {
  background: var(--tint-chart-3-10);
  border-color: var(--chart-3);
  color: var(--chart-3);
}
.meal-label {
  font-size: 11px;
  font-weight: 500;
}

/* 已选食物 */
.selected-list {
  background: var(--accent);
  border-radius: var(--radius-md);
  padding: 4px 12px;
}
.selected-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.selected-item:last-child {
  border-bottom: none;
}
.selected-info {
  flex: 1;
  min-width: 0;
}
.selected-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}
.selected-meta {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.icon-btn {
  min-width: 48px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
  flex-shrink: 0;
}

/* 分类筛选 */
.category-row {
  display: flex;
  gap: 6px;
  padding: 0 4px 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.category-row::-webkit-scrollbar {
  display: none;
}
.category-item {
  flex-shrink: 0;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--accent);
  border-radius: 9999px;
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: nowrap;
  transition: all 0.2s;
  cursor: pointer;
}
.category-item.active {
  background: var(--tint-chart-3-10);
  color: var(--chart-3);
  font-weight: 600;
}

/* 食物列表 */
.food-list {
  flex: 1;
  max-height: 240px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.food-item {
  display: flex;
  align-items: center;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  min-height: 48px;
}
.food-item:active {
  background: var(--accent);
}
.food-info {
  flex: 1;
  min-width: 0;
}
.food-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}
.food-meta {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.food-add-btn {
  width: 32px;
  height: 32px;
  background: var(--tint-chart-1-10);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.food-empty {
  text-align: center;
  color: var(--muted-foreground);
  font-size: 13px;
  padding: 32px 0;
}

/* 弹窗底部 */
.popup-footer {
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: var(--popover);
  margin-top: auto;
}
.footer-summary {
  display: flex;
  align-items: baseline;
  margin-bottom: 10px;
}
.footer-label {
  font-size: 12px;
  color: var(--muted-foreground);
}
.footer-calories {
  font-size: 18px;
  font-weight: 700;
  color: var(--chart-3);
  margin-left: 6px;
}
.footer-macro {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-left: 8px;
}

/* ===== AI 识别 ===== */
.ai-mode-tabs {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}
.ai-mode-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 0;
  background: var(--accent);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
  transition: all 0.2s;
  cursor: pointer;
}
.ai-mode-tab.active {
  background: var(--tint-chart-3-10);
  color: var(--chart-3);
  font-weight: 600;
}
.ai-examples {
  display: flex;
  gap: 6px;
  padding: 0 16px 12px;
  flex-wrap: wrap;
}
.ai-examples span {
  padding: 6px 12px;
  background: var(--accent);
  border-radius: 9999px;
  font-size: 12px;
  color: var(--muted-foreground);
  transition: all 0.2s;
  cursor: pointer;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}
.ai-examples span:active {
  background: var(--muted);
}
.ai-text-input {
  margin: 0 16px;
}
.ai-foods-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
  -webkit-overflow-scrolling: touch;
}
.ai-food-item {
  padding: 12px;
  background: var(--accent);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
}
.ai-food-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.ai-slider-row {
  display: flex;
  align-items: center;
  padding: 0 4px;
  gap: 12px;
}
.slider-label {
  font-size: 12px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}
.ai-slider {
  flex: 1;
}
.slider-value {
  font-size: 12px;
  color: var(--foreground);
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

/* ===== 拍照识别 ===== */
.photo-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 16px 12px;
  padding: 32px 16px;
  background: var(--accent);
  border: 2px dashed var(--border);
  border-radius: var(--radius-md);
  transition: all 0.2s;
}
.photo-upload-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
  margin-top: 10px;
}
.photo-upload-hint {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.photo-source-row {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.photo-source-btn {
  min-height: 48px;
}
.photo-preview-wrap {
  position: relative;
  margin: 0 16px 12px;
  border-radius: var(--radius-md);
  overflow: hidden;
}
.photo-preview-img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
  display: block;
}
.photo-retake-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  min-height: 40px;
}

/* ===== AI 营养分析 ===== */
.nutrition-popup {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.nutrition-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}
.loading-tip {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 16px;
  padding: 0 32px;
  text-align: center;
}
.error-tip {
  font-size: 14px;
  margin-top: 12px;
}

/* 状态卡片（绿/黄/红，用 var() 令牌） */
.status-green {
  background: var(--tint-chart-1-10);
  color: var(--chart-1);
}
.status-yellow {
  background: var(--tint-chart-3-10);
  color: var(--chart-3);
}
.status-red {
  background: color-mix(in srgb, var(--destructive) 10%, transparent);
  color: var(--destructive);
}
.nutrition-status-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0 16px 16px;
  padding: 16px;
  border-radius: var(--radius-lg);
}
.nutrition-status-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}
.nutrition-status-body {
  flex: 1;
  min-width: 0;
}
.nutrition-status-label {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}
.nutrition-status-advice {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.9;
}

.nutrition-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 0 16px 16px;
}
.nutrition-detail-item {
  padding: 14px 12px;
  border-radius: var(--radius-md);
  text-align: center;
}
.nutrition-detail-label {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 6px;
}
.nutrition-detail-value {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}
.nutrition-detail-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 11px;
  color: var(--primary-foreground);
  font-weight: 500;
}
.tag-green {
  background: var(--chart-1);
}
.tag-yellow {
  background: var(--chart-3);
}
.tag-red {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.nutrition-records-section {
  padding: 0 16px calc(20px + env(safe-area-inset-bottom));
}
.nutrition-records-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.nutrition-record-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.nutrition-record-meal {
  font-size: 12px;
  font-weight: 600;
  color: var(--chart-3);
  background: var(--tint-chart-3-10);
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}
.nutrition-record-foods {
  flex: 1;
  font-size: 12px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nutrition-record-calories {
  font-size: 12px;
  font-weight: 600;
  color: var(--chart-3);
  flex-shrink: 0;
}

/* ===== 小屏适配 ===== */
@media (max-width: 360px) {
  .record-hero {
    padding-left: 12px;
    padding-right: 12px;
  }
  .quick-add-grid,
  .ai-entry-list,
  .record-list {
    padding-left: 12px;
    padding-right: 12px;
  }
  .section-wrap,
  .date-group-label {
    margin-left: 12px;
    margin-right: 12px;
  }
  .quick-add-grid {
    gap: 6px;
  }
  .quick-add-label {
    font-size: 11px;
  }
  .quick-add-text {
    font-size: 9px;
  }
  .fab {
    right: 12px;
  }
}
</style>
