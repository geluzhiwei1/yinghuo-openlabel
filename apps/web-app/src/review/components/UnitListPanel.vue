<template>
  <div class="unit-list-panel">
    <div class="panel-header">
      <span class="title">
        <span class="title__eyebrow">QUEUE</span>
        <span class="title__text">待审 Unit<span class="title__period">.</span></span>
      </span>
      <span class="count-chip">
        <span class="count-chip__dot" />
        <span class="count-chip__num">{{ total }}</span>
      </span>
      <button
        class="refresh-btn"
        :class="{ 'refresh-btn--spin': loading }"
        @click="reload"
        :disabled="loading"
        aria-label="刷新"
      >
        <Icon icon="lucide:refresh-cw" :width="14" />
      </button>
    </div>

    <div class="panel-body" v-loading="loading">
      <div
        v-if="instances.length === 0 && !loading"
        class="empty-state"
      >
        <Icon icon="lucide:inbox" :width="32" />
        <p>没有待审 unit</p>
      </div>

      <div
        v-for="(inst, idx) in instances"
        :key="inst.id"
        class="unit-item"
        :class="{ active: currentInstanceId === inst.id }"
        @click="$emit('select', inst)"
      >
        <div class="item-row item-head">
          <span class="unit-id">#{{ inst.unit_id }}</span>
          <span
            v-if="inst.current_status === 'arbitrate'"
            class="item-tag item-tag--warning"
          >
            <span class="item-tag__dot" />
            仲裁
          </span>
          <span
            v-else-if="inst.sample_skipped"
            class="item-tag item-tag--muted"
          >
            抽样跳过
          </span>
        </div>
        <div class="item-row">
          <span class="stage-label">stage:</span>
          <code class="stage-code">{{ inst.current_stage || '—' }}</code>
        </div>
        <div class="item-row meta">
          <span>实例 #{{ inst.id }}</span>
          <span v-if="inst.sample_skipped">已跳过</span>
        </div>
        <div class="index-pin">{{ String(idx + 1).padStart(2, '0') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { WorkflowInstance } from '@/types/api'

defineProps<{
  instances: WorkflowInstance[]
  total: number
  loading: boolean
  currentInstanceId?: number | null
}>()

const emit = defineEmits<{
  (e: 'select', inst: WorkflowInstance): void
  (e: 'reload'): void
}>()

const reload = () => emit('reload')
</script>

<style scoped>
.unit-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lab-snow);
  border-right: 1px solid var(--lab-hairline);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--lab-hairline);
}

.title {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.title__eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.title__text {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 22px;
  font-weight: 400;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
}

.title__period {
  color: var(--lab-coral);
}

.count-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.count-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
}

.count-chip__num {
  color: var(--lab-ink);
  font-weight: 500;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--lab-line);
  color: var(--lab-slate);
  cursor: pointer;
  transition: all 150ms ease;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
  background: var(--lab-cream);
}

.refresh-btn--spin svg {
  animation: lab-spin 1s linear infinite;
}

@keyframes lab-spin {
  to { transform: rotate(360deg); }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--lab-fog);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.unit-item {
  position: relative;
  padding: 12px 14px;
  margin-bottom: 4px;
  border-radius: var(--lab-radius-2xl, 16px);
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid transparent;
}

.unit-item:hover {
  background: var(--lab-cream);
}

.unit-item.active {
  background: var(--lab-ink);
  border-color: var(--lab-ink);
}

.unit-item.active .unit-id,
.unit-item.active .stage-code,
.unit-item.active .meta,
.unit-item.active .stage-label {
  color: var(--lab-snow);
}

.unit-item.active .stage-code {
  background: rgba(255,255,255,0.1);
}

.unit-item.active .index-pin {
  color: var(--lab-lime);
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--lab-slate);
}

.item-head {
  font-size: 14px;
  color: var(--lab-ink);
  font-weight: 500;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
  margin-bottom: 4px;
}

.unit-id {
  flex: 1;
  color: var(--lab-ink);
}

.item-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.item-tag__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.item-tag--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}
.item-tag--warning .item-tag__dot {
  background: var(--lab-graphite);
}

.item-tag--muted {
  background: var(--lab-cream);
  color: var(--lab-ash);
}
.item-tag--muted .item-tag__dot {
  background: var(--lab-fog);
}

.unit-item.active .item-tag--warning {
  background: rgba(255,229,138,0.25);
}

.stage-label {
  color: var(--lab-ash);
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.stage-code {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  background: var(--lab-cream);
  color: var(--lab-ink);
  padding: 1px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  font-size: 11px;
  letter-spacing: 0.02em;
}

.meta {
  font-size: 10.5px;
  color: var(--lab-ash);
  margin-top: 4px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.index-pin {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.06em;
  color: var(--lab-fog);
}

:global(html.dark) .unit-list-panel {
  background: var(--lab-graphite);
  border-right-color: rgba(255,255,255,0.06);
}
:global(html.dark) .title__text { color: var(--lab-snow); }
</style>
