<template>
  <header class="qa-header">
    <div class="header-left">
      <div class="brand">
        <span class="brand__dot" aria-hidden="true" />
        <div class="brand__text">
          <span class="brand__title">终检<span class="brand__period">.</span></span>
          <span class="brand__sub">QA · INSPECT</span>
        </div>
      </div>

      <span class="divider" aria-hidden="true" />

      <div class="project-picker" v-loading="loadingProjects">
        <span class="label">PROJECT</span>
        <el-select
          v-model="projectId"
          filterable
          placeholder="选择项目"
          style="width: 200px"
          @change="onProjectChange"
        >
          <el-option
            v-for="p in projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
      </div>

      <div class="filter-group">
        <el-select
          v-model="statusFilter"
          placeholder="状态"
          style="width: 130px"
          @change="reload"
        >
          <el-option label="进行中" value="in_progress" />
          <el-option label="待仲裁" value="arbitrate" />
          <el-option label="全部状态" value="" />
        </el-select>
        <el-input
          v-model="stageFilter"
          placeholder="stage code(留空走 QA 默认)"
          style="width: 240px"
          clearable
          @change="reload"
        />
      </div>
    </div>

    <div class="header-right">
      <el-popover
        v-if="aggregatedCoverage"
        placement="bottom"
        :width="340"
        trigger="hover"
        :teleported="true"
        popper-class="y-toolbar-popper qa-coverage-pop"
      >
        <template #reference>
          <div class="coverage-chip" v-loading="loadingCoverage">
            <span class="chip-label">抽样覆盖</span>
            <div class="chip-bar">
              <div
                class="chip-bar__fill"
                :class="`chip-bar__fill--${coverageStatus}`"
                :style="{ width: `${Math.round((aggregatedCoverage.rate ?? 0) * 100)}%` }"
              />
            </div>
            <span class="chip-num">
              {{ aggregatedCoverage.sampled }}<span class="chip-num-sep">/</span>{{ aggregatedCoverage.entered }}
            </span>
            <span class="chip-pct">{{ Math.round((aggregatedCoverage.rate ?? 0) * 100) }}%</span>
          </div>
        </template>
        <div class="coverage-detail">
          <div class="detail-eyebrow">STAGE COVERAGE</div>
          <div class="detail-title">各抽样 stage 分布</div>
          <div v-for="row in sampleCoverage" :key="row.stage_code" class="detail-row">
            <code>{{ row.stage_code }}</code>
            <div class="detail-bar">
              <div
                class="detail-bar__fill"
                :style="{ width: `${Math.round((row.coverage ?? 0) * 100)}%` }"
              />
            </div>
            <span class="detail-num">{{ row.actually_sampled }}<span class="detail-num-sep">/</span>{{ row.entered }}</span>
          </div>
        </div>
      </el-popover>

      <el-button text class="help-btn" @click="showHelp">
        <Icon icon="lucide:circle-help" :width="16" />
        <span>快捷键</span>
      </el-button>
      <ToggleDark />
      <el-dropdown :teleported="true" popper-class="y-toolbar-popper">
        <span class="user-trigger">
          <span class="user-avatar" aria-hidden="true">
            {{ (displayName || '?').slice(0, 1).toUpperCase() }}
          </span>
          <span class="user-name">{{ displayName }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="backToReview">审核工作台</el-dropdown-item>
            <el-dropdown-item @click="backToDashboard">质量看板</el-dropdown-item>
            <el-dropdown-item @click="backToWorkspace">工作台</el-dropdown-item>
            <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { userAuth, cleanLoginfo } from '@/states/UserState'
import { useQaSession } from '../composables/useQaSession'
import { useHelpOverlay } from '@/review/composables/useHelpOverlay'

const {
  projectId,
  projects,
  stageFilter,
  statusFilter,
  loadInstances,
  selectProject,
  sampleCoverage,
  aggregatedCoverage,
  loadingCoverage,
} = useQaSession()

const help = useHelpOverlay()

const loadingProjects = computed(() => false)

const displayName = computed(
  () =>
    userAuth.value.user?.name ||
    userAuth.value.user?.email ||
    userAuth.value.user?.username ||
    '当前用户',
)

const coverageStatus = computed(() => {
  const r = aggregatedCoverage.value?.rate ?? 0
  if (r >= 0.8) return 'success'
  if (r >= 0.4) return 'warning'
  return 'exception'
})

const reload = async () => {
  await loadInstances()
}

const onProjectChange = async (id: number | null) => {
  await selectProject(id)
}

const showHelp = () => help.show()

const backToReview = () => {
  window.location.href = `${import.meta.env.BASE_URL}/review.html`
}
const backToDashboard = () => {
  window.location.href = `${import.meta.env.BASE_URL}/dashboard.html`
}
const backToWorkspace = () => {
  window.location.href = `${import.meta.env.BASE_URL}/home.html`
}
const logout = () => {
  cleanLoginfo()
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = `${import.meta.env.BASE_URL}/auth.html`
}
</script>

<style scoped>
.qa-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 60px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-hairline, #ececea);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-right: 4px;
}

