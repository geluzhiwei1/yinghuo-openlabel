<template>
  <header class="review-header">
    <div class="header-left">
      <div class="brand">
        <span class="brand__dot" aria-hidden="true" />
        <div class="brand__text">
          <span class="brand__title">审核工作台<span class="brand__period">.</span></span>
          <span class="brand__sub">REVIEW · §BIZ</span>
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
          placeholder="stage code"
          style="width: 160px"
          clearable
          @change="reload"
        />
      </div>
    </div>

    <div class="header-right">
      <button class="help-btn" @click="showHelp">
        <Icon icon="lucide:circle-help" :width="14" />
        <span>快捷键</span>
        <kbd>?</kbd>
      </button>
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
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { userAuth, cleanLoginfo } from '@/states/UserState'
import { useReviewSession } from '../composables/useReviewSession'
import { useHelpOverlay } from '../composables/useHelpOverlay'

const {
  projectId,
  projects,
  stageFilter,
  statusFilter,
  loadInstances,
  selectProject,
} = useReviewSession()

const helpOverlay = useHelpOverlay()

const loadingProjects = ref(false)

const displayName = computed(
  () =>
    userAuth.value.user?.name ||
    userAuth.value.user?.email ||
    userAuth.value.user?.username ||
    '当前用户',
)

const reload = async () => {
  await loadInstances()
}

const onProjectChange = async (id: number | null) => {
  await selectProject(id)
}

const showHelp = () => {
  helpOverlay.show()
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

onMounted(async () => {
  loadingProjects.value = true
  try {
    // bootstrap 已经在 workbench 调用过;这里只兜底加载
    if (projects.value.length === 0) {
      // selectProject 的 reload 由 workbench 触发
    }
  } finally {
    loadingProjects.value = false
  }
})
</script>

<style scoped>
.review-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 60px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-hairline);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

/* ── Brand ───────────────────────────────────── */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand__dot {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--lab-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.brand__dot::after {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
  gap: 2px;
}

.brand__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 22px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
}

.brand__period {
  color: var(--lab-coral);
}

.brand__sub {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.divider {
  width: 1px;
  height: 22px;
  background: var(--lab-line);
  flex-shrink: 0;
}

/* ── Project picker ──────────────────────────── */
.project-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.project-picker :deep(.el-input__wrapper),
.filter-group :deep(.el-input__wrapper) {
  border-radius: var(--lab-radius-lg, 8px);
  background: var(--lab-cream);
  box-shadow: none !important;
  border: 1px solid transparent;
  transition: border-color 150ms ease;
}

.project-picker :deep(.el-input__wrapper:hover),
.project-picker :deep(.el-input.is-focus .el-input__wrapper),
.filter-group :deep(.el-input__wrapper:hover),
.filter-group :deep(.el-input.is-focus .el-input__wrapper) {
  border-color: var(--lab-ink) !important;
}

.project-picker :deep(.el-input__inner),
.filter-group :deep(.el-input__inner) {
  font-size: 12.5px;
  color: var(--lab-ink);
  height: 32px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Header right ────────────────────────────── */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.help-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-pill, 999px);
  color: var(--lab-slate);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms ease;
}

.help-btn:hover {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
  background: var(--lab-cream);
}

.help-btn kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--lab-ink);
  color: var(--lab-lime);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  font-weight: 500;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 12px 4px 4px;
  border-radius: var(--lab-radius-pill, 999px);
  background: transparent;
  border: 1px solid transparent;
  color: var(--lab-slate);
  transition: all 150ms ease;
  outline: none;
}

.user-trigger:hover {
  background: var(--lab-cream);
  border-color: var(--lab-line);
  color: var(--lab-ink);
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--lab-ink);
  color: var(--lab-lime);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  flex-shrink: 0;
}

.user-name {
  font-size: 12.5px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

:global(html.dark) .review-header {
  background: var(--lab-ink);
  border-bottom-color: rgba(255,255,255,0.06);
}
:global(html.dark) .brand__title { color: var(--lab-snow); }
:global(html.dark) .divider { background: rgba(255,255,255,0.1); }
</style>
