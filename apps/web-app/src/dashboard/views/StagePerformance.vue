<template>
  <div class="stage-performance">
    <section class="sp-hero">
      <div class="sp-hero__eyebrow">
        <span class="sp-hero__eyebrow-dot" />
        <span>STAGE PERF · §BIZ</span>
      </div>
      <h1 class="sp-hero__title">stage 性能基线<span class="sp-hero__period">.</span></h1>
      <p class="sp-hero__sub">基于 stage_history  /  samples &lt; 10 自动标灰  /  窗口外不计入</p>
    </section>

    <div class="sp-toolbar">
      <span class="sp-toolbar__hint">
        数据基于 stage_history(started_at / finished_at / duration_ms),窗口外的不计入。
      </span>
      <span class="sp-toolbar__chip">
        <Icon icon="lucide:filter" :width="11" />
        <span>samples &lt; 10 标灰</span>
      </span>
      <div class="sp-toolbar__right">
        <div class="sp-window">
          <span class="sp-window__label">WINDOW</span>
          <el-select v-model="windowDays" style="width: 130px" @change="reloadAll">
            <el-option :value="7" label="最近 7 天" />
            <el-option :value="30" label="最近 30 天" />
            <el-option :value="90" label="最近 90 天" />
          </el-select>
        </div>
        <button class="sp-refresh" @click="reloadAll">
          <Icon icon="lucide:refresh-cw" :width="14" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <article class="sp-card">
      <header class="sp-card__head">
        <div class="sp-card__title-row">
          <span class="sp-card__idx">§3.4</span>
          <Icon icon="lucide:chart-no-axes-column" :width="16" />
          <h2 class="sp-card__title">stage 耗时分布</h2>
          <span class="sp-card__hint">p50 / p95 / p99 · 分钟</span>
        </div>
        <div class="sp-card__meta">
          <span class="sp-card__legend"><span class="sp-card__dot sp-card__dot--ink" /> p50</span>
          <span class="sp-card__legend"><span class="sp-card__dot sp-card__dot--butter" /> p95</span>
          <span class="sp-card__legend"><span class="sp-card__dot sp-card__dot--coral" /> p99</span>
        </div>
      </header>
      <div ref="durationChartEl" class="sp-chart" />
      <div v-if="!loading && stages.length === 0" class="sp-empty">
        <Icon icon="lucide:chart-column" :width="32" />
        <p>窗口内无完成 stage</p>
      </div>
    </article>

    <article class="sp-card">
      <header class="sp-card__head">
        <div class="sp-card__title-row">
          <span class="sp-card__idx">§3.5</span>
          <Icon icon="lucide:chart-pie" :width="16" />
          <h2 class="sp-card__title">cycle time 瓶颈占比</h2>
          <span class="sp-card__hint">降序</span>
        </div>
      </header>
      <div ref="bottleneckChartEl" class="sp-chart" />
      <div v-if="!loading && bottlenecks.length === 0" class="sp-empty">
        <Icon icon="lucide:filter" :width="32" />
        <p>窗口内无耗时数据</p>
      </div>
    </article>

    <article class="sp-card">
      <header class="sp-card__head">
        <div class="sp-card__title-row">
          <span class="sp-card__idx">§3.6</span>
          <Icon icon="lucide:chart-line" :width="16" />
          <h2 class="sp-card__title">每日完成 cycle time p50</h2>
          <span class="sp-card__hint">分钟</span>
        </div>
      </header>
      <div ref="trendChartEl" class="sp-chart" />
      <div v-if="!loading && trend.length === 0" class="sp-empty">
        <Icon icon="lucide:chart-line" :width="32" />
        <p>窗口内无 approved 实例</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { qualityApi } from '@/api'
import { useECharts } from '@/components/charts/useECharts'
import { useDashboardProject } from '../composables/useDashboardProject'

const { projectId } = useDashboardProject()
const windowDays = ref(30)
const loading = ref(false)

const stages = ref<any[]>([])
const bottlenecks = ref<any[]>([])
const trend = ref<any[]>([])

const durationChartEl = ref<HTMLElement | null>(null)
const bottleneckChartEl = ref<HTMLElement | null>(null)
const trendChartEl = ref<HTMLElement | null>(null)
const durationChart = useECharts(durationChartEl)
const bottleneckChart = useECharts(bottleneckChartEl)
const trendChart = useECharts(trendChartEl)

