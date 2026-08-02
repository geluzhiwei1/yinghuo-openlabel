<template>
  <div class="batch-list">
    <div class="batch-list__header">
      <div class="batch-list__title">
        <Icon icon="lucide:layers" :width="22" />
        <span>批次管理</span>
      </div>
      <div class="batch-list__actions">
        <el-select
          v-model="projectId"
          placeholder="选择项目"
          style="width: 240px"
          :loading="projectLoading"
          @change="onProjectChange"
        >
          <el-option
            v-for="p in projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-input
          v-model="statusFilter"
          placeholder="状态过滤(pending/active/done/cancelled)"
          clearable
          style="width: 240px"
        />
        <el-button  type="primary" @click="loadBatches"><Icon icon="lucide:refresh-cw" />刷新</el-button>
        <el-button 
          type="success" :disabled="!projectId"
          @click="$router.push({ name: 'batches-create', query: { project_id: projectId } })"><Icon icon="lucide:plus" />
          新建批次
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="batch-list__card">
      <el-table
        v-loading="loading"
        :data="batches"
        stripe
        empty-text="该项目下暂无批次,点击右上角新建"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="slug" label="Slug" width="180">
          <template #default="{ row }">
            <code class="batch-list__slug">{{ row.slug }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="mission" label="Mission" width="160" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分派策略" width="120">
          <template #default="{ row }">
            {{ strategyLabel(row.assignee_strategy) }}
          </template>
        </el-table-column>
        <el-table-column label="标注员池" width="160">
          <template #default="{ row }">
            <span v-if="!row.assignees || row.assignees.length === 0" class="batch-list__muted">—</span>
            <span v-else>{{ row.assignees.length }} 人</span>
          </template>
        </el-table-column>
        <el-table-column prop="sampling_rate" label="采样率" width="100">
          <template #default="{ row }">
            {{ ((row.sampling_rate ?? 1) * 100).toFixed(0) }}%
          </template>
        </el-table-column>
        <el-table-column label="Units" width="100">
          <template #default="{ row }">
            {{ row.units_count ?? row.unit_count ?? '—' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push({ name: 'batches-detail', params: { id: row.id } })">
              详情
            </el-button>
            <el-button
              link
              type="success"
              :loading="spawningId === row.id"
              :disabled="!canSpawn(row)"
              @click="onSpawn(row)"
            >
              Spawn
            </el-button>
            <el-button
              link
              type="danger"
              :loading="deletingId === row.id"
              :disabled="!canDelete(row)"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="batch-list__pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadBatches"
          @size-change="loadBatches"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { batchesApi } from '@/api'
import { useBatchProject } from './useBatchProject'

const { projectId, projects, loading: projectLoading, init: initProject } = useBatchProject()

const batches = ref<any[]>([])
const loading = ref(false)
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const spawningId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

const onProjectChange = () => {
  page.value = 1
  loadBatches()
}

const loadBatches = async () => {
  if (!projectId.value) {
    batches.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await batchesApi.listBatches(projectId.value, {
      status: statusFilter.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    batches.value = res?.items ?? res?.data ?? []
    total.value = res?.total ?? batches.value.length
  } finally {
    loading.value = false
  }
}

const canSpawn = (row: any) => {
  return row.status === 'pending' || row.status === 'active'
}

const canDelete = (row: any) => {
  return row.status === 'pending' || row.units_count === 0 || row.unit_count === 0
}

const onSpawn = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `将从数据序列铺开 Units,可能耗时较长。批次:${row.name}`,
      '确认 Spawn',
      { type: 'warning' },
    )
  } catch {
    return
  }
  spawningId.value = row.id
  try {
    const res = await batchesApi.spawnBatch(row.id, {})
    const cnt = res?.spawned ?? res?.created ?? res?.count ?? '?'
    ElMessage.success(`Spawn 完成,生成 ${cnt} 个 unit`)
    await loadBatches()
  } finally {
    spawningId.value = null
  }
}

const onDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除批次「${row.name}」?`, '删除', { type: 'warning' })
  } catch {
    return
  }
  deletingId.value = row.id
  try {
    await batchesApi.removeBatch(row.id)
    ElMessage.success('已删除')
    await loadBatches()
  } finally {
    deletingId.value = null
  }
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    pending: '待启动',
    active: '进行中',
    done: '已完成',
    cancelled: '已取消',
  }
  return map[s] || s || '—'
}

const statusTagType = (s: string): 'info' | 'warning' | 'success' | 'danger' | 'primary' => {
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
    pending: 'info',
    active: 'primary',
    done: 'success',
    cancelled: 'danger',
  }
  return map[s] || 'info'
}

const strategyLabel = (s: string) => {
  const map: Record<string, string> = {
    manual: '手动认领',
    round_robin: '轮转',
    load_aware: '负载均衡',
  }
  return map[s] || s || '—'
}

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

watch(statusFilter, () => {
  page.value = 1
  loadBatches()
})

onMounted(async () => {
  await initProject()
  await loadBatches()
})
</script>

<style scoped>
.batch-list {
  padding: 16px 24px;
}

.batch-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.batch-list__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.batch-list__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-list__card {
  border: 1px solid var(--y-color-divider);
}

.batch-list__pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.batch-list__slug {
  font-family: var(--y-font-family-mono, monospace);
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
}

.batch-list__muted {
  color: var(--el-text-color-placeholder);
}
</style>
