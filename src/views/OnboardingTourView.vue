<script setup lang="ts">
/**
 * 新手引导 + 欢迎动画
 * PRD 7.1：建档完成后的首次使用仪式感
 * 阶段一 tour：功能速览幻灯片（5 大模块介绍）
 * 阶段二 welcome：约 3 秒欢迎动画，用户点击「开始使用」进入首页
 * 仅首次使用触发；本页结束时才调用 markOnboarded，保证整套首启流程原子完成
 * 重设计：Apple 浅色主题，线框图标，极光欢迎动画保留品牌仪式感（Apple 色板）
 */
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'

const router = useRouter()
const userStore = useUserStore()

// ==================== 阶段控制 ====================
const phase = ref<'tour' | 'welcome'>('tour')

// ==================== 功能引导幻灯片 ====================
interface TourSlide {
  icon: string
  title: string
  color: string
  desc: string
}

const slides: TourSlide[] = [
  {
    icon: 'house',
    title: '健康看板',
    color: 'var(--chart-1)',
    desc: '首页一眼掌握今日营养、卡路里与饮水进度，快捷打卡，AI 每日送上专属寄语。'
  },
  {
    icon: 'sparkles',
    title: 'AI 健康顾问',
    color: 'var(--chart-2)',
    desc: '基于你的身体档案流式对话，随时询问饮食、运动、作息问题，获得个性化建议。'
  },
  {
    icon: 'smile',
    title: '心理疏导',
    color: 'var(--chart-5)',
    desc: '倾诉情绪，AI 温柔倾听并感知你的状态；遇到低谷时提供危机干预与求助途径。'
  },
  {
    icon: 'moon',
    title: '睡眠辅助',
    color: 'var(--chart-4)',
    desc: '白噪音混音与呼吸引导助你入睡，记录睡眠后生成专属周报与改善建议。'
  },
  {
    icon: 'utensils',
    title: '健康记录',
    color: 'var(--chart-3)',
    desc: '拍照或输入食物即可 AI 识别，自动计算热量与营养，每一餐轻松打卡。'
  }
]

const currentSlide = ref(0)
const slideDirection = ref<'next' | 'prev'>('next')
const isLastSlide = computed(() => currentSlide.value === slides.length - 1)

const nextSlide = () => {
  if (isLastSlide.value) {
    enterWelcome()
  } else {
    slideDirection.value = 'next'
    currentSlide.value++
  }
}

const prevSlide = () => {
  if (currentSlide.value > 0) {
    slideDirection.value = 'prev'
    currentSlide.value--
  }
}

const goToSlide = (i: number) => {
  slideDirection.value = i > currentSlide.value ? 'next' : 'prev'
  currentSlide.value = i
}

const skipToWelcome = () => {
  enterWelcome()
}

// ==================== 欢迎动画 ====================
const showStartBtn = ref(false)
let welcomeTimer: ReturnType<typeof setTimeout> | null = null

const enterWelcome = () => {
  phase.value = 'welcome'
  // 动画约 3 秒后显示「开始使用」按钮
  welcomeTimer = setTimeout(() => {
    showStartBtn.value = true
  }, 2600)
}

const handleStart = async () => {
  if (welcomeTimer) clearTimeout(welcomeTimer)
  await userStore.markOnboarded()
  router.replace({ name: 'home' })
}

onUnmounted(() => {
  if (welcomeTimer) clearTimeout(welcomeTimer)
})
</script>

