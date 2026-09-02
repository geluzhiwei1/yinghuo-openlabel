<template>
  <div class="my-job">
    <TableSearch :query="queryParam" :options="searchOpt" :search="handleSearch" />
    <div class="container">
      <div class="my-job__toolbar">
        <div class="my-job__toolbar-left">
          <el-button type="primary" @click="openFormCreate()">
            <Icon icon="lucide:plus" :width="16" />
            新建任务
          </el-button>
          <el-dropdown v-if="multipleSelection.length > 0">
            <el-button type="primary" plain>
              批量操作 ({{ multipleSelection.length }})
              <Icon icon="lucide:arrow-down" :width="14" class="el-icon--right" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="collaborator" @click="collaboratorsRef.open(multipleSelection)">协作</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="my-job__toolbar-right">
          <div class="view-toggle" role="tablist" aria-label="视图切换">
            <button
              class="view-toggle__btn"
              :class="{ 'is-active': viewMode === 'table' }"
              role="tab"
              :aria-selected="viewMode === 'table'"
              title="表格视图"
              @click="setViewMode('table')"
            >
              <Icon icon="lucide:list" :width="16" />
            </button>
            <button
              class="view-toggle__btn"
              :class="{ 'is-active': viewMode === 'card' }"
              role="tab"
              :aria-selected="viewMode === 'card'"
              title="卡片视图"
              @click="setViewMode('card')"
            >
              <Icon icon="lucide:layout-grid" :width="16" />
            </button>
          </div>
          <el-tooltip effect="dark" content="刷新" placement="top">
            <button class="icon-action" @click="loadData">
              <Icon icon="lucide:refresh-cw" :width="16" />
            </button>
          </el-tooltip>
        </div>
      </div>

      <!-- 表格视图 -->
      <TableCustom
        v-if="viewMode === 'table'"
        :loading="tableLoading"
        :columns="columns"
        :tableData="tableData"
        :total="pager.total"
        :page="pager.page"
        :pageSize="pager.page_size"
        :viewFunc="handleView"
        :refresh="loadData"
        :delFunc="handleDelete"
        :changePage="changePage"
        :changeSize="changeSize"
        :editFunc="handleEdit"
        :hasToolbar="false"
        @selection-change="handleSelectionChange"
      >
        <template #status="{ rows }">
          <el-popover :width="380" trigger="hover" placement="left-end">
            <template #reference>
              <span class="status-badge" :class="`status-badge--${statusKey(rows.current_status?.status)}`">
                <span class="status-badge__dot" />
                {{ rows.current_status?.status || '未知' }}
              </span>
            </template>
            <div class="status-history">
              <div class="status-history__title">状态历史</div>
              <el-table :data="rows.status_history" size="small">
                <el-table-column property="status" label="状态" min-width="90" />
                <el-table-column property="update_time" label="更新时间" min-width="160" />
                <el-table-column property="user_id" label="更新者" min-width="80" />
              </el-table>
            </div>
          </el-popover>
        </template>
        <template #anno="{ rows }">
          <div class="row-actions">
            <el-tooltip effect="dark" content="查看详情" placement="top">
              <button class="icon-action" @click="handleView(rows)">
                <Icon icon="lucide:eye" :width="15" />
              </button>
            </el-tooltip>
            <el-tooltip effect="dark" content="协作" placement="top">
              <button class="icon-action" @click="collaboratorsRef.open(rows)">
                <Icon icon="lucide:users" :width="15" />
              </button>
            </el-tooltip>
            <el-tooltip effect="dark" content="导出" placement="top">
              <button class="icon-action" @click="dataExportRef.open(rows)">
                <Icon icon="lucide:download" :width="15" />
              </button>
            </el-tooltip>
            <el-popover :width="420" trigger="click" placement="left-end">
              <template #reference>
                <button class="icon-action" title="任务状态">
                  <Icon icon="lucide:refresh-cw" :width="15" />
                </button>
              </template>
              <div class="status-update">
                <div class="status-update__title">更新任务状态</div>
                <el-radio-group v-model="newStatus.status" class="status-update__radios">
                  <el-radio v-for="opt in JobStatus" :value="opt.value" :key="opt.label" size="small">
                    {{ opt.label }}
                  </el-radio>
                </el-radio-group>
                <el-input v-model="newStatus.desc" placeholder="备注（可选）" type="textarea" :rows="2" />
                <div class="status-update__footer">
                  <el-button type="primary" size="small" @click="updateStatus(rows)">更新</el-button>
                </div>
              </div>
            </el-popover>
            <el-tooltip effect="dark" content="编辑" placement="top">
              <button class="icon-action" @click="handleEdit(rows)">
                <Icon icon="lucide:pencil" :width="15" />
              </button>
            </el-tooltip>
            <el-tooltip effect="dark" content="删除" placement="top">
              <button
                class="icon-action icon-action--danger"
                :disabled="rows.disableDeleteBtn"
                @click="handleDelete(rows)"
              >
                <Icon icon="lucide:trash-2" :width="15" />
              </button>
            </el-tooltip>
          </div>
        </template>
      </TableCustom>

      <!-- 卡片视图 -->
      <div v-else v-loading="tableLoading" class="card-grid">
        <article v-for="row in tableData" :key="row.uuid" class="job-card">
          <header class="job-card__header">
            <span class="status-badge" :class="`status-badge--${statusKey(row.current_status?.status)}`">
              <span class="status-badge__dot" />
              {{ row.current_status?.status || '未知' }}
            </span>
            <el-dropdown trigger="click" placement="bottom-end" @command="(cmd: string) => handleCardCommand(cmd, row)">
              <button class="icon-action" aria-label="更多操作">
                <Icon icon="lucide:ellipsis" :width="16" />
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="view">
                    <Icon icon="lucide:eye" :width="14" /> 查看详情
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <Icon icon="lucide:pencil" :width="14" /> 编辑
                  </el-dropdown-item>
                  <el-dropdown-item command="collaborator">
                    <Icon icon="lucide:users" :width="14" /> 协作
                  </el-dropdown-item>
                  <el-dropdown-item command="export">
                    <Icon icon="lucide:download" :width="14" /> 导出
                  </el-dropdown-item>
                  <el-dropdown-item command="status">
                    <Icon icon="lucide:refresh-cw" :width="14" /> 任务状态
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided :disabled="row.disableDeleteBtn">
                    <Icon icon="lucide:trash-2" :width="14" /> 删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </header>

          <h3 class="job-card__title" :title="row.name">{{ row.name }}</h3>
          <p v-if="row.desc" class="job-card__desc" :title="row.desc">{{ row.desc }}</p>

          <dl class="job-card__meta">
            <div class="job-card__meta-item">
              <dt>领域</dt>
              <dd>{{ row.domain || '—' }}</dd>
            </div>
            <div class="job-card__meta-item">
              <dt>任务</dt>
              <dd>{{ row.mission || '—' }}</dd>
            </div>
            <div class="job-card__meta-item">
              <dt>格式</dt>
              <dd>{{ row.data_format || '—' }}</dd>
            </div>
            <div class="job-card__meta-item">
              <dt>主账号</dt>
              <dd>{{ row.main_user_id || '—' }}</dd>
            </div>
          </dl>

          <div v-if="row.anno_hrefs?.length" class="job-card__streams">
            <a
              v-for="s in row.anno_hrefs"
              :key="s.stream"
              class="job-card__stream-chip"
              :href="s.uri"
              :title="`打开 ${s.stream}`"
            >
              <Icon icon="lucide:external-link" :width="12" />
              {{ s.stream }}
            </a>
          </div>

          <footer class="job-card__footer">
            <button class="icon-action" @click="collaboratorsRef.open(row)">
              <Icon icon="lucide:users" :width="14" /> 协作
            </button>
            <button class="icon-action" @click="dataExportRef.open(row)">
              <Icon icon="lucide:download" :width="14" /> 导出
            </button>
            <button class="icon-action" @click="handleEdit(row)">
              <Icon icon="lucide:pencil" :width="14" /> 编辑
            </button>
          </footer>
        </article>

        <EmptyState
          v-if="!tableLoading && tableData.length === 0"
          icon="lucide:inbox"
          title="暂无任务"
          description="新建一个标注任务，或调整筛选条件再试一次。"
          size="sm"
        />
      </div>

      <!-- 分页（卡片视图独立分页） -->
      <div v-if="viewMode === 'card' && tableData.length > 0" class="my-job__pagination">
        <el-pagination
          :current-page="pager.page"
          :page-size="pager.page_size"
          :background="true"
          :layout="'total, prev, pager, next, sizes'"
          :total="pager.total"
          :page-sizes="[10, 20, 30, 40, 50]"
          @current-change="changePage"
          @size-change="changeSize"
        />
      </div>
    </div>

    <AnnoJobForm ref="formRef" @success="loadData" />
    <Collaborators ref="collaboratorsRef"></Collaborators>
    <DataExportDrawer ref="dataExportRef"></DataExportDrawer>

    <el-dialog v-model="statusDialog.visible" title="更新任务状态" width="420px" append-to-body>
      <div class="status-update">
        <el-radio-group v-model="statusDialog.form.status" class="status-update__radios">
          <el-radio v-for="opt in JobStatus" :value="opt.value" :key="opt.label" size="small">
            {{ opt.label }}
          </el-radio>
        </el-radio-group>
        <el-input v-model="statusDialog.form.desc" placeholder="备注（可选）" type="textarea" :rows="3" />
      </div>
      <template #footer>
        <el-button @click="statusDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="confirmStatusDialog">更新</el-button>
      </template>
    </el-dialog>

    <el-dialog title="查看详情" v-model="visibleDetail" width="70%" destroy-on-close>
      <TableDetail :data="viewData"> </TableDetail>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { onMounted, ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { annoJobPerformApi } from '@/api'
import AnnoJobForm from './anno-job-form.vue'
import { messages } from '@/states'
import { type JobPerform } from '@/types/jobPerform'
import { type FormOptionList } from '@/types/form-option'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import EmptyState from '@/components/EmptyState.vue'
import { userAuth } from '@/states/UserState'
import Collaborators from './collaborator-drawer.vue'
import DataExportDrawer from './data-export-drawer.vue'
import { JobStatus } from '@/constants'

type ViewMode = 'table' | 'card'
type StatusKey = 'pending' | 'progress' | 'review' | 'fix' | 'done' | 'cancelled' | 'locked' | 'unknown'

const VIEW_MODE_KEY = 'my-job:view-mode'

const tableLoading = ref(false)
const multipleSelection = ref<JobPerform[]>([])

const viewMode = ref<ViewMode>((localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'table')
const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_KEY, mode)
}

