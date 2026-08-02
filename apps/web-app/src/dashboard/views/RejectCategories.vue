<template>
  <div class="reject-categories">
    <section class="rc-hero">
      <div class="rc-hero__eyebrow">
        <span class="rc-hero__eyebrow-dot" />
        <span>REJECT · §BIZ</span>
      </div>
      <h1 class="rc-hero__title">驳回类别透视<span class="rc-hero__period">.</span></h1>
      <p class="rc-hero__sub">类别 × 严重度矩阵  /  色阶由奶白渐入珊瑚橙  /  红框为热点</p>
    </section>

    <article class="chart-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§3.2</span>
          <h2 class="card-head__title">驳回热力图</h2>
        </div>
        <div class="card-head__meta">
          <span v-if="totalRejects > 0" class="card-head__chip card-head__chip--crit">
            <Icon icon="lucide:circle-alert" :width="12" />
            <span>累计 {{ totalRejects.toLocaleString() }} 次驳回</span>
          </span>
        </div>
      </header>
      <div ref="heatmapEl" class="chart-canvas"></div>
      <div v-if="!loading && items.length === 0" class="card-empty">
        <Icon icon="lucide:layout-grid" :width="32" />
        <p>暂无驳回数据</p>
      </div>
    </article>

    <article class="table-card">
      <header class="card-head">
        <div class="card-head__title-row">
          <span class="card-head__idx">§3.3</span>
          <h2 class="card-head__title">驳回明细</h2>
        </div>
        <span class="card-head__chip">{{ items.length }} 项</span>
      </header>
      <el-table :data="items" size="default" v-loading="loading" class="lab-table">
        <el-table-column prop="category" label="类别" min-width="180">
          <template #default="{ row }">
            <span class="lab-cat">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重度" width="140">
          <template #default="{ row }">
            <span class="lab-sev" :class="`lab-sev--${severityTone(row.severity)}`">
              <span class="lab-sev__dot" />
              {{ row.severity || 'unknown' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="次数" width="120" sortable>
          <template #default="{ row }">
            <span class="lab-num">{{ row.count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="占比">
          <template #default="{ row }">
            <div class="lab-share">
              <div class="lab-share__fill" :style="shareStyle(row)" />
              <span class="lab-share__label">{{ formatRate(row.count / totalRejects) }}</span>
            </div>
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
const items = ref<any[]>([])
const totalRejects = ref(0)
const heatmapEl = ref<HTMLDivElement | null>(null)

const formatRate = (v: any): string => {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

const severityTone = (sev: string): 'danger' | 'warning' | 'critical' | 'muted' => {
  if (sev === 'critical') return 'critical'
  if (sev === 'major') return 'danger'
  if (sev === 'minor') return 'warning'
  return 'muted'
}

const shareStyle = (row: any) => {
  if (!totalRejects.value) return { width: '0%' }
  const pct = Math.max(0, Math.min(1, row.count / totalRejects.value)) * 100
  return { width: `${pct}%` }
}

const loadData = async () => {
  if (projectId.value == null) {
    items.value = []
    totalRejects.value = 0
    return
  }
  loading.value = true
  try {
    const res = await qualityApi.rejectCategories({ project_id: projectId.value })
    items.value = res?.items ?? []
    totalRejects.value = res?.total_rejects ?? 0
    await nextTick()
    renderHeatmap()
  } finally {
    loading.value = false
  }
}

const renderHeatmap = () => {
  if (!heatmapEl.value) return
  if (items.value.length === 0) {
    Plotly.purge(heatmapEl.value)
    return
  }
  const categories = Array.from(new Set(items.value.map((i) => i.category)))
  const severities = ['critical', 'major', 'minor', 'unknown'].filter((s) =>
    items.value.some((i) => i.severity === s),
  )
  const z: number[][] = categories.map((cat) =>
    severities.map((sev) => {
      const found = items.value.find((i) => i.category === cat && i.severity === sev)
      return found?.count ?? 0
    }),
  )
  const maxVal = Math.max(1, ...z.flat())
  Plotly.react(
    heatmapEl.value,
    [
      {
        type: 'heatmap',
        z,
        x: severities,
        y: categories,
        colorscale: [
          [0, '#fbfaf5'],
          [0.3, '#ffe58a'],
          [0.7, '#ff8e5c'],
          [1, '#ff6a3d'],
        ],
        cmin: 0,
        cmax: maxVal,
        showscale: true,
        colorbar: {
          tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
          outlinecolor: 'rgba(0,0,0,0.1)',
          outlinewidth: 1,
          thickness: 10,
          len: 0.7,
        },
        hovertemplate: '%{y} / %{x}<br>次数 %{z}<extra></extra>',
        text: z.map((row) => row.map((v) => (v > 0 ? String(v) : ''))),
        texttemplate: '%{text}',
        textfont: { family: 'JetBrains Mono, monospace', size: 11, color: '#0e0e10' },
        xgap: 4,
        ygap: 4,
      },
    ],
    {
      margin: { t: 30, l: 180, r: 40, b: 50 },
      xaxis: {
        side: 'top',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 },
        gridcolor: 'rgba(0,0,0,0.04)',
      },
      yaxis: {
        tickfont: { family: 'Inter, system-ui, sans-serif', size: 11 },
        gridcolor: 'rgba(0,0,0,0.04)',
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
  if (heatmapEl.value) {
    resizeObserver = new ResizeObserver(() => {
      if (heatmapEl.value) Plotly.Plots.resize(heatmapEl.value)
    })
    resizeObserver.observe(heatmapEl.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (heatmapEl.value) Plotly.purge(heatmapEl.value)
})
watch(projectId, () => loadData())
</script>

<style scoped>
.reject-categories {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rc-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rc-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.rc-hero__eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-coral);
  box-shadow: 0 0 6px var(--lab-coral);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.rc-hero__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
}

.rc-hero__period {
  color: var(--lab-coral);
}

.rc-hero__sub {
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

.card-head__chip--crit {
  background: rgba(255,106,61,0.16);
  color: var(--lab-coral);
}

.chart-canvas {
  width: 100%;
  height: 420px;
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

.lab-cat {
  font-size: 12.5px;
  color: var(--lab-ink);
}

.lab-sev {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.lab-sev__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.lab-sev--critical {
  background: rgba(255,106,61,0.22);
  color: var(--lab-coral);
}
.lab-sev--critical .lab-sev__dot {
  background: var(--lab-coral);
  box-shadow: 0 0 6px var(--lab-coral);
}

.lab-sev--danger {
  background: rgba(255,106,61,0.14);
  color: var(--lab-coral);
}
.lab-sev--danger .lab-sev__dot { background: var(--lab-coral); }

.lab-sev--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}
.lab-sev--warning .lab-sev__dot { background: var(--lab-graphite); }

.lab-sev--muted {
  background: var(--lab-cream);
  color: var(--lab-ash);
}
.lab-sev--muted .lab-sev__dot { background: var(--lab-fog); }

.lab-num {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 13px;
  font-weight: 500;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
}

.lab-share {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 110px;
  height: 18px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  overflow: hidden;
  padding-right: 8px;
}

.lab-share__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #ffe58a, var(--lab-coral));
  border-radius: var(--lab-radius-pill, 999px);
  transition: width 200ms ease;
}

.lab-share__label {
  position: relative;
  z-index: 1;
  margin-left: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  color: var(--lab-graphite);
  letter-spacing: 0.04em;
}
</style>
