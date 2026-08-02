<template>
  <article class="kpi-card">
    <header class="kpi-card__head">
      <span class="kpi-card__idx">{{ idx }}</span>
      <span class="kpi-card__label">{{ label }}</span>
    </header>
    <div class="kpi-card__body">
      <span class="kpi-card__value" :class="`kpi-card__value--${tone}`">
        <span class="kpi-card__num">{{ displayValue }}</span>
        <span v-if="suffix" class="kpi-card__suffix">{{ suffix }}</span>
      </span>
      <span v-if="delta" class="kpi-card__delta" :class="`kpi-card__delta--${deltaTone}`">
        <Icon :icon="deltaIcon" :width="11" />
        <span>{{ delta }}</span>
      </span>
    </div>
    <footer v-if="icon" class="kpi-card__foot">
      <span class="kpi-card__icon" :class="`kpi-card__icon--${tone}`">
        <Icon :icon="icon" :width="14" />
      </span>
      <span class="kpi-card__hint">{{ hint }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  label: string
  value: number | string
  icon?: string
  tone?: 'primary' | 'info' | 'success' | 'danger' | 'warning'
  idx?: string
  suffix?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'flat'
  hint?: string
}>(), {
  tone: 'primary',
  idx: '01',
  deltaTone: 'flat',
  hint: '',
})

const displayValue = computed(() => {
  const v = props.value
  if (v == null || v === '') return '—'
  return typeof v === 'number' ? v.toLocaleString() : String(v)
})

const deltaIcon = computed(() => {
  if (props.deltaTone === 'up') return 'lucide:arrow-up'
  if (props.deltaTone === 'down') return 'lucide:arrow-down'
  return 'lucide:minus'
})
</script>

<style scoped>
.kpi-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 14px;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  box-shadow: var(--lab-shadow-soft, 0 1px 2px rgba(14,14,16,0.04), 0 4px 14px rgba(14,14,16,0.04));
  border: 1px solid var(--lab-hairline);
  transition: all 200ms ease;
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: -32px;
  right: -32px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.14;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--lab-shadow-lift, 0 4px 14px rgba(14,14,16,0.06), 0 12px 32px rgba(14,14,16,0.08));
}

.kpi-card:hover::before {
  opacity: 0.22;
}

.kpi-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.kpi-card__idx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--lab-ash);
}

.kpi-card__label {
  font-size: 12px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.kpi-card__body {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.kpi-card__value {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-card__num {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--lab-ink);
}

.kpi-card__suffix {
  font-size: 12px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.kpi-card__delta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.kpi-card__delta--up {
  background: rgba(184,240,208,0.5);
  color: var(--lab-graphite);
}

.kpi-card__delta--down {
  background: rgba(255,106,61,0.16);
  color: var(--lab-coral);
}

.kpi-card__delta--flat {
  background: var(--lab-cream);
  color: var(--lab-ash);
}

.kpi-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--lab-line);
  position: relative;
  z-index: 1;
}

.kpi-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.kpi-card__icon--primary {
  background: var(--lab-ink);
  color: var(--lab-lime);
}

.kpi-card__icon--info {
  background: var(--lab-lilac, #d9ccff);
  color: var(--lab-graphite);
}

.kpi-card__icon--success {
  background: var(--lab-mint, #b8f0d0);
  color: var(--lab-graphite);
}

.kpi-card__icon--danger {
  background: rgba(255,106,61,0.18);
  color: var(--lab-coral);
}

.kpi-card__icon--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}

.kpi-card__hint {
  font-size: 11px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

/* tone-driven bg glow */
.kpi-card:has(.kpi-card__icon--primary)::before { background: var(--lab-lime); }
.kpi-card:has(.kpi-card__icon--info)::before { background: var(--lab-lilac, #d9ccff); }
.kpi-card:has(.kpi-card__icon--success)::before { background: var(--lab-mint, #b8f0d0); }
.kpi-card:has(.kpi-card__icon--danger)::before { background: var(--lab-coral); }
.kpi-card:has(.kpi-card__icon--warning)::before { background: var(--lab-butter, #ffe58a); }

:global(html.dark) .kpi-card {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.06);
}
:global(html.dark) .kpi-card__num { color: var(--lab-snow); }
:global(html.dark) .kpi-card__idx { background: rgba(255,255,255,0.06); }
</style>
