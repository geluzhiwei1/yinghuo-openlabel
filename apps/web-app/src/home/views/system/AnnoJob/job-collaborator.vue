<template>
  <div>
    <div class="container">
      <TableCustom
        :columns="columns"
        :tableData="tableData"
        :total="pager.total"
        :page="pager.page"
        :pageSize="pager.page_size"
        :viewFunc="handleView"
        :delFunc="handleDelete"
        :changePage="changePage"
        :changeSize="changeSize"
        :editFunc="handleEdit"
        :loading="tableLoading"
      >
        <template #enabled="{ rows }">
          <!-- <span v-if="rows.enabled">有效</span>
          <span v-else>无效</span> -->
          <el-switch v-model="rows.enabled" @change="handleEnable(rows)" />
        </template>
        <template #editSpec="{ rows }">
          <el-button type="primary" size="small" plain @click="handleSpecEdit(rows)"
            >编辑规范</el-button
          >
        </template>
        <template #toolbarBtn>
          <el-button type="primary" size="small" :icon="CirclePlusFilled" @click="handleNew"
            >新增</el-button
          >
        </template>
      </TableCustom>
    </div>
    <el-dialog
      :title="isEdit ? '编辑' : '新增'"
      v-model="visible"
      width="700px"
      destroy-on-close
      :close-on-click-modal="false"
      @close="closeDialog"
    >
      <TableEdit :form-data="rowData" :options="options" :edit="isEdit" :update="updateData">
        <template #desc>
          <el-input
            v-model="rowData.desc"
            style="width: 100%"
            autosize
            clearable
            type="textarea"
            placeholder="请输入简要说明"
          />
        </template>
      </TableEdit>
    </el-dialog>
    <el-dialog title="查看详情" v-model="visible1" width="700px" destroy-on-close>
      <TableDetail :data="viewData"></TableDetail>
    </el-dialog>
    <el-dialog
      title="编辑标注规范"
      v-model="formEditVisible"
      destroy-on-close
      :close-on-click-modal="false"
      align-center="true"
      style="width: 80%; height: 100%"
      @close="handleCloseEditor"
    >
      <AnnoSpecEditorPreview :rowData="rowData"></AnnoSpecEditorPreview>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="anno-specification">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { type AnnoSpec } from '@/types/annoSpec'
import { annoSpecApi } from '@/api'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import TableEdit from '@/components/table-edit.vue'
// import AnnoSpecEditorPreview from './anno-spec-editor-preview.vue'
import { type FormOption, type FormOptionList } from '@/types/form-option'
import { isEmpty } from 'radash'
import { messages } from '@/states'
import { formatUtc } from '@/libs/datetime'

const tableLoading = ref(false)
// 查询相关
const query = reactive({
  name: undefined,
  version: undefined
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '名称：', prop: 'name' },
  { type: 'input', label: '版本：', prop: 'version' }
])
const handleSearch = () => {
  pager.page = 1
  getData()
}

// 表格相关
const columns = ref([
  { type: 'index', label: '序号', width: 55, align: 'center' },
  { prop: 'name', label: '名称' },
  { prop: 'version', label: '版本' },
  { prop: 'lang', label: '语言' },
  { prop: 'updated_time', label: '更新时间' },
  { prop: 'enabled', label: '是否启用' },
  // { prop: "desc", label: "描述" },
  { prop: 'editSpec', label: '编辑规范' },
  { prop: 'operator', label: '操作', width: 250 }
])
const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const tableData = ref<AnnoSpec[]>([])

const buildQuery = () => {
  return {
    pager: {
      page: pager.page,
      page_size: pager.page_size
    },
    query: {
      name: isEmpty(query.name) ? undefined : query.name,
      version: isEmpty(query.version) ? undefined : query.version
    }
  }
}

/**
 * 获取数据
 */
const getData = async () => {
  tableLoading.value = true
  annoSpecApi
    .search(buildQuery())
    .then((res) => {
      tableData.value = res.data.map((item) => {
        return {
          ...item,
          updated_time: formatUtc(item.updated_time)
          // spec: item.spec && item.spec != '' ? JSON.parse(item.spec) : ""
        }
      })
      pager.total = res.total
      pager.page_size = res.page_size
      pager.page = res.page
    })
    .finally(() => {
      tableLoading.value = false
    })
}

const changePage = (val: number) => {
  pager.page = val
  getData()
}

const changeSize = (val: number) => {
  pager.page_size = val
  getData()
}

// 新增/编辑弹窗相关
const handleNew = () => {
  // 默认值
  rowData.value = {
    version: '1.0.0',
    lang: 'zh-CN',
    enabled: false
  }
  isEdit.value = false
  visible.value = true
}
const options = ref<FormOption>({
  labelWidth: '100px',
  span: 12,
  list: [
    { type: 'input', label: '名称', prop: 'name', required: true },
    { type: 'input', label: '版本', prop: 'version', required: false },
    { type: 'input', label: '语言', prop: 'lang', required: false },
    // { type: 'switch', label: '是否启用', prop: 'enabled', required: false, activeText: '是', inactiveText: '否' },
    { type: 'desc', label: '描述', prop: 'desc', required: false }
  ]
})
const visible = ref(false)
const isEdit = ref(false)
const rowData = ref({})
const handleEdit = (row: AnnoSpec) => {
  rowData.value = { ...row }
  isEdit.value = true
  visible.value = true
}
const updateData = (form) => {
  if (isEdit.value) {
    annoSpecApi.update(form).then((res) => {
      ElMessage({ message: '更新成功', type: 'success' })
      closeDialog()
      getData()
    })
  } else {
    annoSpecApi.create(form).then((res) => {
      ElMessage({ message: '创建成功', type: 'success' })
      closeDialog()
      getData()
    })
  }
}

const handleCloseEditor = () => {
  closeDialog()
  getData()
}

const closeDialog = () => {
  visible.value = false
  isEdit.value = false
  formEditVisible.value = false
}

// 查看详情弹窗相关
const visible1 = ref(false)
const viewData = ref({
  row: {},
  list: []
})
const handleView = (row: AnnoSpec) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    { label: '名称', prop: 'name' },
    { label: '版本', prop: 'version' },
    { label: '语言', prop: 'lang' },
    { label: '是否启用', prop: 'enabled' },
    { label: '描述', prop: 'desc' }
  ]
  visible1.value = true
}

onMounted(() => {
  getData()
})

// 删除相关
const deleteRow = (data) => {
  annoSpecApi
    .delete(data)
    .then((res) => {
      messages.lastSuccess = '删除成功'
      getData()
    })
    .catch((err) => {
      messages.lastException = `删除出现异常${err.message}`
    })
}
const handleDelete = (row: AnnoSpec) => {
  deleteRow({ _id: row._id })
}

/**
 * 表单编辑
 */
const formEditVisible = ref(false)
const handleSpecEdit = (row: AnnoSpec) => {
  formEditVisible.value = false
  rowData.value = { _id: row._id }
  formEditVisible.value = true
}

const handleEnable = (row: AnnoSpec) => {
  if (row.spec && row.spec !== '') {
    annoSpecApi.update({ _id: row._id, enabled: row.enabled }).then((res) => {
      ElMessage.success('更新成功')
    })
  } else {
    row.enabled = false
    handleSpecEdit(row)
  }
}

// /**
//  * 保存后回调
//  */
// const handleSubmit = () => {
//   closeDialog();
//   getData();
// };
</script>

<style>
.el-form--inline .el-form-item {
  width: 220px;
}
</style>
