<template>
  <div class="y-table-pro">
    <div v-if="$slots['toolbar-left'] || showSettings" class="y-table-pro__toolbar">
      <div class="y-table-pro__toolbar-left">
        <slot name="toolbar-left" />
      </div>
      <div class="y-table-pro__toolbar-right">
        <slot name="toolbar-right" />
        <el-tooltip v-if="showSettings" :content="t('table.density')" placement="top">
          <el-dropdown trigger="click" @command="(c) => (density = c)">
            <el-button circle size="default">
              <Icon :icon="densityIcon" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="compact" :class="{ 'is-active': density === 'compact' }">
                  {{ t('table.densityCompact') }}
                </el-dropdown-item>
                <el-dropdown-item command="cozy" :class="{ 'is-active': density === 'cozy' }">
                  {{ t('table.densityCozy') }}
                </el-dropdown-item>
                <el-dropdown-item command="loose" :class="{ 'is-active': density === 'loose' }">
                  {{ t('table.densityLoose') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-popover v-if="showSettings" trigger="click" placement="bottom-end" :width="220">
          <template #reference>
            <div class="y-table-pro__settings-trigger">
              <el-tooltip :content="t('table.columns')" placement="top">
                <el-button circle size="default">
                  <Icon icon="lucide:settings" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
          <div class="y-table-pro__column-settings">
            <div class="y-table-pro__column-settings-title">
              {{ t('table.columnsTitle') }}
              <el-button link size="small" @click="resetColumns">{{ t('action.reset') }}</el-button>
            </div>
            <el-checkbox-group v-model="hiddenProps" class="y-table-pro__column-list">
              <div
                v-for="col in allColumns.filter((c) => Boolean(c.prop))"
                :key="col.prop"
                class="y-table-pro__column-item"
              >
                <el-checkbox :value="col.prop" :disabled="col.required">
                  {{ col.label || col.prop }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </el-popover>
      </div>
    </div>

    <SkeletonTable
      v-if="loading && !data.length"
      :rows="skeletonRows"
      :columns="skeletonColumns"
    />

    <el-table
      v-else
      v-bind="$attrs"
      :data="data"
      :class="['y-table-pro__table', `y-table-pro__table--${density}`]"
      :row-key="rowKey"
      :table-layout="tableLayout"
    >
      <template v-for="col in displayedColumns" :key="col.prop">
        <el-table-column
          :type="col.type"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :fixed="col.fixed"
          :align="col.align || 'left'"
          :sortable="col.sortable"
          :formatter="col.formatter"
        >
          <template v-if="col.type === 'index'" #default="scope">
            {{ getIndex(scope.$index) }}
          </template>
          <template v-else-if="$slots[`cell-${col.prop}`]" #default="scope">
            <slot :name="`cell-${col.prop}`" v-bind="scope" />
          </template>
        </el-table-column>
      </template>

      <template v-if="$slots.empty" #empty>
        <slot name="empty" />
      </template>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

export interface TableColumn {
  prop: string
  type?: 'index' | 'selection' | 'expand'
  label?: string
  width?: number | string
  minWidth?: number | string
  fixed?: boolean | 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean | 'custom'
  formatter?: (row: any, column: any, value: any, index: number) => string
  required?: boolean
}

interface Props {
  data: any[]
  columns: TableColumn[]
  loading?: boolean
  rowKey?: string | ((row: any) => string)
  storageKey?: string
  density?: 'compact' | 'cozy' | 'loose'
  showSettings?: boolean
  skeletonRows?: number
  tableLayout?: 'auto' | 'fixed'
  pageIndex?: number
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  rowKey: 'id',
  storageKey: '',
  density: 'cozy',
  showSettings: true,
  skeletonRows: 6,
  tableLayout: 'auto',
  pageIndex: 1,
  pageSize: 20,
})

const emit = defineEmits<{
  (e: 'update:density', value: 'compact' | 'cozy' | 'loose'): void
}>()

const getIndex = (index: number) => {
  return (props.pageIndex - 1) * props.pageSize + index + 1
}

const density = ref<'compact' | 'cozy' | 'loose'>(props.density)

watch(
  () => props.density,
  (v) => {
    density.value = v
  },
)

watch(density, (v) => {
  emit('update:density', v)
  if (props.storageKey) {
    try {
      localStorage.setItem(`yh:table-density:${props.storageKey}`, v)
    } catch {
      // ignore
    }
  }
})

const allColumns = computed<TableColumn[]>(() => props.columns)

const hiddenProps = ref<string[]>([])

const loadPersistedState = () => {
  if (!props.storageKey) return
  try {
    const hidden = localStorage.getItem(`yh:table-hidden:${props.storageKey}`)
    if (hidden) hiddenProps.value = JSON.parse(hidden) || []
    const savedDensity = localStorage.getItem(`yh:table-density:${props.storageKey}`)
    if (savedDensity && ['compact', 'cozy', 'loose'].includes(savedDensity)) {
      density.value = savedDensity as typeof density.value
    }
  } catch {
    hiddenProps.value = []
  }
}

watch(hiddenProps, (val) => {
  if (!props.storageKey) return
  try {
    localStorage.setItem(`yh:table-hidden:${props.storageKey}`, JSON.stringify(val))
  } catch {
    // ignore
  }
})

watch(
  () => props.storageKey,
  () => loadPersistedState(),
  { immediate: true },
)

const displayedColumns = computed<TableColumn[]>(() =>
  allColumns.value.filter((c) => !hiddenProps.value.includes(c.prop) || c.required),
)

const skeletonColumns = computed<SkeletonTable['$props']['columns']>(() => {
  if (!displayedColumns.value.length) return 5
  return displayedColumns.value.map((c) => ({
    prop: c.prop,
    label: c.label,
    width: typeof c.width === 'number' ? c.width : undefined,
  }))
})

const resetColumns = () => {
  hiddenProps.value = []
}

const densityIcon = computed(() => {
  if (density.value === 'compact') return 'lucide:menu'
  if (density.value === 'loose') return 'lucide:align-vertical-space-around'
  return 'lucide:equal'
})
</script>

<style scoped>
.y-table-pro {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.y-table-pro__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}

.y-table-pro__toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.y-table-pro__toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.y-table-pro__toolbar-right :deep(.el-button.is-circle) {
  border-radius: 50% !important;
  border: 1px solid var(--lab-line) !important;
  background: var(--lab-snow) !important;
  color: var(--lab-slate) !important;
  width: 32px !important;
  height: 32px !important;
  min-height: 32px !important;
  padding: 0 !important;
  transition: all 150ms ease;
}

.y-table-pro__toolbar-right :deep(.el-button.is-circle:hover) {
  border-color: var(--lab-ink) !important;
  color: var(--lab-ink) !important;
  background: var(--lab-cream) !important;
  transform: translateY(-1px);
}

.y-table-pro__settings-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.y-table-pro__column-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.y-table-pro__column-settings-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
  color: var(--lab-ink);
}

.y-table-pro__column-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.y-table-pro__column-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 8px;
  transition: background 150ms ease;
}

