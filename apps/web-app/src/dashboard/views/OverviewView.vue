<template>
  <div class="overview">
    <section class="overview__hero">
      <div class="overview__eyebrow">
        <span class="overview__eyebrow-dot" />
        <span>OVERVIEW · §BIZ</span>
      </div>
      <h1 class="overview__title">质量总览<span class="overview__period">.</span></h1>
      <p class="overview__sub">{{ heroSub }}</p>
    </section>

    <div class="kpi-grid" v-loading="loading">
      <KpiCard
        idx="01"
        label="UNIT · TOTAL"
        :value="data?.total_units ?? 0"
        icon="lucide:layers"
        tone="primary"
        hint="全部标注单元累计"
      />
      <KpiCard
        idx="02"
        label="COMPLETED"
        :value="data?.completed ?? 0"
        :suffix="completionRate"
        icon="lucide:circle-check"
        tone="success"
        hint="已完结且未驳回"
      />
      <KpiCard
        idx="03"
        label="FIRST PASS RATE"
        :value="firstPassRate"
        icon="lucide:medal"
        tone="warning"
        hint="首次提交即通过比例"
      />
      <KpiCard
        idx="04"
        label="SEVERE · RATIO"
        :value="severeRate"
        icon="lucide:circle-alert"
        tone="danger"
        hint="严重错误占总驳回比例"
      />
    </div>

    <article class="stage-card">
      <header class="stage-card__head">
        <div class="stage-card__title-row">
          <span class="stage-card__idx">§3.1</span>
          <h2 class="stage-card__title">各阶段通过 / 驳回分布</h2>
        </div>
        <div class="stage-card__meta">
          <span v-if="data?.avg_rework != null" class="stage-card__chip stage-card__chip--info">
            <Icon icon="lucide:refresh-ccw" :width="12" />
            <span>平均返工 {{ data.avg_rework.toFixed(2) }} 次 / unit</span>
          </span>
          <span class="stage-card__chip stage-card__chip--legend">
            <span class="stage-card__legend stage-card__legend--ink" /> 通过
          </span>
          <span class="stage-card__chip stage-card__chip--legend">
            <span class="stage-card__legend stage-card__legend--coral" /> 驳回
          </span>
          <span class="stage-card__chip stage-card__chip--legend">
            <span class="stage-card__legend stage-card__legend--butter" /> 升级仲裁
          </span>
        </div>
      </header>
      <div ref="stageChartEl" class="chart-canvas"></div>
      <div v-if="!loading && (data?.by_stage ?? []).length === 0" class="stage-empty">
        <Icon icon="lucide:chart-bar-horizontal" :width="32" />
        <p>暂无阶段投票数据</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import Plotly from 'plotly.js-dist-min'
import KpiCard from '../components/KpiCard.vue'
import { qualityApi } from '@/api'
import { useDashboardProject } from '../composables/useDashboardProject'

const { projectId } = useDashboardProject()

const loading = ref(false)
const data = ref<any>(null)
const stageChartEl = ref<HTMLDivElement | null>(null)

const heroSub = computed(() => {
  const total = data.value?.total_units
  if (total == null) return '载入项目质量概览...'
  return `当前项目共 ${total.toLocaleString()} 个标注单元 · 按阶段维度透视通过/驳回流转`
})

const completionRate = computed(() => {
  const r = data.value?.completion_rate
  return r != null ? `${(r * 100).toFixed(1)}%` : ''
})

const toPercent = (v: any): string => {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}
const firstPassRate = computed(() => toPercent(data.value?.first_pass_rate))
const severeRate = computed(() => toPercent(data.value?.severe_error_rate))

const loadOverview = async () => {
  if (projectId.value == null) {
    data.value = null
    return
  }
  loading.value = true
  try {
    const res = await qualityApi.overview({ project_id: projectId.value })
    data.value = res
    await nextTick()
    renderStageChart()
  } finally {
    loading.value = false
  }
}

const renderStageChart = () => {
  if (!stageChartEl.value) return
  const stages = data.value?.by_stage ?? []
  if (stages.length === 0) {
    Plotly.purge(stageChartEl.value)
    return
  }
  const x = stages.map((s: any) => s.stage_code)
  const trace = (name: string, key: string, color: string) => ({
    name,
    type: 'bar',
    x,
    y: stages.map((s: any) => s[key] ?? 0),
    marker: { color },
  })
  Plotly.react(
    stageChartEl.value,
    [
      trace('通过', 'approved', '#0e0e10'),
      trace('驳回', 'rejected', '#ff6a3d'),
      trace('升级仲裁', 'escalated', '#ffe58a'),
    ],
    {
      barmode: 'stack',
      margin: { t: 20, l: 40, r: 16, b: 40 },
      legend: { orientation: 'h', y: -0.2 },
      xaxis: { tickangle: -20, gridcolor: 'rgba(0,0,0,0.04)', linecolor: 'rgba(0,0,0,0.08)', tickfont: { family: 'JetBrains Mono, monospace', size: 10 } },
      yaxis: { gridcolor: 'rgba(0,0,0,0.04)', tickfont: { family: 'JetBrains Mono, monospace', size: 10 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Inter, system-ui, sans-serif', size: 11 },
    },
    { responsive: true, displayModeBar: false },
  )
}

const resizeChart = () => {
  if (stageChartEl.value) Plotly.Plots.resize(stageChartEl.value)
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await loadOverview()
  if (stageChartEl.value) {
    resizeObserver = new ResizeObserver(() => resizeChart())
    resizeObserver.observe(stageChartEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (stageChartEl.value) Plotly.purge(stageChartEl.value)
})

watch(projectId, () => loadOverview())
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ── Hero ─────────────────────────────────────── */
.overview__hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.overview__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.overview__eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.overview__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
}

.overview__period {
  color: var(--lab-coral);
}

.overview__sub {
  font-size: 12px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  margin: 0;
}

/* ── KPI grid ─────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

/* ── Stage card ───────────────────────────────── */
.stage-card {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 20px 22px 22px;
  box-shadow: var(--lab-shadow-soft, 0 1px 2px rgba(14,14,16,0.04), 0 4px 14px rgba(14,14,16,0.04));
  border: 1px solid var(--lab-hairline);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stage-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.stage-card__title-row {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.stage-card__idx {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-ash);
  letter-spacing: 0.06em;
}

.stage-card__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--lab-ink);
  margin: 0;
}

.stage-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-card__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  background: var(--lab-cream);
  color: var(--lab-slate);
}

.stage-card__chip--info {
  background: var(--lab-cream);
  color: var(--lab-ink);
}

.stage-card__chip--legend {
  background: transparent;
  color: var(--lab-slate);
  padding-left: 0;
}

.stage-card__legend {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.stage-card__legend--ink { background: var(--lab-ink); }
.stage-card__legend--coral { background: var(--lab-coral); }
.stage-card__legend--butter { background: var(--lab-butter, #ffe58a); }

.chart-canvas {
  width: 100%;
  height: 320px;
}

.stage-empty {
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

@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
