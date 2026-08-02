<template>
  <VueForm ref="form" label-width="120px" v-model="formData" :schema="schema" :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }"/>
  <div style="text-align: center;">
    <JsonEditorVue
        style="height: 400px;width:100%"
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
    <el-text type="success" v-show="successMsg">{{ successMsg }}</el-text>
    <el-button type="primary" @click="onSubmit">从画布载入</el-button>
    <el-button type="primary" :loading="downloading" @click="download">从服务器下载</el-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'
import { globalStates } from '@/states'
import { JsonEditorVue } from '@/components/JsonEditor'
import {type ValidationError} from 'jsoneditor'
import Editor from 'jsoneditor'
import { labelApi } from '@/api'


const formData = reactive({
  format: 'OpenLabel',
  scope: 'currentFrame',
})

const jsonEditor = ref()
const jsonAnnos = ref<any>({})
const jsonEditorOptions = {
  search: true,
}
const errorMsg = ref<string | undefined>(undefined)
const successMsg = ref<string | undefined>(undefined)
const downloading = ref(false)

const onJsonEditorBlur = async (editor) => {
  errorMsg.value = undefined
  const res = await editor.validate();
  if (res.length === 0) {
    jsonAnnos.value = JSON.parse(editor.getText())
  } else {
    errorMsg.value = 'json格式错误'
  }
}
const onSpecJsonValidationError = (editor:Editor, errors: ValidationError[]) => {
  if (errors.length === 0) return;
}

const FORMAT_OPTIONS = ['OpenLabel', 'COCO', 'YOLO']
const SCOPE_VALUES = ['currentFrame', 'currentTask']
const SCOPE_LABELS = ['当前帧', '当前任务']

const schema = reactive({
  "title": "",
  "type": "object",
  "description": "按照指定格式，导出标签数据",
  "properties": {
    "format": {
      "type": "string",
      "title": "导出格式",
      "enum": FORMAT_OPTIONS,
      "default": "OpenLabel",
      "ui:widget": "RadioWidget",
    },
    "scope": {
      "title": "导出范围",
      "type": "string",
      "enum": SCOPE_VALUES,
      "enumNames": SCOPE_LABELS,
      "default": "currentFrame",
      "ui:widget": "SelectWidget",
    }
  }
})

const onSubmit = () => {
  const annos = globalStates.mainAnnoater.export('default')
  jsonEditor.value.editor.set(annos)
}

const buildFileName = (ext: string) => {
  const base = formData.scope === 'currentTask'
    ? `${jobConfig.uuid}`
    : `${jobConfig.seq}_${jobConfig.stream}_${jobConfig.frame}`
  return `${base}_${formData.scope}.${ext}`
}

const download = async () => {
  errorMsg.value = undefined
  successMsg.value = undefined

  if (!jobConfig.uuid || !jobConfig.mission) {
    errorMsg.value = '任务参数缺失'
    return
  }

  const payload = {
    format: formData.format,
    scope: formData.scope,
    mission: jobConfig.mission,
    seq: jobConfig.seq,
    stream: jobConfig.stream,
    frame: jobConfig.frame,
    uuid: jobConfig.uuid,
  }

  downloading.value = true
  try {
    if (formData.format === 'YOLO') {
      const blob = await labelApi.export_format_blob(payload)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', buildFileName('zip'))
      document.body.appendChild(link)
      link.click()
      URL.revokeObjectURL(url)
      successMsg.value = 'YOLO 已下载为 zip'
    } else {
      const res: any = await labelApi.export_format(payload)
      const data = res?.data ?? res
      const dataToSave = JSON.stringify(data, null, 2)
      const blob = new Blob([dataToSave], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', buildFileName('json'))
      document.body.appendChild(link)
      link.click()
      URL.revokeObjectURL(url)
      successMsg.value = `${formData.format} 已下载`
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '导出失败'
  } finally {
    downloading.value = false
  }
}

const changeSchema = (newVal) => {
  // 限制可用的导出格式(部分 mission 不支持 YOLO/COCO)
  switch (newVal) {
    case Mission.ObjectBBox2d:
      schema.properties.format.enum = ['OpenLabel', 'COCO', 'YOLO']
      break
    case Mission.ObjectRBBox2d:
    case Mission.Semantic2d:
      schema.properties.format.enum = ['OpenLabel', 'COCO']
      break
    default:
      schema.properties.format.enum = ['OpenLabel']
      break
  }
  if (!schema.properties.format.enum.includes(formData.format)) {
    formData.format = schema.properties.format.enum[0]
  }
}

watch(() => jobConfig.mission, (newVal) => {
  changeSchema(newVal)
}, { immediate: true })

</script>
