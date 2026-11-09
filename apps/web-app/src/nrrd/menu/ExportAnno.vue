<template>
  <el-dialog v-model="visible" title="导出标注" width="420px" append-to-body>
    <el-form label-width="90px">
      <el-form-item label="导出格式">
        <el-radio-group v-model="format">
          <el-radio value="SegNrrd">NIfTI 压缩包</el-radio>
          <el-radio value="VolumeJSON">轮廓 JSON</el-radio>
          <el-radio value="OpenLabel">OpenLabel</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="导出范围">
        <el-radio-group v-model="scope">
          <el-radio value="currentFrame">当前帧</el-radio>
          <el-radio value="currentTask">整个任务</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <el-text size="small" type="info">
          SegNrrd: series/*.nii.gz(每序列全部 segment 合并为一个多标签 NIfTI, 可回导/3D Slicer 载入)
          + contours.json;
          VolumeJSON: 仅轮廓 manifest。
        </el-text>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="submit">导出</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { labelApi } from '@/api'
import { jobConfig } from '@/states/job-config'

const visible = ref(false)
const exporting = ref(false)
const format = ref<'SegNrrd' | 'VolumeJSON' | 'OpenLabel'>('SegNrrd')
const scope = ref<'currentFrame' | 'currentTask'>('currentFrame')

function open() {
  visible.value = true
}
defineExpose({ open })

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  URL.revokeObjectURL(url)
}

async function submit() {
  exporting.value = true
  try {
    const payload = {
      format: format.value,
      scope: scope.value,
      mission: jobConfig.mission,
      uuid: jobConfig.uuid,
      seq: jobConfig.seq,
      stream: jobConfig.stream,
      frame: String(jobConfig.frame),
    }
    if (format.value === 'SegNrrd') {
      const blob = await labelApi.export_format_blob(payload)
      // 后端业务错误也走 HTTP 200 + JSON body, 小 json 即错误
      if (blob.type.includes('json') && blob.size < 8192) {
        const j = JSON.parse(await blob.text())
        if (j?.status === 1) throw new Error(j.statusText || '导出失败')
      }
      download(blob, `yhsystem_${jobConfig.seq.split('/').pop() || 'vol'}_seg.zip`)
    } else {
      const res = await labelApi.export_format(payload)
      if (res?.status === 1) throw new Error(res.statusText || '导出失败')
      const blob = new Blob([JSON.stringify(res.data, null, 1)], { type: 'application/json' })
      download(blob, `yhsystem_${jobConfig.seq.split('/').pop() || 'vol'}_${format.value}.json`)
    }
    visible.value = false
    ElMessage.success('导出完成')
  } catch (e: any) {
    ElMessage.error(`导出失败: ${e?.message ?? e}`)
  } finally {
    exporting.value = false
  }
}
</script>
