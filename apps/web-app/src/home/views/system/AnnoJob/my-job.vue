<template>
  <div>
    <TableSearch :query="queryParam" :options="searchOpt" :search="handleSearch" />
    <div class="container">
      <TableCustom
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
      >
        <template #toolbarBtn>
          <el-button type="primary" :icon="CirclePlusFilled" @click="openFormCreate()"
            >新增</el-button
          >
        </template>
        <template #dropdownBtn="{ rows }">
          <el-dropdown>
            <el-button type="primary" plain>
              批量
              <el-icon class="el-icon--right">
                <arrow-down />
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="collaborator" @click="collaboratorsRef.open(rows)"
                  >协作</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template #anno="{ rows }">
          <el-button type="primary" size="small" plain @click="collaboratorsRef.open(rows)" disabled
            >协作</el-button
          >
          <el-button type="primary" size="small" plain @click="dataExportRef.open(rows)"
            >导出</el-button
          >

          <el-popover width="500px" height="500px" trigger="click" placement="left-end">
            <template #reference>
              <el-button type="primary" size="small" plain>任务状态</el-button>
            </template>
            <!-- <el-select-v2
              v-model="newStatus.status"
              :options="JobStatus"
            >
            </el-select-v2> -->
            <el-radio-group v-model="newStatus.status">
              <el-radio v-for="opt in JobStatus" :value="opt.value" :key="opt.label">{{
                opt.label
              }}</el-radio>
            </el-radio-group>
            <el-input
              v-model="newStatus.desc"
              placeholder="请输入备注"
              type="textarea"
              :rows="3"
            ></el-input>
            <el-button type="primary" size="small" plain @click="updateStatus(rows)"
              >更新</el-button
            >
          </el-popover>
        </template>
        <template #status="{ rows }">
          <el-popover width="500px" height="500px" trigger="hover" placement="left-end">
            <template #reference
              ><el-button size="small" plain>{{
                rows.current_status?.status ? rows.current_status.status : '未知'
              }}</el-button></template
            >
            <el-table :data="rows.status_history" width="500px">
              <el-table-column property="status" label="状态" />
              <el-table-column property="update_time" label="更新时间" min-width="260" />
              <el-table-column property="user_id" label="更新者" />
              <el-table-column property="desc" label="" />
            </el-table>
          </el-popover>
        </template>
      </TableCustom>
    </div>
    <AnnoJobForm ref="formRef" @success="loadData" />
    <Collaborators ref="collaboratorsRef"></Collaborators>
    <DataExportDrawer ref="dataExportRef"></DataExportDrawer>

    <el-dialog title="查看详情" v-model="visibleDetail" width="70%" destroy-on-close>
      <TableDetail :data="viewData"> </TableDetail>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { ElButton, ElTag, TableV2FixedDir, ElTableV2, ElMessage } from 'element-plus'
import { annoJobPerformApi } from '@/api'
import AnnoJobForm from './anno-job-form.vue'
import { messages } from '@/states'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { type JobPerform } from '@/types/jobPerform'
import { type FormOption, type FormOptionList } from '@/types/form-option'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import { userAuth } from '@/states/UserState'
import Collaborators from './collaborator-drawer.vue'
import DataExportDrawer from './data-export-drawer.vue'
import { JobStatus } from '@/constants'

const tableLoading = ref(false)
const collaboratorsRef = ref()
const dataExportRef = ref()
const newStatus = reactive({
  status: '',
  desc: ''
})

/**
 * 获取数据
 */
const pager = reactive({
  page: 1,
  pageSize: 5,
  total: 0
})
const queryParam = reactive({
  data_seq: undefined,
  mission: undefined,
  job_status: undefined
})
const searchOpt = ref<FormOptionList[]>([
  // { type: 'input', label: '主账号：', prop: 'main_user_id' },
  { type: 'input', label: '数据：', prop: 'data_seq' },
  { type: 'input', label: '任务分类：', prop: 'mission' },
  {
    type: 'select',
    label: '状态：',
    prop: 'job_status',
    opts: [
      { label: '所有', value: undefined },
      { label: '待标注', value: '待标注' },
      { label: '标注中', value: '标注中' },
      { label: '待审核', value: '待审核' },
      { label: '待修正', value: '待修正' },
      { label: '已完成', value: '已完成' },
      { label: '已取消', value: '已取消' },
      { label: '已锁定', value: '已锁定' }
    ]
  }
])
const handleSearch = () => {
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
            // anno_href: `anno?seq=${item.label_spec.data.seq}&mission=${item.label_spec.mission.key}&data_format=${item.label_spec.data.format}&taxonomy=${item.label_spec.taxonomy.key}&domain=${item.label_spec.domain.key}`
            anno_hrefs: item.label_spec.data.streams.map((stream: string) => {
              return {
                stream,
                uri: `anno.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
              }
            }),
            current_status: item.current_status,
            status_history: item.status_history,
            disableDeleteBtn: !item.authority.owners.includes(userAuth.value.user.id)
          }) as JobPerform
      )
    })
    .finally(() => {
      tableLoading.value = false
    })
}
const formRef = ref()
const openFormCreate = () => {
  const params = {
    id: 0
  }
  formRef.value.open('create', params)
}

const handleEdit = (params: JobPerform) => {
  formRef.value.open('edit', params)
}

// 表格相关
const columns = ref([
  { type: 'selection', label: '', width: 55, align: 'center' },
  { type: 'index', label: '序号', width: 55, align: 'center' },
  { prop: 'main_user_id', label: '主账号' },
  { prop: 'name', label: '名称' },
  { prop: 'status', label: '状态' },
  // { prop: 'data_seq', label: '数据' },
  { prop: 'domain', label: '领域' },
  { prop: 'mission', label: '任务分类' },
  { prop: 'taxonomy', label: '标注规范' },
  { prop: 'data_format', label: '数据格式' },
  { prop: 'anno', label: '标注' },
  { prop: 'operator', label: '操作', width: 250 }
])

const getData = async () => {
  await loadData()
}

const changePage = (val: number) => {
  pager.page = val
  getData()
}

const changeSize = (val: number) => {
  pager.page_size = val
  getData()
}

// 删除相关

const deleteRow = (data: JobPerform) => {
  annoJobPerformApi
    .delete(data)
    .then((res) => {
      messages.lastSuccess = '删除成功'
      loadData()
    })
    .catch((err) => {
      messages.lastException = `删除出现异常${err.message}`
    })
}
const handleDelete = (row: JobPerform) => {
  deleteRow(row)
}

// 查看详情弹窗相关
const visibleDetail = ref(false)
const viewData = ref({
  row: {},
  list: [] as any[]
})
const handleView = (row: JobPerform) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    { prop: 'name', label: '名称' },
    { prop: 'data_seq', label: '数据' },
    { prop: 'domain', label: '领域' },
    { prop: 'mission', label: '任务分类' },
    { prop: 'taxonomy', label: '标注规范' },
    { prop: 'data_format', label: '数据格式' },
    { prop: 'desc', label: '描述' }
  ]
  visibleDetail.value = true
}

/**
 *批量协作
 */
const batchOp = (val: any) => {
  console.log(val)
}

const updateStatus = (row) => {
  annoJobPerformApi
    .update_status({
      _id: row.uuid,
      ...newStatus
    })
    .then(() => {
      ElMessage.success('更新成功')
    })
}

onMounted(() => {
  loadData()
})
</script>
