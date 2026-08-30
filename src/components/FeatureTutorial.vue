<script setup lang="ts">
/**
 * 交互式功能教程组件
 * 在页面元素上高亮 spotlight + 弹出提示卡片，引导用户了解功能
 * 支持任意 CSS 选择器定位高亮目标
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import AppleIcon from '@/components/AppleIcon.vue'

export interface TutorialStep {
  /** 高亮元素的 CSS 选择器 */
  selector: string
  /** 教程标题 */
  title: string
  /** 教程描述 */
  description: string
  /** 图标名称（AppleIcon） */
  icon: string
  /** 提示卡片位置：auto 自动判断 / below 目标下方 / above 目标上方 / center 居中 */
  position?: 'auto' | 'below' | 'above' | 'center'
}

const props = withDefaults(defineProps<{
  /** 教程步骤 */
  steps: TutorialStep[]
  /** 是否显示 */
  visible: boolean
}>(), {
  visible: false
})

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'skip'): void
}>()

const currentStep = ref(0)
const spotlightRect = ref({ top: 0, left: 0, width: 0, height: 0 })
const tooltipStyle = ref<Record<string, string>>({})
const tooltipPosition = ref<'below' | 'above' | 'center'>('below')

const isLastStep = computed(() => currentStep.value === props.steps.length - 1)
const currentStepData = computed(() => props.steps[currentStep.value] || null)

/** 查找目标元素并计算 spotlight 位置 */
async function updateSpotlight() {
  if (!currentStepData.value) return

  const { selector, position = 'auto' } = currentStepData.value

  // center 模式不需要高亮元素
  if (position === 'center' || selector === '') {
    spotlightRect.value = { top: 0, left: 0, width: 0, height: 0 }
    tooltipPosition.value = 'center'
    tooltipStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }
    return
  }

  const el = document.querySelector(selector)
  if (!el) {
    // 找不到元素，降级为居中显示
    spotlightRect.value = { top: 0, left: 0, width: 0, height: 0 }
    tooltipPosition.value = 'center'
    tooltipStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }
    return
  }

  // 滚动元素到可见区域
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await new Promise(resolve => setTimeout(resolve, 300))

  const rect = el.getBoundingClientRect()
  const padding = 8
  spotlightRect.value = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  }

  // 计算提示卡片位置
  const tooltipWidth = 300
  const tooltipEstHeight = 160
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let pos: 'below' | 'above' | 'center'
  if (position === 'auto') {
    // 自动判断：目标下方空间足够则放下方，否则放上方
    const spaceBelow = viewportHeight - (rect.bottom + padding)
    const spaceAbove = rect.top - padding
    pos = spaceBelow >= tooltipEstHeight ? 'below' : (spaceAbove >= tooltipEstHeight ? 'above' : 'center')
  } else {
    pos = position
  }

  tooltipPosition.value = pos

  if (pos === 'below') {
    const top = rect.bottom + padding + 12
    const left = Math.max(16, Math.min(rect.left, viewportWidth - tooltipWidth - 16))
    tooltipStyle.value = { top: `${top}px`, left: `${left}px`, transform: 'none' }
  } else if (pos === 'above') {
    const bottom = viewportHeight - rect.top + padding + 12
    const left = Math.max(16, Math.min(rect.left, viewportWidth - tooltipWidth - 16))
    tooltipStyle.value = { bottom: `${bottom}px`, left: `${left}px`, top: 'auto', transform: 'none' }
  } else {
    tooltipStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
}

function handleNext() {
  if (isLastStep.value) {
    emit('complete')
  } else {
    currentStep.value++
  }
}

function handleSkip() {
  emit('skip')
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') handleSkip()
  if (e.key === 'Enter') handleNext()
}

function handleResize() {
  if (props.visible) updateSpotlight()
}

watch(() => props.visible, (val) => {
  if (val) {
    currentStep.value = 0
    nextTick(() => updateSpotlight())
  }
})

