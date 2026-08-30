<script setup lang="ts">
/**
 * 呼吸引导组件
 * PRD 3.2：沉浸式 UI 动画（CSS3 呼吸球）
 * - 预设模式：4-7-8 助眠法、箱式呼吸法、快速放松法
 * - 视觉与文字同步提示（吸气/屏气/呼气倒计时）
 * 重设计：cyan-violet 渐变呼吸球 + 玻璃面板
 */
import { ref, computed, onUnmounted } from 'vue'
import { breathingModes, type BreathingPattern } from '@/types/sleep'
import AuroraButton from '@/components/AuroraButton.vue'

const selectedMode = ref<BreathingPattern>('478')
const isRunning = ref(false)
const currentPhaseIndex = ref(0)
const phaseCountdown = ref(0)
const completedCycles = ref(0)

let phaseTimer: ReturnType<typeof setInterval> | null = null

const currentMode = computed(() => breathingModes.find((m) => m.key === selectedMode.value)!)
const currentPhase = computed(() => currentMode.value.phases[currentPhaseIndex.value] || null)

/** 呼吸球缩放比例（根据阶段） */
const ballScale = computed(() => {
  if (!isRunning.value || !currentPhase.value) return 1
  const phase = currentPhase.value.phase
  if (phase === 'inhale') return 1.4
  if (phase === 'exhale') return 0.7
  return 1 // hold
})

/** 呼吸球过渡时长（匹配当前阶段秒数） */
const ballTransition = computed(() => {
  if (!isRunning.value || !currentPhase.value) return '0.5s ease'
  return `${currentPhase.value.duration}s ease-in-out`
})

/** 阶段文字提示 */
const phaseLabel = computed(() => {
  if (!isRunning.value) return '点击开始'
  if (!currentPhase.value) return ''
  return `${currentPhase.value.label} ${phaseCountdown.value}s`
})

/** 选择模式 */
function selectMode(mode: BreathingPattern): void {
  if (isRunning.value) return
  selectedMode.value = mode
}

/** 开始呼吸引导 */
function start(): void {
  if (isRunning.value) return
  isRunning.value = true
  currentPhaseIndex.value = 0
  completedCycles.value = 0
  runPhase()
}

/** 停止呼吸引导 */
function stop(): void {
  isRunning.value = false
  if (phaseTimer) {
    clearInterval(phaseTimer)
    phaseTimer = null
  }
  currentPhaseIndex.value = 0
  phaseCountdown.value = 0
}

/** 执行当前阶段 */
function runPhase(): void {
  if (!isRunning.value) return
  const phase = currentMode.value.phases[currentPhaseIndex.value]
  if (!phase) return

  phaseCountdown.value = phase.duration

  phaseTimer = setInterval(() => {
    phaseCountdown.value--
    if (phaseCountdown.value <= 0) {
      if (phaseTimer) {
        clearInterval(phaseTimer)
        phaseTimer = null
      }
      nextPhase()
    }
  }, 1000)
}

/** 进入下一阶段 */
function nextPhase(): void {
  const phases = currentMode.value.phases
  currentPhaseIndex.value++

  if (currentPhaseIndex.value >= phases.length) {
    // 完成一轮
    currentPhaseIndex.value = 0
    completedCycles.value++
  }

  if (isRunning.value) {
    runPhase()
  }
}

onUnmounted(() => {
  if (phaseTimer) {
    clearInterval(phaseTimer)
  }
})
</script>

<template>
  <div class="breathing-guide">
    <!-- 模式选择 -->
    <div class="mode-list">
      <div
        v-for="mode in breathingModes"
        :key="mode.key"
        class="mode-card"
        :class="{ active: selectedMode === mode.key, disabled: isRunning }"
        @click="selectMode(mode.key)"
      >
        <div class="mode-icon">{{ mode.icon }}</div>
        <div class="mode-info">
          <div class="mode-label">{{ mode.label }}</div>
          <div class="mode-desc">{{ mode.desc }}</div>
        </div>
      </div>
    </div>

    <!-- 呼吸球动画区 -->
    <div class="breathing-arena">
      <div class="breathing-ball-wrapper">
        <div
          class="breathing-ball"
          :class="{ running: isRunning }"
          :style="{
            transform: `scale(${ballScale})`,
            transition: ballTransition
          }"
        >
          <div class="ball-inner">
            <div class="ball-text">{{ phaseLabel }}</div>
          </div>
        </div>
        <!-- 呼吸球光晕 -->
        <div
          class="breathing-halo"
          :class="{ running: isRunning }"
          :style="{
            transform: `scale(${ballScale})`,
            transition: ballTransition
          }"
        ></div>
      </div>

      <!-- 完成轮数 -->
      <div v-if="isRunning" class="cycle-count">
        已完成 {{ completedCycles }} 轮
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="guide-controls">
      <AuroraButton v-if="!isRunning" size="lg" @click="start">开始呼吸</AuroraButton>
      <AuroraButton v-else type="glass" size="lg" @click="stop">停止</AuroraButton>
    </div>

    <p class="guide-tip">跟随呼吸球的节奏，吸气时球变大，呼气时球变小</p>
  </div>
</template>

<style scoped>
.breathing-guide {
  color: var(--foreground);
}

/* ==================== 模式选择 ==================== */
.mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mode-card.active {
  background: color-mix(in srgb, var(--chart-4) 8%, transparent);
  border-color: color-mix(in srgb, var(--chart-4) 40%, transparent);
}

.mode-card.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.mode-card:active {
  transform: scale(0.98);
}

.mode-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.mode-info {
  flex: 1;
}

.mode-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.mode-desc {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 2px;
  line-height: 1.4;
}

/* ==================== 呼吸球动画区 ==================== */
.breathing-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 0;
  min-height: 220px;
}

.breathing-ball-wrapper {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.breathing-ball {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chart-4) 0%, #af52de 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  transform: scale(1);
  box-shadow: 0 0 30px rgba(88, 86, 214, 0.25), 0 0 60px rgba(88, 86, 214, 0.2);
}

.breathing-halo {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(88, 86, 214, 0.22) 0%, rgba(175, 82, 222, 0.1) 40%, transparent 70%);
  z-index: 1;
  opacity: 0.6;
}

.breathing-halo.running {
  opacity: 1;
}

.ball-inner {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ball-text {
  font-size: 13px;
  color: #ffffff;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.cycle-count {
  margin-top: 20px;
  font-size: 13px;
  color: var(--chart-4);
  font-weight: 500;
}

/* ==================== 控制按钮 ==================== */
.guide-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.guide-tip {
  font-size: 11px;
  color: var(--muted-foreground);
  text-align: center;
}
</style>
