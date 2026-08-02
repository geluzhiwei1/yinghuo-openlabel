<template>
  <div class="stage-history">
    <div v-if="!instance || runs.length === 0" class="empty">
      <el-empty :image-size="80" description="暂无流转记录" />
    </div>
    <el-timeline v-else>
      <el-timeline-item
        v-for="(run, idx) in runs"
        :key="idx"
        :type="timelineType(run.decision)"
        :timestamp="formatTime(run.finished_at || run.started_at)"
        placement="top"
      >
        <div class="run-head">
          <span class="stage">{{ run.stage_code }}</span>
          <el-tag :type="decisionTagType(run.decision)" size="small" effect="plain">
            {{ decisionLabel(run.decision) }}
          </el-tag>
          <span class="actor">操作人 #{{ run.actor_id }}</span>
        </div>
        <div v-if="run.reject_reason" class="reject-reason">
          <div class="reason-row">
            <span class="reason-key">类别:</span>
            <code>{{ run.reject_reason.category }}</code>
          </div>
          <div class="reason-row">
            <span class="reason-key">严重度:</span>
            <el-tag :type="severityTagType(run.reject_reason.severity)" size="small">
              {{ severityLabel(run.reject_reason.severity) }}
            </el-tag>
          </div>
          <div v-if="run.reject_reason.note" class="reason-note">
            {{ run.reject_reason.note }}
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowInstance, StageRun } from '@/types/api'

const props = defineProps<{ instance: WorkflowInstance | null }>()

const runs = computed<StageRun[]>(
  () => (props.instance?.stage_history ?? []) as StageRun[],
)

const timelineType = (decision: string) => {
  if (decision === 'approved') return 'success'
  if (decision === 'rejected') return 'danger'
  return 'info'
}

const decisionTagType = (d: string) => {
  if (d === 'approved') return 'success'
  if (d === 'rejected') return 'danger'
  return 'info'
}

const decisionLabel = (d: string) => {
  if (d === 'approved') return '通过'
  if (d === 'rejected') return '驳回'
  return d
}

const severityTagType = (s: string) => {
  if (s === 'critical') return 'danger'
  if (s === 'major') return 'warning'
  if (s === 'minor') return 'info'
  return 'info'
}

const severityLabel = (s: string) => {
  if (s === 'critical') return '致命'
  if (s === 'major') return '严重'
  if (s === 'minor') return '轻微'
  return s
}

const formatTime = (s?: string): string => {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}
</script>

<style scoped>
.stage-history {
  padding: 12px 16px;
  height: 100%;
  overflow-y: auto;
}
.empty {
  padding: 24px 0;
}
.run-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.stage {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  font-size: 13px;
}
.actor {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.reject-reason {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.reason-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.reason-key {
  color: var(--el-text-color-secondary);
}
.reason-row code {
  background: var(--el-fill-color);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.reason-note {
  margin-top: 4px;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
}
</style>
