<template>
  <div class="lab-shell" :class="{ 'lab-shell--with-sidebar': showSidebar }">
    <LabTopBar>
      <template v-if="$slots['topbar-actions']" #actions><slot name="topbar-actions" /></template>
      <template v-if="$slots['topbar-nav']" #nav><slot name="topbar-nav" /></template>
    </LabTopBar>

    <div class="lab-shell__body">
      <aside v-if="showSidebar" class="lab-shell__sidebar">
        <slot name="sidebar">
          <LabSidebar :menu="menu" />
        </slot>
      </aside>

      <main class="lab-shell__main">
        <slot />
      </main>
    </div>

    <footer v-if="footer" class="lab-shell__footer">
      <slot name="footer">
        <LabTicker v-if="footer === 'ticker'" :items="tickerItems" />
        <LabStatusFooter
          v-else-if="footer === 'status'"
          :status="statusText"
          :metrics="statusMetrics"
        />
      </slot>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LabTopBar from './LabTopBar.vue'
import LabSidebar from './LabSidebar.vue'
import LabTicker from './LabTicker.vue'
import LabStatusFooter from './LabStatusFooter.vue'

type MenuItem = {
  index: string
  title: string
  icon?: string
  children?: MenuItem[]
}

type TickerItem = string

type StatusMetric = { label: string; value: string | number }

const props = withDefaults(defineProps<{
  sidebar?: boolean | null
  menu?: MenuItem[]
  footer?: 'ticker' | 'status' | null
  tickerItems?: TickerItem[]
  statusText?: string
  statusMetrics?: StatusMetric[]
}>(), {
  sidebar: null,
  footer: null,
  tickerItems: () => [
    'OP-7734', 'BATCH B-092', '42 任务待标注', '3 标注员在线',
    '60 FPS', 'CAM-LEFT-014', 'FRAME 00847', 'AUTO-SAVE 00:00:12',
  ],
  statusText: '就绪',
  statusMetrics: () => [],
})

const showSidebar = computed(() => props.sidebar !== null)
</script>

<style scoped>
.lab-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--lab-paper);
}

.lab-shell__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.lab-shell__sidebar {
  width: var(--lab-sidebar-w);
  flex-shrink: 0;
  padding: 16px 12px;
  overflow-y: auto;
  background: transparent;
}

.lab-shell__main {
  flex: 1;
  min-width: 0;
  padding: var(--lab-space-page-t) var(--lab-space-page-x) var(--lab-space-page-b);
  overflow-y: auto;
}

@media (min-width: 1024px) {
  .lab-shell__main {
    padding-left: var(--lab-space-page-x-lg);
    padding-right: var(--lab-space-page-x-lg);
  }
}

.lab-shell__footer {
  flex-shrink: 0;
  height: var(--lab-footer-h);
  border-top: 1px solid var(--lab-hairline);
  background: var(--lab-paper);
}
</style>
