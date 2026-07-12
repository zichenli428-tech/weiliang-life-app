<script setup lang="ts">
/**
 * 健康记录（Tab 3）
 * PRD 3.4：饮食/运动记录列表、手动/拍照录入 | 图像识别估算、JSON 结构化解析
 * PRD 3.1：营养膳食分析核心亮点
 * 重设计：极光琉璃暗色风格，营养模块暖橙红渐变
 */
import { ref, computed, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { showAITip, showAILoading } from '@/utils/aiToast'
import { useDietStore } from '@/store/modules/diet'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AuroraButton from '@/components/AuroraButton.vue'
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
  aiMealType.value = mealType || guessMealTypeByTime()
  aiTextInput.value = ''
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
      openAddPopup(aiMealType.value)
    }
  } catch {
    loading.close()
    showToast('AI 分析失败，请手动添加')
    aiTextVisible.value = false
    openAddPopup(aiMealType.value)
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
const photoInput = ref<HTMLInputElement | null>(null)

const handlePhotoSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过 5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    photoPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  target.value = ''
}

const clearPhoto = () => {
  photoPreview.value = ''
  photoHint.value = ''
}

const triggerPhotoInput = () => {
  photoInput.value?.click()
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
      openAddPopup(aiMealType.value)
      clearPhoto()
    }
  } catch {
    loading.close()
    showToast('AI 图片识别失败，请手动添加')
    aiTextVisible.value = false
    openAddPopup(aiMealType.value)
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

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!dietStore.isLoaded) {
    await dietStore.loadFromStorage()
  }
})
</script>

