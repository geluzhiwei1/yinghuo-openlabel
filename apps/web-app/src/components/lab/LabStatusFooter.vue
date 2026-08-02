<template>
  <div class="lab-status-footer">
    <div class="lab-status-footer__left">
      <span :class="['lab-status-footer__dot', dotClass]" />
      <span class="lab-status-footer__status">{{ status }}</span>
      <span v-if="hint" class="lab-status-footer__hint">{{ hint }}</span>
    </div>
    <div class="lab-status-footer__right">
      <div v-for="m in metrics" :key="m.label" class="lab-status-footer__metric">
        <span class="lab-status-footer__metric-label">{{ m.label }}</span>
        <span class="lab-status-footer__metric-value">{{ m.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Metric = { label: string; value: string | number }

const props = withDefaults(defineProps<{
  status?: string
  hint?: string
  metrics?: Metric[]
  state?: 'ready' | 'syncing' | 'unsaved'
}>(), {
  status: '就绪',
  state: 'ready',
  metrics: () => [],
})

const dotClass = computed(() => `is-${props.state}`)
</script>

<style scoped>
.lab-status-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--lab-space-page-x);
  gap: 16px;
}

.lab-status-footer__left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lab-status-footer__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-ash);
  flex-shrink: 0;
}
.lab-status-footer__dot.is-ready    { background: var(--lab-ink); }
.lab-status-footer__dot.is-syncing  { background: var(--lab-coral); animation: lab-blink 1.6s ease-in-out infinite; }
.lab-status-footer__dot.is-unsaved  { background: var(--lab-coral); }

.lab-status-footer__status {
  font-size: 11.5px;
  color: var(--lab-ink);
  font-weight: 500;
}

.lab-status-footer__hint {
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  color: var(--lab-ash);
  letter-spacing: 0.05em;
}

.lab-status-footer__right {
  display: inline-flex;
  align-items: center;
  gap: 20px;
}

.lab-status-footer__metric {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.lab-status-footer__metric-label {
  font-family: var(--y-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lab-ash);
}

.lab-status-footer__metric-value {
  font-family: var(--y-font-family-mono);
  font-size: 11.5px;
  color: var(--lab-ink);
  font-variant-numeric: tabular-nums;
}
</style>
