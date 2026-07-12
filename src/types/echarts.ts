/**
 * ECharts 类型定义（按需引入对应的 Option 类型组合）
 * PRD 5.1：ECharts 按需引入（雷达图/折线图/柱状图）
 */
import type { ComposeOption } from 'echarts/core'
import type { RadarSeriesOption, LineSeriesOption, BarSeriesOption } from 'echarts/charts'
import type {
  TooltipComponentOption,
  LegendComponentOption,
  GridComponentOption,
  TitleComponentOption
} from 'echarts/components'

export type ECOption = ComposeOption<
  | RadarSeriesOption
  | LineSeriesOption
  | BarSeriesOption
  | TooltipComponentOption
  | LegendComponentOption
  | GridComponentOption
  | TitleComponentOption
>
