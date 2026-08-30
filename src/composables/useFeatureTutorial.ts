/**
 * 功能级新手教程状态管理
 * 记录用户是否已完成某个功能的交互式教程，仅首次进入该功能时触发
 * 状态持久化到 IndexedDB（通过 localforage）
 */
import { ref } from 'vue'
import { getItem, setItem } from '@/utils/storage'

const STORE_NAME = 'user'
const KEY = 'featureTutorials'

/** 已完成教程的功能集合 */
const completedTutorials = ref<Set<string>>(new Set())
const isLoaded = ref(false)

async function loadCompleted(): Promise<void> {
  if (isLoaded.value) return
  try {
    const data = await getItem<string[]>(STORE_NAME, KEY)
    if (Array.isArray(data)) {
      completedTutorials.value = new Set(data)
    }
    isLoaded.value = true
  } catch {
    isLoaded.value = true
  }
}

/** 检查某个功能是否需要教程（未完成则返回 true） */
async function needsTutorial(feature: string): Promise<boolean> {
  await loadCompleted()
  return !completedTutorials.value.has(feature)
}

/** 标记某个功能的教程已完成 */
async function markTutorialDone(feature: string): Promise<void> {
  completedTutorials.value.add(feature)
  try {
    await setItem<string[]>(STORE_NAME, KEY, Array.from(completedTutorials.value))
  } catch {
    // 持久化失败不影响功能使用
  }
}

/** 重置某个功能的教程状态，使其可以重新触发 */
async function resetTutorial(feature: string): Promise<void> {
  completedTutorials.value.delete(feature)
  try {
    await setItem<string[]>(STORE_NAME, KEY, Array.from(completedTutorials.value))
  } catch {
    // 持久化失败不影响功能使用
  }
}

export function useFeatureTutorial() {
  return {
    needsTutorial,
    markTutorialDone,
    resetTutorial
  }
}