.brand__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lab-ink);
  position: relative;
}

.brand__dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 8px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1;
  gap: 3px;
}

.brand__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 22px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 0.9;
  letter-spacing: -0.01em;
}

.brand__period {
  color: var(--lab-coral);
}

.brand__sub {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--lab-ash);
}

.divider {
  width: 1px;
  height: 28px;
  background: var(--lab-hairline, #ececea);
  display: inline-block;
}

.project-picker,
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.coverage-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 14px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill, 999px);
  cursor: default;
  font-size: 12px;
  border: 1px solid transparent;
  transition: border-color 150ms ease;
}

.coverage-chip:hover {
  border-color: var(--lab-line);
}

.chip-label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.chip-bar {
  width: 80px;
  height: 6px;
  background: var(--lab-line);
  border-radius: var(--lab-radius-pill, 999px);
  overflow: hidden;
}

.chip-bar__fill {
  height: 100%;
  border-radius: var(--lab-radius-pill, 999px);
  transition: width 300ms ease;
}

.chip-bar__fill--success {
  background: var(--lab-lime);
}

.chip-bar__fill--warning {
  background: var(--lab-butter, #ffe58a);
}

.chip-bar__fill--exception {
  background: var(--lab-coral);
}

.chip-num {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 12px;
  color: var(--lab-ink);
  font-weight: 500;
}

.chip-num-sep,
.detail-num-sep {
  color: var(--lab-fog);
  margin: 0 1px;
}

.chip-pct {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-graphite);
  padding-left: 6px;
  border-left: 1px solid var(--lab-line);
}

.help-btn {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace) !important;
  font-size: 11px !important;
  letter-spacing: 0.06em;
  color: var(--lab-slate) !important;
}

.help-btn:hover {
  color: var(--lab-ink) !important;
  background: var(--lab-cream) !important;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--lab-ink);
  padding: 4px 12px 4px 4px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill, 999px);
  transition: background 150ms ease;
}

.user-trigger:hover {
  background: var(--lab-line);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--lab-ink);
  color: var(--lab-lime);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 12px;
  font-weight: 500;
}

.user-name {
  font-size: 12px;
  color: var(--lab-graphite);
  font-weight: 500;
}

/* ── Coverage popover ─────────────────────────── */
.coverage-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
}

.detail-eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--lab-ash);
}

.detail-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--lab-ink);
  margin-bottom: 4px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-row code {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  background: var(--lab-cream);
  color: var(--lab-graphite);
  padding: 3px 8px;
  border-radius: 6px;
  min-width: 84px;
}

.detail-bar {
  flex: 1;
  height: 5px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill, 999px);
  overflow: hidden;
}

.detail-bar__fill {
  height: 100%;
  background: var(--lab-ink);
  border-radius: var(--lab-radius-pill, 999px);
  transition: width 300ms ease;
}

.detail-num {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-graphite);
  min-width: 50px;
  text-align: right;
}
</style>