const statusKey = (raw?: string): StatusKey => {
  if (!raw) return 'unknown'
  if (raw.includes('待标')) return 'pending'
  if (raw.includes('标注中')) return 'progress'
  if (raw.includes('审核')) return 'review'
  if (raw.includes('修正')) return 'fix'
  if (raw.includes('完成')) return 'done'
  if (raw.includes('取消')) return 'cancelled'
  if (raw.includes('锁定')) return 'locked'
  return 'unknown'
}

const newStatus = reactive({ status: '', desc: '' })
const statusDialog = reactive({
  visible: false,
  target: null as JobPerform | null,
  form: { status: '', desc: '' },
})

const openStatusDialog = (row: JobPerform) => {
  statusDialog.target = row
  statusDialog.form.status = row.current_status?.status || ''
  statusDialog.form.desc = ''
  statusDialog.visible = true
}
const confirmStatusDialog = () => {
  if (!statusDialog.target) return
  const row = statusDialog.target
  annoJobPerformApi
    .update_status({ _id: row.uuid, ...statusDialog.form })
    .then(() => {
      ElMessage.success('更新成功')
      statusDialog.visible = false
      loadData()
    })
}

const handleCardCommand = (cmd: string, row: JobPerform) => {
  if (cmd === 'view') handleView(row)
  else if (cmd === 'edit') handleEdit(row)
  else if (cmd === 'collaborator') collaboratorsRef.open(row)
  else if (cmd === 'export') dataExportRef.open(row)
  else if (cmd === 'status') openStatusDialog(row)
  else if (cmd === 'delete') handleDelete(row)
}

