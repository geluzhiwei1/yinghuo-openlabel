<template>
  <PageContainer
    :title="t('annoJob.title')"
    :description="t('annoJob.description')"
    :loading="tableLoading"
    :show-pagination="true"
    :page="pager.page"
    :page-size="pager.page_size"
    :total="pager.total"
    @update:page="changePage"
    @update:page-size="changeSize"
  >
    <template #filter>
      <FilterBar
        v-model="queryParam"
        storage-key="anno-job-list"
        @search="handleSearch"
        @reset="handleReset"
      >
        <el-form-item :label="t('annoJob.field.dataSeq')">
          <el-input
            v-model="queryParam.data_seq"
            :placeholder="t('annoJob.placeholder.dataSeq')"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item :label="t('annoJob.field.mission')">
          <el-input
            v-model="queryParam.mission"
            :placeholder="t('annoJob.placeholder.mission')"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item :label="t('annoJob.field.status')">
          <el-select
            v-model="queryParam.job_status"
            :placeholder="t('annoJob.placeholder.status')"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </FilterBar>
    </template>

    <template #toolbar>
      <div class="anno-job-v2__toolbar">
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
        <button class="aj-refresh" @click="loadData" :disabled="tableLoading">
          <Icon icon="lucide:refresh-cw" :width="16" />
          <span>{{ t('action.refresh') }}</span>
          <span class="aj-refresh__ball" aria-hidden="true">
            <Icon icon="lucide:arrow-right" :width="14" />
          </span>
        </button>
      </div>
    </template>

    <!-- 表格视图 -->
    <div v-if="viewMode === 'table'" class="anno-job-v2__table-card">
      <TablePro
        :data="tableData"
        :columns="columns"
        :loading="tableLoading"
        row-key="uuid"
        storage-key="anno-job-list"
        :page-index="pager.page"
        :page-size="pager.page_size"
        @update:density="(d) => (density = d)"
      >
        <template #toolbar-left>
          <span class="anno-job-v2__count">
            <span class="anno-job-v2__count-dot" />
            <span class="anno-job-v2__count-num">{{ pager.total }}</span>
            <span class="anno-job-v2__count-label">{{ t('annoJob.totalCount', { n: pager.total }).replace(pager.total.toString(), '').trim() }}</span>
          </span>
        </template>

        <template #cell-current_status="{ row }">
          <el-popover width="500px" trigger="hover" placement="left-end">
            <template #reference>
              <span
                class="aj-status-chip"
                :class="`aj-status-chip--${statusTagType(row.current_status?.status)}`"
              >
                {{ row.current_status?.status || '未知' }}
              </span>
            </template>
            <el-table :data="row.status_history" size="small">
              <el-table-column property="status" label="状态" />
              <el-table-column property="update_time" label="更新时间" min-width="180" />
              <el-table-column property="user_id" label="更新者" />
              <el-table-column property="desc" label="备注" />
            </el-table>
          </el-popover>
        </template>

        <template #cell-anno="{ row }">
          <div v-if="row.current_status?.status !== '已锁定'" class="anno-job-v2__row-actions">
            <el-popover width="500px" trigger="click" placement="left-end">
              <template #reference>
                <button class="aj-mini-btn aj-mini-btn--primary">{{ t('annoJob.action.annotate') }}</button>
              </template>
              <el-table :data="row.anno_hrefs" size="small">
                <el-table-column property="stream" label="数据" />
                <el-table-column label="操作" width="120">
                  <template #default="{ row: r }">
                    <el-link :href="r.uri" type="primary" target="_blank">
                      {{ t('annoJob.action.openAnnotate') }}
                    </el-link>
                  </template>
                </el-table-column>
              </el-table>
            </el-popover>
            <el-popover width="500px" trigger="hover" placement="left-end">
              <template #reference>
                <button class="aj-mini-btn aj-mini-btn--success">{{ t('annoJob.action.submitReview') }}</button>
              </template>
              <el-select v-model="newStatus.status" disabled style="width: 100%; margin-bottom: 8px">
                <el-option
                  v-for="opt in JobStatus"
                  :label="opt.label"
                  :value="opt.value"
                  :key="opt.label"
                />
              </el-select>
              <el-input
                v-model="newStatus.desc"
                :placeholder="t('annoJob.placeholder.reviewNote')"
                type="textarea"
                :rows="3"
                style="margin-bottom: 8px"
              />
              <el-button type="primary" size="small" @click="updateStatus(row)">
                {{ t('action.confirm') }}
              </el-button>
            </el-popover>
          </div>
          <span v-else class="anno-job-v2__locked">{{ t('annoJob.status.locked') }}</span>
        </template>

        <template #cell-tongji="{ row }">
          <el-popover width="500px" trigger="click" placement="left-end">
            <template #reference>
              <button class="aj-mini-btn">{{ t('annoJob.action.statistics') }}</button>
            </template>
            <el-table :data="row.anno_hrefs" size="small">
              <el-table-column property="stream" label="数据" />
              <el-table-column label="操作" width="120">
                <template #default="{ row: r }">
                  <el-button type="primary" size="small" plain @click="openStatisticDrawer(r)">
                    {{ t('annoJob.action.view') }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-popover>
        </template>

        <template #cell-operator="{ row }">
          <button class="aj-link-btn" @click="handleView(row)">
            <Icon icon="ri:eye-line" :width="14" />
            <span>{{ t('annoJob.action.viewDetail') }}</span>
          </button>
        </template>

        <template #empty>
          <EmptyState
            icon="lucide:file-text"
            :title="t('filter.empty')"
            :description="t('filter.emptyHint')"
          />
        </template>
      </TablePro>
    </div>

    <!-- 卡片视图 -->
    <div v-else v-loading="tableLoading" class="card-grid">
      <article v-for="row in tableData" :key="row.uuid" class="job-card">
        <header class="job-card__header">
          <span
            class="aj-status-chip"
            :class="`aj-status-chip--${statusTagType(row.current_status?.status)}`"
          >
            {{ row.current_status?.status || '未知' }}
          </span>
          <el-dropdown trigger="click" placement="bottom-end" @command="(cmd: string) => handleCardCommand(cmd, row)">
            <button class="icon-action" aria-label="更多操作">
              <Icon icon="lucide:ellipsis" :width="16" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="view">
                  <Icon icon="lucide:eye" :width="14" /> 详情
                </el-dropdown-item>
                <el-dropdown-item command="statistics" :disabled="!row.anno_hrefs?.length">
                  <Icon icon="lucide:bar-chart-2" :width="14" /> 统计
                </el-dropdown-item>
                <el-dropdown-item command="submitReview" :disabled="row.current_status?.status === '已锁定'">
                  <Icon icon="lucide:check-circle" :width="14" /> 提交审核
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </header>

        <h3 class="job-card__title" :title="row.name">{{ row.name }}</h3>
        <p v-if="row.desc" class="job-card__desc" :title="row.desc">{{ row.desc }}</p>

        <dl class="job-card__meta">
          <div class="job-card__meta-item">
            <dt>团队ID</dt>
            <dd>{{ row.main_user_id || '—' }}</dd>
          </div>
          <div class="job-card__meta-item">
            <dt>分类</dt>
            <dd>{{ row.mission || '—' }}</dd>
          </div>
          <div class="job-card__meta-item">
            <dt>标注规范</dt>
            <dd>{{ row.taxonomy || '—' }}</dd>
          </div>
          <div class="job-card__meta-item">
            <dt>数据序列</dt>
            <dd>{{ row.data_seq || '—' }}</dd>
          </div>
        </dl>

        <div v-if="row.anno_hrefs?.length && row.current_status?.status !== '已锁定'" class="job-card__streams">
          <a
            v-for="s in row.anno_hrefs"
            :key="s.stream"
            class="job-card__stream-chip"
            :href="s.uri"
            :title="`打开 ${s.stream}`"
            target="_blank"
          >
            <Icon icon="lucide:external-link" :width="12" />
            {{ s.stream }}
          </a>
        </div>

        <footer class="job-card__footer">
          <button
            v-if="row.anno_hrefs?.length"
            class="icon-action"
            @click="openStatisticDrawer(row.anno_hrefs[0])"
          >
            <Icon icon="lucide:bar-chart-2" :width="14" /> 统计
          </button>
          <button class="icon-action" @click="handleView(row)">
            <Icon icon="lucide:eye" :width="14" /> 详情
          </button>
        </footer>
      </article>

      <EmptyState
        v-if="!tableLoading && tableData.length === 0"
        icon="lucide:inbox"
        title="暂无任务"
        description="调整筛选条件再试一次。"
        size="sm"
      />
    </div>

    <el-dialog :title="t('annoJob.detailTitle')" v-model="visibleDetail" width="70%" destroy-on-close>
      <TableDetail :data="viewData" />
    </el-dialog>

    <AnnotStatisticDrawer ref="annotDrawerRef" />
  </PageContainer>
</template>

<script lang="tsx" setup>
import { onMounted, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { annoJobPerformApi } from '@/api'
import { type JobPerform } from '@/types/jobPerform'
import TableDetail from '@/components/table-detail.vue'
import PageContainer from '@/components/PageContainer.vue'
import FilterBar from '@/components/FilterBar.vue'
import TablePro, { type TableColumn } from '@/components/TablePro.vue'
import EmptyState from '@/components/EmptyState.vue'
import { userAuth } from '@/states/UserState'
import AnnotStatisticDrawer from '@/views/statistics/AnnoStatistics.vue'
import { Mission, JobStatus } from '@/constants'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

const t = (key: string, payload?: Record<string, any>) => i18n.global.t(key, payload as any)

type ViewMode = 'table' | 'card'
const VIEW_MODE_KEY = 'anno-job-v2:view-mode'

const viewMode = ref<ViewMode>((localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'table')
const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_KEY, mode)
}

const tableLoading = ref(false)
const annotDrawerRef = ref()
const density = ref<'compact' | 'cozy' | 'loose'>('cozy')

const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0,
})

