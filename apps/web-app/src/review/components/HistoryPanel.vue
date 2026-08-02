<template>
  <div class="history-panel">
    <el-tabs v-model="activeTab" class="history-tabs">
      <el-tab-pane label="流转历史" name="history">
        <StageHistory :instance="instance" />
      </el-tab-pane>
      <el-tab-pane label="版本 Diff" name="diff">
        <DiffView
          :instance-id="instance?.id"
          :unit-id="instance?.unit_id"
          :latest-version="latestVersion"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkflowInstance } from '@/types/api'
import StageHistory from './StageHistory.vue'
import DiffView from './DiffView.vue'

const props = defineProps<{
  instance: WorkflowInstance | null
  latestVersion?: number | null
}>()

const activeTab = ref<'history' | 'diff'>('history')

const latestVersion = computed(() => props.latestVersion ?? null)
</script>

<style scoped>
.history-panel {
  height: 100%;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}
.history-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.history-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
}
.history-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
