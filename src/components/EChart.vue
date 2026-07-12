<script setup lang="ts">
/**
 * ECharts 通用封装组件
 * PRD 5.1：ECharts 按需引入（雷达图/折线图）
 * PRD 7.2：组件销毁时释放资源，防止内存泄漏
 * 重设计：默认透明背景，适配深色极光琉璃主题
 */
import { ref, watch, onMounted, onUnmounted, onActivated, onDeactivated, shallowRef, computed } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart, LineChart, BarChart } from 'echarts/charts'
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
  TitleComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsType } from 'echarts/core'
import type { ECOption } from '@/types/echarts'

// PRD 5.1：按需注册 ECharts 组件
echarts.use([RadarChart, LineChart, BarChart, TooltipComponent, LegendComponent, GridComponent, TitleComponent, CanvasRenderer])

const props = withDefaults(
  defineProps<{
    option: ECOption
    height?: string
    dark?: boolean
  }>(),
  {
    height: '300px',
    dark: true
  }
)

const chartEl = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<EChartsType | null>(null)

const darkDefaults = computed<ECOption>(() =>
  props.dark
    ? {
        backgroundColor: 'transparent',
        textStyle: { color: '#94a3b8' },
        title: { textStyle: { color: '#f8fafc' } },
        legend: { textStyle: { color: '#94a3b8' } }
      }
    : {}
)

const finalOption = computed<ECOption>(() => {
  const base = darkDefaults.value as ECOption
  // 浅合并：父组件 option 优先级更高
  return {
    ...base,
    ...props.option
  }
})

const initChart = () => {
  if (!chartEl.value || chartInstance.value) return
  chartInstance.value = echarts.init(chartEl.value)
  chartInstance.value.setOption(finalOption.value)
}

const resize = () => chartInstance.value?.resize()

onMounted(() => {
  initChart()
  window.addEventListener('resize', resize)
})

onActivated(() => {
  resize()
})

onDeactivated(() => {
  // keep-alive 失活时不销毁，仅停止渲染
})

watch(
  () => finalOption.value,
  (newOption) => {
    chartInstance.value?.setOption(newOption, true)
  },
  { deep: true }
)

onUnmounted(() => {
  // PRD 7.2：显式释放 ECharts 实例，防止内存泄漏
  window.removeEventListener('resize', resize)
  chartInstance.value?.dispose()
  chartInstance.value = null
})
</script>

<template>
  <div ref="chartEl" :style="{ width: '100%', height }"></div>
</template>
