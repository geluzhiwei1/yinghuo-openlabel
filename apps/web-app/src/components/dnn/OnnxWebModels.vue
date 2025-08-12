<template>
  <el-text type="success">模型文件下载到本地，在浏览器运行，需要高配显卡。</el-text><el-button @click="loadData()">刷新</el-button>
  <el-table-v2
    :columns="columns"
    :data="columnData"
    :width="uiState.menuBar.width_px"
    :height="uiState.appDiv.height_px - uiState.menuBar.height_px"
    :key="refreshKey"
  >
  </el-table-v2>
</template>

<script lang="tsx" setup>
import { onMounted, ref } from 'vue'
import { ElTag, ElTableV2, ElLink, ElMessage } from 'element-plus'
import { ElCheckbox } from 'element-plus'
import { dnnModelSelectorState } from './index'

import type { FunctionalComponent } from 'vue'
import type { CheckboxValueType, Column } from 'element-plus'
import { uiState } from '@/states/UiState'
import { webYoloApisConf } from '@/libs/plugin'

const refreshKey = ref(0)

type SelectionCellProps = {
  value: boolean
  intermediate?: boolean
  onChange: (value: CheckboxValueType) => void
}

const SelectionCell: FunctionalComponent<SelectionCellProps> = ({
  value,
  intermediate = false,
  onChange
}) => {
  return <ElCheckbox onChange={onChange} modelValue={value} indeterminate={intermediate} />
}

const columnData = ref([])
const columns: Column<any>[] = [
  {
    key: 'checked',
    title: '选择',
    dataKey: 'checked',
    width: 50,
    cellRenderer: ({ rowData }) => {
      const onChange = (value: CheckboxValueType) => {
        columnData.value.forEach((row) => (row.checked = false)) // 取消所有选中
        rowData.checked = value
        dnnModelSelectorState.selectedApi = rowData
        dnnModelSelectorState.selectedApi.apiCategory = 'onnx-web'
        // refreshKey.value++
      }
      return <SelectionCell value={rowData.checked} onChange={onChange} />
    }
  },
  {
    key: 'api_group',
    title: 'api_group',
    dataKey: 'api_group',
    width: 150,
    align: 'center',
    cellRenderer: ({ cellData: name }) => <ElTag>{name}</ElTag>
  },
  {
    key: 'api_id',
    title: 'api_id',
    dataKey: 'api_id',
    width: 150,
    align: 'center',
    cellRenderer: ({ cellData: name }) => <ElTag>{name}</ElTag>
  },
  {
    key: 'inferencer',
    title: '推理',
    dataKey: 'serv_info',
    width: 150,
    cellRenderer: ({ cellData: serv_info }) => <ElTag>{serv_info.inferencer}</ElTag>
  },
  {
    key: 'model_info_name',
    title: '模型名称',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <ElTag>{model_info.name}</ElTag>
  },
  {
    key: 'dataset',
    title: '模型数据集',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <ElTag>{model_info.dataset}</ElTag>
  },
  {
    key: 'model_info_classes',
    title: '模型输出类别',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <ElTag>{model_info.classes}</ElTag>
  },
  {
    key: 'api_tags',
    title: 'tags',
    dataKey: 'serv_info.api_tags',
    width: 150,
    cellRenderer: ({ cellData: api_tags }) => <ElTag>{api_tags}</ElTag>
  },
  {
    key: 'operations',
    title: 'Operations',
    cellRenderer: ({ rowData }) => (
      <>
        <ElLink href={rowData.serv_info.reference} target="_blank">
          详情
        </ElLink>
      </>
    ),
    width: 150,
    align: 'center'
  }
]

const loadData = async () => {
  await fetch(webYoloApisConf, {
    mode: 'cors',
    method: 'GET'
  })
    .then(async (response) => {
      if (response.ok) {
        const jsonData = await response.json()
        columnData.value = jsonData.data
      } else {
        ElMessage.error('加载模型列表失败')
      }
    })
    .catch((error) => {
      console.log(error)
      ElMessage.error('加载模型列表异常')
    })
}

onMounted(() => {
  loadData()
})
</script>
