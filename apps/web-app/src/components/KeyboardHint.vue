<template>
  <el-tooltip
    v-if="description"
    :content="description"
    placement="top"
    :show-after="300"
  >
    <span class="y-kbd-hint" :class="{ 'y-kbd-hint--inline': inline }">
      <kbd v-for="(k, i) in keys" :key="i" class="y-kbd-hint__key">
        {{ k }}
      </kbd>
      <span v-if="label" class="y-kbd-hint__label">{{ label }}</span>
    </span>
  </el-tooltip>
  <span v-else class="y-kbd-hint" :class="{ 'y-kbd-hint--inline': inline }">
    <kbd v-for="(k, i) in keys" :key="i" class="y-kbd-hint__key">
      {{ k }}
    </kbd>
    <span v-if="label" class="y-kbd-hint__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
interface Props {
  keys: string[]
  label?: string
  description?: string
  inline?: boolean
}

defineProps<Props>()
</script>

<style scoped>
.y-kbd-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--y-spacing-1);
  font-size: var(--y-font-size-xs);
  color: var(--y-color-text-secondary);
  user-select: none;
}

.y-kbd-hint__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  height: 1.8em;
  padding: 0 var(--y-spacing-1);
  background: var(--y-color-bg-canvas);
  border: 1px solid var(--y-color-divider);
  border-radius: var(--y-radius-sm);
  font-family: var(--y-font-family-mono);
  font-size: var(--y-font-size-xs);
  color: var(--y-color-text-regular);
  box-shadow: 0 1px 0 var(--y-color-divider);
  line-height: 1;
}

.y-kbd-hint__label {
  margin-left: var(--y-spacing-1);
  color: var(--y-color-text-secondary);
}
</style>
