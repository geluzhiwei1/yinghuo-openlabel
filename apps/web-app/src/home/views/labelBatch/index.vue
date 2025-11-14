<template>
  <div>
    <TableSearch :query="query" :options="searchOpt" :search="handleSearch" />
    <div class="container">
      <TableCustom :columns="columns" :tableData="tableData" :loading="tableLoading" :total="pager.total"
        :page="pager.page" :viewFunc="handleView" :delFunc="handleDelete" :page-change="changePage"
        :editFunc="handleEdit" :refresh="getData">
        <template #toolbarBtn>
          <el-button type="primary" :icon="CirclePlusFilled" @click="
            visible = true;
          rowData = {}
            ">新增</el-button>
        </template>
        <template #enabled="{ rows }">
          <el-switch v-model="rows.enabled"></el-switch>
        </template>
      </TableCustom>
    </div>
    <el-dialog :title="isEdit ? '编辑' : '新增'" v-model="visible" width="700px" destroy-on-close
      :close-on-click-modal="false" @close="closeDialog">
      <el-form ref="formRef" :model="rowData" :rules="rules" label-width="120px" status-icon>
        <el-form-item label="唯一编码" prop="onlyCode">
          <el-input v-model="rowData.onlyCode" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item label="规划开始时间" prop="ghStartTime">
          <el-date-picker v-model="rowData.ghStartTime" type="datetime" placeholder="选择规划开始时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="规划结束时间" prop="ghEndTime">
          <el-date-picker v-model="rowData.ghEndTime" type="datetime" placeholder="选择规划结束时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="实际开始时间" prop="sjStartTime">
          <el-date-picker v-model="rowData.sjStartTime" type="datetime" placeholder="选择实际开始时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="实际结束时间" prop="sjEndTime">
          <el-date-picker v-model="rowData.sjEndTime" type="datetime" placeholder="选择实际结束时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="批次说明" prop="pcsm">
          <el-input v-model="rowData.pcsm" type="textarea" :row="2" placeholder="请输入批次说明"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitForm(formRef)"> 保存 </el-button>
        <el-button @click="resetForm(formRef)">重置</el-button>
      </template>
    </el-dialog>
    <el-dialog title="查看详情" v-model="visible1" width="700px" destroy-on-close>
      <TableDetail :data="viewData"></TableDetail>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="label-batch">
/*
Copyright (C) 2025 undefined

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { teamApi } from '@/api'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import { formatUtc } from '@/libs/datetime'
import type { ComponentSize, FormInstance, FormRules } from 'element-plus'

interface User {
  _id: string
  onlyCode: string
  ghStartTime: string
  ghEndTime: string
  sjStartTime: string
  sjEndTime: string
  pcsm: string
  createPerson: string
  createTime: string
  updatePerson: string
  updateTime: string
}

interface FormOptionList {
  type: string
  label: string
  prop: string
  placeholder?: string
}

interface DetailItem {
  prop: string
  label: string
}

const formRef = ref<FormInstance>()
const tableLoading = ref(false)

// 查询相关
const query = reactive({
  email: undefined,
  is_registered: undefined,
  is_signed: undefined
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '唯一编码：', prop: 'onlyCode', placeholder: '请输入唯一编码' },
  { type: 'daterange', label: '规划开始时间：', prop: 'ghStartTime' }
])
const handleSearch = () => {
  pager.page = 1
  getData()
}

// 表格相关
const columns = ref([
  { type: 'index', label: '编号', width: 55, align: 'center' },
  { prop: 'createPerson', label: '创建者', showOverflowTooltip: true },
  { prop: 'createTime', label: '创建时间', showOverflowTooltip: true },
  { prop: 'updatePerson', label: '更新者', showOverflowTooltip: true },
  { prop: 'updateTime', label: '更新时间', showOverflowTooltip: true },
  { prop: 'onlyCode', label: '唯一编码', showOverflowTooltip: true },
  { prop: 'ghStartTime', label: '规划开始时间', showOverflowTooltip: true },
  { prop: 'ghEndTime', label: '规划结束时间', showOverflowTooltip: true },
  { prop: 'sjStartTime', label: '实际开始时间', showOverflowTooltip: true },
  { prop: 'sjEndTime', label: '实际结束时间', showOverflowTooltip: true },
  { prop: 'pcsm', label: '批次说明', showOverflowTooltip: true },
  { prop: 'operator', label: '操作', width: 250 }
])
const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const tableData = ref<User[]>([])
/**
 * 获取数据
 */
const buildQuery = () => {
  return {
    pager: {
      page: pager.page,
      page_size: pager.page_size
    },
    query
  }
}
const getData = async () => {
  tableLoading.value = true
  // adminFlowApi
  //   .queryAll()
  Promise.resolve({ data: [], page: 1, page_size: 10 })
    .then((res: any) => {
      tableData.value = res.data.map((item: any) => {
        return {
          ...item,
          createPerson: 'xiaoli',
          createTime: '2024-10-23',
          updatePerson: '小王',
          updateTime: '2024-12-23',
          onlyCode: 'dddx',
          ghStartTime: '2024-10-23',
          ghEndTime: '2024-10-23',
          sjStartTime: '2024-10-23',
          sjEndTime: '2024-10-23',
          pcsm: '<p>www.baidu.com</p>'
        }
      })
      pager.total = tableData.value.length
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

// 新增/编辑弹窗相关
const rules = reactive<FormRules>({
  onlyCode: [{ required: true, trigger: 'blur', message: '请输入唯一编码' }],
  ghStartTime: [{ required: true, trigger: 'change', message: '请选择规划开始时间' }],
  ghEndTime: [{ required: true, trigger: 'change', message: '请选择规划结束时间' }]
})
const updateData = (form: any) => {
  if (isEdit.value) {
    teamApi.update(form).then((res: any) => {
      ElMessage({ message: '更新成功', type: 'success' })
      closeDialog()
      getData()
    })
  } else {
    teamApi.create(form).then((res: any) => {
      ElMessage({ message: '创建成功', type: 'success' })
      closeDialog()
      getData()
    })
  }
}
const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate((valid, fields) => {
    if (valid) {
      updateData(rowData.value)
    }
  })
}

const resetForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
}
const visible = ref(false)
const isEdit = ref(false)
const rowData = ref<Partial<User>>({})
const handleEdit = (row: User) => {
  rowData.value = { ...row }
  isEdit.value = true
  visible.value = true
}

const closeDialog = () => {
  resetForm(formRef.value)
  visible.value = false
  isEdit.value = false
}

// 查看详情弹窗相关
const visible1 = ref(false)
const viewData = ref<{ row: Partial<User>; list: DetailItem[]; title: string }>({
  row: {},
  list: [],
  title: ''
})
const handleView = (row: User) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    {
      prop: 'createTime',
      label: '创建时间'
    },
    {
      prop: 'isFq',
      label: '是否废弃'
    },
    {
      prop: 'isCd',
      label: '是否存档'
    },
    {
      prop: 'dataCode',
      label: '数据包编码'
    },
    {
      prop: 'yxj',
      label: '优先级'
    },
    {
      prop: 'sspc',
      label: '所属批次'
    },
    {
      prop: 'dataInfo',
      label: '数据包信息'
    }
  ]
  visible1.value = true
}

// 删除相关
const deleteRow = (data: any) => {
  teamApi.delete(data).then((res: any) => {
    ElMessage.success('删除成功')
    getData()
  })
}
const handleDelete = (row: User) => {
  deleteRow({ _id: row._id })
}

onMounted(() => {
  getData()
})
</script>

<style>
.el-form--inline .el-form-item {
  width: 300px;
}
</style>
