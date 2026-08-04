<template>
  <div class="batch-detail">
    <div class="batch-detail__header">
      <el-button  link @click="$router.push({ name: 'batches-list' })"><Icon icon="lucide:arrow-left" />返回列表</el-button>
      <div class="batch-detail__title">
        <Icon icon="lucide:layers" :width="22" />
        <span v-if="batch">{{ batch.name }}</span>
        <span v-else>批次详情</span>
        <el-tag v-if="batch" :type="statusTagType(batch.status)" size="small">
          {{ statusLabel(batch.status) }}
        </el-tag>
      </div>
      <div v-if="batch" class="batch-detail__actions">
        <el-button
          type="success"
          :loading="spawning"
          :disabled="!canSpawn"
          @click="onSpawn"
        >
          Spawn Units
        </el-button>
        <el-button :loading="toggling" :disabled="!canToggle" @click="onToggleStatus">
          {{ batch.status === 'active' ? '暂停' : '激活' }}
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="batch-detail__body">
      <el-card v-if="batch" shadow="never" class="batch-detail__meta-card">
        <template #header>
          <span>批次信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="ID">{{ batch.id }}</el-descriptions-item>
          <el-descriptions-item label="Slug">
            <code>{{ batch.slug }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="Mission">{{ batch.mission }}</el-descriptions-item>
          <el-descriptions-item label="项目">{{ batch.project_id }}</el-descriptions-item>
          <el-descriptions-item label="Seq UUID">
            <code class="batch-detail__uuid">{{ batch.seq_uuid }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="分派策略">
            {{ strategyLabel(batch.assignee_strategy) }}
          </el-descriptions-item>
          <el-descriptions-item label="采样率">
            {{ ((batch.sampling_rate ?? 1) * 100).toFixed(0) }}%
          </el-descriptions-item>
          <el-descriptions-item label="帧范围">
            {{ formatFrameRange(batch.frame_range) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(batch.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="标注员池">
            <span v-if="!batch.assignees || batch.assignees.length === 0" class="batch-detail__muted">—</span>
            <el-tag
              v-for="a in batch.assignees"
              :key="a"
              size="small"
              type="info"
              effect="plain"
              style="margin-right: 4px"
            >
              #{{ a }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审核员池">
            <span v-if="!batch.reviewers || batch.reviewers.length === 0" class="batch-detail__muted">—</span>
            <el-tag
              v-for="a in batch.reviewers"
              :key="a"
              size="small"
              type="info"
              effect="plain"
              style="margin-right: 4px"
            >
              #{{ a }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="QA 池">
            <span v-if="!batch.qa_pool || batch.qa_pool.length === 0" class="batch-detail__muted">—</span>
            <el-tag
              v-for="a in batch.qa_pool"
              :key="a"
              size="small"
              type="info"
              effect="plain"
              style="margin-right: 4px"
            >
              #{{ a }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card v-if="batch" shadow="never" class="batch-detail__units-card">
        <template #header>
          <div class="batch-detail__units-header">
            <span>Units</span>
            <div class="batch-detail__units-filters">
              <el-select
                v-model="unitFilters.assignee_id"
                placeholder="按 assignee 过滤"
                clearable
                filterable
                style="width: 200px"
                @change="reloadUnits"
              >
                <el-option
                  v-for="u in batch.assignees || []"
                  :key="u"
                  :label="`#${u}`"
                  :value="u"
                />
              </el-select>
              <el-select
                v-model="unitFilters.stage_status"
                placeholder="按状态过滤"
                clearable
                style="width: 200px"
                @change="reloadUnits"
              >
                <el-option label="未分派" value="unassigned" />
                <el-option label="已分派" value="assigned" />
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="approved" />
              </el-select>
              <el-checkbox
                v-model="unitFilters.eligible_only"
                @change="reloadUnits"
                title="只显示当前用户角色有权认领的 unit(按 stage 角色过滤)"
              >
                只显示我能领的
              </el-checkbox>
          </div>
          </div>
        </template>
        <el-table v-loading="unitsLoading" :data="units" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="位置" min-width="280">
            <template #default="{ row }">
              <span class="batch-detail__coord">
                {{ row.seq }} / {{ row.stream }} / f{{ row.frame_start }}~{{ row.frame_end }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="Assignee" width="120">
            <template #default="{ row }">
              <span v-if="row.assignee_id">#{{ row.assignee_id }}</span>
              <span v-else class="batch-detail__muted">未分派</span>
            </template>
          </el-table-column>
          <el-table-column label="Reviewer" width="120">
            <template #default="{ row }">
              <span v-if="row.reviewer_id">#{{ row.reviewer_id }}</span>
              <span v-else class="batch-detail__muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="阶段状态" width="120">
            <template #default="{ row }">
              <el-tag :type="stageTagType(row.stage_status)" size="small">
                {{ row.stage_status || '—' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openAnno(row)">打开标注</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="batch-detail__units-pager">
          <el-pagination
            v-model:current-page="unitPage"
            v-model:page-size="unitPageSize"
            :total="unitTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="loadUnits"
            @size-change="loadUnits"
          />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { batchesApi } from '@/api'
import { userAuth } from '@/states/UserState'

const route = useRoute()

const batch = ref<any>(null)
const loading = ref(false)
const spawning = ref(false)
const toggling = ref(false)

const units = ref<any[]>([])
const unitsLoading = ref(false)
const unitPage = ref(1)
const unitPageSize = ref(20)
const unitTotal = ref(0)
const unitFilters = reactive({
  assignee_id: undefined as number | undefined,
  stage_status: undefined as string | undefined,
  eligible_only: false,
})

const batchId = computed(() => Number(route.params.id))

const canSpawn = computed(() => {
  const s = batch.value?.status
  return s === 'pending' || s === 'active'
})

const canToggle = computed(() => {
  const s = batch.value?.status
  return s === 'pending' || s === 'active' || s === 'cancelled'
})

const loadBatch = async () => {
  loading.value = true
  try {
    batch.value = await batchesApi.getBatch(batchId.value)
  } finally {
    loading.value = false
  }
}

const loadUnits = async () => {
  if (!batch.value?.project_id) return
  unitsLoading.value = true
  try {
    const res = await batchesApi.listUnits(batch.value.project_id, {
      batch_id: batchId.value,
      assignee_id: unitFilters.assignee_id,
      stage_status: unitFilters.stage_status,
      eligible_only: unitFilters.eligible_only ? true : undefined,
      page: unitPage.value,
      page_size: unitPageSize.value,
    })
    units.value = res?.items ?? res?.data ?? []
    unitTotal.value = res?.total ?? units.value.length
  } finally {
    unitsLoading.value = false
  }
}

const reloadUnits = () => {
  unitPage.value = 1
  loadUnits()
}

const onSpawn = async () => {
  try {
    await ElMessageBox.confirm('将根据当前批次配置铺开 Units,可能耗时较长', 'Spawn 确认', { type: 'warning' })
  } catch {
    return
  }
  spawning.value = true
  try {
    const res = await batchesApi.spawnBatch(batchId.value, {})
    const cnt = res?.spawned ?? res?.created ?? res?.count ?? '?'
    ElMessage.success(`Spawn 完成,生成 ${cnt} 个 unit`)
    await loadBatch()
    await loadUnits()
  } finally {
    spawning.value = false
  }
}

const onToggleStatus = async () => {
  const next = batch.value.status === 'active' ? 'pending' : 'active'
  try {
    await ElMessageBox.confirm(`将批次状态切到「${statusLabel(next)}」?`, '确认', { type: 'warning' })
  } catch {
    return
  }
  toggling.value = true
  try {
    await batchesApi.updateBatch(batchId.value, { status: next })
    ElMessage.success('已切换')
    await loadBatch()
  } finally {
    toggling.value = false
  }
}

const openAnno = (row: any) => {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}anno.html?seq=${encodeURIComponent(row.seq)}&stream=${encodeURIComponent(row.stream)}&frame=${row.frame_start}&mission=${encodeURIComponent(batch.value.mission)}`
  window.open(url, '_blank')
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

const stageTagType = (s: string | undefined): 'info' | 'warning' | 'success' | 'danger' | 'primary' => {
  if (!s) return 'info'
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'danger'
  if (s === 'in_progress' || s === 'assigned') return 'primary'
  return 'info'
}

const strategyLabel = (s: string) => {
  const map: Record<string, string> = {
    manual: '手动认领',
    round_robin: '轮转',
    load_aware: '负载均衡',
  }
  return map[s] || s || '—'
}

const formatFrameRange = (r: any) => {
  if (!r) return '全帧'
  const parts: string[] = []
  if (r.start != null) parts.push(`start=${r.start}`)
  if (r.end != null) parts.push(`end=${r.end}`)
  if (r.step != null) parts.push(`step=${r.step}`)
  return parts.length > 0 ? parts.join(', ') : '全帧'
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

watch(batchId, () => {
  loadBatch().then(loadUnits)
})

// 确认 userAuth 在被引用时不被 tree-shake 掉(保留扩展点:历史 tab 用)
void userAuth

onMounted(async () => {
  await loadBatch()
  await loadUnits()
})
</script>

<style scoped>
.batch-detail {
  padding: 16px 24px;
}

.batch-detail__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.batch-detail__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.batch-detail__actions {
  display: inline-flex;
  gap: 8px;
}

.batch-detail__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.batch-detail__meta-card,
.batch-detail__units-card {
  border: 1px solid var(--y-color-divider);
}

.batch-detail__units-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.batch-detail__units-filters {
  display: inline-flex;
  gap: 8px;
}

.batch-detail__uuid {
  font-family: var(--y-font-family-mono, monospace);
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
  word-break: break-all;
}

.batch-detail__coord {
  font-family: var(--y-font-family-mono, monospace);
  font-size: 12px;
}

.batch-detail__muted {
  color: var(--el-text-color-placeholder);
}

.batch-detail__units-pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