<template>
  <div class="page-container record-page">
    <!-- 顶部 Nutrition Hero -->
    <div class="record-hero safe-area-top">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">健康记录</h1>
          <p class="text-sm text-white/80 mt-1">每一餐都值得被记录</p>
        </div>
        <GlassCard padding="sm" radius="lg" class="today-card">
          <div class="text-[10px] text-content-secondary">今日热量</div>
          <div class="text-xl font-bold text-content-primary mt-0.5">
            {{ todayCalories }}<span class="text-xs ml-1 text-content-secondary">kcal</span>
          </div>
          <div class="text-[10px] text-content-tertiary mt-0.5">{{ todayCount }} 条记录</div>
        </GlassCard>
      </div>

      <!-- 快速添加按钮 -->
      <div class="quick-add-row">
        <div
          v-for="meal in mealTypeList"
          :key="meal"
          class="quick-add-item"
          @click="openAddPopup(meal)"
        >
          <div class="text-2xl">{{ getMealInfo(meal).icon }}</div>
          <div class="text-[10px] text-white/90 mt-1">{{ getMealInfo(meal).label }}</div>
          <div class="quick-add-btn">+ 添加</div>
        </div>
      </div>

      <!-- AI 智能识别入口 -->
      <div class="ai-entry gradient-border" @click="openAITextInput()">
        <div class="ai-entry-icon">🤖</div>
        <div class="flex-1 min-w-0">
          <div class="ai-entry-title">AI 智能识别</div>
          <div class="ai-entry-desc">描述或拍摄你吃了什么，AI 自动解析食材和营养</div>
        </div>
        <van-icon name="arrow" color="#f8fafc" />
      </div>

      <!-- AI 营养分析入口 -->
      <div class="ai-entry gradient-border" @click="openNutritionAnalysis()">
        <div class="ai-entry-icon">📊</div>
        <div class="flex-1 min-w-0">
          <div class="ai-entry-title">AI 营养分析</div>
          <div class="ai-entry-desc">分析今日饮食营养均衡度，红黄绿三色健康状态</div>
        </div>
        <van-icon name="arrow" color="#f8fafc" />
      </div>
    </div>

    <div class="page-body stagger-fade-up">
      <!-- 记录列表 -->
      <template v-if="groupedDates.length > 0">
        <div v-for="group in groupedDates" :key="group.date" class="mb-4">
          <SectionTitle :title="`${group.label} · ${group.date}`" icon="📅" class="px-4" />
          <div class="px-4 space-y-3">
            <van-swipe-cell v-for="record in group.records" :key="record.id">
              <GlassCard padding="sm" class="record-card">
                <div class="record-icon">{{ getMealInfo(record.mealType).icon }}</div>
                <div class="record-main">
                  <div class="flex items-center gap-2">
                    <span class="record-meal">{{ getMealInfo(record.mealType).label }}</span>
                    <span class="record-time">{{ record.time }}</span>
                    <span class="record-source">{{ sourceLabels[record.source] }}</span>
                  </div>
                  <div class="record-foods">{{ foodsSummary(record) }}</div>
                  <div class="record-nutrition">
                    <span class="text-aurora-green">🔥 {{ record.totalCalories }} kcal</span>
                    <span class="text-content-tertiary">·</span>
                    <span>蛋白质 {{ formatNum(record.totalProtein) }}g</span>
                    <span class="text-content-tertiary">·</span>
                    <span>脂肪 {{ formatNum(record.totalFat) }}g</span>
                    <span class="text-content-tertiary">·</span>
                    <span>碳水 {{ formatNum(record.totalCarbs) }}g</span>
                  </div>
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
        <div class="empty-icon">🍽️</div>
        <div class="empty-title">还没有记录</div>
        <div class="empty-desc">点击下方按钮，开始记录你的第一餐</div>
        <AuroraButton class="mt-4" @click="openAddPopup()">添加第一条记录</AuroraButton>
      </div>
    </div>

    <!-- 浮动添加按钮 -->
    <div v-if="groupedDates.length > 0" class="fab animate-pulse-glow" @click="openAddPopup()">
      <van-icon name="plus" size="24" color="#0b1220" />
    </div>

    <!-- 添加记录弹窗 -->
    <van-popup v-model:show="addVisible" position="bottom" round closeable :style="{ height: '85%' }">
      <div class="dark-popup">
        <div class="add-title">添加饮食记录</div>

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
              <div class="text-xl">{{ getMealInfo(meal).icon }}</div>
              <div class="text-[10px] mt-1">{{ getMealInfo(meal).label }}</div>
            </div>
          </div>
        </div>

        <!-- 已选食物 -->
        <div v-if="selectedFoods.length > 0" class="add-section">
          <div class="add-section-title">
            已选食物
            <span class="text-content-tertiary text-xs ml-2">共 {{ totalPreview.calories }} kcal</span>
          </div>
          <div class="selected-list">
            <div v-for="(food, idx) in selectedFoods" :key="idx" class="selected-item">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-content-primary">{{ food.name }}</div>
                <div class="text-xs text-content-secondary mt-1">
                  {{ food.amount }}g · {{ food.calories }} kcal · P{{ food.protein }} F{{ food.fat }} C{{ food.carbs }}
                </div>
              </div>
              <van-icon name="cross" class="text-content-tertiary" @click="removeSelectedFood(idx)" />
            </div>
          </div>
        </div>

        <!-- 食物搜索 -->
        <div class="add-section flex-1">
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
              <span class="mr-1">{{ cat.icon }}</span>
              <span>{{ cat.label }}</span>
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
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-content-primary">{{ food.name }}</div>
                <div class="text-xs text-content-secondary mt-1">
                  {{ food.defaultAmount }}g · {{ Math.round(food.caloriesPer100g * food.defaultAmount / 100) }} kcal
                </div>
              </div>
              <div class="food-add-btn">+</div>
            </div>
            <div v-if="filteredFoods.length === 0" class="text-center text-content-tertiary text-sm py-8">
              没有找到相关食物
            </div>
          </div>
        </div>

        <!-- 保存按钮 -->
        <div class="add-footer">
          <div class="footer-summary">
            <span class="text-xs text-content-secondary">合计</span>
            <span class="text-lg font-bold text-aurora-green ml-1">{{ totalPreview.calories }} kcal</span>
            <span class="text-xs text-content-tertiary ml-2">
              P{{ totalPreview.protein }} F{{ totalPreview.fat }} C{{ totalPreview.carbs }}
            </span>
          </div>
          <AuroraButton block :disabled="selectedFoods.length === 0" @click="handleSaveRecord">保存记录</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- 自定义食物弹窗 -->
    <van-popup v-model:show="customVisible" position="bottom" round closeable :style="{ height: '50%' }">
      <div class="dark-popup">
        <div class="add-title">自定义食物</div>
        <p class="text-xs text-content-secondary px-4 mb-3">
          手动输入食物信息（蛋白质/脂肪/碳水暂不计入，留待 P3 AI 分析补全）
        </p>
        <van-cell-group inset>
          <van-field v-model="customForm.name" label="食物名称" placeholder="例如：自制炒饭" />
          <van-field v-model.number="customForm.amount" type="number" label="分量(克)" placeholder="克数" />
          <van-field v-model.number="customForm.calories" type="number" label="热量(kcal)" placeholder="热量" />
        </van-cell-group>
        <div class="edit-footer">
          <AuroraButton block @click="confirmCustomFood">添加</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- AI 智能识别弹窗 -->
    <van-popup v-model:show="aiTextVisible" position="bottom" round closeable :style="{ height: '65%' }">
      <div class="dark-popup">
        <div class="add-title">AI 智能识别</div>

        <!-- 模式切换 -->
        <div class="ai-mode-tabs">
          <div class="ai-mode-tab" :class="{ active: aiMode === 'text' }" @click="aiMode = 'text'">
            📝 文字描述
          </div>
          <div class="ai-mode-tab" :class="{ active: aiMode === 'photo' }" @click="aiMode = 'photo'">
            📷 拍照识别
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
            <div class="text-xl">{{ getMealInfo(meal).icon }}</div>
            <div class="text-[10px] mt-1">{{ getMealInfo(meal).label }}</div>
          </div>
        </div>

        <!-- 文字模式 -->
        <template v-if="aiMode === 'text'">
          <p class="text-xs text-content-secondary px-4 mb-2">
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
          <div class="edit-footer">
            <AuroraButton block :loading="aiAnalyzing" @click="handleAIAnalysis">
              {{ aiAnalyzing ? 'AI 分析中…' : '🤖 开始 AI 分析' }}
            </AuroraButton>
          </div>
        </template>

        <!-- 拍照模式 -->
        <template v-else>
          <p class="text-xs text-content-secondary px-4 mb-2">
            拍摄食物照片，AI 自动识别食材并估算重量
          </p>
          <div v-if="!photoPreview" class="photo-upload-area" @click="triggerPhotoInput">
            <div class="photo-upload-icon">📷</div>
            <div class="photo-upload-text">点击拍照或选择图片</div>
            <div class="photo-upload-hint">支持 JPG / PNG，最大 5MB</div>
          </div>
          <div v-else class="photo-preview-wrap">
            <img :src="photoPreview" class="photo-preview-img" alt="食物照片" />
            <van-button size="small" plain class="photo-retake-btn" @click="clearPhoto">重新选择</van-button>
          </div>
          <van-field
            v-model="photoHint"
            type="textarea"
            placeholder="补充说明（可选）：例如面少一点、多加了蛋"
            :autosize="{ minHeight: 50, maxHeight: 80 }"
            class="ai-text-input"
          />
          <div class="edit-footer">
            <AuroraButton block :loading="photoAnalyzing" :disabled="!photoPreview" @click="handlePhotoAnalysis">
              {{ photoAnalyzing ? 'AI 识别中…' : '📷 开始拍照识别' }}
            </AuroraButton>
          </div>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            style="display: none"
            @change="handlePhotoSelect"
          />
        </template>
      </div>
    </van-popup>

    <!-- AI 结果确认弹窗 -->
    <van-popup v-model:show="aiResultVisible" position="bottom" round closeable :style="{ height: '80%' }">
      <div class="dark-popup">
        <div class="add-title">AI 识别结果</div>
        <p class="text-xs text-content-secondary px-4 mb-3">
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
            <div class="text-xl">{{ getMealInfo(meal).icon }}</div>
            <div class="text-[10px] mt-1">{{ getMealInfo(meal).label }}</div>
          </div>
        </div>
        <div class="ai-foods-list">
          <div v-for="(food, idx) in aiFoods" :key="idx" class="ai-food-item">
            <div class="ai-food-header">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-content-primary">{{ food.name }}</div>
                <div class="text-xs text-content-secondary mt-1">
                  {{ food.amount }}g · {{ food.calories }} kcal · P{{ food.protein }} F{{ food.fat }} C{{ food.carbs }}
                </div>
              </div>
              <van-icon name="cross" class="text-content-tertiary" @click="removeAIFood(idx)" />
            </div>
            <div class="ai-slider-row">
              <span class="text-xs text-content-tertiary">重量</span>
              <van-slider
                :model-value="food.amount"
                :min="10"
                :max="500"
                :step="10"
                bar-height="4px"
                class="flex-1 mx-3"
                @update:model-value="(v: number) => updateAIFoodAmount(idx, v)"
              />
              <span class="text-xs text-content-primary w-12 text-right">{{ food.amount }}g</span>
            </div>
          </div>
        </div>
        <div class="ai-result-footer">
          <div class="footer-summary">
            <span class="text-xs text-content-secondary">合计</span>
            <span class="text-lg font-bold text-aurora-green ml-1">{{ aiTotalPreview.calories }} kcal</span>
            <span class="text-xs text-content-tertiary ml-2">
              P{{ aiTotalPreview.protein }} F{{ aiTotalPreview.fat }} C{{ aiTotalPreview.carbs }}
            </span>
          </div>
          <AuroraButton block @click="confirmAIFoods">确认入库</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- AI 营养分析弹窗 -->
    <van-popup v-model:show="nutritionVisible" position="bottom" round closeable :style="{ height: '70%' }">
      <div class="dark-popup nutrition-popup">
        <div class="add-title">AI 营养分析</div>

        <!-- 加载中 -->
        <div v-if="nutritionAnalyzing" class="nutrition-loading">
          <van-loading size="36px" color="#f59e0b">AI 正在分析今日营养...</van-loading>
          <p class="text-xs text-content-secondary mt-4 px-8 text-center">
            大模型推理约需 30-60 秒，请耐心等待
          </p>
        </div>

        <!-- 分析结果 -->
        <template v-else-if="nutritionResult && nutritionResult.success">
          <div
            class="nutrition-status-card"
            :style="{ background: getStatusStyle(nutritionResult.status).bg }"
          >
            <div class="nutrition-status-icon">
              {{ getStatusStyle(nutritionResult.status).icon }}
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="nutrition-status-label"
                :style="{ color: getStatusStyle(nutritionResult.status).text }"
              >
                今日营养状态：{{ getStatusStyle(nutritionResult.status).label }}
              </div>
              <div
                class="nutrition-status-advice"
                :style="{ color: getStatusStyle(nutritionResult.status).text }"
              >
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
              :style="{ background: getStatusStyle(detail.status).bg }"
            >
              <div class="nutrition-detail-label">{{ detail.label }}</div>
              <div
                class="nutrition-detail-value"
                :style="{ color: getStatusStyle(detail.status).text }"
              >
                {{ detail.value }}
              </div>
              <div
                class="nutrition-detail-tag"
                :style="{ background: getStatusStyle(detail.status).text }"
              >
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
          <div class="text-4xl mb-3">😢</div>
          <p class="text-sm text-content-secondary">{{ nutritionResult?.error || '分析失败，请稍后重试' }}</p>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.record-page {
  background-color: #0b1220;
}

