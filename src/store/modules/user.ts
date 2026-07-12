/**
 * 用户档案 Store
 * PRD 3.4（我的页面）：身体档案、目标设定
 * PRD 7.1（新手引导）：首启快速建档流程
 * PRD 4.3：数据仅存本地 IndexedDB（通过 localforage 持久化）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'
import { createEmptyProfile, type UserProfile } from '@/types/user'

const USER_PROFILE_KEY = 'profile'
const ONBOARDED_KEY = 'onboarded'

export const useUserStore = defineStore('user', () => {
  // ==================== State ====================
  const profile = ref<UserProfile>(createEmptyProfile())
  const isOnboarded = ref(false)
  const isLoaded = ref(false)

  // ==================== Getters ====================
  /** 是否已完成首启建档（profile 核心字段非空） */
  const hasProfile = computed(
    () =>
      profile.value.gender !== null &&
      profile.value.height !== null &&
      profile.value.weight !== null &&
      profile.value.goal !== null
  )

  /** BMI 指数 */
  const bmi = computed(() => {
    const { height, weight } = profile.value
    if (!height || !weight || height <= 0) return null
    const h = height / 100
    return Number((weight / (h * h)).toFixed(1))
  })

  // ==================== Actions ====================
  /**
   * 从本地 IndexedDB 加载用户档案
   * Capacitor APK 冷启动时 IndexedDB 可能短暂不可用，采用重试 + 回退策略：
   * 1. 重试读取 profile 和 onboarded 标记（最多 3 次，间隔递增）
   * 2. 若 onboarded 标记缺失但 profile 有有效数据，视为已建档（回退判定）
   * 3. 若仍读取不到，判定为新用户
   */
  async function loadFromStorage(): Promise<void> {
    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const stored = await getItem<UserProfile>('user', USER_PROFILE_KEY)
        const onboarded = await getItem<boolean>('user', ONBOARDED_KEY)

        if (stored) {
          profile.value = stored
        }

        if (onboarded === true) {
          isOnboarded.value = true
          isLoaded.value = true
          return
        }

        // 回退：profile 有有效数据但 onboarded 标记缺失（如 IndexedDB 事务时序问题）
        if (hasProfile.value) {
          isOnboarded.value = true
          await setItem<boolean>('user', ONBOARDED_KEY, true)
          isLoaded.value = true
          return
        }

        // 两者都读到 null：可能 IndexedDB 尚未就绪，等待后重试
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
          continue
        }
      } catch (error) {
        console.error(`[userStore] loadFromStorage attempt ${attempt + 1} failed:`, error)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
          continue
        }
      }
    }
    // 重试完毕仍未读到数据 → 判定为新用户
    isOnboarded.value = false
    isLoaded.value = true
  }

  /** 保存用户档案到本地 IndexedDB */
  async function saveProfile(patch: Partial<UserProfile>): Promise<void> {
    const now = Date.now()
    profile.value = {
      ...profile.value,
      ...patch,
      updatedAt: now,
      createdAt: profile.value.createdAt || now
    }
    await setItem<UserProfile>('user', USER_PROFILE_KEY, profile.value)
  }

  /** 标记已完成首启建档 */
  async function markOnboarded(): Promise<void> {
    isOnboarded.value = true
    await setItem<boolean>('user', ONBOARDED_KEY, true)
  }

  /** 重置用户档案（清空所有数据） */
  async function resetProfile(): Promise<void> {
    profile.value = createEmptyProfile()
    isOnboarded.value = false
    await setItem<UserProfile>('user', USER_PROFILE_KEY, profile.value)
    await setItem<boolean>('user', ONBOARDED_KEY, false)
  }

  return {
    // state
    profile,
    isOnboarded,
    isLoaded,
    // getters
    hasProfile,
    bmi,
    // actions
    loadFromStorage,
    saveProfile,
    markOnboarded,
    resetProfile
  }
})
