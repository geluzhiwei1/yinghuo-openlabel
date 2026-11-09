<template>
  <div ref="rootRef" class="view-menu" :style="{ left: x + 'px', top: y + 'px' }" @contextmenu.prevent
    @pointerdown.stop @pointerup.stop @click.stop>
    <button v-for="it in items" :key="it.key" class="view-menu__item" @click="emit('action', it.key)">
      {{ it.label }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps<{ x: number; y: number; items: { key: string; label: string }[] }>()
const emit = defineEmits<{ action: [key: string]; close: [] }>()

const rootRef = ref<HTMLElement | null>(null)

const onDocDown = (e: PointerEvent) => {
  if (rootRef.value?.contains(e.target as Node)) return
  emit('close')
}
onMounted(() => window.addEventListener('pointerdown', onDocDown, true))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onDocDown, true))
</script>

<style scoped>
.view-menu {
  position: absolute;
  z-index: 20;
  min-width: 120px;
  padding: 4px;
  background: var(--y-color-bg-elevated, #1d1d24);
  border: 1px solid var(--y-color-divider, #33333d);
  border-radius: var(--y-radius-md, 6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
}

.view-menu__item {
  display: block;
  width: 100%;
  padding: 5px 10px;
  border: none;
  border-radius: var(--y-radius-sm, 4px);
  background: transparent;
  color: var(--y-color-text-regular, #d5d5de);
  font-size: var(--y-font-size-sm, 12px);
  text-align: left;
  cursor: pointer;
}

.view-menu__item:hover {
  background: var(--y-color-bg-deep, #2a2a33);
}
</style>