.record-hero {
  position: relative;
  padding: 20px 16px 20px;
  background:
    radial-gradient(ellipse at top right, rgba(245, 158, 11, 0.2) 0%, transparent 50%),
    radial-gradient(ellipse at bottom left, rgba(244, 63, 94, 0.12) 0%, transparent 50%),
    linear-gradient(180deg, #1a1025 0%, #0b1220 100%);
  overflow: hidden;
}

.record-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(244, 63, 94, 0.06) 100%);
  pointer-events: none;
}

.today-card {
  min-width: 110px;
  text-align: right;
}

.quick-add-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.quick-add-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.quick-add-item:active {
  background: rgba(255, 255, 255, 0.14);
  transform: scale(0.96);
}

.quick-add-btn {
  margin-top: 4px;
  padding: 1px 8px;
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.ai-entry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 16px;
  cursor: pointer;
}

.ai-entry-icon {
  font-size: 24px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  flex-shrink: 0;
}

.ai-entry-title {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.ai-entry-desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.record-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 50%;
  flex-shrink: 0;
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-meal {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.record-time {
  font-size: 12px;
  color: #64748b;
}

.record-source {
  font-size: 10px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  padding: 1px 6px;
  border-radius: 6px;
}

.record-foods {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-nutrition {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.delete-btn {
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px 40px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}

.empty-desc {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 6px;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(84px + env(safe-area-inset-bottom));
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
  box-shadow: 0 0 20px rgba(52, 211, 153, 0.3);
  transition: transform 0.2s ease;
}

.fab:active {
  transform: scale(0.92);
}

/* ==================== 深色弹窗通用 ==================== */
.dark-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 0 0;
  background: #0b1220;
}

.add-title {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
  text-align: center;
  padding: 0 0 12px;
}

.add-section {
  padding: 0 16px 12px;
}

.add-section-title {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.custom-link {
  margin-left: auto;
  color: #fbbf24;
  font-size: 12px;
  font-weight: 500;
}

.meal-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.meal-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  border: 1.5px solid transparent;
  color: #94a3b8;
  transition: all 0.2s;
  cursor: pointer;
}

.meal-item.active {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.5);
  color: #fbbf24;
}

.selected-list {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 4px 12px;
}

.selected-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.selected-item:last-child {
  border-bottom: none;
}

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
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  transition: all 0.2s;
}

.category-item.active {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  font-weight: 500;
}

.food-list {
  max-height: 240px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.food-item {
  display: flex;
  align-items: center;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.food-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.food-add-btn {
  width: 26px;
  height: 26px;
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.add-footer {
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0b1220;
}

.footer-summary {
  display: flex;
  align-items: baseline;
  margin-bottom: 10px;
}

.custom-popup {
  padding: 16px 0 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0b1220;
}

.edit-footer {
  padding: 20px 16px 0;
  margin-top: auto;
}

/* ==================== AI 识别相关样式 ==================== */
.ai-meal-select {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 16px 12px;
}

.ai-examples {
  display: flex;
  gap: 6px;
  padding: 0 16px 12px;
  flex-wrap: wrap;
}

.ai-examples span {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  font-size: 12px;
  color: #94a3b8;
  transition: all 0.2s;
}

.ai-examples span:active {
  background: rgba(255, 255, 255, 0.1);
}

.ai-text-input {
  flex: 1;
  margin: 0 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 8px 12px;
}

.ai-foods-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
  -webkit-overflow-scrolling: touch;
}

.ai-food-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  margin-bottom: 10px;
}

.ai-food-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.ai-slider-row {
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.ai-result-footer {
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0b1220;
}

/* ==================== AI 模式切换 ==================== */
.ai-mode-tabs {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.ai-mode-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  transition: all 0.2s;
  cursor: pointer;
}

.ai-mode-tab.active {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}

/* ==================== 拍照识别 ==================== */
.photo-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 16px 12px;
  padding: 32px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 2px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  transition: all 0.2s;
  cursor: pointer;
}

.photo-upload-area:active {
  background: rgba(255, 255, 255, 0.08);
  border-color: #fbbf24;
}

.photo-upload-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.photo-upload-text {
  font-size: 14px;
  font-weight: 500;
  color: #f8fafc;
}

.photo-upload-hint {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}

.photo-preview-wrap {
  position: relative;
  margin: 0 16px 12px;
  border-radius: 12px;
  overflow: hidden;
}

.photo-preview-img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 12px;
}

.photo-retake-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 14px;
}

/* ==================== AI 营养分析 ==================== */
.nutrition-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 0 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #0b1220;
}

.nutrition-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.nutrition-status-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0 16px 16px;
  padding: 16px;
  border-radius: 16px;
}

.nutrition-status-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
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
  border-radius: 14px;
  text-align: center;
}

.nutrition-detail-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.nutrition-detail-value {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}

.nutrition-detail-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  color: #0b1220;
  font-weight: 500;
}

.nutrition-records-section {
  padding: 0 16px calc(20px + env(safe-area-inset-bottom));
}

.nutrition-records-title {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nutrition-record-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.nutrition-record-meal {
  font-size: 12px;
  font-weight: 500;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.nutrition-record-foods {
  flex: 1;
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nutrition-record-calories {
  font-size: 12px;
  font-weight: 500;
  color: #fbbf24;
  flex-shrink: 0;
}
</style>
