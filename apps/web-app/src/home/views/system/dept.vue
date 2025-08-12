<template>
  <div>
    <el-button type="primary" icon="circle-plus-filled" @click="showEditor('addTop', {})">
      添加一级部门
    </el-button>
  </div>
  <div>
    <el-tree
      v-loading="loading"
      style="max-width: 600px"
      :data="dataSource"
      :show-checkbox="false"
      node-key="id"
      default-expand-all
      :expand-on-click-node="false"
    >
      <template #default="{ node, data }">
        <span class="custom-tree-node">
          <span>{{ node.label }}</span>
          <span>
            <!-- <a @click="showEditor('addSub', data)"> 添加 </a> -->
            <el-button size="small" @click="showEditor('addSub', data)">添加子部门</el-button>
            <!-- <a style="margin-left: 8px" @click="showEditor('edit', data)"> 编辑 </a> -->
            <el-button size="small" style="margin-left: 8px" @click="showEditor('edit', data)"
              >编辑</el-button
            >
            <!-- <a v-if="data.children.length === 0" style="margin-left: 8px" @click="remove(node, data)"> 删除 </a> -->
            <el-button
              type="danger"
              size="small"
              :disabled="data.children && data.children.length > 0"
              style="margin-left: 8px"
              @click="remove(node, data)"
              >删除</el-button
            >
          </span>
        </span>
      </template>
    </el-tree>
  </div>
  <el-drawer v-model="editorConf.visible" :size="'50%'">
    <template #header>
      <h4>{{ editorConf.title }}</h4>
    </template>
    <template #default>
      <VueForm
        size="small"
        id="propertyForm"
        ref="propertyForm"
        label-width="auto"
        v-model="editorConf.formData"
        :schema="uiSchema"
        :formProps="{ labelPosition: 'right', layoutColumn: 1 }"
        :formFooter="{ show: false }"
      />
    </template>
    <template #footer>
      <div style="text-align: center">
        <el-button @click="cancelClick">取消</el-button>
        <el-button type="primary" @click="confirmClick">确定</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts" name="system-group">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { type User } from '@/types/user'
import { userDeptsApi } from '@/api'
import TableCustom from '@/components/table-custom.vue'
import TableDetail from '@/components/table-detail.vue'
import TableSearch from '@/components/table-search.vue'
import { type FormOption, type FormOptionList } from '@/types/form-option'
import VueForm from '@lljj/vue3-form-element'
import type Node from 'element-plus/es/components/tree/src/model/node'

interface Tree {
  id: string
  label: string
  children?: Tree[]
}

const loading = ref(false)

// editor
const editorConf = reactive({
  mode: 'addTop',
  visible: false,
  title: '部门信息',
  formData: {},
  curData: {}
})

const uiSchema = {
  type: 'object',
  required: [],
  'ui:order': ['*'],
  properties: {
    parent_id: {
      type: 'string',
      title: '上级部门ID',
      'ui:options': {
        readonly: true
      }
    },
    label: {
      type: 'string',
      title: '部门名称',
      default: '新部门'
    },
    order: {
      type: 'number',
      title: '排序',
      default: 0
    },
    desc: {
      title: '备注',
      type: 'string',
      default: '',
      'ui:options': {
        type: 'textarea',
        rows: 6,
        autosize: {
          minRows: 5,
          maxRows: 10
        }
      }
    }
  }
}

const showEditor = (mode: string, data: Tree) => {
  // const newChild = { id: id++, label: 'testtest', children: [] }
  // if (!data.children) {
  //     data.children = []
  // }
  // data.children.push(newChild)
  // dataSource.value = [...dataSource.value]
  switch (mode) {
    case 'addTop':
      editorConf.title = '添加一级部门'
      editorConf.formData = {}
      break
    case 'addSub':
      editorConf.title = '添加子部门'
      editorConf.formData = {
        parent_id: data.id
      }
      break
    case 'edit':
      editorConf.title = '编辑部门信息'
      editorConf.formData = data
      break
    default:
      break
  }
  editorConf.curData = data
  editorConf.mode = mode
  editorConf.visible = true
}

const remove = (node: Node, data: Tree) => {
  loading.value = true
  userDeptsApi
    .delete({
      id: data.id
    })
    .then((res) => {
      ElMessage.success('删除成功')
    })
    .finally(() => {
      loading.value = false
      getData()
    })
}

function cancelClick() {
  editorConf.visible = false
}
function confirmClick() {
  // save data
  editorConf.visible = false
  console.log(editorConf.formData)
  switch (editorConf.mode) {
    case 'addSub':
    case 'addTop':
      loading.value = true
      userDeptsApi
        .create(editorConf.formData)
        .then((res) => {
          ElMessage.success('添加成功')
        })
        .finally(() => {
          loading.value = false
          getData()
        })
      break
    case 'edit':
      loading.value = true
      userDeptsApi
        .update(editorConf.formData)
        .then((res) => {
          ElMessage.success('更新成功')
        })
        .finally(() => {
          loading.value = false
          getData()
        })
      break
    default:
      break
  }
}

const dataSource = ref<Tree[]>([
  {
    id: 1,
    label: 'Level one 1',
    children: [
      {
        id: 4,
        label: 'Level two 1-1',
        children: [
          {
            id: 9,
            label: 'Level three 1-1-1'
          },
          {
            id: 10,
            label: 'Level three 1-1-2'
          }
        ]
      }
    ]
  },
  {
    id: 2,
    label: 'Level one 2',
    children: [
      {
        id: 5,
        label: 'Level two 2-1'
      },
      {
        id: 6,
        label: 'Level two 2-2'
      }
    ]
  },
  {
    id: 3,
    label: 'Level one 3',
    children: [
      {
        id: 7,
        label: 'Level two 3-1'
      },
      {
        id: 8,
        label: 'Level two 3-2'
      }
    ]
  }
])

const getData = async () => {
  loading.value = true
  userDeptsApi
    .queryTree()
    .then((res) => {
      dataSource.value = res.data
    })
    .finally(() => {
      loading.value = false
    })
}

onMounted(() => {
  getData()
})
</script>

<style scoped>
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}
</style>
