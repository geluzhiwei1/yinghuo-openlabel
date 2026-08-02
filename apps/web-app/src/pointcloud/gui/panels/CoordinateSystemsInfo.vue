<template>
  <div class="flex" style="align-items: center; justify-content: center">
    <el-table-v2 :columns="tableColumns" :data="tableDataRef" :width="700" :height="400" :row-height="40" ref="tableRef"
      fixed />
  </div>
</template>

<script lang="tsx" setup>
import { ref } from 'vue'
import _ from 'lodash'
import { commonChannel } from '@/pointcloud/event/channel'
import { jobConfig } from '@/states/job-config'

const tableDataRef = ref([])
const tableColumns: Column<any>[] = [
  {
    title: 'ID',
    key: 'id',
    dataKey: 'id',
    width: 150
  },
  {
    title: '分类',
    key: 'type',
    dataKey: 'type',
    width: 100
  },
  {
    title: '父',
    key: 'parent',
    dataKey: 'parent',
    width: 100
  },
  {
    title: '',
    key: 'pose_wrt_parent',
    dataKey: 'pose_wrt_parent',
    width: 250
  },
  {
    key: 'operations',
    cellRenderer: ({ rowData }) => (
      <div>
        <el-button size="small" value={rowData.id} onClick={handleChange}>选择</el-button>
      </div>
    ),
    width: 100,
    align: 'center'
  }
]

const handleChange = (e) => {
  jobConfig.coordinate_system = e.currentTarget.value
}

const loadData = () => {
  let coos: any[] = []
  _.forIn(currentMeta.value.openlabel.coordinate_systems, (obj, key) => {
    coos.push({
      id: key,
      type: obj.type,
      parent: obj.parent,
      pose_wrt_parent: obj.pose_wrt_parent?.matrix4x4,
    })
  })
  tableDataRef.value = coos
}

commonChannel.sub(commonChannel.Events.DataLoaded, () => {
  loadData()
})

</script>
