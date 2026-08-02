<template>
  <span :class="['paper-badge', `paper-badge--${color}`]">
    <slot v-if="$slots.dot" name="dot">
      <span class="paper-badge__dot" />
    </slot>
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'sky' | 'lilac' | 'mint' | 'butter' | 'ink' | 'coral' | 'ash' | 'lime'
  dot?: boolean
}>(), {
  color: 'ash',
})
</script>

<style scoped>
.paper-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.paper-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--lab-radius-pill);
  background: currentColor;
}

.paper-badge--sky    { background: var(--lab-sky);    color: #1e3a5f; }
.paper-badge--lilac  { background: var(--lab-lilac);  color: #3d2a6b; }
.paper-badge--mint   { background: var(--lab-mint);   color: #1f4a2e; }
.paper-badge--butter { background: var(--lab-butter); color: #6b4a16; }
.paper-badge--ink    { background: var(--lab-ink);    color: #fff; }
.paper-badge--coral  { background: var(--lab-coral);  color: #fff; }
.paper-badge--ash    { background: var(--lab-cream);  color: var(--lab-slate); }
.paper-badge--lime   { background: var(--lab-lime);   color: var(--lab-lime-ink); }

/* Blinking dot for "in progress" badges */
.paper-badge--coral .paper-badge__dot {
  animation: lab-blink 1.6s ease-in-out infinite;
}
</style>