const queryParam = reactive({
  data_seq: undefined as string | undefined,
  mission: undefined as string | undefined,
  job_status: undefined as string | undefined,
})

const statusOptions = [
  { label: '待标注', value: '待标注' },
  { label: '标注中', value: '标注中' },
  { label: '待审核', value: '待审核' },
  { label: '待修正', value: '待修正' },
  { label: '已完成', value: '已完成' },
  { label: '已取消', value: '已取消' },
  { label: '已锁定', value: '已锁定' },
]

const columns: TableColumn[] = [
  { type: 'index', label: '#', width: 60, align: 'center', required: true },
  { prop: 'main_user_id', label: '团队ID', width: 120, sortable: true },
  { prop: 'name', label: '任务名称', minWidth: 180, required: true },
  { prop: 'mission', label: '分类', width: 140 },
  { prop: 'taxonomy', label: '标注规范', width: 140 },
  { prop: 'current_status', label: '状态', width: 110, align: 'center' },
  { prop: 'anno', label: '标注', width: 180, align: 'center' },
  { prop: 'tongji', label: '统计', width: 100, align: 'center' },
  { prop: 'operator', label: '操作', width: 110, align: 'center', required: true },
]

const statusTagType = (status?: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  if (!status) return 'info'
  if (status === '已完成') return 'success'
  if (status === '待审核') return 'primary'
  if (status === '待修正' || status === '标注中') return 'warning'
  if (status === '已取消' || status === '已锁定') return 'info'
  return 'info'
}

