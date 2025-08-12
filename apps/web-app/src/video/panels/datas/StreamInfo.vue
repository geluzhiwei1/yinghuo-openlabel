<template>
  <el-form label-width="120px">
    <el-form-item label="传感器">
      <el-radio-group v-model="jobConfig.stream">
        <el-radio v-for="item in options" :value="item.camera_id" :key="item.camera_id">
          {{ item.camera_id }} {{ item.group_name }}</el-radio
        >
      </el-radio-group>
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { ref,watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import _ from 'lodash'
import {
  ElRadio,
  ElRadioGroup,
  ElForm,
  ElFormItem
} from 'element-plus'
import { dataSeqState } from '@/states/DataSeqState'

const options = ref([{ camera_id: '1', group_name: '选择' }])

watch(() => dataSeqState.seqMeta, (newVal) => {
  loadData(newVal)
})

const loadData = (seqMeta:any) => {
  let cams: any[] = []
  _.forIn(seqMeta.openlabel.streams, (streamObj, key) => {
    if (streamObj.type === 'camera') {
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
  if (_.isEmpty(jobConfig.stream)) {
    // 默认选择第一个
    jobConfig.stream = cams[0].camera_id
  }
}

</script>
