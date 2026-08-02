<template>
  <div :class="['paper-card', { 'paper-card--flat': flat, 'paper-card--hover': hover }]">
    <div v-if="$slots.header || title" class="paper-card__header">
      <slot name="header">
        <div class="paper-card__title-wrap">
          <span v-if="eyebrow" class="paper-card__eyebrow">{{ eyebrow }}</span>
          <h3 class="paper-card__title">{{ title }}<span v-if="coralDot" class="paper-card__dot">.</span></h3>
        </div>
      </slot>
      <div v-if="$slots.actions" class="paper-card__actions"><slot name="actions" /></div>
    </div>
    <div class="paper-card__body" :style="bodyStyle">
      <slot />
    </div>
    <div v-if="$slots.footer" class="paper-card__footer"><slot name="footer" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  eyebrow?: string  // mono English mini-label above title (design.md §2)
  coralDot?: boolean // signature coral period after title
  flat?: boolean
  hover?: boolean
  padding?: number | string
}>(), {
  coralDot: false,
  flat: false,
  hover: false,
  padding: 20,
})

const bodyStyle = computed(() => ({
  padding: typeof props.padding === 'number' ? `${props.padding}px` : props.padding,
}))
</script>

<style scoped>
.paper-card {
  border-radius: var(--lab-radius-3xl);
  background: var(--lab-snow);
  box-shadow: var(--lab-shadow-soft);
  overflow: hidden;
  transition: box-shadow var(--lab-duration-slow) var(--lab-ease),
              transform var(--lab-duration-slow) var(--lab-ease);
}

.paper-card--flat {
  background: var(--lab-cream);
  box-shadow: none;
  border-radius: var(--lab-radius-2xl);
}

.paper-card--hover:hover {
  box-shadow: var(--lab-shadow-lift);
}

.paper-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 10px;
  border-bottom: 1px solid var(--lab-hairline);
}

.paper-card__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.paper-card__eyebrow {
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lab-ash);
}

.paper-card__title {
  margin: 0;
  font-family: var(--y-font-family-display);
  font-style: italic;
  font-size: 20px;
  line-height: 1;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
}

.paper-card__dot {
  color: var(--lab-coral);
  margin-left: 1px;
}

.paper-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.paper-card__body {
  /* padding set via inline style from prop */
}

.paper-card__footer {
  padding: 12px 20px 18px;
  border-top: 1px solid var(--lab-hairline);
}
</style>
