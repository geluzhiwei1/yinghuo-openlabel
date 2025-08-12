<template>
  <el-text type="success"
    >模型在官网服务器运行，使用时，需要把当前图像传输到服务器进行处理。</el-text
  >
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
import { ElTag, ElTableV2, ElLink } from 'element-plus'
import { dnnModelApi } from '@/api'
import { ElCheckbox } from 'element-plus'
import { dnnModelSelectorState } from './index'

import type { FunctionalComponent } from 'vue'
import type { CheckboxValueType, Column } from 'element-plus'
import { uiState } from '@/states/UiState'

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
        dnnModelSelectorState.selectedApi.apiCategory = 'private'
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
    key: 'serv_uri',
    title: '服务地址',
    dataKey: 'nodes[0].serv_uri',
    width: 150
  },
  {
    key: 'model_info_name',
    title: '模型名称',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <>{model_info.name}</>
  },
  {
    key: 'dataset',
    title: '模型数据集',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <>{model_info.dataset}</>
  },
  {
    key: 'model_info_classes',
    title: '模型输出类别',
    dataKey: 'serv_info.model_info',
    width: 150,
    cellRenderer: ({ cellData: model_info }) => <>{model_info.classes}</>
  },
  {
    key: 'api_tags',
    title: 'tags',
    dataKey: 'serv_info.api_tags',
    width: 150,
    cellRenderer: ({ cellData: api_tags }) => <>{api_tags}</>
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

const loadData = () => {
  dnnModelApi.getList().then((res) => {
    columnData.value = res.data
  })
}

onMounted(() => {
  loadData()
})
</script>
