/**
 * ECharts Vue 3 composable。
 * tree-shake:仅注册 LineChart/BarChart/PieChart + 必要组件。
 * 用法:
 *   const el = ref<HTMLElement>()
 *   const { setOption, resize } = useECharts(el)
 *   setOption({...})
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, LineChart, PieChart,
  GridComponent, LegendComponent, TitleComponent,
  TooltipComponent, DataZoomComponent,
  CanvasRenderer,
])

export type EChartsOption = Parameters<echarts.ECharts['setOption']>[0]

export function useECharts(el: Ref<HTMLElement | null>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  const ready = ref(false)

  const ensureInit = () => {
    if (chart.value || !el.value) return
    chart.value = echarts.init(el.value)
    ready.value = true
  }

  const setOption = (option: EChartsOption) => {
    ensureInit()
    chart.value?.setOption(option, { notMerge: true })
  }

  const resize = () => chart.value?.resize()

  const dispose = () => {
    chart.value?.dispose()
    chart.value = null
    ready.value = false
  }

  onMounted(() => {
    ensureInit()
    window.addEventListener('resize', resize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    dispose()
  })

  watch(el, () => ensureInit())

  return { chart, ready, setOption, resize, dispose }
}