watch(currentStep, () => {
  if (props.visible) updateSpotlight()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  if (props.visible) {
    nextTick(() => updateSpotlight())
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="tutorial-overlay">
      <!-- Spotlight 遮罩：通过 4 块半透明 div 围绕高亮区域 -->
      <!-- 遮罩仅作为视觉屏蔽与点击拦截，不响应点击跳过；用户只能通过「跳过」或「下一步」按钮推进教程 -->
      <!-- 上方遮罩 -->
      <div
        class="mask-block"
        :style="{
          top: '0',
          left: '0',
          right: '0',
          height: spotlightRect.top + 'px'
        }"
      />
      <!-- 下方遮罩 -->
      <div
        class="mask-block"
        :style="{
          top: (spotlightRect.top + spotlightRect.height) + 'px',
          left: '0',
          right: '0',
          bottom: '0'
        }"
      />
      <!-- 左侧遮罩 -->
      <div
        class="mask-block"
        :style="{
          top: spotlightRect.top + 'px',
          left: '0',
          width: spotlightRect.left + 'px',
          height: spotlightRect.height + 'px'
        }"
      />
      <!-- 右侧遮罩 -->
      <div
        class="mask-block"
        :style="{
          top: spotlightRect.top + 'px',
          left: (spotlightRect.left + spotlightRect.width) + 'px',
          right: '0',
          height: spotlightRect.height + 'px'
        }"
      />

      <!-- 高亮边框框 -->
      <div
        v-if="spotlightRect.width > 0"
        class="spotlight-border"
        :style="{
          top: spotlightRect.top + 'px',
          left: spotlightRect.left + 'px',
          width: spotlightRect.width + 'px',
          height: spotlightRect.height + 'px'
        }"
      />

      <!-- 提示卡片 -->
      <Transition name="tooltip-fade">
        <div v-if="currentStepData" class="tutorial-tooltip" :style="tooltipStyle">
          <div class="tooltip-header">
            <span class="tooltip-icon">
              <AppleIcon :name="currentStepData.icon" :size="18" />
            </span>
            <span class="tooltip-step">{{ currentStep + 1 }} / {{ steps.length }}</span>
          </div>
          <h3 class="tooltip-title">{{ currentStepData.title }}</h3>
          <p class="tooltip-desc">{{ currentStepData.description }}</p>
          <div class="tooltip-actions">
            <button class="tooltip-skip" @click="handleSkip">跳过</button>
            <button class="tooltip-next" @click="handleNext">
              {{ isLastStep ? '开始使用' : '下一步' }}
              <AppleIcon v-if="!isLastStep" name="chevron-right" :size="14" />
            </button>
          </div>
          <!-- 指向高亮元素的箭头 -->
          <div v-if="tooltipPosition === 'below'" class="tooltip-arrow tooltip-arrow-top"></div>
          <div v-if="tooltipPosition === 'above'" class="tooltip-arrow tooltip-arrow-bottom"></div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.tutorial-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.mask-block {
  position: fixed;
  background: rgba(0, 0, 0, 0.55);
  cursor: default;
}

.spotlight-border {
  position: fixed;
  border: 2px solid var(--primary);
  border-radius: 8px;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15);
  pointer-events: none;
  transition: all 0.3s ease;
}

.tutorial-tooltip {
  position: fixed;
  width: 300px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: 18px 20px 16px;
  z-index: 10000;
  transition: all 0.3s ease;
}

.tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tooltip-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tooltip-step {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.tooltip-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0 0 8px;
}

.tooltip-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin: 0 0 16px;
}

.tooltip-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tooltip-skip {
  font-size: 14px;
  color: var(--muted-foreground);
  background: none;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}
.tooltip-skip:hover {
  color: var(--foreground);
  background: var(--accent);
}

.tooltip-next {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-foreground);
  background: var(--primary);
  border: none;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.tooltip-next:active {
  transform: scale(0.97);
}

.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  left: 24px;
}
.tooltip-arrow-top {
  top: -7px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid var(--card);
}
.tooltip-arrow-bottom {
  bottom: -7px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid var(--card);
}

/* 过渡动画 */
.tooltip-fade-enter-active {
  transition: all 0.3s ease;
}
.tooltip-fade-leave-active {
  transition: all 0.2s ease;
}
.tooltip-fade-enter-from {
  opacity: 0;
  transform: translate(0, 8px);
}
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
