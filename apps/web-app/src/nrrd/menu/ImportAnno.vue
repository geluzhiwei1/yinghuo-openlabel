<template>
  <VueForm ref="form" label-width="120px" v-model="formData" :schema="schema" :formProps="{ labelPosition: 'right' }"
    :formFooter="{ show: false }" @cancel="doCancel()" />
  <div style="text-align: center;">
    <el-upload ref="uploadRef" class="upload-demo" action="xx"
      :auto-upload="false">
      <template #trigger>
        <el-button type="primary">select file</el-button>
      </template>

      <el-button class="ml-3" type="success" @click="submitUpload">
        upload to server
      </el-button>

      <template #tip>
        <div class="el-upload__tip">
          jpg/png files with a size less than 500kb
        </div>
      </template>
    </el-upload>
  </div>
</template>
<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import { ElUpload, ElButton } from 'element-plus'
import VueForm from '@lljj/vue3-form-element'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'
import { Mission } from '@/constants'
import type { UploadInstance } from 'element-plus'

const activeTab = ref('currentFrame')

const uploadRef = ref<UploadInstance>()

const schemaCurrentFrame = {
  "title": "",
  "type": "object",
  "description": "通过粘贴导入数据",
  "properties": {
    "format": {
      "type": "string",
      "title": "格式",
      "enum": [
        'YOLO',
        'COCO',
        'OpenLabel'
      ],
      "ui:widget": "RadioWidget",
    },
    "dataStr": {
      "type": "string",
      "default": "",
      "title": "数据",
      "maxLength": 10240,
      "ui:options": {
        "type": "textarea",
        "rows": 6,
        "autosize": {
          "minRows": 5,
          "maxRows": 10
        }
      }
    }
  }
}

const formDataCurrentFrame = reactive({
  format: 'COCO',
  frames: 'currentFrame',
})

const schema = reactive({
  "type": "object",
  "description": "通过上传文件导入数据",
  "properties": {
    "format": {
      "type": "string",
      "title": "格式",
      "enum": [
        'YOLO',
        'COCO',
        'OpenLabel'
      ],
      "ui:widget": "RadioWidget",
    },
  }
})

const submitUpload = () => {
  uploadRef.value!.submit()
}

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
