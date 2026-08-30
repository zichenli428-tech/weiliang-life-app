<script setup lang="ts">
/**
 * Apple 按钮
 * primary：主色实色背景（System Blue），白字
 * secondary：浅灰背景 + 边框
 * text：透明背景，主色文字
 * 兼容旧 type='glass' → 映射为 secondary
 */
const props = withDefaults(
  defineProps<{
    type?: 'primary' | 'glass' | 'secondary' | 'text'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    type: 'primary',
    size: 'md',
    block: false,
    disabled: false,
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (e: MouseEvent) => {
  if (props.disabled || props.loading) return
  emit('click', e)
}

const sizeClasses = {
  sm: 'px-4 py-1.5 text-xs min-h-[36px]',
  md: 'px-5 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[48px]'
}

const typeClass = (t: string) => {
  if (t === 'primary') return 'btn-primary'
  if (t === 'text') return 'btn-text'
  // glass 兼容映射为 secondary
  return 'btn-secondary'
}
</script>

<template>
  <button
    class="aurora-btn inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
    :class="[
      sizeClasses[size],
      block ? 'w-full' : '',
      typeClass(type)
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <van-loading v-if="loading" type="spinner" size="14px" color="currentColor" />
    <slot />
  </button>
</template>

<style scoped>
/* 按钮样式由全局 main.css 的 .btn-primary/.btn-secondary/.btn-text 提供 */
</style>
