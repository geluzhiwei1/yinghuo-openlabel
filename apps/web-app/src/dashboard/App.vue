<template>
  <el-config-provider :locale="zhCn">
    <div class="dashboard-shell" data-face="business">
      <DashboardHeader />
      <main class="dashboard-main">
        <RouterView />
      </main>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import DashboardHeader from './components/DashboardHeader.vue'
import { useThemeStore } from '@/store/theme'
import { useDashboardProject } from './composables/useDashboardProject'

const { init } = useDashboardProject()

onMounted(async () => {
  useThemeStore().initTheme()
  // 拉一次 /me:写入 tenant_id / preferences,并把 preferences 里持久化的
  // 最近用过的 project_id 作为初始值,避免每次进看板都要重选
  await init()
})
</script>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--lab-paper);
}
.dashboard-main {
  flex: 1;
  padding: 24px 28px 48px;
  overflow-y: auto;
}
</style>
