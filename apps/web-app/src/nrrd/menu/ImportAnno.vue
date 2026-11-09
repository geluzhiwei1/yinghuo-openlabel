<template>
  <el-dialog v-model="visible" title="导入标注" width="640px" append-to-body :close-on-click-modal="false">
    <el-form label-width="90px">
      <el-form-item label="选择文件">
        <div class="import-files">
          <el-button @click="fileRef?.click()">选择 zip / .seg.nrrd.gz / .nii(.gz)</el-button>
          <el-text v-if="files.length" size="small" class="import-files__names">
            {{ files.map(f => f.name).join('、') }}
          </el-text>
        </div>
        <input ref="fileRef" type="file" class="import-files__input" multiple
               accept=".zip,.nrrd,.gz,.nii" @change="onFiles" />
      </el-form-item>
      <el-form-item label="已有标注帧">
        <el-radio-group v-model="mode">
          <el-radio value="skip">跳过</el-radio>
          <el-radio value="overwrite">覆盖(删除该帧既有 segment)</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <el-text size="small" type="info">
          按 series_uid → 导出清单帧号 → 患者文件名 → 几何 匹配目标帧;患者或网格不一致的文件自动跳过。
          支持导出的 zip(series/)或散的 series .seg.nrrd.gz,以及 NIfTI .nii/.nii.gz 多标签分割(按患者文件名或几何匹配)。
        </el-text>
      </el-form-item>
    </el-form>
    <el-table v-if="results.length" :data="results" size="small" max-height="240">
      <el-table-column prop="file" label="文件" min-width="200" show-overflow-tooltip />
      <el-table-column label="帧" width="56">
        <template #default="{ row }">{{ row.frame ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="匹配方式" width="90">
        <template #default="{ row }">{{ row.matched_by || '-' }}</template>
      </el-table-column>
      <el-table-column label="结果" min-width="180">
        <template #default="{ row }">
          <el-text :type="row.action === 'imported' ? 'success' : 'info'">{{ actionText(row) }}</el-text>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="importing" :disabled="!files.length" @click="submit">导入</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { zipSync } from 'fflate'
import { labelApi } from '@/api'
import { jobConfig } from '@/states/job-config'
import { volState } from '../store'
import { disposeLabelmap, initLabelmap } from '../seg/labelmap'
import { resetSegments } from '../seg/segments'
import { loadVolumeLabels, hasUnsavedChanges } from '../seg/segDocument'

const visible = ref(false)
const importing = ref(false)
const mode = ref<'skip' | 'overwrite'>('skip')
const files = ref<File[]>([])
const results = ref<any[]>([])
const fileRef = ref<HTMLInputElement>()

function open() {
  files.value = []
  results.value = []
  visible.value = true
}
defineExpose({ open })

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  files.value = [...(input.files ?? [])]
  input.value = ''
}

function actionText(row: any): string {
  if (row.action === 'imported') return `已导入 ${row.segments} 段 / ${row.voxels} 体素`
  if (row.action === 'skipped_existing') return '跳过: 帧已有标注'
  if (row.action === 'parse_error') return `解析失败: ${row.detail ?? ''}`
  return `跳过: ${row.detail ?? ''}`
}

async function buildBody(): Promise<Blob> {
  const zips = files.value.filter(f => /\.zip$/i.test(f.name))
  const loose = files.value.filter(f => !/\.zip$/i.test(f.name))
  if (zips.length > 1) throw new Error('一次只能导入一个 zip')
  if (zips.length === 1 && loose.length === 0) return zips[0]
  // 散文件打包进 series/, 服务端走同一路由
  const entries: Record<string, Uint8Array> = {}
  for (const f of loose) entries[`series/${f.name}`] = new Uint8Array(await f.arrayBuffer())
  return new Blob([zipSync(entries)])
}

async function submit() {
  if (!files.value.length || importing.value) return
  importing.value = true
  results.value = []
  try {
    const body = await buildBody()
    const res = await labelApi.import_format_zip(jobConfig.uuid, jobConfig.stream, mode.value, body)
    if (res?.status === 1) throw new Error(res.statusText || '导入失败')
    results.value = res?.data?.results ?? []
    ElMessage.success(`导入完成: ${res?.data?.imported ?? 0} 帧,跳过 ${res?.data?.skipped ?? 0}`)
    volState.savedAt = Date.now()   // DataPanel 徽章刷新信号
    await refreshCurrentFrame()
  } catch (e: any) {
    ElMessage.error(`导入失败: ${e?.message ?? e}`)
  } finally {
    importing.value = false
  }
}

/** 命中当前帧时原地重载标注(有未保存修改则不动, 提示用户自行处理) */
async function refreshCurrentFrame() {
  const cur = String(jobConfig.frame)
  if (!results.value.some(r => r.action === 'imported' && String(r.frame) === cur)) return
  if (hasUnsavedChanges()) {
    ElMessage.warning('当前帧已导入, 但本帧有未保存修改, 未自动刷新')
    return
  }
  const grid = volState.base?.grid
  if (!grid) return
  resetSegments()
  disposeLabelmap()
  initLabelmap(grid)
  volState.dirty = false
  await loadVolumeLabels()
}
</script>

<style lang="scss" scoped>
.import-files {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  &__names {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 原生 input 只作选择器, 不占位
  &__input {
    display: none;
  }
}
</style>
