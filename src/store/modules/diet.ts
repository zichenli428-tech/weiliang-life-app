/**
 * 饮食记录 Store
 * PRD 3.1：营养膳食分析 - 记录入库与查询
 * PRD 4.3：数据仅存本地 IndexedDB（通过 localforage 持久化）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'
import {
  generateRecordId,
  getTodayDate,
  getNowTime,
  type DietRecord,
  type DietFood,
  type MealType,
  type RecordSource
} from '@/types/diet'

const DIET_RECORDS_KEY = 'records'

export const useDietStore = defineStore('diet', () => {
  // ==================== State ====================
  const records = ref<DietRecord[]>([])
  const isLoaded = ref(false)

  // ==================== Getters ====================
  /** 今日记录 */
  const todayRecords = computed(() =>
    records.value.filter((r) => r.date === getTodayDate())
  )

  /** 今日总热量 */
  const todayCalories = computed(() =>
    todayRecords.value.reduce((sum, r) => sum + r.totalCalories, 0)
  )

  /** 按日期分组（最近的在前） */
  const recordsByDate = computed(() => {
    const groups: Record<string, DietRecord[]> = {}
    const sorted = [...records.value].sort((a, b) => b.createdAt - a.createdAt)
    for (const r of sorted) {
      if (!groups[r.date]) groups[r.date] = []
      groups[r.date].push(r)
    }
    return groups
  })

  /** 指定日期记录 */
  function getRecordsByDate(date: string): DietRecord[] {
    return records.value.filter((r) => r.date === date)
  }

  // ==================== Actions ====================
  /** 从本地 IndexedDB 加载 */
  async function loadFromStorage(): Promise<void> {
    const stored = await getItem<DietRecord[]>('diet', DIET_RECORDS_KEY)
    if (stored && Array.isArray(stored)) {
      records.value = stored
    }
    isLoaded.value = true
  }

  /** 持久化到本地 IndexedDB */
  async function saveToStorage(): Promise<void> {
    await setItem<DietRecord[]>('diet', DIET_RECORDS_KEY, records.value)
  }

  /**
   * 添加一条饮食记录
   * @param input 食物清单 + 餐次 + 来源 + 备注
   */
  async function addRecord(input: {
    foods: DietFood[]
    mealType: MealType
    source: RecordSource
    note?: string
    date?: string
    time?: string
  }): Promise<DietRecord> {
    const totalCalories = input.foods.reduce((s, f) => s + f.calories, 0)
    const totalProtein = input.foods.reduce((s, f) => s + f.protein, 0)
    const totalFat = input.foods.reduce((s, f) => s + f.fat, 0)
    const totalCarbs = input.foods.reduce((s, f) => s + f.carbs, 0)

    const record: DietRecord = {
      id: generateRecordId(),
      date: input.date || getTodayDate(),
      time: input.time || getNowTime(),
      mealType: input.mealType,
      foods: input.foods,
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein * 10) / 10,
      totalFat: Math.round(totalFat * 10) / 10,
      totalCarbs: Math.round(totalCarbs * 10) / 10,
      source: input.source,
      note: input.note,
      createdAt: Date.now()
    }

    records.value.unshift(record)
    await saveToStorage()
    return record
  }

  /** 删除一条记录 */
  async function removeRecord(id: string): Promise<void> {
    records.value = records.value.filter((r) => r.id !== id)
    await saveToStorage()
  }

  /** 清空所有记录 */
  async function clearAll(): Promise<void> {
    records.value = []
    await saveToStorage()
  }

  return {
    // state
    records,
    isLoaded,
    // getters
    todayRecords,
    todayCalories,
    recordsByDate,
    // actions
    getRecordsByDate,
    loadFromStorage,
    addRecord,
    removeRecord,
    clearAll
  }
})
