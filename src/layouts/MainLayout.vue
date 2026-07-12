<script setup lang="ts">
/**
 * 主布局组件
 * 6 个主 Tab（健康看板 / AI 顾问 / 心理疏导 / 睡眠辅助 / 健康记录 / 我的）
 * PRD 4.2：底部 Safe Area 适配
 * 重设计：玻璃胶囊 Dock 导航
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/** 当前路由是否需要显示底部 Dock */
const showDock = computed(() => route.meta.showTabBar !== false)

/** Dock 配置（6 个主 Tab） */
const tabs = [
  { name: 'home', path: '/', label: '看板', icon: 'wap-home-o' },
  { name: 'advisor', path: '/advisor', label: '顾问', icon: 'chat-o' },
  { name: 'mind', path: '/mind', label: '心理', icon: 'smile-o' },
  { name: 'sleep', path: '/sleep', label: '睡眠', icon: 'volume-o' },
  { name: 'record', path: '/record', label: '记录', icon: 'records' },
  { name: 'profile', path: '/profile', label: '我的', icon: 'user-o' }
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

    <!-- 玻璃胶囊 Dock（6 个主 Tab） -->
    <div v-if="showDock" class="dock-wrapper safe-area-bottom">
      <div class="glass-dock">
        <div
          v-for="tab in tabs"
          :key="tab.name"
          class="dock-item"
          :class="{ active: activeTab === tab.name }"
          @click="navigateTo(tab.path)"
        >
          <div class="dock-icon-wrap">
            <van-icon :name="tab.icon" class="dock-icon" />
          </div>
          <span class="dock-label">{{ tab.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #0b1220;
}

.main-content {
  flex: 1;
}

/* 有 Dock 时留出底部空间：Dock 高度约 64px + 底部间距 */
.main-content.with-dock {
  padding-bottom: calc(72px + env(safe-area-inset-bottom));
}

/* ==================== 玻璃胶囊 Dock ==================== */
.dock-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  padding: 0 16px calc(12px + env(safe-area-inset-bottom));
  pointer-events: none;
}

.glass-dock {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 420px;
  padding: 8px 10px;
  pointer-events: auto;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.04)
  );
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  box-shadow:
    0 8px 32px rgba(2, 8, 20, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.dock-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 44px;
  min-height: 44px;
  padding: 4px 2px;
  border-radius: 16px;
  color: #64748b;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.dock-item:active {
  transform: scale(0.94);
}

.dock-item.active {
  color: #34d399;
}

.dock-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.dock-item.active .dock-icon-wrap {
  background: rgba(52, 211, 153, 0.12);
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.25);
}

.dock-icon {
  font-size: 20px;
  line-height: 1;
  transition: all 0.2s ease;
}

.dock-item.active .dock-icon {
  transform: translateY(-1px);
}

.dock-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  opacity: 0;
  max-width: 0;
  transform: translateY(4px);
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  white-space: nowrap;
  overflow: hidden;
}

.dock-item.active .dock-label {
  opacity: 1;
  max-width: 40px;
  transform: translateY(0);
  margin-top: 1px;
}
</style>
