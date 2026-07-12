<script setup lang="ts">
/**
 * 玻璃卡片容器
 * 统一极光琉璃风格：磨砂半透明 + 细边框 + 柔和阴影
 * 支持：光晕、渐变边框、自定义 padding
 */
import { computed } from 'vue'

export type GlowType = 'green' | 'cyan' | 'violet' | 'nutrition' | 'sleep' | 'mind' | 'advisor' | 'profile' | boolean

const props = withDefaults(
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
    radius: 'xl',
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
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
  xl: 'rounded-[24px]'
}

const glowClass = computed(() => {
  if (!props.glow) return ''
  if (props.glow === true) return 'glow-green'
  const map: Record<string, string> = {
    green: 'glow-green',
    cyan: 'glow-cyan',
    violet: 'glow-violet',
    nutrition: 'glow-nutrition',
    sleep: 'glow-sleep',
    mind: 'glow-mind',
    advisor: 'glow-advisor',
    profile: 'glow-profile'
  }
  return map[props.glow as string] || 'glow-green'
})
</script>

<template>
  <div
    class="glass-card transition-all duration-200"
    :class="[
      paddingMap[padding],
      radiusMap[radius],
      glowClass,
      { 'gradient-border': gradientBorder, 'hover:scale-[0.99] hover:bg-white/10': hover }
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.glass-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(2, 8, 20, 0.36);
}

/* 渐变边框由全局 main.css 的 .gradient-border 提供 */
</style>
