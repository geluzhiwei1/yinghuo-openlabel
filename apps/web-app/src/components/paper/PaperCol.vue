<template>
  <div class="paper-col" :style="colStyle"><slot /></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  span?: number   // out of 24
  offset?: number
  push?: number
  pull?: number
}>(), {
  span: 24,
  offset: 0,
})

const colStyle = computed(() => {
  const pct = (props.span / 24) * 100
  const offsetPct = (props.offset / 24) * 100
  return {
    width: `${pct}%`,
    marginLeft: offsetPct ? `${offsetPct}%` : 0,
  }
})
</script>

<style scoped>
.paper-col {
  box-sizing: border-box;
}
</style>
