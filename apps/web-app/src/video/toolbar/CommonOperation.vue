<template>
  <el-button-group>
    <el-tooltip placement="bottom-start" raw-content :content="$t('video.buttons.undo')">
      <el-button type="primary" @click="unDoConf.handle()" :disabled="unDoConf.disabled.value">
        <Icon :icon="unDoConf.icon" />
      </el-button>
    </el-tooltip>
    <el-tooltip placement="bottom-start" raw-content :content="$t('video.buttons.redo')">
      <el-button type="primary" @click="reDoConf.handle()" :disabled="reDoConf.disabled.value">
        <Icon :icon="reDoConf.icon" />
      </el-button>
    </el-tooltip>
    <el-tooltip placement="bottom-start" raw-content :content="t('video.buttons.' + item.id.replace('-','.'))"
      v-for="(item, index) in commonButtons" :key="index">
      <el-button type="primary" @click="item.handle()" :loading="item.loading">
        <Icon :icon="item.icon" v-show="!item.loading" />
      </el-button>
    </el-tooltip>
    <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary">
          {{ $t('video.toolbar.delete') }}
        </el-button>
      </template>
      <div>
        <el-button-group>
          <el-tooltip placement="bottom-start" raw-content :content="t('video.buttons.' + item.id.replace('-','.'))"
            v-for="(item, index) in delButtons" :key="index">
            <el-button type="primary" @click="item.handle()" :loading="item.loading">
              <Icon :icon="item.icon" v-show="!item.loading" />
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </el-popover>
  </el-button-group>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import _ from 'lodash'
import { Icon } from '@iconify/vue'
import { commonChannel } from '../channel'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'
import type { Action } from 'element-plus'
import { globalStates } from '@/states'
import { hotkeysManager } from '../hotkeysManager'
import { messages } from '@/states'
import { listify } from 'radash'
import { userSettings } from '@/states/UserState'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const unDoConf = {
  id: 'common-undo',
  icon: 'mynaui:undo',
  name: t('video.toolbar.undo'),
  shortcut: 'Shift+Z',
  description: t('video.buttons.undo'),
  showButton: true,
  disabled: computed(() => {
    if (globalStates.mainAnnoater.undoRedo?.states.canUndo) {
      return false
    } else {
      return true
    }
  }),
  handle: () => {
    globalStates.mainAnnoater.undoLastOp?.()
  }
}

const reDoConf = {
  id: 'common-redo',
  icon: 'mynaui:redo',
  name: t('video.toolbar.redo'),
  shortcut: 'Shift+D',
  description: t('video.buttons.redo'),
  showButton: true,
  disabled: computed(() => {
    if (globalStates.mainAnnoater.undoRedo?.states.canRedo) {
      return false
    } else {
      return true
    }
  }),
  handle: () => {
    globalStates.mainAnnoater.redoLastOp?.()
  }
}

const saveButtonConf = reactive({
  id: 'save-annotation',
  icon: 'mingcute:upload-3-line',
  name: t('video.toolbar.save'),
  shortcut: 'Shift+S',
  description: t('video.buttons.save'),
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'save-annotation' })
  }
})
const loadButtonConf = {
  id: 'load-annotation',
  icon: 'uis:refresh',
  name: t('video.toolbar.load'),
  shortcut: 'Shift+R',
  description: t('video.buttons.load'),
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'load-annotation' })
  }
}

const commonButtons = [
  saveButtonConf,
  loadButtonConf,
]


const delButtons = [
  {
    id: 'delete',
    icon: 'ep:delete',
    name: t('video.toolbar.delete'),
    shortcut: 'X',
    description: t('video.buttons.delete'),
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete' })
    }
  },
  {
    id: 'delete-all',
    icon: 'ep:delete-filled',
    name: t('video.toolbar.deleteAll'),
    shortcut: 'Shift+X',
    description: t('video.buttons.deleteAll'),
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete-all' })
    }
  }
  ,
  {
    id: 'delete-seq-all',
    icon: 'mdi:database-remove',
    name: t('video.toolbar.deleteSeqAll'),
    shortcut: '',
    description: t('video.buttons.deleteSeqAll'),
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete-seq-all' })
    }
  }
]

