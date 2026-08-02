<template>
  <el-form label-width="120px">
    <el-form-item label="操作">
      <el-row style="width:100%">
        <el-col :span="12"><el-button @click="callAutoLabel()">自动标注</el-button></el-col>
        <el-col :span="12">快捷键：<el-tag>R</el-tag>发起推理请求</el-col>
      </el-row>
    </el-form-item>
    <el-form-item label="模型">
      <el-row style="width:100%" v-for="(item, index) in modelApis" :key="index">
        <el-col :span="8"><el-switch v-model="item.serv_info.selected"
            @change="handleModelChange(item.api_id)" /></el-col>
        <el-col :span="16"><a href="{{ item.serv_info.reference }}" target="_blank">{{ item.serv_info.model_info.name
        }}-{{
  item.serv_info.model_info.dataset }}</a></el-col>
      </el-row>
    </el-form-item>
    <el-form-item label="阈值">
      <el-slider v-model="dataForm.thresh_score" :step="0.05" :max="1" :min="0.05" show-input></el-slider>
    </el-form-item>
  </el-form>
</template>

<script lang="tsx" setup>
import { reactive, ref } from 'vue'
import _ from 'lodash'
import { eventBus } from '../../event/EventBus'
import { ElNotification } from 'element-plus'
import { jobConfig } from '@/states/job-config'

const modelApis = ref([])

const dataForm = reactive({
  thresh_score: 0.5,
  api_id: '',
})

const handleModelChange = (api_id) => {
  dataForm.api_id = api_id
  modelApis.value.map((item) => {
    item.serv_info.selected = false
    item.serv_info.selected = item.api_id === api_id
  })
}

const callAutoLabel = async () => {
  if (_.isString(dataForm.api_id) && dataForm.api_id !== "") {
    const req_seq = {
      stream: jobConfig.stream,
      ts: jobConfig.ts,
    }
    const rtnJson = await window.pySeqData.httpDetLidar3D.serv_api(dataForm.api_id, req_seq, {
      'thresh_score': dataForm.thresh_score,
    })
    const boxes = rtnJson.toJs({ dict_converter: Object.fromEntries }).data[0].objects
    boxes.map((box) => {
      box.rotation.z = -box.rotation.z - Math.PI / 2.0
      // box.position.z + 1.5
    })
    await eventBus.emitAsync(eventBus.Box3d.AutoLabelBoxes, boxes)
  } else {
    ElNotification({
      title: '提示',
      message: '正在加载可用模型',
      type: 'warning',
    })
  }
}

eventBus.on(eventBus.SeqData.Loaded, async () => {
  // const rtn = await window.pySeqData.httpDetLidar3D.list_api()
  // modelApis.value = rtn.toJs({ dict_converter: Object.fromEntries })
  // modelApis.value.map((item) => {
  //   if (item.serv_info.selected) {
  //     dataForm.api_id = item.api_id
  //   }
  // })
})

</script>
