<template>
  <nav class="paper-tabs" :class="{ 'paper-tabs--full': full }">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      :class="['paper-tabs__item', { 'is-active': tab.value === modelValue }]"
      @click="onSelect(tab.value)"
    >
      <Icon v-if="tab.icon" :icon="tab.icon" :width="14" />
      <span class="paper-tabs__label">{{ tab.label }}</span>
      <span v-if="tab.count !== undefined" class="paper-tabs__count">{{ tab.count }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type Tab = {
  value: string | number
  label: string
  icon?: string
  count?: number | string
}

withDefaults(defineProps<{
  modelValue?: string | number
  tabs: Tab[]
  full?: boolean
}>(), {
  full: false,
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string | number): void }>()
const onSelect = (v: string | number) => emit('update:modelValue', v)
</script>

<style scoped>
.paper-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill);
}
.paper-tabs--full {
  display: flex;
  width: 100%;
}
.paper-tabs--full .paper-tabs__item {
  flex: 1;
}

.paper-tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--lab-ctrl-h-sm);
  padding: 0 14px;
  border: none;
  background: transparent;
  border-radius: var(--lab-radius-pill);
  font-family: var(--y-font-family-base);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--lab-slate);
  cursor: pointer;
  transition: background-color var(--lab-duration-base) var(--lab-ease),
              color var(--lab-duration-base) var(--lab-ease);
}

.paper-tabs__item:hover {
  color: var(--lab-ink);
  background: rgba(255, 255, 255, 0.5);
}

.paper-tabs__item.is-active {
  background: var(--lab-ink);
  color: #fff;
}

.paper-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--lab-radius-pill);
  background: rgba(255, 255, 255, 0.18);
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  font-weight: 500;
}
.paper-tabs__item:not(.is-active) .paper-tabs__count {
  background: var(--lab-snow);
  color: var(--lab-ash);
}
</style>
