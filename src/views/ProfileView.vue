<script setup lang="ts">
/**
 * 我的页面（Tab 4）
 * PRD 3.4：身体档案、目标设定、设置 | 动态调整 AI 回答策略
 * PRD 7.1：首启建档后的档案管理与重建
 * 重设计：Apple 风格浅色主题，实色卡片 + AppleIcon 线框图标
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import { useUserStore } from '@/store/modules/user'
import { useDietStore } from '@/store/modules/diet'
import { useSleepStore } from '@/store/modules/sleep'
import { useChatStore } from '@/store/modules/chat'
import { useMindStore } from '@/store/modules/mind'
import { clearStore } from '@/utils/storage'
import { useFeatureTutorial } from '@/composables/useFeatureTutorial'
import { genderLabels, goalLabels, activityLabels, getBmiLevel } from '@/constants/user'
import type { Gender, HealthGoal, ActivityLevel } from '@/types/user'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AuroraButton from '@/components/AuroraButton.vue'
import AppleIcon from '@/components/AppleIcon.vue'

const router = useRouter()
const userStore = useUserStore()
const dietStore = useDietStore()
const sleepStore = useSleepStore()
const chatStore = useChatStore()
const mindStore = useMindStore()
const { resetTutorial } = useFeatureTutorial()

// ==================== 档案展示 ====================
const profile = computed(() => userStore.profile)
const bmiLevel = computed(() => getBmiLevel(userStore.bmi))
const goalLabel = computed(() => (profile.value.goal ? goalLabels[profile.value.goal] : null))
const activityLabel = computed(() =>
  profile.value.activityLevel ? activityLabels[profile.value.activityLevel] : null
)

// ==================== 编辑弹窗 ====================
const editVisible = ref(false)
type EditForm = {
  nickname?: string
  gender?: Gender | null
  age?: number
  height?: number
  weight?: number
  targetWeight?: number
}
const editForm = ref<EditForm>({})

const openEdit = () => {
  editForm.value = {
    nickname: profile.value.nickname,
    gender: profile.value.gender,
    height: profile.value.height ?? undefined,
    weight: profile.value.weight ?? undefined,
    targetWeight: profile.value.targetWeight ?? undefined,
    age: profile.value.age ?? undefined
  }
  editVisible.value = true
}

const handleSaveEdit = async () => {
  // 输入范围校验，防止 BMI 除零和 AI prompt 污染
  const { age, height, weight, targetWeight } = editForm.value
  if (age !== undefined && (age < 5 || age > 120 || !Number.isFinite(age))) {
    showToast('年龄请在 5-120 岁之间')
    return
  }
  if (height !== undefined && (height < 80 || height > 250 || !Number.isFinite(height))) {
    showToast('身高请在 80-250 cm 之间')
    return
  }
  if (weight !== undefined && (weight < 20 || weight > 300 || !Number.isFinite(weight))) {
    showToast('体重请在 20-300 kg 之间')
    return
  }
  if (targetWeight !== undefined && (targetWeight < 20 || targetWeight > 300 || !Number.isFinite(targetWeight))) {
    showToast('目标体重请在 20-300 kg 之间')
    return
  }
  await userStore.saveProfile(editForm.value)
  editVisible.value = false
  showToast({ type: 'success', message: '档案已更新' })
}

// ==================== 目标设定编辑弹窗 ====================
const goalEditVisible = ref(false)
type GoalEditForm = {
  goal: HealthGoal
  activityLevel: ActivityLevel
}
const goalEditForm = ref<GoalEditForm>({ goal: 'maintain', activityLevel: 'sedentary' })

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

const openGoalEdit = () => {
  goalEditForm.value = {
    goal: profile.value.goal,
    activityLevel: profile.value.activityLevel
  }
  goalEditVisible.value = true
}

const handleSaveGoalEdit = async () => {
  await userStore.saveProfile({
    goal: goalEditForm.value.goal,
    activityLevel: goalEditForm.value.activityLevel
  })
  goalEditVisible.value = false
  showToast({ type: 'success', message: '目标已更新' })
}

// ==================== 重新观看教程 ====================
const replaying = ref(false)
const tutorialOptions = [
  { label: '饮食记录教程', value: 'record', route: '/record' },
  { label: '睡眠辅助教程', value: 'sleep', route: '/sleep' }
]

const handleReplayTutorial = () => {
  if (replaying.value) return
  showConfirmDialog({
    title: '重新观看教程',
    message: '将重新播放「饮食记录」和「睡眠辅助」的功能教程，是否继续？',
    confirmButtonColor: '#007AFF',
    confirmButtonText: '重新观看',
    cancelButtonText: '取消'
  })
    .then(async () => {
      replaying.value = true
      showLoadingToast({ message: '正在重置教程...', forbidClick: true, duration: 0 })
      await Promise.all(tutorialOptions.map((opt) => resetTutorial(opt.value)))
      closeToast()
      showToast({ type: 'success', message: '教程已重置，即将开始' })
      setTimeout(() => {
        router.push('/record')
        replaying.value = false
      }, 800)
    })
    .catch(() => {})
}

// ==================== 重建档案 / 清空数据 ====================
const handleRebuild = () => {
  showConfirmDialog({
    title: '重建档案',
    message: '将清空当前档案并重新进入建档流程，确定吗？',
    confirmButtonColor: '#007AFF'
  })
    .then(async () => {
      await userStore.resetProfile()
      router.replace({ name: 'onboarding' })
    })
    .catch(() => {})
}

const handleClearAll = () => {
	  showConfirmDialog({
	    title: '清空所有数据',
	    message: '将清除身体档案与所有本地记录（饮食/睡眠/心理日记/聊天历史），此操作不可恢复！',
	    confirmButtonColor: '#ff3b30'
	  })
	    .then(async () => {
	      // 清空 localStorage 中的缓存数据（打卡、每日寄语、免责声明）
	      const keysToRemove: string[] = []
	      for (let i = 0; i < localStorage.length; i++) {
	        const key = localStorage.key(i)
	        if (key && (key.startsWith('checkins_') || key.startsWith('ai_daily_') || key === 'mind_disclaimer_accepted')) {
	          keysToRemove.push(key)
	        }
	      }
	      keysToRemove.forEach((k) => localStorage.removeItem(k))
	      // 清空所有业务 store 的内存数据
	      await Promise.all([
	        userStore.resetProfile(),
	        dietStore.clearAll(),
	        sleepStore.clearAll(),
	        chatStore.clearAll(),
	        mindStore.clearAll()
	      ])
	      // 清空 IndexedDB 中未被 store 覆盖的 objectStore（食物库/离线队列/情绪）
	      await Promise.all([
	        clearStore('foodDB'),
	        clearStore('pending'),
	        clearStore('mood')
	      ])
	      showToast({ type: 'success', message: '已清空，重新建档' })
	      router.replace({ name: 'onboarding' })
	    })
	    .catch(() => {})
	}
</script>

<template>
  <div class="page-container profile-page">
    <!-- 顶部用户卡片 -->
    <div class="profile-hero safe-area-top">
      <div class="hero-row">
        <div class="avatar">{{ profile.nickname?.charAt(0) || '健' }}</div>
        <div class="hero-info">
          <div class="hero-name">{{ profile.nickname || '健康用户' }}</div>
          <div v-if="goalLabel" class="hero-goal">
            <AppleIcon :name="goalLabel.icon" :size="13" />
            <span>{{ goalLabel.label }}</span>
          </div>
          <div v-else class="hero-goal">未设定目标</div>
        </div>
        <AuroraButton size="sm" type="secondary" @click="openEdit">编辑</AuroraButton>
      </div>

      <!-- BMI 卡片 -->
      <GlassCard padding="md" class="bmi-card">
        <div class="bmi-row">
          <div>
            <div class="bmi-label">BMI 指数</div>
            <div class="bmi-value">{{ userStore.bmi ?? '-' }}</div>
          </div>
          <div class="bmi-tag" :style="{ background: bmiLevel.color }">
            {{ bmiLevel.label }}
          </div>
        </div>
        <div class="bmi-meta">
          身高 {{ profile.height ?? '-' }}cm · 体重 {{ profile.weight ?? '-' }}kg · 目标 {{ profile.targetWeight ?? '-' }}kg
        </div>
      </GlassCard>
    </div>

    <!-- 身体档案 -->
    <div class="page-body stagger-fade-up">
      <SectionTitle title="身体档案" icon="clipboard-list" color="var(--chart-2)" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell title="昵称" :value="profile.nickname || '-'" />
          <van-cell title="性别" :value="profile.gender ? genderLabels[profile.gender] : '-'" />
          <van-cell title="年龄" :value="profile.age ? `${profile.age} 岁` : '-'" />
          <van-cell title="身高" :value="profile.height ? `${profile.height} cm` : '-'" />
          <van-cell title="体重" :value="profile.weight ? `${profile.weight} kg` : '-'" />
          <van-cell title="目标体重" :value="profile.targetWeight ? `${profile.targetWeight} kg` : '-'" />
          <van-cell title="编辑身体档案" is-link @click="openEdit" />
        </van-cell-group>
      </GlassCard>

      <!-- 目标设定 -->
      <SectionTitle title="目标设定" icon="target" color="var(--chart-1)" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell title="健康目标" :label="goalLabel?.desc">
            <template #value>
              <span v-if="goalLabel" class="goal-value">
                <AppleIcon :name="goalLabel.icon" :size="14" />
                <span>{{ goalLabel.label }}</span>
              </span>
              <span v-else>-</span>
            </template>
          </van-cell>
          <van-cell
            title="活动水平"
            :value="activityLabel?.label || '-'"
            :label="activityLabel?.desc"
          />
          <van-cell title="编辑目标设定" is-link @click="openGoalEdit" />
        </van-cell-group>
      </GlassCard>

      <!-- 设置 -->
      <SectionTitle title="设置" icon="settings" color="var(--muted-foreground)" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell title="重建档案" label="重新进入建档流程" is-link @click="handleRebuild" />
          <van-cell title="重新观看教程" label="饮食记录与睡眠辅助功能教程" is-link @click="handleReplayTutorial" />
          <van-cell title="关于微量生活" label="版本 v1.2.0" />
          <van-cell title="清空所有数据" label="清除档案与本地记录" is-link @click="handleClearAll">
            <template #right-icon>
              <AppleIcon name="triangle-alert" :size="16" class="danger-icon" />
            </template>
          </van-cell>
        </van-cell-group>
      </GlassCard>

      <p class="footer-note">
        数据仅存储在本地浏览器（IndexedDB），不上传服务器
      </p>
      <p class="footer-note sub">
        本软件的AI大模型服务由 OpenCode Zen mimo-v2.5-free 提供
      </p>
    </div>

    <!-- 编辑弹窗 -->
    <van-popup
      v-model:show="editVisible"
      position="bottom"
      round
      closeable
      :style="{ height: '65dvh' }"
    >
      <div class="edit-popup">
        <div class="edit-title">编辑档案</div>
        <GlassCard padding="none" class="mx-4">
          <van-cell-group inset>
            <van-field v-model="editForm.nickname" label="昵称" placeholder="请输入昵称" />
            <van-field label="性别" readonly>
              <template #input>
                <div class="gender-chips">
                  <div
                    v-for="g in ([['male', '男'], ['female', '女']] as [Gender, string][])"
                    :key="g[0]"
                    class="gender-chip"
                    :class="{ active: editForm.gender === g[0] }"
                    @click="editForm.gender = g[0]"
                  >
                    {{ g[1] }}
                  </div>
                </div>
              </template>
            </van-field>
            <van-field
              v-model.number="editForm.age"
              type="digit"
              inputmode="numeric"
              label="年龄"
              placeholder="年龄"
            />
            <van-field
              v-model.number="editForm.height"
              type="digit"
              inputmode="numeric"
              label="身高(cm)"
              placeholder="身高"
            />
            <van-field
              v-model.number="editForm.weight"
              type="digit"
              inputmode="decimal"
              label="体重(kg)"
              placeholder="体重"
            />
            <van-field
              v-model.number="editForm.targetWeight"
              type="digit"
              inputmode="decimal"
              label="目标体重(kg)"
              placeholder="目标体重"
            />
          </van-cell-group>
        </GlassCard>
        <div class="edit-footer">
          <AuroraButton block @click="handleSaveEdit">保存</AuroraButton>
        </div>
      </div>
    </van-popup>

    <!-- 目标设定编辑弹窗 -->
    <van-popup
      v-model:show="goalEditVisible"
      position="bottom"
      round
      closeable
      :style="{ height: '80dvh' }"
    >
      <div class="edit-popup goal-edit-popup">
        <div class="edit-title">编辑目标设定</div>
        <div class="goal-edit-body">
          <!-- 健康目标 -->
          <div class="goal-edit-section">
            <div class="goal-edit-label">健康目标</div>
            <div class="goal-grid">
              <div
                v-for="opt in goalOptions"
                :key="opt.value"
                class="goal-option-card"
                :class="{ active: goalEditForm.goal === opt.value }"
                @click="goalEditForm.goal = opt.value"
              >
                <AppleIcon :name="opt.icon" :size="22" class="goal-option-icon" />
                <span class="goal-option-label">{{ opt.label }}</span>
                <span class="goal-option-desc">{{ opt.desc }}</span>
              </div>
            </div>
          </div>
          <!-- 活动水平 -->
          <div class="goal-edit-section">
            <div class="goal-edit-label">活动水平</div>
            <div class="activity-list">
              <div
                v-for="opt in activityOptions"
                :key="opt.value"
                class="activity-option-row"
                :class="{ active: goalEditForm.activityLevel === opt.value }"
                @click="goalEditForm.activityLevel = opt.value"
              >
                <div class="activity-info">
                  <div class="activity-label">{{ opt.label }}</div>
                  <div class="activity-desc">{{ opt.desc }}</div>
                </div>
                <AppleIcon
                  v-if="goalEditForm.activityLevel === opt.value"
                  name="circle-check"
                  :size="20"
                  class="activity-check"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="edit-footer">
          <AuroraButton block @click="handleSaveGoalEdit">保存</AuroraButton>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.profile-page {
  background-color: var(--background);
  max-width: 480px;
  margin: 0 auto;
}

.profile-hero {
  padding: 20px 16px 24px;
  background: var(--background);
}

.hero-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--secondary);
  border: 1px solid var(--border);
  color: var(--foreground);
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.hero-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--foreground);
}

.hero-goal {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--muted-foreground);
}

.bmi-card {
  margin-top: 20px;
}

.bmi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bmi-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.bmi-value {
  font-size: 30px;
  font-weight: 700;
  color: var(--foreground);
  margin-top: 4px;
  line-height: 1.1;
}

.bmi-tag {
  padding: 4px 12px;
  border-radius: 12px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.bmi-meta {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 8px;
}

.goal-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.danger-icon {
  color: var(--destructive);
  margin-left: 4px;
}

.footer-note {
  font-size: 12px;
  color: var(--muted-foreground);
  text-align: center;
  margin: 24px 16px 0;
}

.footer-note.sub {
  margin-top: 8px;
}

.edit-popup {
  padding: 16px 0;
}

.edit-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  text-align: center;
  padding: 8px 0 16px;
}

.edit-footer {
  padding: 20px 16px 0;
  flex-shrink: 0;
}

/* 性别选择 chips */
.gender-chips {
  display: flex;
  gap: 8px;
}
.gender-chip {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: var(--radius-md);
  background: var(--accent);
  border: 1.5px solid transparent;
  font-size: 14px;
  color: var(--muted-foreground);
  transition: all 0.2s;
  cursor: pointer;
}
.gender-chip.active {
  background: var(--tint-chart-1-10);
  border-color: var(--chart-1);
  color: var(--chart-1);
  font-weight: 600;
}

/* 目标设定编辑弹窗 */
.goal-edit-popup {
  padding: 16px 0 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.goal-edit-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
  -webkit-overflow-scrolling: touch;
}
.goal-edit-section {
  margin-bottom: 20px;
}
.goal-edit-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 10px;
}
.goal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.goal-option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 10px;
  min-height: 96px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.2s;
  cursor: pointer;
}
.goal-option-card:active {
  transform: scale(0.98);
}
.goal-option-card.active {
  border-color: var(--chart-1);
  background: var(--tint-chart-1-10);
}
.goal-option-icon {
  color: var(--muted-foreground);
  transition: color 0.2s;
}
.goal-option-card.active .goal-option-icon {
  color: var(--chart-1);
}
.goal-option-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}
.goal-option-desc {
  font-size: 11px;
  color: var(--muted-foreground);
  text-align: center;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-option-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  transition: all 0.2s;
  cursor: pointer;
}
.activity-option-row:active {
  transform: scale(0.99);
}
.activity-option-row.active {
  border-color: var(--chart-1);
  background: var(--tint-chart-1-10);
}
.activity-info {
  flex: 1;
}
.activity-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}
.activity-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.activity-check {
  color: var(--chart-1);
  flex-shrink: 0;
}
</style>
