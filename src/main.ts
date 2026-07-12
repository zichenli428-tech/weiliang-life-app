import { createApp } from 'vue'
import localforage from 'localforage'
import { App as CapacitorApp } from '@capacitor/app'
import { showToast } from 'vant'
import App from './App.vue'
import pinia from './store'
import router from './router'
import { useUserStore } from '@/store/modules/user'
import './styles/main.css'

/**
 * 抑制 ECharts 雷达图 alignTicks 无害警告
 * 原因：ECharts 5.5 雷达组件的 indicator 内部轴默认 alignTicks=true，
 * 当 indicator max=100 时会输出 "ticks may be not readable" 警告，
 * 但实际刻度（0/25/50/75/100）完全可读，且雷达组件级的 alignTicks:false
 * 不会传递到内部轴，因此只能通过控制台过滤抑制此纯提示性警告。
 */
const originalWarn = console.warn
console.warn = function (...args: unknown[]) {
  const first = args[0]
  if (
    typeof first === 'string' &&
    first.includes('[ECharts]') &&
    first.includes('alignTicks')
  ) {
    return
  }
  originalWarn.apply(console, args as Parameters<typeof console.warn>)
}

const app = createApp(App)

// 全局错误处理：捕获 Vue 组件内未处理的错误，避免静默失败
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', info, err)
}

// 捕获未处理的 Promise rejection（如异步操作中未被 catch 的错误）
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
})

app.use(pinia)

// PRD 7.1：先加载本地用户档案，再注册路由和挂载应用
// 关键：app.use(router) 会立即触发 Vue Router 初始导航和 beforeEach 守卫，
// 必须在 isOnboarded 从 IndexedDB 恢复之后执行，否则守卫读到默认值 false，
// 导致已建档用户在 Capacitor APK 冷启动后被误判为新用户、强制跳转建档页。
const userStore = useUserStore()
Promise.race([
  localforage.ready(),
  new Promise(resolve => setTimeout(resolve, 3000))
]).finally(() => {
  userStore.loadFromStorage().finally(() => {
    app.use(router)
    app.mount('#app')

    // Android 物理返回键处理：非首页 router.back()，首页双击退出
    // Web 环境下此监听不会触发，仅 APK 生效
    let lastBackPress = 0
    CapacitorApp.addListener('backButton', () => {
      const currentPath = router.currentRoute.value.path
      if (currentPath === '/' || currentPath === '/onboarding') {
        const now = Date.now()
        if (now - lastBackPress < 2000) {
          CapacitorApp.exitApp()
        } else {
          lastBackPress = now
          showToast('再按一次退出应用')
        }
      } else {
        router.back()
      }
    })
  })
})