const LAB = {
  ink: '#0e0e10',
  graphite: '#1c1c20',
  slate: '#3f4046',
  ash: '#8a8b92',
  fog: '#b8b9be',
  line: '#e6e4dc',
  paper: '#f7f6f2',
  cream: '#fbfaf5',
  snow: '#ffffff',
  lime: '#c8fa4b',
  coral: '#ff6a3d',
  butter: '#ffe58a',
}

const MONO = {
  fontFamily: 'JetBrains Mono, monospace',
}

async function loadStages() {
  if (projectId.value == null) {
    stages.value = []
    return
  }
  const r = await qualityApi.stageDuration({ project_id: projectId.value, window_days: windowDays.value })
  stages.value = r?.stages || []
  renderDuration()
}

async function loadBottleneck() {
  if (projectId.value == null) {
    bottlenecks.value = []
    return
  }
  const r = await qualityApi.bottleneck({ project_id: projectId.value, window_days: windowDays.value })
  bottlenecks.value = r?.items || []
  renderBottleneck()
}

async function loadTrend() {
  if (projectId.value == null) {
    trend.value = []
    return
  }
  const r = await qualityApi.cycleTimeTrend({ project_id: projectId.value, window_days: windowDays.value })
  trend.value = r?.series || []
  renderTrend()
}

function renderDuration() {
  if (stages.value.length === 0) {
    durationChart.setOption({ xAxis: { data: [] }, yAxis: { type: 'value' }, series: [] })
    return
  }
  const codes = stages.value.map((s) => s.stage)
  durationChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(14,14,16,0.04)' } },
      backgroundColor: LAB.ink,
      borderColor: 'transparent',
      textStyle: { color: LAB.snow, fontFamily: MONO.fontFamily, fontSize: 11 },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);',
    },
    legend: {
      data: ['p50', 'p95', 'p99'],
      textStyle: { color: LAB.slate, fontFamily: MONO.fontFamily, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      icon: 'roundRect',
      itemGap: 14,
    },
    grid: { left: 50, right: 30, top: 40, bottom: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: codes,
      axisLine: { lineStyle: { color: LAB.line } },
      axisTick: { show: false },
      axisLabel: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '分钟',
      nameTextStyle: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
      splitLine: { lineStyle: { color: LAB.line, type: 'dashed' } },
      axisLabel: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
    },
    series: [
      { name: 'p50', type: 'bar', data: stages.value.map((s) => s.p50), itemStyle: { color: LAB.ink, borderRadius: [4, 4, 0, 0] }, barGap: '20%' },
      { name: 'p95', type: 'bar', data: stages.value.map((s) => s.p95), itemStyle: { color: LAB.butter, borderRadius: [4, 4, 0, 0] } },
      { name: 'p99', type: 'bar', data: stages.value.map((s) => s.p99), itemStyle: { color: LAB.coral, borderRadius: [4, 4, 0, 0] } },
    ],
  })
}

function renderBottleneck() {
  if (bottlenecks.value.length === 0) {
    bottleneckChart.setOption({ xAxis: { type: 'value' }, yAxis: { data: [] }, series: [] })
    return
  }
  const items = bottlenecks.value
  bottleneckChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(14,14,16,0.04)' } },
      backgroundColor: LAB.ink,
      borderColor: 'transparent',
      textStyle: { color: LAB.snow, fontFamily: MONO.fontFamily, fontSize: 11 },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);',
      formatter: (params: any) => {
        const p = params[0]
        const item = items[items.length - 1 - p.dataIndex]
        return `${item.stage}<br/>占比 ${(item.share * 100).toFixed(1)}%<br/>avg ${item.avg_minutes} 分<br/>samples ${item.samples}`
      },
    },
    grid: { left: 100, right: 60, top: 20, bottom: 30, containLabel: true },
    xAxis: {
      type: 'value',
      name: '占比',
      nameTextStyle: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
      axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
      splitLine: { lineStyle: { color: LAB.line, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: items.map((i) => i.stage).reverse(),
      axisLine: { lineStyle: { color: LAB.line } },
      axisTick: { show: false },
      axisLabel: { color: LAB.slate, fontFamily: MONO.fontFamily, fontSize: 10 },
    },
    series: [
      {
        name: '占比',
        type: 'bar',
        data: items.map((i) => i.share).reverse(),
        itemStyle: {
          color: (params: any) => {
            const original = items[items.length - 1 - params.dataIndex]
            return original?.samples_low ? LAB.fog : LAB.coral
          },
          borderRadius: [0, 6, 6, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter: (p: any) => `${(p.value * 100).toFixed(1)}%`,
          color: LAB.graphite,
          fontFamily: MONO.fontFamily,
          fontSize: 10,
        },
        barWidth: '50%',
      },
    ],
  })
}