const handleSelectionChange = (rows: JobPerform[]) => {
  multipleSelection.value = rows
}

const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0,
})
const queryParam = reactive({
  data_seq: undefined,
  mission: undefined,
  job_status: undefined,
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '数据：', prop: 'data_seq' },
  { type: 'input', label: '任务分类：', prop: 'mission' },
  {
    type: 'select',
    label: '状态：',
    prop: 'job_status',
    opts: [
      { label: '所有', value: '' },
      { label: '待标注', value: '待标注' },
      { label: '标注中', value: '标注中' },
      { label: '待审核', value: '待审核' },
      { label: '待修正', value: '待修正' },
      { label: '已完成', value: '已完成' },
      { label: '已取消', value: '已取消' },
      { label: '已锁定', value: '已锁定' },
    ],
  },
])
const handleSearch = () => {
  pager.page = 1
  loadData()
}

const tableData = ref<JobPerform[]>([])
const loadData = () => {
  tableLoading.value = true
  annoJobPerformApi
    .search({ pager, query: queryParam })
    .then((res) => {
      pager.page = res.page
      pager.page_size = res.page_size
      pager.total = res.total

      tableData.value = res.data.map(
        (item) =>
          ({
            uuid: item._id,
            main_user_id: item.creater,
            id: item.id,
            name: item.name,
            desc: item.desc,
            authority: item.authority,
            domain: item.label_spec.domain.key,
            mission: item.label_spec.mission.key,
            taxonomy: item.label_spec.taxonomy.key,
            data_format: item.label_spec.data.format,
            data_seq: item.label_spec.data.seq,
            data: item.label_spec.data,
            anno_hrefs: item.label_spec.data.streams.map((stream: string) => ({
              stream,
              uri: `anno.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`,
            })),
            current_status: item.current_status,
            status_history: item.status_history,
            disableDeleteBtn: !item.authority.owners.includes(userAuth.value.user.id),
          }) as JobPerform
      )
    })
    .finally(() => {
      tableLoading.value = false
    })
}

