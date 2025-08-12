<template>
  <VueForm
    ref="formImport"
    label-width="120px"
    v-model="formData"
    :schema="schema"
    :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }"
  />
  <!-- <el-text type="success">
      格式说明：https://TODO
    </el-text> -->
  <div style="text-align: center">
    <JsonEditorVue
      style="height: 400px; width: 100%"
      ref="jsonEditor"
      :jsonData="jsonAnnos"
      :currentMode="'code'"
      :modeList="['code', 'tree', 'text']"
      :expandedOnStart="false"
      :options="jsonEditorOptions"
      @blur="onJsonEditorBlur"
      @validationError="onJsonValidationError"
    />
    <el-text type="danger" v-show="errorMsg">异常：{{ errorMsg }}</el-text>
    <el-button type="primary" @click="submitImport">确定</el-button>
  </div>
</template>
<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'
import { JsonEditorVue } from '@/components/JsonEditor'
import { type ValidationError } from 'jsoneditor'
import Editor from 'jsoneditor'
import { globalStates } from '@/states'

const jsonEditor = ref()
const jsonAnnos = ref<any>({})
const jsonEditorOptions = {
  search: true
}
const errorMsg = ref(undefined)

const onJsonEditorBlur = async (editor) => {
  errorMsg.value = undefined
  const res = await editor.validate()
  if (res.length === 0) {
    jsonAnnos.value = editor.get()
  } else {
    errorMsg.value = 'json格式错误'
  }
}
const onJsonValidationError = (editor: Editor, errors: ValidationError[]) => {
  if (errors.length === 0) return
}
const formImport = ref()

const schema = reactive({
  type: 'object',
  description: '粘贴标签数据',
  required: ['format', 'dataStr'],
  properties: {
    format: {
      description: '',
      type: 'string',
      title: '格式',
      enum: [
        // 'YOLO',
        // 'COCO',
        'OpenLabel'
      ],
      'ui:widget': 'RadioWidget'
    }
  }
})

const formData = reactive({
  dataStr: '',
  format: 'OpenLabel'
})

const submitImport = async () => {
  const annos = jsonEditor.value.editor.get()
  if (!Array.isArray(annos)) {
    errorMsg.value = '格式错误'
    return
  }
  globalStates.mainAnnoater.import('default', annos)
  errorMsg.value = '导入成功'
}

const changeSchema = (newVal) => {
  switch (newVal) {
    case Mission.PcPolyline3d:
      schema.properties.format.enum = ['COCO', 'YOLO', 'OpenLabel']
      break
    case Mission.ObjectBBox3d:
      schema.properties.format.enum = [
        // 'CSV-ts,trackid,type,x,y,z,rx,ry,rz,sx,sy,sz',
        'OpenLabel'
      ]
      break
    default:
      break
  }
}

watch(
  () => jobConfig.mission,
  (newVal) => {
    changeSchema(newVal)
  },
  { immediate: true }
)
</script>
