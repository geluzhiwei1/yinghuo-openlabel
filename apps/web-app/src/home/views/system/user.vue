<template>
  <div>
    <TableSearch :query="query" :options="searchOpt" :search="handleSearch" />
    <div class="container">
      <TableCustom
        :columns="columns"
        :tableData="tableData"
        :total="page.total"
        :viewFunc="handleView"
        :delFunc="handleDelete"
        :page-change="changePage"
        :editFunc="handleEdit"
      >
        <template #toolbarBtn>
          <el-button type="primary" :icon="CirclePlusFilled" @click="visible = true"
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
      <TableEdit :form-data="rowData" :options="options" :edit="isEdit" :update="updateData" />
    </el-dialog>
    <el-dialog title="查看详情" v-model="visible1" width="700px" destroy-on-close>
      <TableDetail :data="viewData"></TableDetail>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="system-user">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { User } from '@/types/user'
import { fetchUserData } from '@/api'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import { FormOption, FormOptionList } from '@/types/form-option'
import { validateEmail } from '@/libs/validtor'

// 查询相关
const query = reactive({
  name: ''
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '用户名：', prop: 'name' },
  { type: 'input', label: '手机号：', prop: 'name' },
  {
    type: 'select',
    label: '状态：',
    prop: 'status',
    opts: [
      { label: '正常', value: '1' },
      { label: '停用', value: '0' }
    ]
  }
])
const handleSearch = () => {
  changePage(1)
}

// 表格相关
const columns = ref([
  { type: 'index', label: '序号', width: 55, align: 'center' },
  { prop: 'name', label: '姓名' },
  { prop: 'name', label: '昵称' },
  { prop: 'phone', label: '手机号' },
  { prop: 'phone', label: '邮箱' },
  { prop: 'role', label: '角色' },
  { prop: 'role', label: '部门' },
  { prop: 'role', label: '最近登录时间' },
  { prop: 'operator', label: '操作', width: 250 }
])
const page = reactive({
  index: 1,
  size: 10,
  total: 0
})
const tableData = ref<User[]>([])
/**
 * 获取数据
 */
const getData = async () => {
  const res = await fetchUserData()
  tableData.value = res.data.list
  page.total = res.data.pageTotal
}
getData()

const changePage = (val: number) => {
  page.page = val
  getData()
}

function isValidPhoneNumber(phoneNumber) {
  const regex = /^(13[0-9]|14[5|7|9]|15[0-3|5-9]|16[2|5|6|7]|17[0-8]|18[0-9]|19[8|9])\d{8}$/
  return regex.test(phoneNumber)
}

/**
 * 验证手机号
 */
const checkPhone = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请输入手机号'))
  } else if (!isValidPhoneNumber(value)) {
    callback(new Error('请输入正确的手机号'))
  } else {
    callback()
  }
}

/**
 * 验证邮箱
 */
const checkEmail = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请输入邮箱'))
  } else if (!validateEmail(value)) {
    callback(new Error('请输入正确的邮箱'))
  } else {
    callback()
  }
}

// 角色静态数据
const roleTreeData = [
  {
    value: '1',
    label: '管理员',
    children: [
      {
        value: '1-1',
        label: '管理员1',
        children: [
          {
            value: '1-1-1',
            label: '管理员11'
          }
        ]
      }
    ]
  },
  {
    value: '2',
    label: '负责人',
    children: [
      {
        value: '2-1',
        label: '负责人1',
        children: [
          {
            value: '2-1-1',
            label: '负责人11'
          }
        ]
      },
      {
        value: '2-2',
        label: '负责人2',
        children: [
          {
            value: '2-2-1',
            label: '负责人22'
          }
        ]
      }
    ]
  }
]

// 部门静态数据
const departTreeData = [
  {
    value: '1',
    label: '财务部',
    children: [
      {
        value: '1-1',
        label: '财务部分部',
        children: [
          {
            value: '1-1-1',
            label: '财务部分部1'
          }
        ]
      }
    ]
  },
  {
    value: '2',
    label: '总经办',
    children: []
  }
]
// 新增/编辑弹窗相关
const options = ref<FormOption>({
  labelWidth: '100px',
  span: 12,
  list: [
    { type: 'input', label: '用户名称', prop: 'name', required: true },
    { type: 'input', label: '用户昵称', prop: 'nickName', required: false },
    {
      type: 'input',
      label: '手机号',
      prop: 'phone',
      required: true,
      rules: { validator: checkPhone, trigger: 'blur' }
    },
    { type: 'input', label: '密码', prop: 'password', required: true },
    {
      type: 'input',
      label: '邮箱',
      prop: 'email',
      required: false,
      rules: { validator: checkEmail, trigger: 'blur' }
    },
    { type: 'input', label: '状态', prop: 'status', required: true },
    { type: 'treeSelect', label: '角色', prop: 'role', required: true, opts: roleTreeData },
    { type: 'treeSelect', label: '部门', prop: 'role', required: true, opts: departTreeData }
  ]
})
const visible = ref(false)
const isEdit = ref(false)
const rowData = ref({})
const handleEdit = (row: User) => {
  rowData.value = { ...row }
  isEdit.value = true
  visible.value = true
}
const updateData = () => {
  closeDialog()
  getData()
}

const closeDialog = () => {
  visible.value = false
  isEdit.value = false
}

// 查看详情弹窗相关
const visible1 = ref(false)
const viewData = ref({
  row: {},
  list: []
})
const handleView = (row: User) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    {
      prop: 'id',
      label: '用户ID'
    },
    {
      prop: 'name',
      label: '用户名'
    },
    {
      prop: 'password',
      label: '密码'
    },
    {
      prop: 'email',
      label: '邮箱'
    },
    {
      prop: 'phone',
      label: '电话'
    },
    {
      prop: 'role',
      label: '角色'
    },
    {
      prop: 'date',
      label: '注册日期'
    }
  ]
  visible1.value = true
}

// 删除相关
const handleDelete = (row: User) => {
  ElMessage.success('删除成功')
}
</script>

<style>
.el-form--inline .el-form-item {
  width: 220px;
}
</style>