const missionAnnoUri = (stream: string, item: any): string => {
  switch (item.label_spec.mission.key) {
    case Mission.ObjectBBox3d:
    case Mission.PcPolyline3d:
    case Mission.PcSemantic3d:
      return `pc.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
    default:
      return `anno.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
  }
}

const tableData = ref<JobPerform[]>([])

const loadData = () => {
  tableLoading.value = true
  annoJobPerformApi
    .searchJob({ pager, query: queryParam })
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
              uri: missionAnnoUri(stream, item),
              uuid: item._id,
              current_mission: item.label_spec.mission.key,
              seq: item.label_spec.data.seq,
            })),
            current_status: item.current_status,
            status_history: item.status_history,
            disableDeleteBtn: !item.authority.owners.includes(userAuth.value.user.id),
          }) as JobPerform,
      )
    })
    .finally(() => {
      tableLoading.value = false
    })
}

const handleSearch = () => {
  pager.page = 1
  loadData()
}

const handleReset = () => {
  queryParam.data_seq = undefined
  queryParam.mission = undefined
  queryParam.job_status = undefined
  pager.page = 1
  loadData()
}

const changePage = (val: number) => {
  pager.page = val
  loadData()
}

const changeSize = (val: number) => {
  pager.page_size = val
  pager.page = 1
  loadData()
}

