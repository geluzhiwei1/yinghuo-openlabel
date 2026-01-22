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
      <el-form ref="formRef" :model="rowData" :rules="rules" label-width="100px" status-icon>
        <el-form-item label="是否废弃" prop="isFq">
          <el-switch v-model="rowData.isFq" active-value="true" inactive-value="false"></el-switch>
        </el-form-item>
        <el-form-item label="是否存档" prop="isCd">
          <el-switch v-model="rowData.isCd" active-value="true" inactive-value="false"></el-switch>
        </el-form-item>
        <el-form-item label="数据包编码" prop="dataCode">
          <el-input v-model="rowData.dataCode" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item label="优先级" prop="yxj">
          <el-select v-model="rowData.yxj" placeholder="请选择" clearable>
            <el-option :label="'高'" :value="1"></el-option>
            <el-option :label="'低'" :value="2"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="所属批次" prop="sspc">
          <el-input v-model="rowData.sspc" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item label="数据包信息" prop="dataInfo">
          <el-input type="textarea" :rows="2" v-model="rowData.dataInfo" placeholder="请输入"></el-input>
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

<script setup lang="ts" name="data-package-manager">
/*
Copyright (C) 2025 格律至微

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
import { adminFlowApi } from '@/api'

interface User {
  _id: string
  isFq: string
  isCd: string
  dataCode: string
  yxj: number
  sspc: string
  dataInfo: string
  createTime: string
}

interface FormOption {
  type: string
  label: string
  prop: string
  placeholder?: string
  opts?: { label: string; value: any }[]
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
const searchOpt = ref<FormOption[]>([
  { type: 'daterange', label: '创建时间：', prop: 'create_time' },
  { type: 'input', label: '是否废弃：', prop: 'isFq', placeholder: '请输入' },
  { type: 'input', label: '是否存档：', prop: 'isCd', placeholder: '请输入' },
  { type: 'input', label: '数据包编码：', prop: 'dataCode', placeholder: '请输入' },
  {
    type: 'select',
    label: '优先级：',
    prop: 'yxj',
    placeholder: '请输入',
    opts: [
      { label: '高', value: 1 },
      { label: '低', value: 2 }
    ]
  },
  { type: 'input', label: '所属批次：', prop: 'sspc', placeholder: '请输入' }
])
const handleSearch = () => {
  pager.page = 1
  getData()
}

// 表格相关
const columns = ref([
  { type: 'index', label: '编号', width: 55, align: 'center' },
  { prop: 'createTime', label: '创建时间' },
  { prop: 'isFq', label: '是否废弃' },
  { prop: 'isCd', label: '是否存档' },
  { prop: 'dataCode', label: '数据包编码' },
  { prop: 'yxj', label: '优先级' },
  { prop: 'sspc', label: '所属批次' },
  { prop: 'dataInfo', label: '数据包信息', width: 150, showOverflowTooltip: true },
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
          createTime: '2024-10-23',
          isFq: 'true',
          isCd: 'false',
          dataCode: 'seqxx',
          yxj: '高',
          sspc: 'test2',
          dataInfo: '{"dccca:dawda"}'
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
  isFq: [{ required: true, trigger: 'change', message: '请选择' }],
  isCd: [{ required: true, trigger: 'change', message: '请选择' }],
  dataCode: [{ required: true, trigger: 'blur', message: '请输入数据包编码' }],
  yxj: [{ required: true, trigger: 'blur', message: '请选择优先级' }],
  sspc: [{ required: true, trigger: 'blur', message: '请输入所属批次' }]
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
