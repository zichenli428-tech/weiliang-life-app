/**
 * Vue Router 路由配置
 * 6 个主 Tab（健康看板 / AI 顾问 / 心理疏导 / 睡眠辅助 / 健康记录 / 我的）
 * PRD 7.1：首启快速建档流程（未建档用户强制跳转建档页）
 *
 * 路由模式：history（配合 Capacitor APK 阶段，PRD 5.3）
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/store/modules/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue'),
    meta: {
      title: '建档',
      showTabBar: false,
      requiresOnboarding: false
    }
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: {
      title: '健康看板',
      tab: 1,
      requiresOnboarding: true
    }
  },
  {
    path: '/advisor',
    name: 'advisor',
    component: () => import('@/views/AdvisorView.vue'),
    meta: {
      title: 'AI 健康顾问',
      tab: 2,
      requiresOnboarding: true
    }
  },
  {
    path: '/record',
    name: 'record',
    component: () => import('@/views/RecordView.vue'),
    meta: {
      title: '健康记录',
      tab: 5,
      requiresOnboarding: true
    }
  },
  {
    path: '/mind',
    name: 'mind',
    component: () => import('@/views/MindView.vue'),
    meta: {
      title: '心理疏导',
      tab: 3,
      requiresOnboarding: true
    }
  },
  {
    path: '/sleep',
    name: 'sleep',
    component: () => import('@/views/SleepView.vue'),
    meta: {
      title: '睡眠辅助',
      tab: 4,
      requiresOnboarding: true
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: {
      title: '我的',
      tab: 6,
      requiresOnboarding: true
    }
  },
  // 404 兜底：重定向到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 全局前置守卫
router.beforeEach(async (to, _from, next) => {
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `微量生活 · ${title}`
  }

  // PRD 7.1：未建档用户强制进入建档流程
  const userStore = useUserStore()
  // 双保险：确保用户档案已从 IndexedDB 加载完毕再判断建档状态
  if (!userStore.isLoaded) {
    await userStore.loadFromStorage()
  }
  const requiresOnboarding = to.meta.requiresOnboarding !== false

  if (requiresOnboarding && !userStore.isOnboarded) {
    // 需要建档但未建档 → 跳转建档页
    next({ name: 'onboarding' })
  } else if (to.name === 'onboarding' && userStore.isOnboarded) {
    // 已建档还去建档页 → 跳转首页
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
