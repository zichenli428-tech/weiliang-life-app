<script setup lang="ts">
/**
 * 白噪音混音台
 * PRD 3.2：多音轨同时播放、独立音量控制、定时关闭（淡出停止）
 *
 * 技术实现：Web Audio API 播放真实音频文件（mp3）
 * - 首次播放时 fetch + decodeAudioData 加载并缓存 AudioBuffer
 * - AudioBufferSourceNode 循环播放，GainNode 控制独立音量
 * - 定时关闭时统一淡出停止
 */
import { ref, computed, onUnmounted } from 'vue'
import { whiteNoiseTracks, type WhiteNoiseTrack } from '@/types/sleep'

interface ActiveTrack {
  track: WhiteNoiseTrack
  gainNode: GainNode
  source: AudioBufferSourceNode
  volume: number
}

const audioContext = ref<AudioContext | null>(null)
const activeTracks = ref<Map<string, ActiveTrack>>(new Map())
const bufferCache = ref<Map<string, AudioBuffer>>(new Map())
const loadingTracks = ref<Set<string>>(new Set())
const timerMinutes = ref(0)
const timerRemaining = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null
let fadeInterval: ReturnType<typeof setInterval> | null = null

/** 确保 AudioContext 已初始化（需用户交互后创建） */
function ensureAudioContext(): AudioContext {
  if (!audioContext.value) {
    audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioContext.value.state === 'suspended') {
    audioContext.value.resume()
  }
  return audioContext.value
}

