<template>
  <div class="flex" style="align-items: center; justify-content: center">
    <el-text>{{ tip_text }}</el-text>
  </div>
  <div class="flex" style="align-items: center; justify-content: center">
    <el-input-number v-model="jobConfig.frame" :step="1" :min="0" />
  </div>
  <div class="flex" style="align-items: center; justify-content: center">
    <el-table-v2 :columns="tableColumns" :data="tableDataRef" :width="500" :height="400" :row-height="40" ref="tableRef"
      fixed />
  </div>
</template>

<script lang="tsx" setup>
import { ref } from 'vue'
import { commonChannel } from '@/pointcloud/event/channel'
import _ from 'lodash'

const tableDataRef = ref([])
const tip_text = ref([])

const tableColumns: Column<any>[] = [
  {
    title: 'id',
    key: 'id',
    dataKey: 'id',
    width: 50
  },
  {
    title: '时间戳',
    key: 'timestamp',
    dataKey: 'timestamp',
    width: 150
  },
  {
    title: '路径',
    key: 'uri',
    dataKey: 'uri',
    width: 150
  },
  {
    key: 'operations',
    cellRenderer: ({ rowIndex }) => (
      <div>
        <el-button size="small" value={rowIndex} onClick={handleChangeFrame}>选择</el-button>
      </div>
    ),
    width: 100,
    align: 'center'
  }
]

const handleChangeFrame = (e) => {
  jobConfig.frame = _.parseInt(e.currentTarget.value)
}

const onDataReady = () => {
  let arr: any[] = []
  _.forIn(currentStreamMeta.value.openlabel.frames, (streamObj, key) => {
    arr.push({
      id: key,
      timestamp: _.get(streamObj, 'frame_properties.timestamp', ''),
      uri: _.get(streamObj, 'frame_properties.uri', '')
    })
  })
  tableDataRef.value = arr

  let frame_id = _.parseInt(jobConfig.frame)
  if (!frame_id) {
    frame_id = 0
  }
  if (frame_id >= arr.length) {
    frame_id = arr.length - 1
  }
  // const frame = arr[frame_id]
  tip_text.value = `第${frame_id} / ${tableDataRef.value.length} 帧`
}

commonChannel.sub(commonChannel.Events.DataLoaded, () => {
  onDataReady()
})
</script>
