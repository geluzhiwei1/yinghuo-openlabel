<template>
  <div class="y-skeleton-table" :class="{ 'y-skeleton-table--bordered': bordered }">
    <div v-if="showHeader" class="y-skeleton-table__header" :style="gridStyle">
      <div v-for="(col, i) in normalizedColumns" :key="i" class="y-skeleton-table__cell">
        <el-skeleton-item variant="text" />
      </div>
    </div>
    <div v-for="row in rows" :key="row" class="y-skeleton-table__row" :style="gridStyle">
      <div v-for="(col, i) in normalizedColumns" :key="i" class="y-skeleton-table__cell">
        <el-skeleton-item :variant="cellVariant(i)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SkeletonColumn {
  prop?: string
  label?: string
  width?: number | string
}

interface Props {
  rows?: number
  columns?: number | Array<string | SkeletonColumn>
  showHeader?: boolean
  bordered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  columns: 5,
  showHeader: true,
  bordered: true,
})

const normalizedColumns = computed<Array<SkeletonColumn>>(() => {
  if (typeof props.columns === 'number') {
    return Array.from({ length: props.columns }, (_, i) => ({ prop: `col-${i}` }))
  }
  return props.columns.map((c, i) => {
    if (typeof c === 'string') return { prop: c, label: c }
    return { prop: c.prop ?? `col-${i}`, label: c.label ?? c.prop, width: c.width }
  })
})

const gridStyle = computed(() => {
  const template = normalizedColumns.value
    .map((c) => {
      if (!c.width) return '1fr'
      if (typeof c.width === 'number') return `${c.width}px`
      return c.width
    })
    .join(' ')
  return { gridTemplateColumns: template }
})

const cellVariant = (index: number): 'text' | 'rect' => {
  // First column often an avatar/icon — slightly taller
  if (index === 0) return 'rect'
  return 'text'
}
</script>

<style scoped>
.y-skeleton-table {
  width: 100%;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl, 16px);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(14,14,16,0.02);
}

.y-skeleton-table--bordered {
  border: 1px solid var(--lab-hairline, #ececea);
}

.y-skeleton-table__header,
.y-skeleton-table__row {
  display: grid;
  align-items: center;
  gap: 12px;
}

.y-skeleton-table__header {
  height: 44px;
  padding: 0 18px;
  background: var(--lab-cream);
  border-bottom: 1px solid var(--lab-hairline, #ececea);
  font-weight: 500;
}

.y-skeleton-table__row {
  height: 48px;
  padding: 0 18px;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
}

.y-skeleton-table__row:last-child {
  border-bottom: none;
}

.y-skeleton-table__cell {
  display: flex;
  align-items: center;
  padding-right: 8px;
}

.y-skeleton-table__cell :deep(.el-skeleton__item) {
  background: linear-gradient(
    90deg,
    var(--lab-cream) 0%,
    var(--lab-line) 50%,
    var(--lab-cream) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
  height: 12px;
}

.y-skeleton-table__header .y-skeleton-table__cell :deep(.el-skeleton__item) {
  height: 10px;
  width: 60% !important;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
