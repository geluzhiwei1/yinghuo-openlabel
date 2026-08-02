<template>
  <div class="diff-view">
    <div class="diff-toolbar">
      <span class="title">版本对比</span>
      <el-input-number
        v-model="fromVersion"
        :min="0"
        :max="latestVersion ?? undefined"
        size="small"
        style="width: 90px"
        controls-position="right"
      />
      <span class="arrow">→</span>
      <el-input-number
        v-model="toVersion"
        :min="0"
        :max="latestVersion ?? undefined"
        size="small"
        style="width: 90px"
        controls-position="right"
      />
      <el-button
        size="small"
        type="primary"
        :loading="loading"
        @click="loadDiff"
      >
        对比
      </el-button>
    </div>

    <div v-loading="loading" class="diff-body">
      <div v-if="!diff" class="empty">
        <el-empty :image-size="80" description="选择两个版本进行对比" />
      </div>
      <template v-else>
        <div v-if="diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0" class="no-change">
          <el-tag type="success" size="large" effect="plain">两版本完全一致</el-tag>
        </div>
        <div v-else class="diff-summary">
          <el-tag type="success">新增 +{{ diff.added.length }}</el-tag>
          <el-tag type="warning">修改 {{ diff.modified.length }}</el-tag>
          <el-tag type="danger">删除 -{{ diff.removed.length }}</el-tag>
        </div>

        <DiffSection title="新增" type="success" :items="addedItems" />
        <DiffSection title="修改" type="warning" :items="modifiedItems" />
        <DiffSection title="删除" type="danger" :items="removedItems" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, h, defineComponent } from 'vue'
import { workflowApi } from '@/api'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  instanceId?: number | null
  unitId?: number | null
  latestVersion?: number | null
}>()

const fromVersion = ref<number>(0)
const toVersion = ref<number>(0)
const loading = ref(false)
const diff = ref<any>(null)

watch(
  () => props.latestVersion,
  (v) => {
    if (v != null && v > 0) {
      toVersion.value = v
      fromVersion.value = Math.max(0, v - 1)
    }
  },
  { immediate: true },
)

const loadDiff = async () => {
  if (props.instanceId == null && props.unitId == null) {
    ElMessage.warning('未选中 unit')
    return
  }
  if (fromVersion.value === toVersion.value) {
    ElMessage.warning('请选择不同的版本')
    return
  }
  loading.value = true
  try {
    if (props.instanceId != null) {
      diff.value = await workflowApi.getInstanceDiff(props.instanceId, {
        from: fromVersion.value,
        to: toVersion.value,
      })
    }
  } catch {
    diff.value = null
  } finally {
    loading.value = false
  }
}

const summarize = (obj: any): string => {
  if (!obj || typeof obj !== 'object') return String(obj)
  if (obj.name) return obj.name
  if (obj.label) return obj.label
  const od = obj.object_data ?? obj
  if (od.bbox2d) return `bbox ${JSON.stringify(od.bbox2d.val ?? od.bbox2d)}`
  return JSON.stringify(obj).slice(0, 80)
}

const addedItems = computed(() =>
  (diff.value?.added ?? []).map((o: any) => ({
    id: o.id ?? '?',
    summary: summarize(o),
  })),
)
const modifiedItems = computed(() =>
  (diff.value?.modified ?? []).map((m: any) => ({
    id: m.id ?? '?',
    summary: `${summarize(m.from)} → ${summarize(m.to)}`,
  })),
)
const removedItems = computed(() =>
  (diff.value?.removed ?? []).map((o: any) => ({
    id: o.id ?? '?',
    summary: summarize(o),
  })),
)

// DiffSection 内联组件(避免单独建文件)
const DiffSection = defineComponent({
  props: {
    title: { type: String, required: true },
    type: { type: String, required: true },
    items: { type: Array as () => Array<{ id: string; summary: string }>, required: true },
  },
  setup(props) {
    return () => {
      if (props.items.length === 0) return null
      return h('div', { class: 'diff-section' }, [
        h('div', { class: 'section-title' }, [
          h('span', { class: `dot dot-${props.type}` }),
          h('span', null, `${props.title} (${props.items.length})`),
        ]),
        h(
          'div',
          { class: 'section-body' },
          props.items.map((it) =>
            h('div', { class: 'diff-item', key: it.id }, [
              h('code', { class: 'item-id' }, it.id),
              h('span', { class: 'item-summary' }, it.summary),
            ]),
          ),
        ),
      ])
    }
  },
})
</script>

<style scoped>
.diff-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.diff-toolbar .title {
  font-weight: 600;
  margin-right: 8px;
}
.arrow {
  color: var(--el-text-color-secondary);
}
.diff-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}
.empty {
  padding: 24px 0;
}
.no-change {
  text-align: center;
  padding: 32px 0;
}
.diff-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.diff-view :deep(.diff-section) {
  margin-bottom: 16px;
}
.diff-view :deep(.section-title) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}
.diff-view :deep(.dot) {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.diff-view :deep(.dot-success) {
  background: var(--el-color-success);
}
.diff-view :deep(.dot-warning) {
  background: var(--el-color-warning);
}
.diff-view :deep(.dot-danger) {
  background: var(--el-color-danger);
}
.diff-view :deep(.section-body) {
  padding-left: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.diff-view :deep(.diff-item) {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 3px;
  font-size: 12px;
}
.diff-view :deep(.item-id) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.diff-view :deep(.item-summary) {
  color: var(--el-text-color-regular);
  word-break: break-all;
}
</style>
