<template>
  <div class="y-page">
    <div v-if="$slots.breadcrumb || breadcrumbs?.length" class="y-page__breadcrumb">
      <slot name="breadcrumb">
        <el-breadcrumb><Icon icon="lucide:arrow-right" />
          <el-breadcrumb-item
            v-for="(item, i) in breadcrumbs"
            :key="i"
            :to="item.to ? { path: item.to } : undefined"
          >
            {{ item.title }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </slot>
    </div>

    <div v-if="$slots.header || title || $slots.toolbar" class="y-page__header">
      <div class="y-page__header-main">
        <slot name="header">
          <h2 v-if="title" class="y-page__title">{{ title }}</h2>
          <p v-if="description" class="y-page__description">{{ description }}</p>
        </slot>
      </div>
      <div v-if="$slots.toolbar" class="y-page__toolbar">
        <slot name="toolbar" />
      </div>
    </div>

    <div v-if="$slots.filter" class="y-page__filter">
      <slot name="filter" />
    </div>

    <div class="y-page__body" :class="{ 'y-page__body--loading': loading }">
      <slot />
    </div>

    <div v-if="$slots.footer || showPagination" class="y-page__footer">
      <slot name="footer">
        <div v-if="showPagination" class="y-page__pagination">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            :page-sizes="pageSizes"
            :layout="paginationLayout"
            background
            @update:current-page="$emit('update:page', $event)"
            @update:page-size="$emit('update:pageSize', $event)"
          />
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
export interface BreadcrumbItem {
  title: string
  to?: string
}

interface Props {
  title?: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  loading?: boolean
  showPagination?: boolean
  page?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  paginationLayout?: string
}

withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  breadcrumbs: () => [],
  loading: false,
  showPagination: false,
  page: 1,
  pageSize: 20,
  total: 0,
  pageSizes: () => [10, 20, 50, 100],
  paginationLayout: 'total, sizes, prev, pager, next, jumper',
})

defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:pageSize', value: number): void
}>()
</script>

<style scoped>
.y-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.y-page__breadcrumb {
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lab-ash);
}

.y-page__breadcrumb :deep(.el-breadcrumb__item) {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.y-page__breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--lab-ash) !important;
  font-weight: 400 !important;
}

.y-page__breadcrumb :deep(.el-breadcrumb__inner:hover) {
  color: var(--lab-ink) !important;
}

.y-page__breadcrumb :deep(.el-breadcrumb__separator) {
  color: var(--lab-fog) !important;
}

.y-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lab-hairline, #ececea);
}

.y-page__header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.y-page__title {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 36px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1;
  letter-spacing: -0.01em;
}

.y-page__description {
  margin: 0;
  font-size: 13px;
  color: var(--lab-slate);
  line-height: 1.5;
}

.y-page__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 4px;
}

.y-page__filter {
  background: var(--lab-snow);
  border: 1px solid var(--lab-hairline, #ececea);
  border-radius: var(--lab-radius-2xl, 16px);
  padding: 14px 18px;
  box-shadow: 0 1px 2px rgba(14,14,16,0.02);
}

.y-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.y-page__body--loading {
  position: relative;
  pointer-events: none;
}

.y-page__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.y-page__pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
