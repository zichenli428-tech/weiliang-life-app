<script setup lang="ts">
/**
 * 我的页面（Tab 4）
 * PRD 3.4：身体档案、目标设定、设置 | 动态调整 AI 回答策略
 * PRD 7.1：首启建档后的档案管理与重建
 * 重设计：深灰蓝暗色玻璃风格
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/store/modules/user'
import { useDietStore } from '@/store/modules/diet'
import { useSleepStore } from '@/store/modules/sleep'
import { useChatStore } from '@/store/modules/chat'
import { useMindStore } from '@/store/modules/mind'
import { clearStore } from '@/utils/storage'
import { genderLabels, goalLabels, activityLabels, getBmiLevel } from '@/constants/user'
import GlassCard from '@/components/GlassCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import AuroraButton from '@/components/AuroraButton.vue'

const router = useRouter()
const userStore = useUserStore()
const dietStore = useDietStore()
const sleepStore = useSleepStore()
const chatStore = useChatStore()
const mindStore = useMindStore()

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
  age?: number
  height?: number
  weight?: number
  targetWeight?: number
}
const editForm = ref<EditForm>({})

const openEdit = () => {
  editForm.value = {
    nickname: profile.value.nickname,
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

// ==================== 重建档案 / 清空数据 ====================
const handleRebuild = () => {
  showConfirmDialog({
    title: '重建档案',
    message: '将清空当前档案并重新进入建档流程，确定吗？',
    confirmButtonColor: '#64748b'
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
	    confirmButtonColor: '#fb7185'
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
      <div class="flex items-center gap-4">
        <div class="avatar">{{ profile.nickname?.charAt(0) || '健' }}</div>
        <div class="flex-1">
          <div class="text-xl font-semibold text-white">{{ profile.nickname || '健康用户' }}</div>
          <div class="text-sm text-white/80 mt-1">
            {{ goalLabel ? `${goalLabel.icon} ${goalLabel.label}` : '未设定目标' }}
          </div>
        </div>
        <AuroraButton size="sm" type="glass" @click="openEdit">编辑</AuroraButton>
      </div>

      <!-- BMI 卡片 -->
      <GlassCard padding="md" glow="profile" class="bmi-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs text-content-secondary">BMI 指数</div>
            <div class="text-3xl font-bold text-content-primary mt-1">{{ userStore.bmi ?? '-' }}</div>
          </div>
          <div class="bmi-tag" :style="{ background: bmiLevel.color }">
            {{ bmiLevel.label }}
          </div>
        </div>
        <div class="text-xs text-content-secondary mt-2">
          身高 {{ profile.height ?? '-' }}cm · 体重 {{ profile.weight ?? '-' }}kg · 目标 {{ profile.targetWeight ?? '-' }}kg
        </div>
      </GlassCard>
    </div>

    <!-- 身体档案 -->
    <div class="page-body stagger-fade-up">
      <SectionTitle title="身体档案" icon="📋" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell title="昵称" :value="profile.nickname || '-'" />
          <van-cell title="性别" :value="profile.gender ? genderLabels[profile.gender] : '-'" />
          <van-cell title="年龄" :value="profile.age ? `${profile.age} 岁` : '-'" />
          <van-cell title="身高" :value="profile.height ? `${profile.height} cm` : '-'" />
          <van-cell title="体重" :value="profile.weight ? `${profile.weight} kg` : '-'" />
          <van-cell title="目标体重" :value="profile.targetWeight ? `${profile.targetWeight} kg` : '-'" />
        </van-cell-group>
      </GlassCard>

      <!-- 目标设定 -->
      <SectionTitle title="目标设定" icon="🎯" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell
            title="健康目标"
            :value="goalLabel ? `${goalLabel.icon} ${goalLabel.label}` : '-'"
            :label="goalLabel?.desc"
          />
          <van-cell
            title="活动水平"
            :value="activityLabel?.label || '-'"
            :label="activityLabel?.desc"
          />
        </van-cell-group>
      </GlassCard>

      <!-- 设置 -->
      <SectionTitle title="设置" icon="⚙️" class="px-4" />
      <GlassCard padding="none" class="mx-4 mb-4">
        <van-cell-group inset>
          <van-cell title="重建档案" label="重新进入建档流程" is-link @click="handleRebuild" />
          <van-cell title="关于微量生活" label="版本 v1.0.0-dev.lizichen" />
          <van-cell title="清空所有数据" label="清除档案与本地记录" is-link @click="handleClearAll">
            <template #right-icon>
              <van-icon name="warning-o" class="text-status-danger ml-1" />
            </template>
          </van-cell>
        </van-cell-group>
      </GlassCard>

      <p class="text-xs text-content-tertiary text-center mt-6 px-6">
        数据仅存储在本地浏览器（IndexedDB），不上传服务器
      </p>
      <p class="text-xs text-content-tertiary text-center mt-2 px-6">
        本软件的AI大模型服务由商汤日日新sensenova-6.7-flash-lite提供
      </p>
    </div>

    <!-- 编辑弹窗 -->
    <van-popup
      v-model:show="editVisible"
      position="bottom"
      round
      closeable
      :style="{ height: '60%' }"
    >
      <div class="edit-popup">
        <div class="edit-title">编辑档案</div>
        <GlassCard padding="none" class="mx-4">
          <van-cell-group inset>
            <van-field v-model="editForm.nickname" label="昵称" placeholder="请输入昵称" />
            <van-field
              v-model.number="editForm.age"
              type="digit"
              label="年龄"
              placeholder="年龄"
            />
            <van-field
              v-model.number="editForm.height"
              type="number"
              label="身高(cm)"
              placeholder="身高"
            />
            <van-field
              v-model.number="editForm.weight"
              type="number"
              label="体重(kg)"
              placeholder="体重"
            />
            <van-field
              v-model.number="editForm.targetWeight"
              type="number"
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
  </div>
</template>

<style scoped>
.profile-page {
  background-color: #0b1220;
}

.profile-hero {
  position: relative;
  padding: 20px 16px 24px;
  background:
    radial-gradient(ellipse at top right, rgba(100, 116, 139, 0.2) 0%, transparent 55%),
    linear-gradient(135deg, #475569 0%, #1e293b 100%);
  overflow: hidden;
}

.profile-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, transparent 100%);
  pointer-events: none;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.08);
}

.bmi-card {
  margin-top: 20px;
}

.bmi-tag {
  padding: 4px 12px;
  border-radius: 12px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.edit-popup {
  padding: 16px 0;
}

.edit-title {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
  text-align: center;
  padding: 8px 0 16px;
}

.edit-footer {
  padding: 20px 16px 0;
}
</style>
