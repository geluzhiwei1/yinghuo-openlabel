<template>
  <el-form label-width="120px">
    <el-form-item label="传感器">
      <el-radio-group v-model="jobConfig.stream">
        <el-radio v-for="item in options" :label="item.camera_id" :key="item.camera_id">
          {{ item.camera_id }} - {{ item.group_name }}</el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useDataState } from '@/pointcloud/data-seq'
import _ from 'lodash'
import { commonChannel } from '@/pointcloud/event/channel'
import { jobConfig } from '@/states/job-config'

const { getCurrentSeqMetaAsync } = useDataState()

const options = ref([{ camera_id: '1', group_name: '选择' }])

const loadData = () => {
  getCurrentSeqMetaAsync().then((seqMeta) => {
    let cams: any[] = []
    _.forIn(seqMeta.openlabel.streams, (streamObj, key) => {
      if (streamObj.type === 'lidar') {
        cams.push({
          camera_id: key,
          camera_type: streamObj.type,
          group_name: _.get(streamObj, 'stream_properties.group.name', ''),
          group_value: _.get(streamObj, 'stream_properties.group.value', ''),
          camera_resolution: `${_.get(
            streamObj,
            'stream_properties.intrinsics_pinhole.width_px',
            ''
          )} x ${_.get(streamObj, 'stream_properties.intrinsics_pinhole.', 'height_px')}`,
          checked: false
        })
      }
    })
    options.value = cams
  })
}

commonChannel.sub(commonChannel.Events.SeqDataChanged, () => {
  loadData()
})

</script>
