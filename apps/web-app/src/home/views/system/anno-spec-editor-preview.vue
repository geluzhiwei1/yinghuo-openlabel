<template>
  <el-row style="text-align: center">
    <el-col :span="18">
      <el-button-group size="small">
        <el-dropdown @command="handleCommand">
          <el-button>
            根据模板创建<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="spec-default">从默认模板新建</el-dropdown-item>
              <el-dropdown-item command="spec-simple">从最简模板新建</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <AnnoSpecSelector
          v-model:model-value="copyFromSpec"
          :options="{ btnLabel: '从现有规范复制', inputVisible: false }"
        />
      </el-button-group>
      <el-button-group size="small">
        <el-button @click="handleCommand('saveSpec')" type="primary">保存</el-button>
        <el-button @click="handleCommand('reset')">重置</el-button>
      </el-button-group>
    </el-col>
    <el-col :span="6">可视化预览</el-col>
  </el-row>
  <el-row>
    <el-col :span="18">
      <el-form-item>
        <label for=""
          >规范内容<el-text type="danger" v-show="errorMsg">异常：{{ errorMsg }}</el-text></label
        >
        <JsonEditorVue
          style="height: 600px; width: 100%"
          ref="jsonEditor"
          :currentMode="'code'"
          :modeList="['code', 'tree', 'text']"
          :expandedOnStart="false"
          :options="jsonEditorOptions"
          @blur="onJsonEditorBlur"
          @validationError="onSpecJsonValidationError"
          @selectionChange="onSelectionChange"
        />
      </el-form-item>
    </el-col>
    <el-col :span="6">
      <el-form-item>
        <label for="">请选择:</label>
        <el-tree-select
          :data="dataTree"
          v-model="selectedClass"
          default-expand-all
          check-strictly
          @node-click="nodeClick"
        ></el-tree-select>
      </el-form-item>
      <VueForm style="margin-left: 20px" :schema="schema" :formFooter="{ show: false }"></VueForm>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { JsonEditorVue } from '@/components/JsonEditor'
import { type ValidationError } from 'jsoneditor'
import VueForm from '@lljj/vue3-form-element'
import { annoSpecApi, openlabelApi } from '@/api'
import { annoSpecTemplates } from './anno-spec-template'
import AnnoSpecSelector from '@/components/AnnoSpecSelector.vue'

const jsonEditor = ref()

const { rowData } = defineProps({
  rowData: {
    type: Object,
    required: true
  }
})

const rowDataRef = ref({ ...rowData })
// const emits = defineEmits(['submit'])
const copyFromSpec = ref({})
watch(copyFromSpec, (newVal, oldVal) => {
  const { key, type, name, domain } = newVal
  let jsonObj = undefined
  if (type === 'system') {
    openlabelApi
      .query({
        taxonomy: key,
        domain: domain
      })
      .then((res) => {
        if (res && res.data) {
          jsonObj = res.data[0]
          specJson.value = jsonObj
          updateTreeData(specJson.value)
          ElMessage.success('操作成功')
        }
      })
  } else if (type === 'user') {
    annoSpecApi.query({ _id: key }).then((res) => {
      if (res && res.data && res.data.length == 1) {
        jsonObj = res.data[0]
        specJson.value = JSON.parse(jsonObj.spec)
        updateTreeData(specJson.value)
        ElMessage.success('操作成功')
      }
    })
  } else {
    ElMessage.warning('未找到该规范！')
  }
})

const jsonEditorOptions = {
  search: true
  // onValidate: function (json) {
  //     console.log('validating...')
  //     var errors = [];
  //     return errors;
  //   }
}
const errorMsg = ref(undefined)
const selectedClass = ref('')
const dataTree = ref()
// const formData = ref({})
const schema = ref({
  type: 'object',
  properties: {}
})

// const uiSchema = ref({})

const specJson = ref<any>({}) // 左侧json数据
const originalJson = ref<any>({}) // 未编辑的json

watch(specJson, (newVal) => {
  jsonEditor.value.editor.set(newVal)
})

/**
 * 节点选择
 */
const nodeClick = (data, node, instance, event) => {
  if (!node.isLeaf) {
    ElMessage.warning('请选择叶子节点！')
    // node.setChecked(false)
    return
  }
  nodeChange(data.value)
}
function nodeChange(val: string) {
  const properties = {}
  const res = diGuiMergeProperties(specJson.value.openlabel.classes, val, properties)
  // specJson.value.schema = {}
  // specJson.value.schema.properties = res
  schema.value.properties = res
  // schema.value.title = get(specJson.value, 'openlabel.meta.name', '')
  // schema.value.description = get(specJson.value, 'openlabel.meta.description', '')
}

function diGuiMergeProperties(arr: any, val: string, properties: Object) {
  if (!arr || !arr.length) {
    return properties
  }
  arr.forEach((item) => {
    if (item.children && item.children.length) {
      diGuiMergeProperties(item.children, val, properties)
    }
    if (item.name == val) {
      let resProperties = {}
      const parentNodes = findParentNodesByName(specJson.value.openlabel.classes, item.name)
      parentNodes.forEach((ele) => {
        resProperties = Object.assign(resProperties, ele.properties)
      })
      return Object.assign(properties, resProperties, item.properties)
    }
  })
  return properties
}

