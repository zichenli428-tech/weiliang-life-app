<script setup lang="ts">
/**
 * 统一模块标题
 * 小字大写 + 左侧极光竖条，营造科技信息层级
 */
defineProps<{
  title: string
  icon?: string
}>()
</script>

<template>
  <div class="section-title">
    <div class="accent-bar"></div>
    <span v-if="icon" class="section-icon">{{ icon }}</span>
    <span class="section-text">{{ title }}</span>
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.accent-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
}

.section-icon {
  font-size: 13px;
  line-height: 1;
}

.section-text {
  line-height: 1;
}
</style>
