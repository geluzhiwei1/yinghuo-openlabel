<template>
  <div class="dashboard-v2">
    <!-- Hero -->
    <div class="dash-hero">
      <div class="dash-hero__left">
        <span class="dash-hero__eyebrow">
          <span class="dash-hero__dot" />
          DASHBOARD · §HOME
        </span>
        <h1 class="dash-hero__title">
          {{ t('dashboard.greeting') || '早上好' }}<span class="dash-hero__period">.</span>
        </h1>
        <p class="dash-hero__sub">
          {{ userAuth.user.name || userAuth.user.email || userAuth.user.mobile_phone_no || t('dashboard.guest') }}
          <span v-if="lastLoginText" class="dash-hero__login">
            · 上次登录 {{ lastLoginText }}
          </span>
        </p>
      </div>
      <div class="dash-hero__right">
        <el-link href="https://gitee.com/gerwee/yinghuo/issues" target="_blank" :underline="'never'" class="dash-hero__link">
          <Icon icon="lucide:message-square" :width="14" />
          {{ t('dashboard.action.feedback') }}
        </el-link>
        <el-link href="https://www.bilibili.com/video/BV1xoTvz2ES5?t=4.4" target="_blank" :underline="'never'" class="dash-hero__link">
          <Icon icon="lucide:video" :width="14" />
          {{ t('dashboard.action.tutorial') }}
        </el-link>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="dash-kpi-grid">
      <div
        v-for="(kpi, idx) in kpiCards"
        :key="kpi.key"
        class="kpi-card"
        :class="`kpi-card--${kpi.color}`"
      >
        <span class="kpi-card__idx">{{ String(idx + 1).padStart(2, '0') }}</span>
        <div class="kpi-card__icon">
          <Icon :icon="kpi.icon" :width="22" />
        </div>
        <div class="kpi-card__body">
          <div class="kpi-card__value">{{ kpi.value }}</div>
          <div class="kpi-card__label">{{ kpi.label }}</div>
        </div>
        <div v-if="kpi.sub" class="kpi-card__sub">
          <Icon :icon="kpi.subIcon || 'lucide:chevron-up'" :width="14" />
          {{ kpi.sub }}
        </div>
      </div>
    </div>

    <!-- Main content grid -->
    <div class="dashboard-v2__content-grid">
      <!-- Task progress section -->
      <div class="dashboard-v2__section dashboard-v2__section--chart">
        <div class="dashboard-v2__section-header">
          <div class="dashboard-v2__section-eyebrow">CHART · §3.1</div>
          <h3 class="dashboard-v2__section-title">
            {{ t('dashboard.section.taskProgress') }}<span class="dashboard-v2__section-period">.</span>
          </h3>
          <el-segmented v-model="chartPeriod" :options="chartPeriodOptions" size="small" class="dash-segmented" />
        </div>
        <div class="chart-placeholder">
          <div class="chart-placeholder__bars">
            <div
              v-for="(bar, i) in weeklyBars"
              :key="i"
              class="chart-placeholder__bar-group"
            >
              <div class="chart-placeholder__bar-stack">
                <div class="chart-placeholder__bar chart-placeholder__bar--new" :style="{ height: bar.newHeight + '%' }" />
                <div class="chart-placeholder__bar chart-placeholder__bar--done" :style="{ height: bar.doneHeight + '%' }" />
              </div>
              <span class="chart-placeholder__label">{{ bar.label }}</span>
              <span class="chart-placeholder__num">{{ bar.done }}<span class="chart-placeholder__num-sep">/</span>{{ bar.new }}</span>
            </div>
          </div>
          <div class="chart-placeholder__legend">
            <span class="chart-placeholder__legend-item chart-placeholder__legend-item--new">
              <span class="chart-placeholder__legend-dot" />{{ t('dashboard.chart.new') }}
            </span>
            <span class="chart-placeholder__legend-item chart-placeholder__legend-item--done">
              <span class="chart-placeholder__legend-dot" />{{ t('dashboard.chart.completed') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Todo list section -->
      <div class="dashboard-v2__section dashboard-v2__section--todo">
        <div class="dashboard-v2__section-header">
          <div>
            <div class="dashboard-v2__section-eyebrow">TODO · §B</div>
            <h3 class="dashboard-v2__section-title">
              {{ t('dashboard.section.myTodo') }}<span class="dashboard-v2__section-period">.</span>
            </h3>
          </div>
          <span class="todo-count-chip">
            <span class="todo-count-chip__dot" />
            {{ todoItems.length }}
          </span>
        </div>
        <div v-if="todoLoading" class="dashboard-v2__loading">
          <Icon icon="lucide:loader-circle" class="is-loading" />
        </div>
        <div v-else-if="todoItems.length === 0" class="dashboard-v2__empty">
          <EmptyState icon="lucide:circle-check" :title="t('dashboard.todo.empty')" />
        </div>
        <div v-else class="dashboard-v2__todo-list">
          <div
            v-for="item in todoItems"
            :key="item.uuid"
            class="todo-item"
            @click="openJob(item)"
          >
            <div class="todo-item__left">
              <Icon
                :icon="item.status === '待修正' ? 'lucide:circle-alert' : 'lucide:clock'"
                :class="['todo-item__icon', `todo-item__icon--${statusColor(item.status)}`]"
                :width="18"
              />
              <div class="todo-item__info">
                <div class="todo-item__name">{{ item.name }}</div>
                <div class="todo-item__meta">
                  <code class="todo-item__mission">{{ item.mission }}</code>
                  <span class="todo-item__seq">{{ item.data_seq }}</span>
                </div>
              </div>
            </div>
            <div class="todo-item__right">
              <span
                class="todo-status-chip"
                :class="`todo-status-chip--${statusColor(item.status)}`"
              >
                {{ item.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="dash-quick">
      <span class="dash-quick__eyebrow">QUICK · ACTIONS</span>
      <div class="dash-quick__row">
        <button class="dash-act dash-act--primary" @click="$router.push('/my-job')">
          <Icon icon="lucide:plus" :width="16" />
          <span>{{ t('dashboard.action.newJob') }}</span>
        </button>
        <button class="dash-act" @click="$router.push('/my-job')">
          <Icon icon="lucide:list-checks" :width="16" />
          <span>{{ t('dashboard.action.myJobs') }}</span>
        </button>
        <button class="dash-act" @click="$router.push('/anno-specification')">
          <Icon icon="lucide:book" :width="16" />
          <span>{{ t('dashboard.action.specs') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { userAuth } from '@/states/UserState'
import { formatUtc } from '@/libs/datetime'
import { statisticsApi, annoJobPerformApi } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import { i18n } from '@/locales'
import type { JobPerform } from '@/types/jobPerform'

const t = (key: string) => i18n.global.t(key)
const router = useRouter()

const stats = ref({ myJobs: 0, collabJobs: 0, myAnnotations: 0, rejectionRate: 0 })
const todoItems = ref<any[]>([])
const todoLoading = ref(false)
const chartPeriod = ref('7d')
const chartPeriodOptions = [
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
]

const lastLoginText = computed(() => {
  const last = userAuth.value.user?.last_login
  if (!last) return ''
  return formatUtc(last)
})

const kpiCards = computed(() => [
  {
    key: 'my-jobs',
    icon: 'lucide:briefcase',
    label: t('dashboard.kpi.myJobs'),
    value: stats.value.myJobs,
    color: 'primary',
    sub: '',
    subIcon: '',
  },
  {
    key: 'collab-jobs',
    icon: 'lucide:users',
    label: t('dashboard.kpi.collabJobs'),
    value: stats.value.collabJobs,
    color: 'info',
    sub: '',
    subIcon: '',
  },
  {
    key: 'my-annotations',
    icon: 'lucide:circle-check',
    label: t('dashboard.kpi.myAnnotations'),
    value: stats.value.myAnnotations,
    color: 'success',
    sub: '',
    subIcon: '',
  },
  {
    key: 'rejection-rate',
    icon: 'lucide:circle-alert',
    label: t('dashboard.kpi.rejectionRate'),
    value: stats.value.rejectionRate > 0 ? `${stats.value.rejectionRate}%` : '0%',
    color: 'danger',
    sub: '',
    subIcon: stats.value.rejectionRate > 0 ? 'lucide:chevron-up' : '',
  },
])

const weeklyBars = ref([
  { label: '周一', newHeight: 60, doneHeight: 45, new: 12, done: 9 },
  { label: '周二', newHeight: 80, doneHeight: 70, new: 16, done: 14 },
  { label: '周三', newHeight: 55, doneHeight: 55, new: 11, done: 11 },
  { label: '周四', newHeight: 90, doneHeight: 75, new: 18, done: 15 },
  { label: '周五', newHeight: 70, doneHeight: 65, new: 14, done: 13 },
  { label: '周六', newHeight: 40, doneHeight: 38, new: 8, done: 7 },
  { label: '周日', newHeight: 35, doneHeight: 30, new: 7, done: 6 },
])

const statusColor = (status?: string) => {
  if (status === '待修正') return 'danger'
  if (status === '待审核') return 'warning'
  return 'info'
}

const statusTagType = (status?: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  if (status === '待修正') return 'danger'
  if (status === '待审核') return 'warning'
  return 'info'
}

const missionAnnoUri = (stream: string, item: any): string => {
  const miss = item.label_spec?.mission?.key
  if (miss === 'ObjectBBox3d' || miss === 'PcPolyline3d' || miss === 'PcSemantic3d') {
    return `pc.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
  }
  return `anno.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
}

const loadStats = () => {
  statisticsApi.my({}).then((res) => {
    stats.value.myJobs = res.data?.job?.admin ?? 0
    stats.value.collabJobs = res.data?.job?.collaborator ?? 0
    stats.value.myAnnotations = res.data?.anno?.total_count ?? 0
    stats.value.rejectionRate = res.data?.anno?.rejection_rate ?? 0
  })
}

const loadTodo = () => {
  todoLoading.value = true
  annoJobPerformApi
    .searchJob({
      pager: { page: 1, page_size: 20 },
      query: { job_status: undefined },
    })
    .then((res) => {
      const pending = ['待修正', '待审核']
      todoItems.value = res.data
        .filter((item: any) => {
          const s = item.current_status?.status
          return pending.includes(s)
        })
        .slice(0, 10)
        .map((item: any) => ({
          uuid: item._id,
          name: item.name,
          mission: item.label_spec?.mission?.key ?? '-',
          data_seq: item.label_spec?.data?.seq ?? '-',
          status: item.current_status?.status,
          anno_hrefs: item.anno_hrefs,
        }))
    })
    .finally(() => {
      todoLoading.value = false
    })
}

const openJob = (item: any) => {
  if (item.anno_hrefs?.[0]?.uri) {
    window.open(item.anno_hrefs[0].uri, '_blank')
  }
}

onMounted(() => {
  loadStats()
  loadTodo()
})
</script>

<style scoped>
.dashboard-v2 {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
}

/* ── Hero ─────────────────────────────────────── */
.dash-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 0 16px;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
  flex-wrap: wrap;
}

.dash-hero__left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dash-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.dash-hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 12px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.dash-hero__title {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 64px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1;
  letter-spacing: -0.02em;
}

.dash-hero__period {
  color: var(--lab-coral);
}

.dash-hero__sub {
  margin: 0;
  font-size: 14px;
  color: var(--lab-slate);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dash-hero__login {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--lab-ash);
}

.dash-hero__right {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 8px;
}

.dash-hero__link {
  font-size: 12px !important;
  color: var(--lab-slate) !important;
  --el-link-text-color: var(--lab-slate);
  --el-link-hover-text-color: var(--lab-ink);
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.dash-hero__link:hover {
  color: var(--lab-coral) !important;
  --el-link-hover-text-color: var(--lab-coral);
}

/* ── KPI grid ───────────────────────────────── */
.dash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .dash-kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 500px) {
  .dash-kpi-grid { grid-template-columns: 1fr; }
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 22px 24px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(14,14,16,0.02), 0 6px 18px rgba(14,14,16,0.04);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(14,14,16,0.06), 0 16px 32px rgba(14,14,16,0.08);
}

.kpi-card__idx {
  position: absolute;
  top: 12px;
  right: 16px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--lab-fog);
}

.kpi-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--lab-radius-pill, 999px);
  flex-shrink: 0;
}

.kpi-card--primary .kpi-card__icon {
  background: var(--lab-ink);
  color: var(--lab-lime);
}
.kpi-card--info .kpi-card__icon {
  background: var(--lab-lilac, #d9ccff);
  color: var(--lab-graphite);
}
.kpi-card--success .kpi-card__icon {
  background: var(--lab-mint, #b8f0d0);
  color: var(--lab-graphite);
}
.kpi-card--danger .kpi-card__icon {
  background: rgba(255,106,61,0.18);
  color: var(--lab-coral);
}

.kpi-card__body {
  flex: 1;
  min-width: 0;
}

.kpi-card__value {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 32px;
  font-weight: 500;
  color: var(--lab-ink);
  line-height: 1;
  margin-bottom: 4px;
  letter-spacing: -0.02em;
}

.kpi-card__label {
  font-size: 12px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.kpi-card__sub {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--lab-coral);
  flex-shrink: 0;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  padding: 2px 8px;
  background: rgba(255,106,61,0.1);
  border-radius: var(--lab-radius-pill, 999px);
}

/* ── Content grid ─────────────────────────────── */
.dashboard-v2__content-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  min-height: 360px;
}

@media (max-width: 900px) {
  .dashboard-v2__content-grid { grid-template-columns: 1fr; }
}

.dashboard-v2__section {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 1px 2px rgba(14,14,16,0.02), 0 4px 14px rgba(14,14,16,0.03);
}

.dashboard-v2__section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard-v2__section-eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--lab-ash);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.dashboard-v2__section-title {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 26px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1;
  letter-spacing: -0.01em;
}

.dashboard-v2__section-period {
  color: var(--lab-coral);
}

.dash-segmented :deep(.el-segmented) {
  background: var(--lab-cream);
  border-radius: var(--lab-radius-lg, 8px);
  padding: 3px;
}

.dash-segmented :deep(.el-segmented__item-label) {
  font-size: 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

/* ── Chart placeholder ─────────────────────────── */
.chart-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-placeholder__bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 12px;
  min-height: 200px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
}

.chart-placeholder__bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.chart-placeholder__bar-stack {
  width: 100%;
  max-width: 36px;
  height: 180px;
  display: flex;
  flex-direction: column-reverse;
  align-items: stretch;
  gap: 2px;
}

.chart-placeholder__bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 400ms cubic-bezier(.16,.84,.44,1);
}

.chart-placeholder__bar--new {
  background: var(--lab-line);
}

.chart-placeholder__bar--done {
  background: var(--lab-ink);
}

.chart-placeholder__label {
  font-size: 11px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.chart-placeholder__num {
  font-size: 10px;
  color: var(--lab-fog);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.chart-placeholder__num-sep {
  margin: 0 1px;
}

.chart-placeholder__legend {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.chart-placeholder__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.06em;
}

.chart-placeholder__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}

.chart-placeholder__legend-item--new .chart-placeholder__legend-dot {
  background: var(--lab-line);
}

.chart-placeholder__legend-item--done .chart-placeholder__legend-dot {
  background: var(--lab-ink);
}

/* ── Todo list ───────────────────────────────── */
.todo-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.todo-count-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-coral);
  animation: lab-blink 1.6s ease-in-out infinite;
}

.dashboard-v2__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--lab-ink);
}

