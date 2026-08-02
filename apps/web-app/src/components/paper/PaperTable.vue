<template>
  <div class="paper-table" :class="{ 'paper-table--dense': dense }">
    <table>
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.prop"
            :style="{ width: col.width, minWidth: col.minWidth, textAlign: col.align || 'left' }"
            :class="{ 'is-sortable': col.sortable, 'is-sorted': col.prop === sortBy }"
            @click="col.sortable && onSort(col.prop)"
          >
            <span class="paper-table__head-label">{{ col.label }}</span>
            <Icon
              v-if="col.sortable"
              :icon="col.prop === sortBy && sortDir === 'desc' ? 'lucide:chevron-down' : 'lucide:chevron-up'"
              :width="12"
              class="paper-table__sort-icon"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in data" :key="rowKey ? row[rowKey] : i" @click="$emit('row-click', row)">
          <td
            v-for="col in columns"
            :key="col.prop"
            :style="{ textAlign: col.align || 'left' }"
          >
            <slot :name="col.prop" :row="row" :value="row[col.prop]" :index="i">
              {{ formatCell(row[col.prop], col) }}
            </slot>
          </td>
        </tr>
        <tr v-if="!data.length">
          <td :colspan="columns.length" class="paper-table__empty">
            <slot name="empty">暂无数据</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

type Column = {
  prop: string
  label: string
  width?: string
  minWidth?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  formatter?: (value: any, row: any) => string
}

const props = defineProps<{
  data: any[]
  columns: Column[]
  rowKey?: string
  dense?: boolean
}>()

defineEmits<{ (e: 'row-click', row: any): void }>()

const sortBy = ref<string>('')
const sortDir = ref<'asc' | 'desc'>('asc')

const onSort = (prop: string) => {
  if (sortBy.value === prop) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = prop
    sortDir.value = 'asc'
  }
}

const formatCell = (value: any, col: Column) => {
  if (col.formatter) return col.formatter(value, null)
  if (value == null) return ''
  return String(value)
}
</script>

<style scoped>
.paper-table {
  width: 100%;
  background: transparent;
}

.paper-table table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  table-layout: auto;
}

.paper-table thead th {
  padding: 10px 12px;
  font-family: var(--y-font-family-base);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--lab-ash);
  border-bottom: 1px solid var(--lab-line);
  white-space: nowrap;
  background: transparent;
}

.paper-table thead th.is-sortable {
  cursor: pointer;
  user-select: none;
  transition: color var(--lab-duration-base);
}
.paper-table thead th.is-sortable:hover { color: var(--lab-ink); }
.paper-table thead th.is-sorted { color: var(--lab-ink); }

.paper-table__head-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.paper-table__sort-icon {
  color: var(--lab-ink);
}

.paper-table tbody td {
  padding: 12px;
  font-size: 13px;
  color: var(--lab-ink);
  border-bottom: 1px solid var(--lab-hairline);
  vertical-align: middle;
}

.paper-table--dense tbody td {
  padding: 8px 12px;
}

.paper-table tbody tr {
  transition: background-color var(--lab-duration-base);
  cursor: default;
}
.paper-table tbody tr:hover td {
  background: rgba(251, 250, 245, 0.6);
}
.paper-table tbody tr:last-child td {
  border-bottom: none;
}

.paper-table__empty {
  text-align: center;
  padding: 40px 12px;
  color: var(--lab-ash);
  font-size: 12.5px;
}
</style>
