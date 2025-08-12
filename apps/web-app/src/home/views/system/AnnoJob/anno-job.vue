<template>
  <div>
    <TableSearch :query="queryParam" :options="searchOpt" :search="handleSearch" />
    <!-- <el-button v-permiss="'sss'">测试按钮</el-button> -->
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
        :changePage="changePage"
        :changeSize="changeSize"
      >
        <template #anno="{ rows }">
          <div v-if="rows.current_status?.status !== '已锁定'">
            <el-popover width="500px" height="500px" trigger="click" placement="left-end">
              <template #reference>
                <el-button type="primary" size="small" plain>标注</el-button>
              </template>
              <el-table :data="rows.anno_hrefs" width="100%">
                <el-table-column property="stream" label="数据" />
                <el-table-column property="uri" label="操作">
                  <template #default="{ row }">
                    <el-link :href="row['uri']" type="primary" target="_blank">点击标注</el-link>
                  </template>
                </el-table-column>
              </el-table>
            </el-popover>
            <el-popover width="500px" height="500px" trigger="hover" placement="left-end">
              <template #reference>
                <el-button type="primary" size="small" plain>提交审核</el-button>
              </template>
              <el-select v-model="newStatus.status" disabled>
                <el-option
                  v-for="opt in JobStatus"
                  :label="opt.label"
                  :value="opt.value"
                  :key="opt.label"
                ></el-option>
              </el-select>
              <el-input
                v-model="newStatus.desc"
                placeholder="请输入备注"
                type="textarea"
                :rows="3"
              ></el-input>
              <el-button type="primary" size="small" plain @click="updateStatus(rows)"
                >确定</el-button
              >
            </el-popover>
          </div>
        </template>
        <template #tongji="{ rows }">
          <!-- <el-button type="primary" size="small" plain @click="openStatisticDrawer">统计</el-button> -->
          <el-popover width="500px" height="500px" trigger="click" placement="left-end">
            <template #reference
              ><el-button type="primary" size="small" plain>统计</el-button></template
            >
            <el-table :data="rows.anno_hrefs" width="100%">
              <el-table-column property="stream" label="数据" />
              <el-table-column property="uri" label="操作">
                <template #default="{ row }">
                  <el-button type="primary" size="small" plain @click="openStatisticDrawer(row)"
                    >查看</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </el-popover>
        </template>

        <template #status="{ rows }">
          <el-popover width="500px" height="500px" trigger="hover" placement="left-end">
            <template #reference
              ><el-button size="small" plain>{{
                rows.current_status?.status ? rows.current_status.status : '未知'
              }}</el-button></template
            >
            <el-table :data="rows.status_history" width="100%">
              <el-table-column property="status" label="状态" />
              <el-table-column property="update_time" label="更新时间" min-width="260" />
              <el-table-column property="user_id" label="更新者" />
              <el-table-column property="desc" label="" />
            </el-table>
          </el-popover>
        </template>
      </TableCustom>
    </div>
    <el-dialog title="查看详情" v-model="visibleDetail" width="70%" destroy-on-close>
      <TableDetail :data="viewData"> </TableDetail>
    </el-dialog>

    <!-- 统计弹框 -->
    <AnnotStatisticDrawer ref="annotDrawerRef"></AnnotStatisticDrawer>
  </div>
</template>

<script lang="tsx" setup>
import { onMounted, ref, reactive } from 'vue'
import { annoJobPerformApi } from '@/api'
import { type JobPerform } from '@/types/jobPerform'
import { type FormOption, type FormOptionList } from '@/types/form-option'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import { userAuth } from '@/states/UserState'
import AnnotStatisticDrawer from '@/views/statistics/AnnoStatistics.vue'
import { Mission } from '@/constants'
import { ElMessage } from 'element-plus'
import { JobStatus } from '@/constants'

const tableLoading = ref(false)
const annotDrawerRef = ref()

const pagerLayout = ref('total, prev, pager, next, jumper')
/**
 * 获取数据
 */
const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const queryParam = reactive({
  data_seq: undefined,
  mission: undefined,
  job_status: undefined
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '数据：', prop: 'data_seq' },
  { type: 'input', label: '任务分类：', prop: 'mission' },
  {
    type: 'select',
    label: '状态：',
    prop: 'job_status',
    opts: [
      { label: '所有', value: undefined },
      // 待标注、标注中、待审核、待修正、已完成、已取消、已锁定
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

const missionAnnoUri = (stream: string, item: any): string => {
  switch (item.label_spec.mission.key) {
    case Mission.ObjectBBox3d:
    case Mission.PcPolyline3d:
    case Mission.PcSemantic3d:
      return `pc.html?uuid=${item._id}&stream=${encodeURIComponent(stream)}`
    default:
      // 2d 视觉
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
            // anno_href: `anno?seq=${item.label_spec.data.seq}&mission=${item.label_spec.mission.key}&data_format=${item.label_spec.data.format}&taxonomy=${item.label_spec.taxonomy.key}&domain=${item.label_spec.domain.key}`
            anno_hrefs: item.label_spec.data.streams.map((stream: string) => {
              return {
                stream,
                uri: missionAnnoUri(stream, item),
                uuid: item._id,
                current_mission: item.label_spec.mission.key,
                seq: item.label_spec.data.seq
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
// 表格相关
const columns = ref([
  { type: 'index', label: '序号', width: 55, align: 'center' },
  { prop: 'main_user_id', label: '团队ID' },
  { prop: 'name', label: '任务名称' },
  // { prop: 'data_seq', label: '任务数据' },
  // { prop: 'domain', label: '领域' },
  { prop: 'mission', label: '分类' },
  { prop: 'taxonomy', label: '标注规范' },
  // { prop: 'data_format', label: '数据格式' },
  { prop: 'status', label: '状态' },
  { prop: 'anno', label: '标注' },
  { prop: 'tongji', label: '统计' }
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
 * 打开统计弹框drawer
 */
const openStatisticDrawer = (options: any) => {
  annotDrawerRef.value?.toggleOpen(options)
}

const newStatus = reactive({
  status: '待审核',
  desc: ''
})
const updateStatus = (row) => {
  annoJobPerformApi
    .update_status({
      _id: row.uuid,
      status: '待审核'
    })
    .then(() => {
      ElMessage.success('提交成功')
    })
}

onMounted(() => {
  loadData()
})
</script>
