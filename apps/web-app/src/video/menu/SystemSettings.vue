<template>
  <el-dialog v-model="settingsDlgVisible" title="系统设置" width="800">
    <VueForm id="propertyForm" ref="propertyForm" v-model="formData" :schema="schema"
      :formProps="{ labelPosition: 'right', layoutColumn: 1}" 
      :formFooter="{ show: false }" @change="handleFormChange" />
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { userSettings } from '@/states/UserState'

const schema = {
  type: 'object',
  required: [],
  'ui:order': ['*'],
  properties: {
    saveBeforeChangeFrame: {
      type: 'boolean',
      title: '切换帧图像时保存',
      description: "切换帧图像前，自动保存标签",
      default: true,
    },
    savePerSeconds: {
      "type": "object",
      properties: {
        enabled: {
          type: 'boolean',
          title: '启用定时保存',
          description: "定时保存标签",
          default: false,
        },
        prop: {
            title: "秒数",
            type: "number",
            enum: [30, 60, 120, 300],
            enumNames: ["30秒", "1分钟", "2分钟", "5分钟"],
            'ui:options': {
                "default-first-option": true,
            },
            "ui:hidden": "{{rootFormData.savePerSeconds.enabled === false}}"
        }
      },
    }
  }
}

const formData = reactive({
  savePerSeconds: {
    enabled: false,
    prop: 60,
  },
  saveBeforeChangeFrame: false,
})

const handleFormChange = (data: any) => {
  userSettings.value = {...formData}
}

const settingsDlgVisible = ref(false)
const open = () => {
  settingsDlgVisible.value = !settingsDlgVisible.value
}
defineExpose({ open })

</script>
