<template>
  <el-card shadow="hover" class="stuck-table">
    <template #header>
      <div class="stuck-table__header">
        <div class="stuck-table__title">
          <Icon icon="lucide:siren" :width="18" />
          <span>卡住的实例</span>
          <el-tag v-if="!loading" type="info" size="small">共 {{ total }}</el-tag>
        </div>
        <div class="stuck-table__actions">
          <el-select v-model="thresholdMinutes" style="width: 140px" @change="reload">
            <el-option :value="60" label="> 1 小时" />
            <el-option :value="240" label="> 4 小时" />
            <el-option :value="480" label="> 8 小时" />
            <el-option :value="1440" label="> 1 天" />
          </el-select>
          <el-button @click="reload"><Icon icon="lucide:refresh-cw" />刷新</el-button>
        </div>
      </div>
    </template>

    <el-table
      v-loading="loading"
      :data="items"
      stripe
      empty-text="窗口内没有卡住的实例"
    >
      <el-table-column prop="instance_id" label="Instance" width="100" />
      <el-table-column prop="unit_id" label="Unit" width="100" />
      <el-table-column prop="mission" label="Mission" width="160" />
      <el-table-column prop="current_stage" label="当前 stage" width="140" />
      <el-table-column label="卡住时长" width="140">
        <template #default="{ row }">
          <el-tag type="warning" size="small">{{ formatAge(row.age_minutes) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标注员" width="120">
        <template #default="{ row }">
          <span v-if="row.assignee_id != null">{{ row.assignee_id }}</span>
          <span v-else class="stuck-table__muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="审核员" width="120">
        <template #default="{ row }">
          <span v-if="row.reviewer_id != null">{{ row.reviewer_id }}</span>
          <span v-else class="stuck-table__muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="seq" label="Seq" width="100" />
    </el-table>

    <div class="stuck-table__footer">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="reload"
        @size-change="onSizeChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { workflowApi } from '@/api'

const props = defineProps<{ projectId: number | null }>()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(50)
const thresholdMinutes = ref(240)

async function reload() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      threshold_minutes: thresholdMinutes.value,
      page: page.value,
      page_size: pageSize.value,
    }
    if (props.projectId != null) params.project_id = props.projectId
    const r = await workflowApi.monitorStuck(params)
    items.value = r?.items || []
    total.value = r?.total || 0
  } finally {
    loading.value = false
  }
}

function onSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  reload()
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes.toFixed(0)} 分钟`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} 小时`
  return `${(minutes / 1440).toFixed(1)} 天`
}

watch(() => props.projectId, () => {
  page.value = 1
  reload()
})

reload()
</script>

<style lang="scss" scoped>
.stuck-table {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__muted {
    color: var(--el-text-color-secondary);
  }

  &__footer {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
