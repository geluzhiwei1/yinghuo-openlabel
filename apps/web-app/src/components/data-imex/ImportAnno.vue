<template>
  <VueForm ref="formImport" label-width="120px" v-model="formData" :schema="schema" :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }" />

  <div v-if="formData.format === 'YOLO'" class="yolo-input-block">
    <el-form label-width="120px">
      <el-form-item label="类别名单">
        <el-input
          v-model="yoloClasses"
          type="textarea"
          :rows="3"
          placeholder="每行一个类名 (顺序对应 class_id),或粘贴 data.yaml 中的 names 段"
        />
      </el-form-item>
      <el-form-item label="图像尺寸">
        <el-input v-model="yoloImageShape" placeholder="例如:1920x1080,留空则使用当前画布图像" style="width: 280px;" />
      </el-form-item>
      <el-form-item label="YOLO 标签">
        <el-input
          v-model="yoloLabels"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 14 }"
          placeholder="每行一条 `class_id cx cy w h`,坐标为 0-1 归一化值"
        />
      </el-form-item>
    </el-form>
  </div>

  <div v-else style="text-align: center;">
    <JsonEditorVue
        style="height: 400px;width:100%"
        ref="jsonEditor"
        :jsonData="jsonAnnos"
        :currentMode="'code'"
        :modeList="['code', 'tree', 'text']"
        :expandedOnStart="false"
        :options="jsonEditorOptions"
        @blur="onJsonEditorBlur"
        @validationError="onJsonValidationError"
      />
  </div>

  <div style="text-align: center; margin-top: 8px;">
    <el-text type="danger" v-show="errorMsg">异常：{{ errorMsg }}</el-text>
    <el-text type="success" v-show="successMsg">{{ successMsg }}</el-text>
    <el-button type="primary" @click="submitImport">确定</el-button>
  </div>
</template>
<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'
import { JsonEditorVue } from '@/components/JsonEditor'
import {type ValidationError} from 'jsoneditor'
import Editor from 'jsoneditor'
import { globalStates } from '@/states'
import { cocoToOpenLabel, yoloToOpenLabel, parseYoloClasses, type CocoData, type YoloPayload } from './converters'


const jsonEditor = ref()
const jsonAnnos = ref<any>({})
const jsonEditorOptions = {
  search: true,
}
const errorMsg = ref<string | undefined>(undefined)
const successMsg = ref<string | undefined>(undefined)

const yoloClasses = ref('')
const yoloLabels = ref('')
const yoloImageShape = ref('')

const onJsonEditorBlur = async (editor) => {
  const res = await editor.validate();
  if (res.length === 0) {
    jsonAnnos.value = editor.get()
    errorMsg.value = undefined
  } else {
    errorMsg.value = 'json格式错误'
  }
}
const onJsonValidationError = (editor:Editor, errors: ValidationError[]) => {
  if (errors.length === 0) return;
}

const formData = reactive({
  format: 'OpenLabel',
})

const FORMAT_LABELS: Record<string, string> = {
  OpenLabel: 'OpenLabel',
  COCO: 'COCO',
  YOLO: 'YOLO',
}

const schema = reactive({
  "type": "object",
  "description": "选择导入格式,粘贴或填写标签数据,系统会自动转换为标准 OpenLabel 格式",
  "required": ["format"],
  "properties": {
    "format": {
      "description": "",
      "type": "string",
      "title": "格式",
      "enum": ['OpenLabel'],
      "enumNames": ['OpenLabel'],
      "default": "OpenLabel",
      "ui:widget": "RadioWidget",
    }
  }
})

const changeSchema = (newVal) => {
  switch (newVal) {
    case Mission.ObjectBBox2d:
      schema.properties.format.enum = ['OpenLabel', 'COCO', 'YOLO']
      schema.properties.format.enumNames = ['OpenLabel', 'COCO', 'YOLO']
      break
    case Mission.ObjectRBBox2d:
      schema.properties.format.enum = ['OpenLabel', 'COCO']
      schema.properties.format.enumNames = ['OpenLabel', 'COCO']
      break
    default:
      schema.properties.format.enum = ['OpenLabel']
      schema.properties.format.enumNames = ['OpenLabel']
      break
  }
  if (!schema.properties.format.enum.includes(formData.format)) {
    formData.format = schema.properties.format.enum[0]
  }
}

watch(() => jobConfig.mission, (newVal) => {
  changeSchema(newVal)
}, { immediate: true })

const currentImageSize = (): [number, number] => {
  const img = globalStates.imageObject
  if (img) {
    try {
      const { width, height } = (img as any).getOriginalSize?.() || {}
      if (width && height) return [width, height]
    } catch {
      // fall through to direct props
    }
    const w = (img as any).width || (img as any).scaleX
    const h = (img as any).height || (img as any).scaleY
    if (w && h) return [w, h]
  }
  return [0, 0]
}

const parseImageShapeInput = (): [number, number] => {
  const raw = yoloImageShape.value.trim()
  if (!raw) return currentImageSize()
  const m = raw.match(/^(\d+)\s*[x×*,\s]\s*(\d+)$/)
  if (m) return [Number(m[1]), Number(m[2])]
  const parts = raw.split(/[x×*,\s]+/).map((s) => Number(s)).filter((n) => !Number.isNaN(n))
  if (parts.length === 2) return [parts[0], parts[1]]
  return currentImageSize()
}

const submitImport = async () => {
  errorMsg.value = undefined
  successMsg.value = undefined

  try {
    let annos: any[] = []

    if (formData.format === 'OpenLabel') {
      const data = jsonEditor.value?.editor?.get?.()
      if (Array.isArray(data)) {
        annos = data
      } else if (data && typeof data === 'object') {
        if (Array.isArray((data as any).frame_labels)) {
          annos = (data as any).frame_labels
        } else if (Array.isArray((data as any).openlabel?.objects)) {
          annos = (data as any).openlabel.objects
        } else {
          annos = Object.values(data)
        }
      } else {
        throw new Error('OpenLabel 数据应为数组')
      }
    } else if (formData.format === 'COCO') {
      const data = jsonEditor.value?.editor?.get?.() as CocoData
      annos = cocoToOpenLabel(data || {})
    } else if (formData.format === 'YOLO') {
      const classes = parseYoloClasses(yoloClasses.value)
      const [w, h] = parseImageShapeInput()
      const payload: YoloPayload = {
        classes,
        image_shape: yoloImageShape.value.trim() ? [w, h] : undefined,
        labels: yoloLabels.value,
      }
      const [fw, fh] = currentImageSize()
      annos = yoloToOpenLabel(payload, fw, fh)
    }

    if (!Array.isArray(annos) || annos.length === 0) {
      errorMsg.value = '没有可导入的标签数据'
      return
    }

    globalStates.mainAnnoater.import('default', annos)
    successMsg.value = `成功导入 ${annos.length} 条 (${FORMAT_LABELS[formData.format] || formData.format} → OpenLabel)`
  } catch (e: any) {
    errorMsg.value = e?.message || '导入失败'
  }
}
</script>
<style scoped>
.yolo-input-block {
  padding: 0 16px;
}
</style>
