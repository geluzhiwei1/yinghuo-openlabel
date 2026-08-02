<template>
  <div class="lab-ticker">
    <div class="lab-ticker__track lab-animate-marquee">
      <div v-for="(item, i) in doubled" :key="i" class="lab-ticker__item">
        <span class="lab-ticker__bullet" />
        <span class="lab-ticker__text">{{ item }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  items?: string[]
}>(), {
  items: () => [],
})

// Duplicate content so the marquee animation (-50%) loops seamlessly
const doubled = computed(() => [...props.items, ...props.items])
</script>

<style scoped>
.lab-ticker {
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}

.lab-ticker__track {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  white-space: nowrap;
  will-change: transform;
}

.lab-ticker__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lab-ticker__bullet {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lab-coral);
}

.lab-ticker__text {
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--lab-slate);
  text-transform: uppercase;
}
</style>
