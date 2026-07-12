<script setup lang="ts">
/**
 * 极光按钮
 * primary：极光渐变背景，深色文字
 * glass：玻璃半透明背景，白色文字
 */
const props = withDefaults(
  defineProps<{
    type?: 'primary' | 'glass'
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
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base'
}
</script>

<template>
  <button
    class="aurora-btn inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
    :class="[
      sizeClasses[size],
      block ? 'w-full' : '',
      type === 'primary'
        ? 'aurora-gradient text-surface-bg shadow-lg shadow-aurora-green/20'
        : 'glass text-content-primary'
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <van-loading v-if="loading" type="spinner" size="14px" color="currentColor" />
    <slot />
  </button>
</template>

<style scoped>
.aurora-btn {
  -webkit-tap-highlight-color: transparent;
}

.aurora-gradient {
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
}

.glass {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(2, 8, 20, 0.24);
}

.glass:active {
  background: rgba(255, 255, 255, 0.12);
}
</style>
