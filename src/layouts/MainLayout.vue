<script setup lang="ts">
/**
 * 主布局组件（Apple 风格）
 * 6 个主 Tab 底部导航，Apple tabbar 样式
 * 实色背景 + 顶部 hairline 分割线 + SVG 图标 + 触控目标 ≥48dp
 * 不依赖 backdrop-filter，Android WebView 兼容
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppleIcon from '@/components/AppleIcon.vue'

const route = useRoute()
const router = useRouter()

/** 当前路由是否需要显示底部 Dock */
const showDock = computed(() => route.meta.showTabBar !== false)

/** Dock 配置（6 个主 Tab，使用 AppleIcon 名称） */
const tabs = [
  { name: 'home', path: '/', label: '看板', icon: 'house' },
  { name: 'record', path: '/record', label: '记录', icon: 'utensils' },
  { name: 'sleep', path: '/sleep', label: '睡眠', icon: 'moon' },
  { name: 'mind', path: '/mind', label: '心理', icon: 'smile' },
  { name: 'advisor', path: '/advisor', label: '顾问', icon: 'message-circle' },
  { name: 'profile', path: '/profile', label: '我的', icon: 'user' }
]

const activeTab = computed(() => {
  const found = tabs.find((t) => route.path === t.path)
  return found?.name || 'home'
})

const navigateTo = (path: string) => {
  router.push(path)
}
</script>

<template>
  <div class="main-layout">
    <!-- 内容区：留出底部 Dock 高度 -->
    <main class="main-content" :class="{ 'with-dock': showDock }">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Apple tabbar 底部导航 -->
    <nav v-if="showDock" class="dock-nav">
      <a
        v-for="tab in tabs"
        :key="tab.name"
        class="dock-tab"
        :class="{ active: activeTab === tab.name }"
        @click="navigateTo(tab.path)"
      >
        <AppleIcon :name="tab.icon" :size="22" class="dock-icon" />
        <span class="dock-label">{{ tab.label }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--background);
}

.main-content {
  flex: 1;
}

/* 有 Dock 时留出底部空间：Dock 高度 56px + 底部安全区 */
.main-content.with-dock {
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}

/* ==================== Apple tabbar ==================== */
.dock-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--sidebar);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: var(--shadow-sm);
}

.dock-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  min-width: 48px;
  padding: 6px 4px;
  color: var(--muted-foreground);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 150ms ease;
  cursor: pointer;
}

.dock-tab.active {
  color: var(--primary);
}

.dock-icon {
  stroke-width: 1.5;
  transition: transform 150ms ease;
}

.dock-tab.active .dock-icon {
  transform: translateY(-1px);
}

.dock-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

/* 小屏适配：缩小字号 */
@media (max-width: 360px) {
  .dock-label {
    font-size: 9px;
  }
  .dock-tab {
    padding: 4px 2px;
  }
}
</style>
