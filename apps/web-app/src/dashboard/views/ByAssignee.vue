<template>
  <div class="by-assignee">
    <section class="assignee-hero">
      <div class="assignee-hero__eyebrow">
        <span class="assignee-hero__eyebrow-dot" />
        <span>BY ASSIGNEE · §BIZ</span>
      </div>
      <h1 class="assignee-hero__title">标注员产能<span class="assignee-hero__period">.</span></h1>
      <p class="assignee-hero__sub">横轴 · 分配 unit 数  /  纵轴 · 已完成  /  色阶 · 首次通过率</p>
    </section>

    <article class="chart-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§2.1</span>
          <h2 class="card-head__title">产能散点</h2>
        </div>
        <div class="card-head__meta">
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--low" /> &lt; 50%
          </span>
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--mid" /> 50–80%
          </span>
          <span class="card-head__chip">
            <span class="card-head__legend card-head__legend--high" /> &ge; 80%
          </span>
        </div>
      </header>
      <div ref="scatterEl" class="chart-canvas"></div>
      <div v-if="!loading && rows.length === 0" class="card-empty">
        <Icon icon="ri:-user-search-line" :width="32" />
        <p>暂无标注员数据</p>
      </div>
    </article>

    <article class="table-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§2.2</span>
          <h2 class="card-head__title">明细表</h2>
        </div>
        <span class="card-head__chip">{{ rows.length }} 人</span>
      </header>
      <el-table :data="rows" size="default" v-loading="loading" class="lab-table">
        <el-table-column prop="assignee_id" label="标注员 ID" width="140">
          <template #default="{ row }">
            <span class="lab-id-chip">#{{ row.assignee_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="units_assigned" label="分配数" width="110" sortable />
        <el-table-column prop="units_completed" label="已完成" width="110" sortable />
        <el-table-column label="完成率" width="130">
          <template #default="{ row }">
            <div class="lab-rate-bar">
              <div class="lab-rate-bar__fill" :style="completionStyle(row)" />
              <span class="lab-rate-bar__label">{{ formatRate(row.units_completed / row.units_assigned) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="rejects_received" label="累计被驳回" width="130" sortable />
        <el-table-column label="首次通过率">
          <template #default="{ row }">
            <span class="lab-rate-pill" :class="`lab-rate-pill--${firstPassTone(row.first_pass_rate)}`">
              {{ formatRate(row.first_pass_rate) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import Plotly from 'plotly.js-dist-min'
import { qualityApi } from '@/api'
import { useDashboardProject } from '../composables/useDashboardProject'

const { projectId } = useDashboardProject()

const loading = ref(false)
const rows = ref<any[]>([])
const scatterEl = ref<HTMLDivElement | null>(null)

const maxAssigned = computed(() =>
  rows.value.reduce((m, r) => Math.max(m, r.units_assigned ?? 0), 0),
)

const formatRate = (v: any): string => {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

const firstPassTone = (v: any): 'success' | 'warning' | 'danger' | 'muted' => {
  if (v == null) return 'muted'
  if (v >= 0.8) return 'success'
  if (v >= 0.5) return 'warning'
  return 'danger'
}

const completionStyle = (row: any) => {
  const r = row.units_assigned ? row.units_completed / row.units_assigned : 0
  const pct = Math.max(0, Math.min(1, r)) * 100
  return { width: `${pct}%` }
}

const loadData = async () => {
  if (projectId.value == null) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const res = await qualityApi.byAssignee({ project_id: projectId.value })
    rows.value = res?.items ?? []
    await nextTick()
    renderScatter()
  } finally {
    loading.value = false
  }
}

const renderScatter = () => {
  if (!scatterEl.value) return
  if (rows.value.length === 0) {
    Plotly.purge(scatterEl.value)
    return
  }
  Plotly.react(
    scatterEl.value,
    [
      {
        type: 'scatter',
        mode: 'markers+text',
        x: rows.value.map((r) => r.units_assigned ?? 0),
        y: rows.value.map((r) => r.units_completed ?? 0),
        text: rows.value.map((r) => `#${r.assignee_id}`),
        textposition: 'top center',
        textfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#8a8b92' },
        marker: {
          size: 18,
          color: rows.value.map((r) => r.first_pass_rate ?? 0),
          colorscale: [
            [0, '#ff6a3d'],
            [0.5, '#ffe58a'],
            [1, '#c8fa4b'],
          ],
          cmin: 0,
          cmax: 1,
          showscale: true,
          colorbar: {
            title: '首次通过率',
            ticksuffix: '%',
            tickvals: [0, 0.5, 1],
            tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
            thickness: 10,
            len: 0.7,
          },
          line: { color: '#0e0e10', width: 1.5 },
        },
        hovertemplate:
          '标注员 #%{customdata}<br>分配 %{x} / 完成 %{y}<br>首次通过率 %{p:.1%}<extra></extra>',
        customdata: rows.value.map((r) => r.assignee_id),
      },
    ],
    {
      margin: { t: 20, l: 50, r: 60, b: 50 },
      xaxis: {
        title: '分配 unit 数',
        range: [0, (maxAssigned.value || 10) + 2],
        gridcolor: 'rgba(0,0,0,0.04)',
        linecolor: 'rgba(0,0,0,0.08)',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
        titlefont: { family: 'JetBrains Mono, monospace', size: 10 },
      },
      yaxis: {
        title: '已完成 unit 数',
        gridcolor: 'rgba(0,0,0,0.04)',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
        titlefont: { family: 'JetBrains Mono, monospace', size: 10 },
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
  if (scatterEl.value) {
    resizeObserver = new ResizeObserver(() => {
      if (scatterEl.value) Plotly.Plots.resize(scatterEl.value)
    })
    resizeObserver.observe(scatterEl.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (scatterEl.value) Plotly.purge(scatterEl.value)
})
watch(projectId, () => loadData())
</script>

<style scoped>
.by-assignee {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.assignee-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assignee-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.assignee-hero__eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.assignee-hero__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
}

.assignee-hero__period {
  color: var(--lab-coral);
}

.assignee-hero__sub {
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

.card-head__legend--low { background: var(--lab-coral); }
.card-head__legend--mid { background: var(--lab-butter, #ffe58a); }
.card-head__legend--high { background: var(--lab-lime); }

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

/* ── lab table decorations ─────────────────────── */
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

.lab-rate-bar {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  height: 18px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  overflow: hidden;
  padding-right: 8px;
}

.lab-rate-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--lab-ink), var(--lab-graphite));
  border-radius: var(--lab-radius-pill, 999px);
  transition: width 200ms ease;
}

.lab-rate-bar__label {
  position: relative;
  z-index: 1;
  margin-left: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  color: var(--lab-snow);
  mix-blend-mode: difference;
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
</style>