function renderTrend() {
  const withSamples = trend.value.filter((t) => t.samples > 0)
  if (withSamples.length === 0) {
    trendChart.setOption({ xAxis: { data: [] }, yAxis: { type: 'value' }, series: [] })
    return
  }
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: LAB.ink,
      borderColor: 'transparent',
      textStyle: { color: LAB.snow, fontFamily: MONO.fontFamily, fontSize: 11 },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);',
      formatter: (params: any) => {
        const p = params[0]
        const item = trend.value[p.dataIndex]
        return `${item.date}<br/>p50 ${item.p50_minutes ?? '—'} 分<br/>samples ${item.samples}${item.samples_low ? '(标灰)' : ''}`
      },
    },
    grid: { left: 50, right: 30, top: 20, bottom: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.value.map((t) => t.date),
      axisLine: { lineStyle: { color: LAB.line } },
      axisTick: { show: false },
      axisLabel: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '分钟',
      nameTextStyle: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
      splitLine: { lineStyle: { color: LAB.line, type: 'dashed' } },
      axisLabel: { color: LAB.ash, fontFamily: MONO.fontFamily, fontSize: 10 },
    },
    series: [
      {
        name: 'cycle p50',
        type: 'line',
        smooth: true,
        connectNulls: true,
        symbol: 'circle',
        symbolSize: 6,
        data: trend.value.map((t) => t.p50_minutes),
        itemStyle: { color: LAB.ink },
        lineStyle: { color: LAB.ink, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(200,250,75,0.35)' },
              { offset: 1, color: 'rgba(200,250,75,0.02)' },
            ],
          },
        },
      },
    ],
  })
}

async function reloadAll() {
  if (projectId.value == null) return
  loading.value = true
  try {
    await Promise.all([loadStages(), loadBottleneck(), loadTrend()])
  } finally {
    loading.value = false
  }
}

onMounted(reloadAll)
watch(projectId, reloadAll)
</script>

<style scoped>
.stage-performance {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sp-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.sp-hero__eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.sp-hero__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
}

.sp-hero__period {
  color: var(--lab-coral);
}

.sp-hero__sub {
  font-size: 12px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  margin: 0;
}

/* ── Toolbar ───────────────────────────────────── */
.sp-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  border: 1px dashed var(--lab-line);
}

.sp-toolbar__hint {
  flex: 1;
  min-width: 240px;
  font-size: 11.5px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

.sp-toolbar__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.sp-toolbar__right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.sp-window {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sp-window__label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.sp-window :deep(.el-input__wrapper) {
  border-radius: var(--lab-radius-lg, 8px);
  background: var(--lab-cream);
  box-shadow: none !important;
  border: 1px solid transparent;
}

.sp-window :deep(.el-input__wrapper:hover),
.sp-window :deep(.el-input.is-focus .el-input__wrapper) {
  border-color: var(--lab-ink) !important;
}

.sp-window :deep(.el-input__inner) {
  font-size: 12.5px;
  color: var(--lab-ink);
  height: 32px;
}

.sp-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-ink);
  color: var(--lab-snow);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.sp-refresh:hover {
  background: var(--lab-graphite);
  color: var(--lab-lime);
  transform: translateY(-1px);
}

/* ── Card ──────────────────────────────────────── */
.sp-card {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 20px 22px 22px;
  box-shadow: var(--lab-shadow-soft, 0 1px 2px rgba(14,14,16,0.04), 0 4px 14px rgba(14,14,16,0.04));
  border: 1px solid var(--lab-hairline);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sp-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.sp-card__title-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sp-card__idx {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-ash);
  letter-spacing: 0.06em;
}

.sp-card__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--lab-ink);
  margin: 0;
}

.sp-card__hint {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--lab-ash);
  margin-left: 4px;
}

.sp-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sp-card__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  color: var(--lab-slate);
  letter-spacing: 0.04em;
}

.sp-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.sp-card__dot--ink { background: var(--lab-ink); }
.sp-card__dot--butter { background: var(--lab-butter, #ffe58a); }
.sp-card__dot--coral { background: var(--lab-coral); }

.sp-chart {
  width: 100%;
  height: 320px;
}

.sp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--lab-fog);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 12px;
  letter-spacing: 0.04em;
}
</style>
