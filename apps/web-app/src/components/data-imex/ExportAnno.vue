<template>
  <VueForm
    ref="form"
    label-width="120px"
    v-model="formData"
    :schema="schema"
    :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }"
  />
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
      @validationError="onSpecJsonValidationError"
    />
    <el-text type="danger" v-show="errorMsg">异常：{{ errorMsg }}</el-text>
    <el-button type="primary" @click="onSubmit">确定</el-button>
    <el-button type="primary" @click="download">从服务器下载</el-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'
import { globalStates } from '@/states'
import { JsonEditorVue } from '@/components/JsonEditor'
import { type ValidationError } from 'jsoneditor'
import Editor from 'jsoneditor'
import { labelApi } from '@/api'

const formData = reactive({
  format: 'OpenLabel',
  frames: 'currentFrame',
  jsonAnnos: ''
})

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
    jsonAnnos.value = JSON.parse(editor.getText())
  } else {
    errorMsg.value = 'json格式错误'
  }
}
const onSpecJsonValidationError = (editor: Editor, errors: ValidationError[]) => {
  if (errors.length === 0) return
}

const schema = reactive({
  title: '',
  type: 'object',
  description: '按照指定格式，导出标签数据',
  properties: {
    format: {
      type: 'string',
      title: '导出格式',
      enum: ['OpenLabel'],
      'ui:widget': 'RadioWidget'
    },
    frames: {
      title: '导出范围',
      type: 'string',
      enum: ['currentFrame'],
      enumNames: ['当前帧'],
      'ui:widget': 'SelectWidget'
    }
    // "jsonAnnos": {
    //   "type": "string",
    //   "default": "",
    //   "title": "数据",
    //   "maxLength": 10240,
    //   "ui:options": {
    //     "type": "textarea",
    //     "rows": 6,
    //     "autosize": {
    //       "minRows": 5,
    //       "maxRows": 10
    //     }
    //   }
    // }
  }
})

const onSubmit = () => {
  const annos = globalStates.mainAnnoater.export('default')
  jsonEditor.value.editor.set(annos)
}

const download = () => {
  const params = {
    seq: jobConfig.seq,
    stream: jobConfig.stream,
    frame: jobConfig.frame,
    current_mission: jobConfig.mission,
    current_tool: globalStates.mainTool,
    uuid: jobConfig.uuid
  }
  labelApi
    .load(params)
    .then((res: any) => {
      const dataToSave = JSON.stringify(res.data)
      const blob = new Blob([dataToSave], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${jobConfig.frame}.json`)
      document.body.appendChild(link)
      link.click()
      URL.revokeObjectURL(url)
    })
    .finally(() => {})
}

const changeSchema = (newVal) => {
  switch (newVal) {
    case Mission.ObjectBBox2d:
      schema.properties.format.enum = ['OpenLabel']
      break
    case Mission.Semantic2d:
      schema.properties.format.enum = ['OpenLabel']
      break
    default:
      break
  }
}

watch(
  () => jobConfig.mission,
  (newVal) => {
    changeSchema(newVal)
  }
)
</script>