.y-table-pro__column-item:hover {
  background: var(--lab-cream);
}

/* ── Table itself ─────────────────────────────── */
.y-table-pro__table :deep(.el-table) {
  background: transparent;
  --el-table-border-color: var(--lab-hairline, #ececea);
  --el-table-header-bg-color: var(--lab-cream);
  --el-table-row-hover-bg-color: var(--lab-cream);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
}

.y-table-pro__table :deep(.el-table::before),
.y-table-pro__table :deep(.el-table__border-left-patch) {
  display: none;
}

.y-table-pro__table :deep(.el-table__cell) {
  padding: 12px 0;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
}

.y-table-pro__table :deep(.el-table__header-wrapper .cell) {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lab-ash);
  font-weight: 500;
}

.y-table-pro__table :deep(.el-table__row:hover > td) {
  background: var(--lab-cream) !important;
}

.y-table-pro__table :deep(.el-table__body-wrapper .cell) {
  font-size: 13px;
  color: var(--lab-graphite);
}

.y-table-pro__table--compact :deep(.el-table__cell) {
  padding: 6px 0;
}

.y-table-pro__table--loose :deep(.el-table__cell) {
  padding: 18px 0;
}

/* Sortable caret icon */
.y-table-pro__table :deep(.caret-wrapper) {
  color: var(--lab-fog);
}

.y-table-pro__table :deep(.el-table__column-filter-trigger) {
  color: var(--lab-fog);
}
</style>
