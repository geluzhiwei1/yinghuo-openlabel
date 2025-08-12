<template>
  <el-drawer v-model="visible" :size="'50%'" destroy-on-close>
    <template #header>
      <h4>数据导出{{ batchMode ? '-批量' : '' }}</h4>
    </template>
    <template #default>
      <el-text> 导出标注数据 </el-text>
      <el-form :loading="loading">
        <el-form-item label="范围：">
          <el-select v-model="formData.frames">
            <el-option label="全部" value="all"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitForm()"> 确定 </el-button>
        </el-form-item>
      </el-form>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { ref, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { ElButton, ElDrawer } from 'element-plus'
import { isEmpty } from 'radash'
import { labelApi } from '@/api'

const loading = ref(false)
const visible = ref(false)
const formData = reactive({
  frames: 'all',
  job_uuid: ''
})
const batchMode = ref(false)
const rows = ref([])

const submitForm = () => {
  if (isEmpty(formData.frames)) {
    ElMessage.warning('请选择范围')
  } else {
    // 提交数据
    if (!batchMode.value) {
      labelApi.export_coco(formData).then((res) => {
        const dataToSave = JSON.stringify(res.data)
        const blob = new Blob([dataToSave], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'annotations.json')
        document.body.appendChild(link)
        link.click()
        URL.revokeObjectURL(url)
      })
    }
  }
}

const open = (row: any) => {
  visible.value = true
  if (Array.isArray(row)) {
    // 批量操作
    batchMode.value = true
  } else {
    // 单个操作
    batchMode.value = false
    formData.job_uuid = row.uuid
  }
}
const close = () => {
  batchMode.value = false
  rows.value = []
  visible.value = false
}

defineExpose({ open, close })
</script>
