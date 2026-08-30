<script setup lang="ts">
/**
 * 首启快速建档流程
 * PRD 7.1：第一次进入 App 时建档（3 步内选完），让后续 AI 建议真正个性化
 * Step 1: 性别 + 年龄
 * Step 2: 身高 + 体重 + 目标体重
 * Step 3: 健康目标 + 活动水平
 * 重设计：Apple 风格浅色主题，实色卡片 + AppleIcon 线框图标
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/store/modules/user'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'
import type { Gender, HealthGoal, ActivityLevel } from '@/types/user'

const router = useRouter()
const userStore = useUserStore()

const currentStep = ref(1)
const totalSteps = 3

// 表单数据
const nickname = ref('')
const gender = ref<Gender | null>(null)
const age = ref(25)
const height = ref(170)
const weight = ref(65)
const targetWeight = ref(60)
const goal = ref<HealthGoal>('maintain')
const activityLevel = ref<ActivityLevel>('moderate')

// 选项配置（图标使用 AppleIcon 名称，与 constants/user.ts 保持一致）
const goalOptions: { value: HealthGoal; label: string; icon: string; desc: string }[] = [
  { value: 'lose_fat', label: '减脂塑形', icon: 'flame', desc: '减少体脂，线条更清晰' },
  { value: 'gain_muscle', label: '增肌增重', icon: 'dumbbell', desc: '增加肌肉，提升力量' },
  { value: 'maintain', label: '保持健康', icon: 'target', desc: '维持现状，均衡饮食' },
  { value: 'improve_sleep', label: '改善睡眠', icon: 'moon', desc: '提升睡眠质量' },
  { value: 'relieve_stress', label: '缓解压力', icon: 'leaf', desc: '放松身心，调节情绪' }
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
  if (currentStep.value === 1) return gender.value !== null && nickname.value.trim().length > 0
  if (currentStep.value === 2) return height.value > 0 && weight.value > 0
  return true
})

const progressPercent = computed(() => (currentStep.value / totalSteps) * 100)

const handleNext = () => {
  if (!stepValid.value) {
    if (currentStep.value === 1) {
      showToast(!nickname.value.trim() ? '请输入昵称' : '请选择性别')
    } else {
      showToast('请填写身高体重')
    }
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
    nickname: nickname.value.trim(),
    gender: gender.value,
    age: age.value,
    height: height.value,
    weight: weight.value,
    targetWeight: targetWeight.value,
    goal: goal.value,
    activityLevel: activityLevel.value
  })
  // 不在此处 markOnboarded：先进入新手引导 + 欢迎动画，待用户点击「开始使用」再标记完成
  showToast({ message: '建档成功', type: 'success' })
  router.replace({ name: 'onboarding-tour' })
}
</script>

<template>
  <div class="onboarding safe-area-top safe-area-bottom">
    <!-- 顶部进度 -->
    <div class="onboarding-header">
      <div class="header-row">
        <span class="step-count">{{ currentStep }} / {{ totalSteps }}</span>
        <span class="step-tag">微量生活 · 建档</span>
      </div>
      <van-progress
        :percentage="progressPercent"
        stroke-width="4"
        color="var(--chart-1)"
        track-color="var(--muted)"
        :show-pivot="false"
      />
    </div>

    <!-- 步骤内容 -->
    <div class="onboarding-body stagger-fade-up">
      <!-- Step 1: 性别 + 年龄 -->
      <div v-if="currentStep === 1" class="step-pane">
        <h2 class="step-title"><span class="step-index">01</span> 先了解一下你</h2>
        <p class="step-subtitle">性别与年龄影响营养与运动建议</p>

        <div class="section-label">昵称</div>
        <input
          v-model="nickname"
          class="nickname-input"
          type="text"
          maxlength="12"
          placeholder="给自己起个名字"
        />

        <div class="section-label mt-6">性别</div>
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div
            v-for="g in ([['male', '男'], ['female', '女']] as [Gender, string][])"
            :key="g[0]"
            class="option-card press-effect"
            :class="{ active: gender === g[0] }"
            @click="gender = g[0]"
          >
            <AppleIcon name="user" :size="28" class="option-icon" />
            <span class="option-text">{{ g[1] }}</span>
          </div>
        </div>

        <div class="section-label">年龄：<span class="value-highlight">{{ age }} 岁</span></div>
        <van-slider
          v-model="age"
          :min="12"
          :max="80"
          :step="1"
          bar-height="4px"
          active-color="var(--chart-1)"
        >
          <template #button>
            <div class="slider-button">{{ age }}</div>
          </template>
        </van-slider>
      </div>

      <!-- Step 2: 身高 + 体重 + 目标体重 -->
      <div v-else-if="currentStep === 2" class="step-pane">
        <h2 class="step-title"><span class="step-index">02</span> 身体数据</h2>
        <p class="step-subtitle">用于计算 BMI 与每日营养目标</p>

        <div class="section-label">身高：<span class="value-highlight">{{ height }} cm</span></div>
        <van-slider
          v-model="height"
          :min="140"
          :max="210"
          :step="1"
          bar-height="4px"
          active-color="var(--chart-2)"
          class="mb-6"
        >
          <template #button>
            <div class="slider-button">{{ height }}</div>
          </template>
        </van-slider>

        <div class="section-label">体重：<span class="value-highlight">{{ weight }} kg</span></div>
        <van-slider
          v-model="weight"
          :min="30"
          :max="150"
          :step="0.5"
          bar-height="4px"
          active-color="var(--chart-2)"
          class="mb-6"
        >
          <template #button>
            <div class="slider-button">{{ weight }}</div>
          </template>
        </van-slider>

        <div class="section-label">目标体重：<span class="value-highlight">{{ targetWeight }} kg</span></div>
        <van-slider
          v-model="targetWeight"
          :min="30"
          :max="150"
          :step="0.5"
          bar-height="4px"
          active-color="var(--chart-4)"
        >
          <template #button>
            <div class="slider-button">{{ targetWeight }}</div>
          </template>
        </van-slider>
      </div>

      <!-- Step 3: 目标 + 活动水平 -->
      <div v-else class="step-pane">
        <h2 class="step-title"><span class="step-index">03</span> 你的健康目标</h2>
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
            <AppleIcon :name="opt.icon" :size="24" class="option-icon" />
            <span class="option-text">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
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
              <div class="row-label">{{ opt.label }}</div>
              <div class="row-desc">{{ opt.desc }}</div>
            </div>
            <AppleIcon v-if="activityLevel === opt.value" name="circle-check" :size="20" class="row-check" />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="onboarding-footer safe-area-bottom">
      <AuroraButton
        v-if="currentStep > 1"
        type="secondary"
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
  background: var(--background);
  padding: 0 20px;
  max-width: 480px;
  margin: 0 auto;
}

.onboarding-header {
  padding-top: 20px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.step-count {
  font-size: 14px;
  color: var(--primary);
  font-weight: 600;
}

.step-tag {
  font-size: 12px;
  color: var(--muted-foreground);
}

.onboarding-body {
  flex: 1;
  padding: 24px 0;
}

.step-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 6px;
}

.step-index {
  color: var(--primary);
  margin-right: 4px;
}

.step-subtitle {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0 0 24px;
}

.section-label {
  font-size: 14px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}

.value-highlight {
  color: var(--primary);
  font-weight: 600;
}

.nickname-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 16px;
  color: var(--foreground);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s ease;
  outline: none;
}
.nickname-input::placeholder {
  color: var(--muted-foreground);
}
.nickname-input:focus {
  border-color: var(--primary);
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  cursor: pointer;
}

.option-card.compact {
  padding: 14px 10px;
  min-height: 96px;
}

.option-icon {
  color: var(--muted-foreground);
  transition: color 0.2s ease;
}

.option-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}

.option-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
  text-align: center;
}

.option-card.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.option-card.active .option-icon {
  color: var(--primary);
}

.option-card:active {
  transform: scale(0.98);
}

.option-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  cursor: pointer;
}

.option-row.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.row-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}

.row-desc {
  font-size: 12px;
  color: var(--muted-foreground);
}

.row-check {
  color: var(--primary);
}

.option-row:active {
  transform: scale(0.99);
}

.slider-button {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 14px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.onboarding-footer {
  display: flex;
  gap: 12px;
  padding: 12px 0 16px;
  border-top: 1px solid var(--border);
  background: var(--background);
}
</style>
