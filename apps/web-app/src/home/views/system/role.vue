<template>
  <div>
    <TableSearch :query="query" :options="searchOpt" :search="handleSearch" />
    <div class="container">
      <TableCustom
        :columns="columns"
        :tableData="tableData"
        :total="pager.total"
        :page="pager.page"
        :viewFunc="handleView"
        :delFunc="handleDelete"
        :page-change="changePage"
        :editFunc="handleEdit"
        :refresh="getData"
      >
        <template #toolbarBtn>
          <el-button type="primary" :icon="CirclePlusFilled" @click="visible = true"
            >新增</el-button
          >
        </template>
        <template #status="{ rows }">
          <el-tag type="success" v-if="rows.status">启用</el-tag>
          <el-tag type="danger" v-else>禁用</el-tag>
        </template>
        <template #permissions="{ rows }">
          <el-button type="primary" size="small" plain @click="handlePermission(rows)" disabled
            >管理</el-button
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
      <TableDetail :data="viewData">
        <template #status="{ rows }">
          <el-tag type="success" v-if="rows.status">启用</el-tag>
          <el-tag type="danger" v-else>禁用</el-tag>
        </template>
      </TableDetail>
    </el-dialog>
    <el-drawer title="权限管理" v-model="visible2" size="70%" destroy-on-close>
      <RolePermission :permiss-options="permissOptions" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="system-role">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { type Role } from '@/types/role'
// import { fetchRoleData } from '@/api';
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import TableEdit from '@/components/table-edit.vue'
import RolePermission from './role-permission.vue'
import { CirclePlusFilled, Message } from '@element-plus/icons-vue'
import { type FormOption, type FormOptionList } from '@/types/form-option'
import { roleApi } from '@/api'
import { isEmpty } from 'radash'
import { formatUtc } from '@/libs/datetime'
import { userAuth } from '@/states/UserState'

const tableLoading = ref(false)

// 查询相关
const query = reactive({
  label: undefined,
  is_system: undefined
})
const searchOpt = ref<FormOptionList[]>([
  { type: 'input', label: '名称：', prop: 'label' }
  //   { type: 'switch', label: '默认角色', prop: 'is_system' }
])
const handleSearch = () => {
  pager.page = 1
  getData()
}

// 表格相关
const columns = ref([
  { type: 'index', label: '序号', width: 55, align: 'center' },
  { prop: '_id', label: '角色ID' },
  { prop: 'label', label: '角色名称' },
  { prop: 'is_system', label: '默认角色' },
  { prop: 'updated_time', label: '更新时间' },
  // { prop: 'status', label: '启用/禁用' },
  { prop: 'permissions', label: '功能' },
  { prop: 'operator', label: '操作', width: 250 }
])
const pager = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const buildQuery = () => {
  return {
    pager: {
      page: pager.page,
      page_size: pager.page_size
    },
    query: {
      label: isEmpty(query.label) ? undefined : query.label,
      is_system: query.is_system
    }
  }
}
const tableData = ref<Role[]>([])
const getData = async () => {
  tableLoading.value = true
  roleApi
    .search(buildQuery())
    .then((res) => {
      tableData.value = res.data.map((item) => {
        return {
          ...item,
          updated_time: formatUtc(item.updated_time),
          disableDeleteBtn: item.is_system ? true : false
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

// 新增/编辑弹窗相关
const options = ref<FormOption>({
  labelWidth: '100px',
  span: 24,
  list: [
    { type: 'input', label: '角色名称', prop: 'label', required: true },
    { type: 'input', label: '备注', prop: 'desc', required: false }
  ]
})
const visible = ref(false)
const isEdit = ref(false)
const rowData = ref({})
const handleEdit = (row: Role) => {
  rowData.value = { ...row }
  isEdit.value = true
  visible.value = true
}
const updateData = (form) => {
  if (isEdit.value) {
    roleApi.update(form).then((res) => {
      ElMessage({ message: '更新成功', type: 'success' })
      closeDialog()
      getData()
    })
  } else {
    roleApi.create(form).then((res) => {
      ElMessage({ message: '创建成功', type: 'success' })
      closeDialog()
      getData()
    })
  }
}
const closeDialog = () => {
  visible.value = false
  isEdit.value = false
  rowData.value = {}
}

// 查看详情弹窗相关
const visible1 = ref(false)
const viewData = ref({
  row: {},
  list: [],
  column: 1
})
const handleView = (row: Role) => {
  viewData.value.row = { ...row }
  viewData.value.list = [
    {
      prop: '_id',
      label: '角色ID'
    },
    {
      prop: 'label',
      label: '角色名称'
    },
    {
      prop: 'is_system',
      label: '默认角色'
    },
    {
      prop: 'desc',
      label: '备注'
    }
  ]
  visible1.value = true
}

// 删除相关
const deleteRow = (data) => {
  roleApi.delete(data).then((res) => {
    ElMessage.success('删除成功')
    getData()
  })
}
const handleDelete = (row: Role) => {
  deleteRow({ _id: row._id })
}

// 权限管理弹窗相关
const visible2 = ref(false)
const permissOptions = ref({})
const handlePermission = (row: Role) => {
  // console.log(row.authority.owners);
  // console.log(permiss.key);
  visible2.value = true
  // permissOptions.value = {
  //     id: row._id,
  //     permiss: row.authority.owners
  // };
  // permissOptions.value = {
  //     id: row._id,
  //     permiss: permiss.key
  // };
}

onMounted(() => {
  getData()
})
</script>

<style scoped></style>
