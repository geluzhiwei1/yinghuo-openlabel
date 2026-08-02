<template>
  <div class="by-reviewer">
    <section class="reviewer-hero">
      <div class="reviewer-hero__eyebrow">
        <span class="reviewer-hero__eyebrow-dot" />
        <span>BY REVIEWER · §BIZ</span>
      </div>
      <h1 class="reviewer-hero__title">审核员流转<span class="reviewer-hero__period">.</span></h1>
      <p class="reviewer-hero__sub">柱高 · 驳回率  /  色深 · 总投票数  /  标签 · 平均工时</p>
    </section>

    <article class="chart-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§2.3</span>
          <h2 class="card-head__title">驳回率分布</h2>
        </div>
        <div class="card-head__meta">
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--ok" /> &lt; 10%
          </span>
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--warn" /> 10–30%
          </span>
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--crit" /> &ge; 30%
          </span>
        </div>
      </header>
      <div ref="barEl" class="chart-canvas"></div>
      <div v-if="!loading && rows.length === 0" class="card-empty">
        <Icon icon="lucide:badge-check" :width="32" />
        <p>暂无审核员数据</p>
      </div>
    </article>

    <article class="table-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§2.4</span>
          <h2 class="card-head__title">明细表</h2>
        </div>
        <span class="card-head__chip">{{ rows.length }} 人</span>
      </header>
      <el-table :data="rows" size="default" v-loading="loading" class="lab-table">
        <el-table-column prop="reviewer_id" label="审核员 ID" width="140">
          <template #default="{ row }">
            <span class="lab-id-chip">#{{ row.reviewer_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_votes" label="总投票数" width="120" sortable />
        <el-table-column prop="approved" label="通过" width="100" sortable />
        <el-table-column prop="rejected" label="驳回" width="100" sortable />
        <el-table-column prop="escalated" label="升级仲裁" width="120" sortable />
        <el-table-column label="驳回率" width="140">
          <template #default="{ row }">
            <span class="lab-rate-pill" :class="`lab-rate-pill--${rejectTone(row.reject_rate)}`">
              {{ formatRate(row.reject_rate) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="平均工时(ms)">
          <template #default="{ row }">
            <span class="lab-ms">{{ row.avg_duration_ms != null ? Math.round(row.avg_duration_ms) : '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import Plotly from 'plotly.js-dist-min'
import { qualityApi } from '@/api'
import { useDashboardProject } from '../composables/useDashboardProject'

const { projectId } = useDashboardProject()

const loading = ref(false)
const rows = ref<any[]>([])
const barEl = ref<HTMLDivElement | null>(null)

const formatRate = (v: any): string => {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

const rejectTone = (v: any): 'success' | 'warning' | 'danger' | 'muted' => {
  if (v == null) return 'muted'
  if (v < 0.1) return 'success'
  if (v < 0.3) return 'warning'
  return 'danger'
}

const loadData = async () => {
  if (projectId.value == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const res = await qualityApi.byReviewer({ project_id: projectId.value })
    rows.value = res?.items ?? []
    await nextTick()
    renderBar()
  } finally {
    loading.value = false
  }
}

const renderBar = () => {
  if (!barEl.value) return
  if (rows.value.length === 0) {
    Plotly.purge(barEl.value)
    return
  }
  const xs = rows.value.map((r) => `#${r.reviewer_id}`)
  const ys = rows.value.map((r) => (r.reject_rate ?? 0) * 100)
  Plotly.react(
    barEl.value,
    [
      {
        type: 'bar',
        x: xs,
        y: ys,
        marker: {
          color: ys,
          colorscale: [
            [0, '#c8fa4b'],
            [0.3, '#ffe58a'],
            [1, '#ff6a3d'],
          ],
          cmin: 0,
          cmax: 50,
          line: { color: '#0e0e10', width: 0.5 },
        },
        hovertemplate: '审核员 %{x}<br>驳回率 %{y:.1f}%<extra></extra>',
        text: ys.map((v: number) => `${v.toFixed(1)}%`),
        textposition: 'outside',
        textfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#3f4046' },
      },
    ],
    {
      margin: { t: 20, l: 50, r: 20, b: 60 },
      yaxis: {
        title: '驳回率 (%)',
        gridcolor: 'rgba(0,0,0,0.04)',
        rangemode: 'tozero',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
        titlefont: { family: 'JetBrains Mono, monospace', size: 10 },
      },
      xaxis: {
        tickangle: -20,
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Inter, system-ui, sans-serif', size: 11 },
    },
    { responsive: true, displayModeBar: false },
  )
}

let resizeObserver: ResizeObserver | null = null
onMounted(async () => {
  await loadData()
  if (barEl.value) {
    resizeObserver = new ResizeObserver(() => {
      if (barEl.value) Plotly.Plots.resize(barEl.value)
    })
    resizeObserver.observe(barEl.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (barEl.value) Plotly.purge(barEl.value)
})
watch(projectId, () => loadData())
</script>

<style scoped>
.by-reviewer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.reviewer-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reviewer-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.reviewer-hero__eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.reviewer-hero__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
}

.reviewer-hero__period {
  color: var(--lab-coral);
}

.reviewer-hero__sub {
  font-size: 12px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  margin: 0;
}

.chart-card,
.table-card {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 20px 22px 22px;
  box-shadow: var(--lab-shadow-soft, 0 1px 2px rgba(14,14,16,0.04), 0 4px 14px rgba(14,14,16,0.04));
  border: 1px solid var(--lab-hairline);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.card-head__title-row {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.card-head__idx {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-ash);
  letter-spacing: 0.06em;
}

.card-head__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--lab-ink);
  margin: 0;
}

.card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.card-head__chip {
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

.card-head__legend {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.card-head__legend--ok { background: var(--lab-lime); }
.card-head__legend--warn { background: var(--lab-butter, #ffe58a); }
.card-head__legend--crit { background: var(--lab-coral); }

.chart-canvas {
  width: 100%;
  height: 360px;
}

.card-empty {
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

/* lab table decorations */
.lab-table :deep(.el-table__header-wrapper th .cell) {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.lab-table :deep(.el-table__row:hover > td) {
  background: var(--lab-cream) !important;
}

.lab-table :deep(td .cell),
.lab-table :deep(th .cell) {
  font-size: 12.5px;
  color: var(--lab-graphite);
}

.lab-id-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  color: var(--lab-ink);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.lab-rate-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.lab-rate-pill--success {
  background: var(--lab-mint, #b8f0d0);
  color: var(--lab-graphite);
}

.lab-rate-pill--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}

.lab-rate-pill--danger {
  background: rgba(255,106,61,0.18);
  color: var(--lab-coral);
}

.lab-rate-pill--muted {
  background: var(--lab-cream);
  color: var(--lab-ash);
}

.lab-ms {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11.5px;
  color: var(--lab-slate);
  letter-spacing: 0.04em;
}
</style>
