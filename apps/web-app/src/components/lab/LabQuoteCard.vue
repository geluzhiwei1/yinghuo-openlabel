<template>
  <div class="lab-quote">
    <div class="lab-quote__glow" />
    <div class="lab-quote__label">MANIFESTO</div>
    <p class="lab-quote__text">{{ text }}<span class="lab-quote__dot">.</span></p>
    <div class="lab-quote__source">{{ source }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string
  source: string
}>()
</script>

<style scoped>
.lab-quote {
  position: relative;
  padding: 20px 22px;
  background: var(--lab-ink);
  color: #fff;
  border-radius: var(--lab-radius-3xl);
  overflow: hidden;
}

.lab-quote__glow {
  position: absolute;
  top: -16px;
  right: -16px;
  width: 80px;
  height: 80px;
  background: var(--lab-lime);
  border-radius: 50%;
  filter: blur(36px);
  opacity: 0.35;
  pointer-events: none;
}

.lab-quote__label {
  font-family: var(--y-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 10px;
}

.lab-quote__text {
  margin: 0;
  font-family: var(--y-font-family-display);
  font-style: italic;
  font-size: 20px;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: -0.01em;
}

.lab-quote__dot {
  color: var(--lab-coral);
}

.lab-quote__source {
  margin-top: 12px;
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}
</style>