<template>
  <div class="tour-screen safe-area-top safe-area-bottom">
    <!-- ==================== 阶段一：功能速览 ==================== -->
    <div v-if="phase === 'tour'" class="tour-phase">
      <div class="tour-header">
        <span class="header-tag">功能速览</span>
        <span class="skip-btn" @click="skipToWelcome">跳过</span>
      </div>

      <div class="slide-stage">
        <Transition :name="slideDirection === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
          <div :key="currentSlide" class="slide-card">
            <div class="slide-icon" :style="{ color: slides[currentSlide].color, boxShadow: `0 8px 32px color-mix(in srgb, ${slides[currentSlide].color} 24%, transparent)` }">
              <AppleIcon :name="slides[currentSlide].icon" :size="56" :stroke-width="1.5" />
            </div>
            <h2 class="slide-title" :style="{ color: slides[currentSlide].color }">
              {{ slides[currentSlide].title }}
            </h2>
            <p class="slide-desc">{{ slides[currentSlide].desc }}</p>
          </div>
        </Transition>
      </div>

      <div class="dots">
        <span
          v-for="(_, i) in slides"
          :key="i"
          class="dot"
          :class="{ active: i === currentSlide }"
          @click="goToSlide(i)"
        />
      </div>

      <div class="tour-footer">
        <AuroraButton v-if="currentSlide > 0" type="secondary" class="!w-1/3" @click="prevSlide">
          上一步
        </AuroraButton>
        <AuroraButton
          :class="currentSlide > 0 ? '!w-2/3' : '!w-full'"
          @click="nextSlide"
        >
          {{ isLastSlide ? '进入欢迎' : '下一步' }}
        </AuroraButton>
      </div>
    </div>

    <!-- ==================== 阶段二：欢迎动画 ==================== -->
    <div v-else class="welcome-phase">
      <div class="welcome-bg"></div>
      <div class="welcome-content">
        <div class="welcome-logo">
          <AppleIcon name="leaf" :size="80" :stroke-width="1.5" />
        </div>
        <h1 class="welcome-title">
          欢迎来到<br />
          <span class="title-brand">微量生活</span>
        </h1>
        <p class="welcome-subtitle">你的私人 AI 健康管家</p>
        <Transition name="fade-up">
          <AuroraButton v-if="showStartBtn" class="welcome-btn" @click="handleStart">
            开始使用
          </AuroraButton>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--background);
  max-width: 480px;
  margin: 0 auto;
}

/* ==================== 功能速览 ==================== */
.tour-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}

.tour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 8px;
}

.header-tag {
  font-size: 12px;
  color: var(--muted-foreground);
}

.skip-btn {
  font-size: 13px;
  color: var(--muted-foreground);
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--secondary);
  transition: all 0.2s ease;
}

.skip-btn:active {
  transform: scale(0.96);
  color: var(--foreground);
}

.slide-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
}

.slide-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 12px;
}

.slide-icon {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 32px;
  background: var(--card);
  border: 1px solid var(--border);
  margin-bottom: 28px;
}

.slide-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 14px;
}

.slide-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted-foreground);
  margin: 0;
  max-width: 280px;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 0 20px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 4px;
  background: var(--muted);
  transition: all 0.3s ease;
  cursor: pointer;
}

.dot.active {
  width: 22px;
  background: var(--primary);
}

.tour-footer {
  display: flex;
  gap: 12px;
  padding: 12px 0 20px;
}

/* 幻灯片切换动画 */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: all 0.32s ease;
}

.slide-next-enter-from {
  transform: translateX(36px);
  opacity: 0;
}

.slide-next-leave-to {
  transform: translateX(-36px);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-36px);
  opacity: 0;
}

.slide-prev-leave-to {
  transform: translateX(36px);
  opacity: 0;
}

/* ==================== 欢迎动画 ==================== */
.welcome-phase {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.welcome-bg {
  position: absolute;
  inset: -20%;
  background: linear-gradient(135deg, var(--chart-1), var(--chart-2), var(--chart-5), var(--chart-3), var(--chart-1));
  background-size: 300% 300%;
  animation: auroraShift 8s ease infinite;
  opacity: 0.12;
  filter: blur(60px);
}

@keyframes auroraShift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.welcome-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 32px;
}

.welcome-logo {
  color: var(--chart-1);
  animation: welcomeLogo 2.4s ease-out both;
  filter: drop-shadow(0 0 24px color-mix(in srgb, var(--chart-1) 40%, transparent));
}

@keyframes welcomeLogo {
  0% {
    transform: scale(0.5) rotate(-12deg);
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.welcome-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.35;
  margin: 28px 0 12px;
  animation: fadeUp 0.9s ease-out 0.9s both;
}

.title-brand {
  color: var(--primary);
}

.welcome-subtitle {
  font-size: 15px;
  color: var(--muted-foreground);
  margin: 0 0 48px;
  animation: fadeUp 0.9s ease-out 1.5s both;
}

.welcome-btn {
  min-width: 200px;
}

@keyframes fadeUp {
  0% {
    transform: translateY(18px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.fade-up-enter-active {
  transition: all 0.5s ease;
}

.fade-up-enter-from {
  transform: translateY(16px);
  opacity: 0;
}
</style>
