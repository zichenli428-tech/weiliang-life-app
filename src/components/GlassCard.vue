<script setup lang="ts">
/**
 * Apple Card 卡片容器
 * 实色背景 + 边框 + 低 alpha 阴影，不依赖 backdrop-filter（Android WebView 兼容）
 * 兼容旧 glow/gradientBorder 属性（迁移期降级处理，不再产生光晕）
 */
import { computed } from 'vue'

export type GlowType = 'green' | 'cyan' | 'violet' | 'nutrition' | 'sleep' | 'mind' | 'advisor' | 'profile' | boolean

withDefaults(
  defineProps<{
    glow?: GlowType
    gradientBorder?: boolean
    padding?: 'sm' | 'md' | 'lg' | 'none'
    radius?: 'md' | 'lg' | 'xl'
    hover?: boolean
  }>(),
  {
    glow: false,
    gradientBorder: false,
    padding: 'md',
    radius: 'lg',
    hover: false
  }
)

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5'
}

const radiusMap = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl'
}

const glowClass = computed(() => {
  // 迁移期：glow 不再产生视觉光晕，仅保留属性兼容
  return ''
})
</script>

<template>
  <div
    class="glass-card transition-all duration-200"
    :class="[
      paddingMap[padding],
      radiusMap[radius],
      glowClass,
      { 'hover:shadow-md hover:-translate-y-px': hover }
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
/* Apple Card 样式由全局 main.css 的 .glass-card 提供（实色 + 边框 + 阴影） */
.glass-card {
  /* 覆盖旧的 scoped 玻璃拟态，统一为 Apple Card */
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
</style>