const visibleDetail = ref(false)
const viewData = ref({ row: {}, list: [] as any[] })

const handleView = (row: any) => {
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

const openStatisticDrawer = (options: any) => {
  annotDrawerRef.value?.toggleOpen(options)
}

const handleCardCommand = (cmd: string, row: JobPerform) => {
  if (cmd === 'view') handleView(row)
  else if (cmd === 'statistics' && row.anno_hrefs?.length) openStatisticDrawer(row.anno_hrefs[0])
  else if (cmd === 'submitReview') updateStatus(row)
}

const newStatus = reactive({
  status: '待审核',
  desc: '',
})

const updateStatus = (row: any) => {
  annoJobPerformApi
    .update_status({ _id: row.uuid, status: '待审核' })
    .then(() => {
      ElMessage.success('提交成功')
      loadData()
    })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.anno-job-v2__toolbar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* View toggle — same look as my-job.vue */
.view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--lab-paper);
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

/* Hero refresh button — coral with lime ball */
.aj-refresh {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 4px 0 14px;
  border: none;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-coral);
  color: var(--lab-snow);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 200ms ease;
  box-shadow: 0 4px 14px rgba(255,106,61,0.32);
}

.aj-refresh:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(255,106,61,0.42);
}

.aj-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.aj-refresh__ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--lab-lime);
  color: var(--lab-ink);
  transition: transform 200ms ease;
}

.aj-refresh:hover:not(:disabled) .aj-refresh__ball {
  transform: rotate(45deg);
}

/* Table card */
.anno-job-v2__table-card {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-xl, 12px);
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(14,14,16,0.02), 0 4px 14px rgba(14,14,16,0.03);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Count chip */
.anno-job-v2__count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-cream);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--lab-slate);
}

.anno-job-v2__count-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
}

.anno-job-v2__count-num {
  color: var(--lab-ink);
  font-weight: 500;
}

.anno-job-v2__count-label {
  color: var(--lab-ash);
}

/* Status chip — replaces el-tag */
.aj-status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.aj-status-chip--success {
  background: var(--lab-mint, #b8f0d0);
  color: var(--lab-graphite);
}

.aj-status-chip--primary {
  background: var(--lab-ink);
  color: var(--lab-lime);
}

.aj-status-chip--warning {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}

.aj-status-chip--danger {
  background: rgba(255,106,61,0.16);
  color: var(--lab-coral);
}

.aj-status-chip--info {
  background: var(--lab-cream);
  color: var(--lab-slate);
}

/* Row action mini buttons */
.anno-job-v2__row-actions {
  display: inline-flex;
  gap: 6px;
  justify-content: center;
}

.aj-mini-btn {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: var(--lab-radius-pill, 999px);
  border: 1px solid var(--lab-line);
  background: var(--lab-snow);
  color: var(--lab-graphite);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.aj-mini-btn:hover {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
  background: var(--lab-cream);
}

.aj-mini-btn--primary {
  background: var(--lab-ink);
  color: var(--lab-snow);
  border-color: var(--lab-ink);
}

.aj-mini-btn--primary:hover {
  background: var(--lab-graphite);
  color: var(--lab-lime);
}

.aj-mini-btn--success {
  background: var(--lab-lime);
  color: var(--lab-ink);
  border-color: var(--lab-lime);
}

.aj-mini-btn--success:hover {
  background: #b8e83a;
}

.aj-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--lab-slate);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  transition: all 150ms ease;
}

.aj-link-btn:hover {
  color: var(--lab-ink);
  background: var(--lab-cream);
}

.anno-job-v2__locked {
  color: var(--lab-fog);
  font-size: 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

/* ===== Icon action (shared by card + dropdown trigger) ===== */
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
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

/* ===== Card grid (mirrors my-job.vue for visual consistency) ===== */
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
</style>
