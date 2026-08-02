<template>
  <div class="paper-row" :style="rowStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  gutter?: number
  tag?: string
}>(), {
  gutter: 0,
})

const rowStyle = computed(() => ({
  marginLeft: props.gutter ? `-${props.gutter / 2}px` : 0,
  marginRight: props.gutter ? `-${props.gutter / 2}px` : 0,
}))
</script>

<style scoped>
.paper-row {
  display: flex;
  flex-wrap: wrap;
  box-sizing: border-box;
}
</style>
