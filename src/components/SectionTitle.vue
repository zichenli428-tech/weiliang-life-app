<script setup lang="ts">
/**
 * Apple 风格分区标题
 * 图标 + 标题文字，可配置图标颜色（默认模块色）
 */
import AppleIcon from '@/components/AppleIcon.vue'

const props = withDefaults(
  defineProps<{
    title: string
    icon?: string
    color?: string
  }>(),
  {
    icon: '',
    color: 'var(--chart-1)'
  }
)
</script>

<template>
  <div class="section-title">
    <AppleIcon v-if="icon" :name="icon" :size="18" :style="{ color: props.color }" />
    <span class="section-text">{{ title }}</span>
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  font-family: var(--font-sans);
}

.section-text {
  line-height: 1;
}
</style>
