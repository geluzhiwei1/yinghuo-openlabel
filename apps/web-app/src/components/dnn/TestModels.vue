<template>
  <el-button type="primary" @click="openFormCreate()">创建</el-button>
  <el-table-v2
    id="tab1"
    :columns="columns"
    :data="columnData"
    :width="uiState.menuBar.width_px"
    :height="uiState.appDiv.height_px - uiState.menuBar.height_px"
  />
  <AnnoJobForm ref="formRef" @success="loadData" />
</template>

<script lang="tsx" setup>
import { onMounted, ref } from 'vue'
import { ElButton, ElTag, TableV2FixedDir, ElTableV2, ElLink } from 'element-plus'
import { annoJobPerformApi } from '@/api'
import type { Column } from 'element-plus'
import { uiState } from '@/states/UiState'
import AnnoJobForm from '@ui-common/components/anno/AnnoJobForm.vue'

const formRef = ref()
const openFormCreate = () => {
  const params = {
    id: 0
  }
  formRef.value.open('create', params)
}

const columns: Column<any>[] = [
  {
    key: 'id',
    title: 'id',
    dataKey: 'id',
    width: 50
  },
  {
    key: 'name',
    title: 'name',
    dataKey: 'name',
    width: 150,
    fixed: TableV2FixedDir.LEFT,
    align: 'center',
    cellRenderer: ({ cellData: name }) => <ElTag>{name}</ElTag>
  },
  {
    key: 'data_seq',
    title: '数据',
    dataKey: 'data_seq',
    width: 150
  },
  {
    key: 'domain',
    title: 'domain',
    dataKey: 'domain',
    width: 150
  },
  {
    key: 'mission',
    title: 'mission',
    dataKey: 'mission',
    width: 150
  },
  {
    key: 'taxonomy',
    title: 'taxonomy',
    dataKey: 'taxonomy',
    width: 150
  },
  {
    key: 'data_format',
    title: 'data_format',
    dataKey: 'data_format',
    width: 150
  },
  {
    key: 'operations',
    title: 'Operations',
    cellRenderer: ({ rowData }) => (
      <>
        <ElButton size="small" type="danger">
          删除
        </ElButton>
        <ElLink href={rowData.anno_href} target="_blank">
          标注
        </ElLink>
      </>
    ),
    width: 250,
    align: 'center'
  }
]

const columnData = ref([])

const loadData = () => {
  annoJobPerformApi.getList().then((data) => {
    columnData.value = data.map((item) => ({
      id: item.id,
      name: item.name,
      desc: item.desc,
      domain: item.label_spec.domain.key,
      mission: item.label_spec.mission.key,
      taxonomy: item.label_spec.taxonomy.key,
      data_format: item.label_spec.data.format,
      data_seq: item.label_spec.data.seq,
      data: item.label_spec.data,
      anno_href: `annotate?seq=${item.label_spec.data.seq}&mission=${item.label_spec.mission.key}&data_format=${item.label_spec.data.format}&taxonomy=${item.label_spec.taxonomy.key}&domain=${item.label_spec.domain.key}`
    }))
  })
}

onMounted(() => {
  loadData()
})
</script>