const checkClassNameUnique = (children, classNameMap) => {
  if (!Array.isArray(children)) {
    throw new Error('children不是一个数组')
  }
  children.forEach((item) => {
    if (!item.name) {
      throw new Error('item缺少name属性')
    }
    if (classNameMap.has(item.name)) {
      throw new Error('类别【' + item.name + '】已存在，name必须是唯一的')
    }
    classNameMap.set(item.name, item.properties)

    if (item.children && item.children.length > 0) {
      checkClassNameUnique(item.children, classNameMap)
    }
  })
}
const checkClassName = (spec) => {
  if (!spec || !spec.openlabel || !spec.openlabel.classes || spec.openlabel.classes.length === 0) {
    throw new Error('无效的spec对象')
  }
  const classNameMap = new Map()
  checkClassNameUnique(spec.openlabel.classes[0].children, classNameMap)
}

function findParentNodesByName(nodes, name, parents = []) {
  // 遍历数组中的每个节点
  for (const node of nodes) {
    // 如果当前节点的 name 匹配目标 name，则返回父节点列表
    if (node.name === name) {
      return parents
    }

    // 如果当前节点有子节点，递归查找
    if (node.children && node.children.length > 0) {
      const result = findParentNodesByName(node.children, name, [...parents, node])
      if (result) {
        return result
      }
    }
  }

  // 如果没有找到，返回 null
  return null
}

/**
 * 根据左侧json数据递归data
 */
function generateTreeFromArray(nodes) {
  return nodes.map((node) => {
    // 创建新的节点，包含 label 和 value 字段
    const newNode = {
      label: node.name,
      value: node.name, // 使用 ontology_uid 作为 value
      properties: {},
      children: []
    }

    // 如果当前节点有子节点，递归处理子节点
    if (node.children && node.children.length > 0) {
      newNode.children = generateTreeFromArray(node.children)
    }

    // 如果没有子节点，则删除 children 字段
    if (newNode.children.length === 0) {
      delete newNode.children
    }

    return newNode
  })
}

const updateTreeData = (json) => {
  if (!json.openlabel) return
  const originalTreeArray = json.openlabel.classes
  dataTree.value = generateTreeFromArray(originalTreeArray)

  if (selectedClass.value && selectedClass.value !== '') {
    nodeChange(selectedClass.value)
  }
}

const getJsonData = async (_id: string) => {
  // const res = await fetchFormSchemaData();
  annoSpecApi
    .query({ _id })
    .then((res) => {
      if (res.data && res.data.length === 1) {
        if (res.data[0].spec === '') {
          specJson.value = annoSpecTemplates.default
        } else {
          const spec = JSON.parse(res.data[0].spec)
          specJson.value = spec
        }
        originalJson.value = specJson.value
        updateTreeData(specJson.value)
      } else {
        ElMessage.error('查询数据失败，请刷新表格')
      }
    })
    .finally(() => {})
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'spec-default':
      ElMessageBox.confirm('将替换当前编辑中的内容，是否继续?', 'Warning', {
        type: 'warning'
      }).then(() => {
        specJson.value = annoSpecTemplates.default
        updateTreeData(specJson.value)
      })
      break
    case 'spec-simple':
      ElMessageBox.confirm('将替换当前编辑中的内容，是否继续?', 'Warning', {
        type: 'warning'
      }).then(() => {
        specJson.value = annoSpecTemplates.simple
        updateTreeData(specJson.value)
      })
      break
    case 'reset':
      specJson.value = originalJson.value
      updateTreeData(specJson.value)
      break
    case 'saveSpec':
      if (errorMsg.value !== undefined) return
      try {
        checkClassName(specJson.value)
      } catch (e) {
        ElMessage.error(e.message)
        errorMsg.value = e.message
        return
      }
      annoSpecApi
        .update({ _id: rowDataRef.value._id, spec: JSON.stringify(specJson.value) })
        .then((res) => {
          ElMessage.success('保存成功')
        })
      break
    default:
      break
  }
}

const onSpecJsonValidationError = (editor: Editor, errors: ValidationError[]) => {
  if (errors.length === 0) return
  // console.error('onValidationError', errors);
}
const onSelectionChange = (editor, start, end) => {
  // console.log("onSelectionChange", start);
  // console.log("onSelectionChange", end);
  // TODO auto change treeNode
}
const onJsonEditorBlur = async (editor) => {
  errorMsg.value = undefined
  const res = await editor.validate()
  if (res.length === 0) {
    specJson.value = JSON.parse(editor.getText())
    updateTreeData(specJson.value)
  } else {
    errorMsg.value = 'json格式错误'
  }
}

onMounted(() => {
  const { _id } = rowDataRef.value
  getJsonData(_id)
})
</script>

<style scoped>
.oa {
  overflow: auto;
}
.opert-btns {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
