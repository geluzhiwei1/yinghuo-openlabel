<template>
  <el-button-group>
    <!-- <el-button type="primary" @click="unDoConf.handle()" :disabled="unDoConf.disabled.value">
      <Icon :icon="unDoConf.icon" />
    </el-button>
    <el-button type="primary" @click="reDoConf.handle()" :disabled="reDoConf.disabled.value">
      <Icon :icon="reDoConf.icon" />
    </el-button> -->
    <el-tooltip placement="bottom-start" raw-content :content="'<span>' +
      item.name +
      '</br>' +
      item.description +
      '</br>' +
      item.shortcutLabel +
      '</span>'
      " v-for="(item, index) in commonButtons" :key="index">
      <el-button type="primary" @click="item.handle()" :loading="item.loading">
        <Icon :icon="item.icon" v-show="!item.loading" />
      </el-button>
    </el-tooltip>
  </el-button-group>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, watch } from 'vue'
import _ from 'lodash'
import { Icon } from '@iconify/vue'
import { commonChannel } from '../channel'
import { ElButton, ElTooltip, ElButtonGroup, ElMessageBox, ElMessage } from 'element-plus'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'
import { labelerState } from '@/states/ImageLabelerState'
import type { Action } from 'element-plus'
import { globalStates } from '@/states'
import { hotkeysManager } from '../hotkeysManager'
import { messages } from '@/states'
import { listify } from 'radash'
import { userSettings } from '@/states/UserState'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

// onMounted(() => {
//   Mousetrap.bind('ctrl+s', () => {
//     commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'save-annotation' })
//   }, 'keypress')
// })

const unDoConf = {
  id: 'common-undo',
  icon: 'lucide:undo-2',
  name: t('workbench.undo'),
  shortcut: 'Shift+Z',
  shortcutLabel: t('shortcutCheatsheet.undo'),
  description: `<el-text>${t('workbench.undoDesc')}</el-text>`,
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
    // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'common-undo' })
  }
}

const reDoConf = {
  id: 'common-redo',
  icon: 'lucide:redo-2',
  name: t('workbench.redo'),
  shortcut: 'Shift+D',
  shortcutLabel: t('shortcutCheatsheet.redo'),
  description: `<el-text>${t('workbench.redoDesc')}</el-text>`,
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
    // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'common-undo' })
  }
}

const saveButtonConf = reactive({
  id: 'save-annotation',
  icon: 'lucide:save',
  name: t('workbench.save'),
  shortcut: 'Shift+S',
  shortcutLabel: t('shortcutCheatsheet.save'),
  description: `<el-text>${t('workbench.saveDesc')}</el-text>`,
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'save-annotation' })
  }
})
const loadButtonConf = {
  id: 'load-annotation',
  icon: 'lucide:refresh-cw',
  name: t('workbench.load'),
  shortcut: 'Shift+R',
  shortcutLabel: t('shortcutCheatsheet.load'),
  description: `<el-text>${t('workbench.loadDesc')}</el-text>`,
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'load-annotation' })
  }
}

const commonButtons = [
  saveButtonConf,
  loadButtonConf,
  {
    id: 'delete',
    icon: 'lucide:trash-2',
    name: t('workbench.deleteSelected'),
    shortcut: 'X',
    shortcutLabel: t('shortcutCheatsheet.deleteSelected'),
    description: `<el-text>${t('workbench.deleteSelectedDesc')}</el-text>`,
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete' })
    }
  },
  {
    id: 'delete-all',
    icon: 'lucide:trash-2',
    name: t('workbench.deleteFrame'),
    shortcut: 'Shift+X',
    shortcutLabel: t('shortcutCheatsheet.deleteAll'),
    description: `<el-text>${t('workbench.deleteFrameDesc')}</el-text>`,
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete-all' })
    }
  }
  ,
  {
    id: 'delete-seq-all',
    icon: 'lucide:database',
    name: t('workbench.deleteTask'),
    shortcut: 'Shift+X',
    shortcutLabel: t('shortcutCheatsheet.deleteTask'),
    description: `<el-text>${t('workbench.deleteTaskDesc')}</el-text>`,
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete-seq-all' })
    }
  }
]

const saveLabel = () => {
  saveButtonConf.loading = true
  const frame_labels = globalStates.mainAnnoater.export('updated')

  // 要删除的数据
  globalStates.mainAnnoater.deletedObjs?.forEach((v, k) => {
    frame_labels.push({ ...v.userData.anno, 'attributes': {'op_type': 'remove'}})
  })

  if (frame_labels.length === 0) {
    saveButtonConf.loading = false
    return
  }

  labelApi.save({
      frame_labels,
      jobConfig: jobConfig,
      current_mission: labelerState.currentMission,
      current_tool: globalStates.mainTool
    })
    .then((res) => {
      // messages.lastSuccess = t('statusBar.saveSuccess', { frame: jobConfig.frame, count: frame_labels.length })
      ElMessage.success(t('statusBar.saveSuccess', { frame: jobConfig.frame }) + res.statusText)
      globalStates.mainAnnoater.deletedObjs?.clear()
      loadAnnos()
    })
    .catch(() => {
      ElMessage.error(t('statusBar.saveFailed'))
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
    current_mission: labelerState.currentMission,
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
      ElMessageBox.confirm(t('workbench.deleteConfirm'), t('result.warningTitle'), {
        distinguishCancelAndClose: true,
        confirmButtonText: t('workbench.yes'),
        cancelButtonText: t('workbench.no')
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          messages.lastInfo = t('workbench.clearFrame')
        })
        .catch((action: Action) => {
          if (action === 'cancel') {
            // do nothing
          }
        })
      break
    case 'delete-seq-all':
      ElMessageBox.confirm(t('workbench.deleteTaskConfirm'), t('result.warningTitle'), {
        distinguishCancelAndClose: true,
        confirmButtonText: t('workbench.yes'),
        cancelButtonText: t('workbench.no')
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          labelApi.deleteSeqAll({
              jobConfig: jobConfig,
              current_mission: jobConfig.mission,
              // current_mission: labelerState.currentMission,
          }).then(() => {
            commonChannel.pub(commonChannel.Events.UpdateObjectCounts, {})
            ElMessage.success(t('workbench.deleteSuccess'))
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
  const filterdButtns = commonButtons.filter((btn) => btn.shortcut && btn.shortcut !== '')
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
