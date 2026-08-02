<template>
  <div class="y-empty-state" :class="[`y-empty-state--${size}`]">
    <div class="y-empty-state__icon">
      <slot name="icon">
        <Icon :icon="icon || 'lucide:inbox'" :width="iconSize" />
      </slot>
    </div>
    <div v-if="$slots.title || title" class="y-empty-state__title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="$slots.description || description" class="y-empty-state__description">
      <slot name="description">{{ description }}</slot>
    </div>
    <div v-if="$slots.action" class="y-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  icon?: string
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  icon: '',
  title: '',
  description: '',
  size: 'md',
})

const iconSize = computed(() => {
  if (props.size === 'sm') return 36
  if (props.size === 'lg') return 72
  return 56
})
</script>

<style scoped>
.y-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  padding: 56px 24px;
  color: var(--lab-slate);
  position: relative;
}

.y-empty-state--sm {
  padding: 24px 16px;
  gap: 8px;
}

.y-empty-state--lg {
  padding: 88px 24px;
  gap: 18px;
}

.y-empty-state__icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1.5px dashed var(--lab-line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lab-fog);
  line-height: 1;
  background: var(--lab-cream);
  position: relative;
}

.y-empty-state__icon::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px dashed var(--lab-hairline, #ececea);
  opacity: 0.6;
}

.y-empty-state--sm .y-empty-state__icon {
  width: 48px;
  height: 48px;
}

.y-empty-state--lg .y-empty-state__icon {
  width: 96px;
  height: 96px;
}

.y-empty-state__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 24px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin-top: 4px;
}

.y-empty-state--sm .y-empty-state__title {
  font-size: 18px;
}

.y-empty-state--lg .y-empty-state__title {
  font-size: 32px;
}

.y-empty-state__description {
  font-size: 12px;
  color: var(--lab-ash);
  max-width: 480px;
  line-height: 1.6;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

.y-empty-state__action {
  margin-top: 8px;
}
</style>
