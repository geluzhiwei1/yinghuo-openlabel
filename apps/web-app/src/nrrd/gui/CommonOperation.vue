<template>
  <el-badge :is-dot="hasChanges" class="co-badge">
    <el-button-group>
      <el-tooltip placement="bottom-start" :content="t('nrrd.save.tooltip')" >
        <el-button id="btn-save-anno" type="primary" :loading="saving" :disabled="!volState.base" @click="save">
          <Icon icon="lucide:save" v-show="!saving" />
        </el-button>
      </el-tooltip>
    </el-button-group>
  </el-badge>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { volState } from '../store'
import { segState } from '../seg/segments'
import { saveVolumeLabels, hasUnsavedChanges } from '../seg/segDocument'
import { jobConfig } from '@/states/job-config'
import { i18n } from '@/locales'

const t = (key: string, args?: any) => i18n.global.t(key, args ?? {})

const saving = ref(false)
const hasChanges = computed(() => hasUnsavedChanges())

async function save() {
  if (saving.value) return
  if (!hasChanges.value) {
    ElMessage.info(t('nrrd.save.noChanges'))
    return
  }
  saving.value = true
  try {
    const { saved, removed } = await saveVolumeLabels()
    ElMessage.success(t('nrrd.save.success', { frame: jobConfig.frame, saved, removed }))
  } catch (e: any) {
    ElMessage.error(t('nrrd.save.failed', { msg: e?.message ?? e }))
  } finally {
    saving.value = false
  }
}
</script>