/** 加载音频文件为 AudioBuffer（带缓存） */
async function loadAudioBuffer(ctx: AudioContext, track: WhiteNoiseTrack): Promise<AudioBuffer> {
  const cached = bufferCache.value.get(track.id)
  if (cached) return cached

  const response = await fetch(track.src)
  if (!response.ok) {
    throw new Error(`音频加载失败: ${track.name} (${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  bufferCache.value.set(track.id, audioBuffer)
  return audioBuffer
}

/** 切换音轨播放/停止 */
async function toggleTrack(track: WhiteNoiseTrack): Promise<void> {
  const ctx = ensureAudioContext()
  const existing = activeTracks.value.get(track.id)

  if (existing) {
    // 停止该音轨
    existing.source.stop()
    existing.source.disconnect()
    existing.gainNode.disconnect()
    activeTracks.value.delete(track.id)
    updateActiveState()
    return
  }

  // 加载并播放
  if (loadingTracks.value.has(track.id)) return
  loadingTracks.value.add(track.id)

  try {
    const buffer = await loadAudioBuffer(ctx, track)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.3
    source.connect(gainNode).connect(ctx.destination)
    source.start()

    activeTracks.value.set(track.id, {
      track,
      gainNode,
      source,
      volume: 0.3
    })
    updateActiveState()
  } catch (error) {
    console.error('[WhiteNoiseMixer] 播放失败:', track.id, error)
  } finally {
    loadingTracks.value.delete(track.id)
  }
}

/** 调整音轨音量 */
function setVolume(trackId: string, volume: number): void {
  const active = activeTracks.value.get(trackId)
  if (active && audioContext.value) {
    active.volume = volume
    active.gainNode.gain.setTargetAtTime(volume, audioContext.value.currentTime, 0.05)
  }
}

/** 某音轨是否正在播放 */
function isTrackActive(trackId: string): boolean {
  return activeTracks.value.has(trackId)
}

/** 某音轨是否正在加载 */
function isTrackLoading(trackId: string): boolean {
  return loadingTracks.value.has(trackId)
}

/** 获取音轨音量 */
function getTrackVolume(trackId: string): number {
  return activeTracks.value.get(trackId)?.volume ?? 0.3
}

/** 是否有音轨在播放 */
const hasActiveTracks = ref(false)
function updateActiveState(): void {
  hasActiveTracks.value = activeTracks.value.size > 0
}

/** 停止所有音轨 */
function stopAll(): void {
  if (!audioContext.value) return
  activeTracks.value.forEach((active) => {
    active.source.stop()
    active.source.disconnect()
    active.gainNode.disconnect()
  })
  activeTracks.value.clear()
  clearTimer()
  hasActiveTracks.value = false
}

/** 定时关闭 */
function startTimer(minutes: number): void {
  clearTimer()
  if (minutes === 0) return
  timerMinutes.value = minutes
  timerRemaining.value = minutes * 60
  timerInterval = setInterval(() => {
    timerRemaining.value--
    if (timerRemaining.value <= 0) {
      clearTimer()
      fadeOutAndStop()
    }
  }, 1000)
}

/** 清除定时器 */
function clearTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }
  timerMinutes.value = 0
  timerRemaining.value = 0
}

/** 淡出停止（PRD 3.2：定时关闭淡出停止） */
function fadeOutAndStop(): void {
  if (!audioContext.value) {
    stopAll()
    return
  }
  const ctx = audioContext.value
  const fadeDuration = 3 // 3 秒淡出

  activeTracks.value.forEach((active) => {
    active.gainNode.gain.setTargetAtTime(0, ctx.currentTime, fadeDuration / 2)
  })

  fadeInterval = setInterval(() => {
    stopAll()
  }, fadeDuration * 1000)
}

/** 格式化剩余时间 */
const timerDisplay = computed(() => {
  const mins = Math.floor(timerRemaining.value / 60)
  const secs = timerRemaining.value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const timerOptions = [0, 15, 30, 60]

onUnmounted(() => {
  stopAll()
  if (audioContext.value) {
    audioContext.value.close()
    audioContext.value = null
  }
})
</script>

<template>
  <div class="noise-mixer">
    <div class="mixer-header">
      <div class="text-xs text-content-secondary">可同时播放多个音轨，混合出专属助眠白噪音</div>
      <div v-if="hasActiveTracks" class="mixer-stop" @click="stopAll">全部停止</div>
    </div>

    <!-- 音轨网格 -->
    <div class="track-grid">
      <div
        v-for="track in whiteNoiseTracks"
        :key="track.id"
        class="track-card"
        :class="{ active: isTrackActive(track.id) }"
        :style="isTrackActive(track.id) ? { borderColor: track.color, boxShadow: `0 0 16px ${track.color}33` } : {}"
        @click="toggleTrack(track)"
      >
        <div class="track-icon" :style="{ background: isTrackActive(track.id) ? track.color : 'rgba(255,255,255,0.08)' }">
          <span v-if="isTrackLoading(track.id)" class="loading-spinner"></span>
          <span v-else>{{ track.icon }}</span>
        </div>
        <div class="track-name">{{ track.name }}</div>

        <!-- 音量控制（仅播放中显示） -->
        <div v-if="isTrackActive(track.id)" class="track-volume" @click.stop>
          <van-slider
            :model-value="getTrackVolume(track.id)"
            :min="0"
            :max="1"
            :step="0.05"
            bar-color="#818cf8"
            inactive-color="rgba(255,255,255,0.08)"
            @update:model-value="(v: number) => setVolume(track.id, v)"
          />
        </div>
      </div>
    </div>

    <!-- 定时关闭 -->
    <div class="timer-section">
      <div class="timer-label">
        <van-icon name="clock-o" size="14" color="#94a3b8" />
        <span>定时关闭</span>
      </div>
      <div class="timer-options">
        <div
          v-for="min in timerOptions"
          :key="min"
          class="timer-chip"
          :class="{ active: timerMinutes === min }"
          @click="startTimer(min)"
        >
          {{ min === 0 ? '关闭' : `${min}分钟` }}
        </div>
      </div>
      <div v-if="timerRemaining > 0" class="timer-countdown">
        剩余 {{ timerDisplay }} 后淡出停止
      </div>
    </div>
  </div>
</template>

<style scoped>
.noise-mixer {
  color: #f8fafc;
}

.mixer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 12px;
}

.mixer-stop {
  flex-shrink: 0;
  font-size: 12px;
  color: #fb7185;
  padding: 4px 10px;
  border: 1px solid rgba(251, 113, 133, 0.4);
  border-radius: 999px;
  background: rgba(251, 113, 133, 0.08);
}

.mixer-stop:active {
  background: rgba(251, 113, 133, 0.15);
}

.track-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.track-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.track-card.active {
  background: rgba(255, 255, 255, 0.08);
}

.track-card:active {
  transform: scale(0.97);
}

.track-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 8px;
  transition: background 0.3s;
  color: #f8fafc;
}

.track-name {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.track-volume {
  width: 100%;
  padding: 4px 0;
}

.timer-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 14px;
}

.timer-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 10px;
}

.timer-options {
  display: flex;
  gap: 8px;
}

.timer-chip {
  flex: 1;
  text-align: center;
  padding: 8px 6px;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  transition: all 0.2s ease;
}

.timer-chip.active {
  background: rgba(129, 140, 248, 0.15);
  border-color: rgba(129, 140, 248, 0.4);
  color: #a5b4fc;
  font-weight: 600;
}

.timer-countdown {
  margin-top: 10px;
  font-size: 12px;
  color: #a5b4fc;
  text-align: center;
  font-weight: 500;
}

.loading-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #a5b4fc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
