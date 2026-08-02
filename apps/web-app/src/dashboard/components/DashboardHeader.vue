<template>
  <header class="dashboard-header">
    <div class="header-left">
      <div class="brand">
        <span class="brand__dot" aria-hidden="true" />
        <div class="brand__text">
          <span class="brand__title">质量看板<span class="brand__period">.</span></span>
          <span class="brand__sub">DASHBOARD · BIZ</span>
        </div>
      </div>

      <span class="divider" aria-hidden="true" />

      <div class="project-picker" v-loading="loading">
        <span class="label">PROJECT</span>
        <el-select
          v-model="projectId"
          filterable
          placeholder="选择项目"
          style="width: 220px"
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
    </div>

    <nav class="header-nav">
      <RouterLink to="/overview">
        <span class="nav-idx">01</span>
        <span>总览</span>
      </RouterLink>
      <RouterLink to="/by-assignee">
        <span class="nav-idx">02</span>
        <span>标注员</span>
      </RouterLink>
      <RouterLink to="/by-reviewer">
        <span class="nav-idx">03</span>
        <span>审核员</span>
      </RouterLink>
      <RouterLink to="/reject-categories">
        <span class="nav-idx">04</span>
        <span>驳回类别</span>
      </RouterLink>
      <RouterLink to="/stage-performance">
        <span class="nav-idx">05</span>
        <span>stage 性能</span>
      </RouterLink>
    </nav>

    <div class="header-right">
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
            <el-dropdown-item @click="backToWorkspace">回到工作台</el-dropdown-item>
            <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import ToggleDark from '@/components/ToggleDark.vue'
import { userAuth, cleanLoginfo } from '@/states/UserState'
import { useDashboardProject } from '../composables/useDashboardProject'

const { projectId, projects, loading, selectProject } = useDashboardProject()

const displayName = computed(
  () =>
    userAuth.value.user?.name ||
    userAuth.value.user?.email ||
    userAuth.value.user?.username ||
    '当前用户',
)

const onProjectChange = async (id: number | null) => {
  await selectProject(id)
  ElMessage.success('已切换项目')
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
.dashboard-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  height: 60px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-hairline);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* ── Brand chip ─────────────────────────────────── */
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
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
}

/* ── Project picker ─────────────────────────────── */
.project-picker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.project-picker :deep(.el-input__wrapper) {
  border-radius: var(--lab-radius-lg, 8px);
  background: var(--lab-cream);
  box-shadow: none !important;
  border: 1px solid transparent;
  transition: border-color 150ms ease;
}

.project-picker :deep(.el-input__wrapper:hover),
.project-picker :deep(.el-input.is-focus .el-input__wrapper) {
  border-color: var(--lab-ink) !important;
}

.project-picker :deep(.el-input__inner) {
  font-size: 13px;
  color: var(--lab-ink);
  height: 32px;
}

/* ── Nav pills ──────────────────────────────────── */
.header-nav {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.header-nav a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--lab-radius-pill, 999px);
  color: var(--lab-slate);
  text-decoration: none;
  font-size: 13px;
  transition: all 150ms ease;
}

.header-nav a:hover {
  background: var(--lab-cream);
  color: var(--lab-ink);
}

.header-nav a.router-link-active {
  background: var(--lab-ink);
  color: var(--lab-snow);
  font-weight: 500;
}

.header-nav a.router-link-active .nav-idx {
  color: var(--lab-lime);
}

.nav-idx {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--lab-fog);
}

/* ── Header right ───────────────────────────────── */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
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
  letter-spacing: 0;
  flex-shrink: 0;
}

.user-name {
  font-size: 12.5px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

/* Dark theme support */
:global(html.dark) .dashboard-header {
  background: var(--lab-ink);
  border-bottom-color: rgba(255,255,255,0.06);
}
:global(html.dark) .brand__title { color: var(--lab-snow); }
:global(html.dark) .divider { background: rgba(255,255,255,0.1); }
:global(html.dark) .project-picker :deep(.el-input__wrapper) { background: rgba(255,255,255,0.06); }
:global(html.dark) .header-nav a { color: rgba(255,255,255,0.6); }
:global(html.dark) .header-nav a:hover { background: rgba(255,255,255,0.08); color: var(--lab-snow); }
:global(html.dark) .user-trigger { color: rgba(255,255,255,0.6); }
:global(html.dark) .user-trigger:hover { background: rgba(255,255,255,0.08); color: var(--lab-snow); }
</style>