const formRef = ref()
const collaboratorsRef = ref()
const dataExportRef = ref()

const openFormCreate = () => {
  formRef.value.open('create', { id: 0 })
}
const handleEdit = (params: JobPerform) => {
  formRef.value.open('edit', params)
}

const columns = ref([
  { type: 'selection', label: '', width: 48, align: 'center' },
  { type: 'index', label: '#', width: 50, align: 'center' },
  { prop: 'name', label: '名称', minWidth: 160, align: 'left' },
  { prop: 'status', label: '状态', width: 110, align: 'left' },
  { prop: 'domain', label: '领域', width: 110 },
  { prop: 'mission', label: '任务', width: 120 },
  { prop: 'taxonomy', label: '标注规范', minWidth: 120, showOverflowTooltip: true },
  { prop: 'data_format', label: '格式', width: 90 },
  { prop: 'main_user_id', label: '主账号', width: 110 },
  { prop: 'anno', label: '操作', width: 220, align: 'center' },
])

const changePage = (val: number) => {
  pager.page = val
  loadData()
}
const changeSize = (val: number) => {
  pager.page_size = val
  pager.page = 1
  loadData()
}

const handleDelete = (row: JobPerform) => {
  annoJobPerformApi
    .delete(row)
    .then(() => {
      messages.lastSuccess = '删除成功'
      loadData()
    })
    .catch((err) => {
      messages.lastException = `删除出现异常${err.message}`
    })
}

const visibleDetail = ref(false)
const viewData = ref({ row: {}, list: [] as any[] })
const handleView = (row: JobPerform) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    { prop: 'name', label: '名称' },
    { prop: 'data_seq', label: '数据' },
    { prop: 'domain', label: '领域' },
    { prop: 'mission', label: '任务分类' },
    { prop: 'taxonomy', label: '标注规范' },
    { prop: 'data_format', label: '数据格式' },
    { prop: 'desc', label: '描述' },
  ]
  visibleDetail.value = true
}

