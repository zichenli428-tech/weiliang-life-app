<script setup lang="ts">
/**
 * 首启快速建档流程
 * PRD 7.1：第一次进入 App 时建档（3 步内选完），让后续 AI 建议真正个性化
 * Step 1: 性别 + 年龄
 * Step 2: 身高 + 体重 + 目标体重
 * Step 3: 健康目标 + 活动水平
 * 重设计：暗色极光背景，玻璃化步骤卡片
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/store/modules/user'
import AuroraButton from '@/components/AuroraButton.vue'
import type { Gender, HealthGoal, ActivityLevel } from '@/types/user'

const router = useRouter()
const userStore = useUserStore()

const currentStep = ref(1)
const totalSteps = 3

// 表单数据
const gender = ref<Gender | null>(null)
const age = ref(25)
const height = ref(170)
const weight = ref(65)
const targetWeight = ref(60)
const goal = ref<HealthGoal>('maintain')
const activityLevel = ref<ActivityLevel>('moderate')

// 选项配置
const goalOptions: { value: HealthGoal; label: string; icon: string; desc: string }[] = [
  { value: 'lose_fat', label: '减脂塑形', icon: '🔥', desc: '减少体脂，线条更清晰' },
  { value: 'gain_muscle', label: '增肌增重', icon: '💪', desc: '增加肌肉，提升力量' },
  { value: 'maintain', label: '保持健康', icon: '⚖️', desc: '维持现状，均衡饮食' },
  { value: 'improve_sleep', label: '改善睡眠', icon: '🌙', desc: '提升睡眠质量' },
  { value: 'relieve_stress', label: '缓解压力', icon: '🧘', desc: '放松身心，调节情绪' }
]

const activityOptions: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: '久坐', desc: '几乎不运动' },
  { value: 'light', label: '轻度', desc: '每周 1-3 次轻运动' },
  { value: 'moderate', label: '中度', desc: '每周 3-5 次中等运动' },
  { value: 'active', label: '高度', desc: '每周 6-7 次剧烈运动' },
  { value: 'very_active', label: '极高', desc: '体力工作或每天高强度训练' }
]

// 步骤校验
const stepValid = computed(() => {
  if (currentStep.value === 1) return gender.value !== null
  if (currentStep.value === 2) return height.value > 0 && weight.value > 0
  return true
})

const progressPercent = computed(() => (currentStep.value / totalSteps) * 100)

const handleNext = () => {
  if (!stepValid.value) {
    showToast(currentStep.value === 1 ? '请选择性别' : '请填写身高体重')
    return
  }
  if (currentStep.value < totalSteps) {
    currentStep.value++
  } else {
    handleComplete()
  }
}

const handlePrev = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const handleComplete = async () => {
  await userStore.saveProfile({
    nickname: '健康用户',
    gender: gender.value,
    age: age.value,
    height: height.value,
    weight: weight.value,
    targetWeight: targetWeight.value,
    goal: goal.value,
    activityLevel: activityLevel.value
  })
  await userStore.markOnboarded()
  showToast({ message: '建档成功，开启健康生活', type: 'success' })
  router.replace({ name: 'home' })
}
</script>

<template>
  <div class="onboarding safe-area-top safe-area-bottom">
    <!-- 顶部进度 -->
    <div class="onboarding-header">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm aurora-text font-semibold">{{ currentStep }} / {{ totalSteps }}</span>
        <span class="text-xs text-content-secondary">微量生活 · 建档</span>
      </div>
      <van-progress
        :percentage="progressPercent"
        stroke-width="4"
        color="linear-gradient(135deg, #34d399, #22d3ee, #a78bfa)"
        track-color="rgba(255,255,255,0.08)"
        :show-pivot="false"
      />
    </div>

    <!-- 步骤内容 -->
    <div class="onboarding-body stagger-fade-up">
      <!-- Step 1: 性别 + 年龄 -->
      <div v-if="currentStep === 1" class="step-pane">
        <h2 class="step-title"><span class="aurora-text">01</span> 先了解一下你</h2>
        <p class="step-subtitle">性别与年龄影响营养与运动建议</p>

        <div class="section-label">性别</div>
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div
            v-for="g in ([['male', '男'], ['female', '女']] as [Gender, string][])"
            :key="g[0]"
            class="option-card press-effect"
            :class="{ active: gender === g[0] }"
            @click="gender = g[0]"
          >
            <span class="text-4xl mb-2">{{ g[0] === 'male' ? '👨' : '👩' }}</span>
            <span class="text-sm font-medium">{{ g[1] }}</span>
          </div>
        </div>

        <div class="section-label">年龄：<span class="aurora-text font-semibold">{{ age }} 岁</span></div>
        <van-slider
          v-model="age"
          :min="12"
          :max="80"
          :step="1"
          bar-height="4px"
          active-color="#34d399"
        >
          <template #button>
            <div class="slider-button">{{ age }}</div>
          </template>
        </van-slider>
      </div>

      <!-- Step 2: 身高 + 体重 + 目标体重 -->
      <div v-else-if="currentStep === 2" class="step-pane">
        <h2 class="step-title"><span class="aurora-text">02</span> 身体数据</h2>
        <p class="step-subtitle">用于计算 BMI 与每日营养目标</p>

        <div class="section-label">身高：<span class="aurora-text font-semibold">{{ height }} cm</span></div>
        <van-slider
          v-model="height"
          :min="140"
          :max="210"
          :step="1"
          bar-height="4px"
          active-color="#22d3ee"
          class="mb-6"
        >
          <template #button>
            <div class="slider-button">{{ height }}</div>
          </template>
        </van-slider>

        <div class="section-label">体重：<span class="aurora-text font-semibold">{{ weight }} kg</span></div>
        <van-slider
          v-model="weight"
          :min="30"
          :max="150"
          :step="0.5"
          bar-height="4px"
          active-color="#22d3ee"
          class="mb-6"
        >
          <template #button>
            <div class="slider-button">{{ weight }}</div>
          </template>
        </van-slider>

        <div class="section-label">目标体重：<span class="aurora-text font-semibold">{{ targetWeight }} kg</span></div>
        <van-slider
          v-model="targetWeight"
          :min="30"
          :max="150"
          :step="0.5"
          bar-height="4px"
          active-color="#a78bfa"
        >
          <template #button>
            <div class="slider-button">{{ targetWeight }}</div>
          </template>
        </van-slider>
      </div>

      <!-- Step 3: 目标 + 活动水平 -->
      <div v-else class="step-pane">
        <h2 class="step-title"><span class="aurora-text">03</span> 你的健康目标</h2>
        <p class="step-subtitle">AI 将围绕此目标给出个性化建议</p>

        <div class="section-label">主要目标</div>
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div
            v-for="opt in goalOptions"
            :key="opt.value"
            class="option-card compact press-effect"
            :class="{ active: goal === opt.value }"
            @click="goal = opt.value"
          >
            <span class="text-2xl mb-1">{{ opt.icon }}</span>
            <span class="text-sm font-medium">{{ opt.label }}</span>
            <span class="text-xs text-content-secondary mt-1">{{ opt.desc }}</span>
          </div>
        </div>

        <div class="section-label">活动水平</div>
        <div class="flex flex-col gap-2">
          <div
            v-for="opt in activityOptions"
            :key="opt.value"
            class="option-row press-effect"
            :class="{ active: activityLevel === opt.value }"
            @click="activityLevel = opt.value"
          >
            <div class="flex-1">
              <div class="text-sm font-medium text-content-primary">{{ opt.label }}</div>
              <div class="text-xs text-content-secondary">{{ opt.desc }}</div>
            </div>
            <van-icon v-if="activityLevel === opt.value" name="success" class="text-aurora-green" />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="onboarding-footer safe-area-bottom">
      <AuroraButton
        v-if="currentStep > 1"
        type="glass"
        class="!w-1/3"
        @click="handlePrev"
      >
        上一步
      </AuroraButton>
      <AuroraButton
        :class="currentStep > 1 ? '!w-2/3' : '!w-full'"
        :disabled="!stepValid"
        @click="handleNext"
      >
        {{ currentStep === totalSteps ? '完成建档' : '下一步' }}
      </AuroraButton>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at top right, rgba(52, 211, 153, 0.12) 0%, transparent 45%),
    radial-gradient(ellipse at top left, rgba(34, 211, 238, 0.1) 0%, transparent 45%),
    radial-gradient(ellipse at bottom right, rgba(167, 139, 250, 0.08) 0%, transparent 45%),
    linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
  padding: 0 20px;
}

.onboarding-header {
  padding-top: 20px;
}

.onboarding-header :deep(.van-progress__portion) {
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%) !important;
}

.onboarding-body {
  flex: 1;
  padding: 24px 0;
}

.step-title {
  font-size: 22px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0 0 6px;
}

.step-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 24px;
}

.section-label {
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 12px;
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.option-card.compact {
  padding: 14px 10px;
  min-height: 96px;
}

.option-card.active {
  background: rgba(52, 211, 153, 0.08);
  border-color: rgba(52, 211, 153, 0.4);
  box-shadow: 0 0 20px rgba(52, 211, 153, 0.18);
}

.option-card:active {
  transform: scale(0.98);
}

.option-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.option-row.active {
  background: rgba(52, 211, 153, 0.08);
  border-color: rgba(52, 211, 153, 0.35);
  box-shadow: inset 3px 0 0 #34d399;
}

.option-row:active {
  transform: scale(0.99);
}

.slider-button {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 14px;
  background: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #a78bfa 100%);
  color: #0b1220;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(52, 211, 153, 0.35);
}

.onboarding-footer {
  display: flex;
  gap: 12px;
  padding: 12px 0 16px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 0 -20px;
  padding-left: 20px;
  padding-right: 20px;
}
</style>