const saveLabel = () => {
  saveButtonConf.loading = true
  const frame_labels = globalStates.mainAnnoater.export('createOrUpdated')

  // 要删除的数据
  globalStates.mainAnnoater.deletedObjs?.forEach((v, k) => {
    frame_labels.push({ ...v.userData.anno, 'attributes': {'opType': 'remove'}})
  })

  if (frame_labels.length === 0) {
    messages.lastInfo = ""
    saveButtonConf.loading = false
    return
  }

  labelApi.save({
      frame_labels,
      jobConfig: jobConfig,
      current_mission: jobConfig.mission,
      current_tool: globalStates.mainTool
    })
    .then((res) => {
      ElMessage.success(t('video.messages.saveSuccessShort', { frame: jobConfig.frame, statusText: res.statusText }))
      globalStates.mainAnnoater.deletedObjs?.clear()
      loadAnnos()
    })
    .catch(() => {
      ElMessage.error(t('video.messages.saveFail', { frame: jobConfig.frame }))
    })
    .finally(() => {
      saveButtonConf.loading = false
    })
}


const saveFramesLabel = (frameIds: number[]) => {
}

const loadAnnos = () => {
  // 加载已经标注的框
  const params = {
    seq: jobConfig.seq,
    stream: jobConfig.stream,
    frame: jobConfig.frame,
    current_mission: jobConfig.mission,
    current_tool: globalStates.mainTool,
    uuid: jobConfig.uuid
  }
  loadButtonConf.loading = true
  labelApi
    .load(params)
    .then((res: any) => {
      const rtn = res.data
      if (_.isEmpty(rtn)) return
      // 如果帧已经切换，忽略
      if (jobConfig.frame !== rtn[0].jobConfig.frame) {
        return
      }
      let datas = listify(rtn[0].frame_labels, (key, value) => value)
      globalStates.mainAnnoater.import('default', datas)
    })
    .finally(() => {
      loadButtonConf.loading = false
      globalStates.anno.annoDataLoaded += 1
    })
}
/**
 * 保存标签
 */
commonChannel.sub(commonChannel.Events.ButtonClicked, (msg: any) => {
  switch (msg.data) {
    case 'common-undo':
      globalStates.mainAnnoater.undoLastOp()
      break
    case 'load-annotation':
      loadAnnos()
      break
    case 'save-annotation':
      saveLabel()
      break
    case 'delete':
      globalStates.mainAnnoater.removeSelected()
      break
    case 'delete-all':
      ElMessageBox.confirm(t('video.messages.deleteConfirm'), t('video.misc.confirm'), {
        distinguishCancelAndClose: true,
        confirmButtonText: t('video.misc.yes'),
        cancelButtonText: t('video.misc.no')
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          messages.lastInfo = t('video.messages.cleared')
        })
        .catch((action: Action) => {
          if (action === 'cancel') {
            // do nothing
          }
        })
      break
    case 'delete-seq-all':
      ElMessageBox.confirm(t('video.messages.deleteSeqAllConfirm'), t('video.misc.confirm'), {
        distinguishCancelAndClose: true,
        confirmButtonText: t('video.misc.yes'),
        cancelButtonText: t('video.misc.no')
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          labelApi.deleteSeqAll({
              jobConfig: jobConfig,
              current_mission: jobConfig.mission,
          }).then(() => {
            commonChannel.pub(commonChannel.Events.UpdateObjectCounts, {})
            ElMessage.success(t('video.messages.deleteSuccess'))
          })
        })
        .catch((action: Action) => {
          if (action === 'cancel') {
            // do nothing
          }
        })
      break
    default:
      break
  }
})

const init = () => {
  const btns = [...commonButtons, ...delButtons]
  const filterdButtns = btns.filter((btn) => btn.shortcut && btn.shortcut !== '')
  const keys = filterdButtns.map((btn) => btn.shortcut)
  const handles = filterdButtns.map((btn) => () => btn.handle())
  keys.forEach((key, index) => {
    hotkeysManager.registerHotkeys({ toolId: 'commonOp', keys: key, cb: handles[index] })
  })
}

let timerId = null as any
watch(() => userSettings.value.savePerSeconds.enabled, (newVal, oldVal) => {
  if (!newVal) {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  } else {
    if (!timerId) {
      // 没有定时器，则创建
      timerId = setInterval(saveLabel, userSettings.value.savePerSeconds.prop * 1000)
    }
  }
}, {immediate: true})

onMounted(() => {
  init()
})
</script>