.dashboard-v2__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard-v2__todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 320px;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--lab-radius-pill, 999px);
  cursor: pointer;
  transition: background 150ms ease;
  border: 1px solid transparent;
}

.todo-item:hover {
  background: var(--lab-cream);
  border-color: var(--lab-line);
}

.todo-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.todo-item__icon--danger { color: var(--lab-coral); }
.todo-item__icon--warning { color: #d4a82d; }
.todo-item__icon--info { color: var(--lab-slate); }

.todo-item__info {
  min-width: 0;
}

.todo-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--lab-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.todo-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.todo-item__mission {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  background: var(--lab-cream);
  color: var(--lab-graphite);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.todo-item__seq {
  font-size: 10px;
  color: var(--lab-fog);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.todo-item__right {
  flex-shrink: 0;
}

.todo-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.todo-status-chip--danger {
  background: rgba(255,106,61,0.14);
  color: var(--lab-coral);
}

.todo-status-chip--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}

.todo-status-chip--info {
  background: var(--lab-cream);
  color: var(--lab-slate);
}

/* ── Quick actions ───────────────────────────── */
.dash-quick {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.dash-quick__eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.dash-quick__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.dash-act {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  height: 40px;
  border-radius: var(--lab-radius-pill, 999px);
  border: 1px solid var(--lab-line);
  background: var(--lab-snow);
  color: var(--lab-ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.dash-act:hover {
  border-color: var(--lab-ink);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(14,14,16,0.08);
}

.dash-act--primary {
  background: var(--lab-ink);
  color: var(--lab-snow);
  border-color: var(--lab-ink);
  box-shadow: 0 4px 14px rgba(14,14,16,0.18);
}

.dash-act--primary:hover {
  background: var(--lab-graphite);
  box-shadow: 0 8px 22px rgba(14,14,16,0.28);
}

.dash-act--primary svg {
  background: var(--lab-lime);
  color: var(--lab-ink);
  padding: 2px;
  border-radius: 50%;
  width: 18px;
  height: 18px;
}
</style>
