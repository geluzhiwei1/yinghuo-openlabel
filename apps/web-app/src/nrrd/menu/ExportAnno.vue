<template>
  <VueForm ref="form" label-width="120px" v-model="formData" :schema="schema" :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }"/>
    <div style="text-align: center;">  <el-button type="primary" disabled>Primary</el-button>
      <el-button type="success" disabled>Success</el-button></div>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'
import { Mission } from '@/constants'

const schema = reactive({
  "title": "",
  "type": "object",
  "description": "按照指定格式，导出标签数据",
  "properties": {
    "format": {
      "type": "string",
      "title": "导出格式",
      "enum": [
        'COCO',
        'YOLO',
        'OpenLabel',
      ],
      "ui:widget": "RadioWidget",
    },
    "frames": {
      "title": "导出范围",
      "type": "string",
      "enum": [
        "currentFrame",
        "allFrames"
      ],
      "enumNames": [
        "当前帧",
        "所有帧",
      ],
      "ui:widget": "SelectWidget",
    }
  }
})

const formData = reactive({
  format: 'COCO',
  frames: 'currentFrame',
})

const submitForm = async () => {
  const data = {
    jobConfig,
    exportConf: formData
  }
  await labelApi.export(data)
}

const doCancel = () => {
  // exportAnnoDlgVisible.value = false
}

const changeSchema = (newVal) => {
  switch (newVal) {
    case Mission.ObjectBBox2d:
      schema.properties.format.enum = [
        'COCO',
        'YOLO',
        'OpenLabel',
      ]
      break;
    case Mission.Semantic2d:
      schema.properties.format.enum = [
        'COCO',
        'YOLO',
        'Cityscapes',
        'OpenLabel',
      ]
      break;
    default:
      break;
  }
}

watch(jobConfig.mission, (newVal) => {
  changeSchema(newVal)
})

</script>
