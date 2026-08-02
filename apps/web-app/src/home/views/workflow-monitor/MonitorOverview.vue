<template>
  <div class="monitor-overview">
    <div class="monitor-overview__header">
      <div class="monitor-overview__title">
        <Icon icon="lucide:activity" :width="22" />
        <span>工作流监控</span>
      </div>
      <div class="monitor-overview__actions">
        <el-select
          v-model="projectId"
          placeholder="全部项目"
          clearable
          style="width: 220px"
          :loading="projectLoading"
          @change="reloadAll"
        >
          <el-option
            v-for="p in projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-select v-model="windowDays" style="width: 130px" @change="reloadAll">
          <el-option :value="1" label="最近 1 天" />
          <el-option :value="7" label="最近 7 天" />
          <el-option :value="30" label="最近 30 天" />
          <el-option :value="90" label="最近 90 天" />
        </el-select>
        <el-button  type="primary" @click="reloadAll"><Icon icon="lucide:refresh-cw" />刷新</el-button>
      </div>
    </div>

    <div class="monitor-overview__kpi-grid">
      <el-card v-for="kpi in kpiCards" :key="kpi.key" shadow="hover" class="monitor-overview__kpi">
        <div class="monitor-overview__kpi-label">{{ kpi.label }}</div>
        <div class="monitor-overview__kpi-value" :class="kpi.tone">{{ kpi.value }}</div>
        <div class="monitor-overview__kpi-hint">{{ kpi.hint }}</div>
      </el-card>
    </div>

    <div class="monitor-overview__chart-grid">
      <el-card shadow="hover" class="monitor-overview__chart-card">
        <template #header>
          <div class="monitor-overview__chart-title">
            <Icon icon="lucide:chart-no-axes-column" :width="18" />
            <span>各 stage 状态分布</span>
          </div>
        </template>
        <div ref="stageChartEl" class="monitor-overview__chart" />
      </el-card>

      <el-card shadow="hover" class="monitor-overview__chart-card">
        <template #header>
          <div class="monitor-overview__chart-title">
            <Icon icon="lucide:chart-line" :width="18" />
            <span>每日完成 / 拒绝</span>
          </div>
        </template>
        <div ref="throughputChartEl" class="monitor-overview__chart" />
      </el-card>
    </div>

    <StuckTable :project-id="projectId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { workflowApi, projectsApi } from '@/api'
import { useECharts } from '@/components/charts/useECharts'
import { readChartTheme } from '@/components/charts/useChartTheme'
import StuckTable from './StuckTable.vue'

const projectId = ref<number | null>(null)
const windowDays = ref(7)
const projectLoading = ref(false)
const projects = ref<any[]>([])

const summary = ref<any>(null)
const throughput = ref<any[]>([])

const stageChartEl = ref<HTMLElement | null>(null)
const throughputChartEl = ref<HTMLElement | null>(null)
const stageChart = useECharts(stageChartEl)
const throughputChart = useECharts(throughputChartEl)

const kpiCards = computed(() => {
  const s = summary.value?.by_status || {}
  const totalInProgress = s.in_progress || 0
  const totalApproved = s.approved || 0
  // 卡住阈值 4 小时(与后端默认一致)
  const stuckCount = totalInProgress > 0 ? null : 0
  const todayCompleted = (summary.value?.by_stage || []).reduce(
    (sum: number, x: any) => sum + (x.today_completed || 0),
    0,
  )
  return [
    {
      key: 'in_progress', label: '进行中实例', value: totalInProgress,
      hint: '当前 current_status=in_progress', tone: '',
    },
    {
      key: 'stuck', label: '卡住 (>4h)', value: '...',
      hint: '需在 StuckTable 看明细', tone: totalInProgress > 0 ? 'warn' : '',
    },
    {
      key: 'today_completed', label: `近 ${windowDays.value} 天完成`,
      value: todayCompleted, hint: 'decision=approved', tone: 'good',
    },
    {
      key: 'approved', label: '累计完成', value: totalApproved,
      hint: '历史 approved 总数', tone: '',
    },
  ]
})

async function loadProjects() {
  projectLoading.value = true
  try {
    const r = await projectsApi.list({ page: 1, page_size: 100 })
    projects.value = r?.items || []
  } finally {
    projectLoading.value = false
  }
}

async function loadSummary() {
  const params: Record<string, any> = { window_days: windowDays.value }
  if (projectId.value != null) params.project_id = projectId.value
  const r = await workflowApi.monitorSummary(params)
  summary.value = r
  renderStageChart()
}

async function loadThroughput() {
  const params: Record<string, any> = { window_days: windowDays.value }
  if (projectId.value != null) params.project_id = projectId.value
  const r = await workflowApi.monitorThroughput(params)
  throughput.value = r?.series || []
  renderThroughputChart()
}

function renderStageChart() {
  const stages = summary.value?.by_stage || []
  const codes = stages.map((x: any) => x.stage)
  const t = readChartTheme()
  stageChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['进行中', '完成', '拒绝'] },
    grid: { left: 50, right: 30, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: codes },
    yAxis: { type: 'value' },
    series: [
      { name: '进行中', type: 'bar', data: stages.map((x: any) => x.in_progress || 0), itemStyle: { color: t.primary } },
      { name: '完成', type: 'bar', data: stages.map((x: any) => x.today_completed || 0), itemStyle: { color: t.success } },
      { name: '拒绝', type: 'bar', data: stages.map((x: any) => x.today_rejected || 0), itemStyle: { color: t.danger } },
    ],
  })
}

function renderThroughputChart() {
  const series = throughput.value || []
  const t = readChartTheme()
  throughputChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成', '拒绝'] },
    grid: { left: 50, right: 30, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: series.map((x: any) => x.date) },
    yAxis: { type: 'value' },
    series: [
      { name: '完成', type: 'line', smooth: true, data: series.map((x: any) => x.completed || 0), itemStyle: { color: t.success } },
      { name: '拒绝', type: 'line', smooth: true, data: series.map((x: any) => x.rejected || 0), itemStyle: { color: t.danger } },
    ],
  })
}

async function reloadAll() {
  await Promise.all([loadSummary(), loadThroughput()])
}

onMounted(async () => {
  await loadProjects()
  await reloadAll()
})
</script>

<style lang="scss" scoped>
.monitor-overview {
  padding: 16px 24px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 500;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  &__kpi {
    :deep(.el-card__body) {
      padding: 16px 20px;
    }
  }

  &__kpi-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 6px;
  }

  &__kpi-value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;

    &.good { color: var(--el-color-success); }
    &.warn { color: var(--el-color-warning); }
  }

  &__kpi-hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-top: 4px;
  }

  &__chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__chart-card {
    :deep(.el-card__body) {
      padding: 12px;
    }
  }

  &__chart-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  &__chart {
    width: 100%;
    height: 280px;
  }
}
</style>