const updateStatus = (row: JobPerform) => {
  annoJobPerformApi
    .update_status({ _id: row.uuid, ...newStatus })
    .then(() => {
      ElMessage.success('更新成功')
      loadData()
    })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.my-job {
  display: flex;
  flex-direction: column;
}

.my-job__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.my-job__toolbar-left,
.my-job__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  background: var(--lab-cream);
  border: 1px solid var(--lab-hairline);
  border-radius: 8px;
}

.view-toggle__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--lab-ash);
  cursor: pointer;
  transition: all 150ms ease;
}

.view-toggle__btn:hover {
  color: var(--lab-ink);
}

.view-toggle__btn.is-active {
  background: var(--lab-snow);
  color: var(--lab-ink);
  box-shadow: 0 1px 2px rgba(14, 14, 16, 0.06);
}

.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--lab-slate);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 150ms ease;
}

.icon-action:hover {
  background: var(--lab-cream);
  border-color: var(--lab-hairline);
  color: var(--lab-ink);
}

.icon-action--danger:hover {
  background: rgba(255, 106, 61, 0.10);
  border-color: rgba(255, 106, 61, 0.22);
  color: var(--lab-coral);
}

.icon-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  justify-content: center;
}

/* ===== Status badge ===== */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: var(--lab-cream);
  color: var(--lab-slate);
  border: 1px solid var(--lab-hairline);
  cursor: default;
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-badge--pending { color: var(--lab-ash); }
.status-badge--progress { color: var(--lab-coral); background: rgba(255, 106, 61, 0.08); border-color: rgba(255, 106, 61, 0.18); }
.status-badge--review { color: #2a6fae; background: var(--lab-sky); border-color: rgba(42, 111, 174, 0.18); }
.status-badge--fix { color: var(--lab-coral); background: rgba(255, 106, 61, 0.10); border-color: rgba(255, 106, 61, 0.22); }
.status-badge--done { color: #2f7a3e; background: var(--lab-mint); border-color: rgba(47, 122, 62, 0.20); }
.status-badge--cancelled { color: var(--lab-fog); background: transparent; border-color: var(--lab-hairline); border-style: dashed; }
.status-badge--locked { color: #8a6a00; background: var(--lab-butter); border-color: rgba(138, 106, 0, 0.22); }
.status-badge--unknown { color: var(--lab-ash); }

.status-history__title,
.status-update__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--lab-ink);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.status-update__radios {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 10px;
}

.status-update__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ===== Card grid ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.job-card {
  display: flex;
  flex-direction: column;
  background: var(--lab-snow);
  border: 1px solid var(--lab-hairline);
  border-radius: 12px;
  padding: 14px 14px 12px;
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}

.job-card:hover {
  border-color: var(--lab-line);
  box-shadow: 0 2px 8px rgba(14, 14, 16, 0.04);
}

.job-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.job-card__title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--lab-ink);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-card__desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--lab-ash);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-card__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 0 0 12px;
  padding: 10px 0;
  border-top: 1px solid var(--lab-hairline);
  border-bottom: 1px solid var(--lab-hairline);
}

.job-card__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.job-card__meta-item dt {
  font-size: 10px;
  font-weight: 500;
  color: var(--lab-ash);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.job-card__meta-item dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-card__streams {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.job-card__stream-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--lab-cream);
  border: 1px solid var(--lab-hairline);
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  color: var(--lab-slate);
  text-decoration: none;
  transition: all 150ms ease;
}

.job-card__stream-chip:hover {
  background: var(--lab-snow);
  border-color: var(--lab-ink);
  color: var(--lab-ink);
}

.job-card__footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding-top: 4px;
}

.my-job__pagination {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 4px;
}

/* Make TableCustom's pagination text smaller */
:deep(.el-pagination) {
  font-size: 12px;
}
</style>
