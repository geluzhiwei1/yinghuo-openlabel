<template>
  <el-button-group>
    <el-tooltip
      placement="bottom-start"
      raw-content
      :content="'<span>Undo' + '</br>' + '</br>快捷键：Ctrl + Z' + '</span>'"
    >
      <el-button type="primary" @click="unDoConf.handle()" :disabled="unDoConf.disabled.value">
        <Icon :icon="unDoConf.icon" />
      </el-button>
    </el-tooltip>
    <el-tooltip
      placement="bottom-start"
      raw-content
      :content="'<span>Redo' + '</br>' + '</br>快捷键：Ctrl + Y' + '</span>'"
    >
      <el-button type="primary" @click="reDoConf.handle()" :disabled="reDoConf.disabled.value">
        <Icon :icon="reDoConf.icon" />
      </el-button>
    </el-tooltip>
    <el-tooltip
      placement="bottom-start"
      raw-content
      :content="
        '<span>' +
        item.name +
        '</br>' +
        item.description +
        '</br>快捷键：' +
        item.shortcut +
        '</span>'
      "
      v-for="(item, index) in commonButtons"
      :key="index"
    >
      <el-button type="primary" @click="item.handle()" :loading="item.loading">
        <Icon :icon="item.icon" v-show="!item.loading" />
      </el-button>
    </el-tooltip>
    <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary"> 删 </el-button>
      </template>
      <div>
        <el-button-group>
          <el-tooltip
            placement="bottom-start"
            raw-content
            :content="
              '<span>' +
              item.name +
              '</br>' +
              item.description +
              '</br>快捷键：' +
              item.shortcut +
              '</span>'
            "
            v-for="(item, index) in delButtons"
            :key="index"
          >
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
/*
Copyright (C) 2025 undefined

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { computed, onMounted, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import _ from 'lodash'
import { Icon } from '@iconify/vue'
import { commonChannel } from '../video/channel'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'
import type { Action } from 'element-plus'
import { globalStates } from '@/states'
import { HotkeysManager } from '@/libs/hotkeys-manager'
import { messages } from '@/states'
import { listify } from 'radash'
import { userSettings } from '@/states/UserState'

const hotkeysManager = new HotkeysManager(false)

const unDoConf = {
  id: 'common-undo',
  icon: 'mynaui:undo',
  name: '取消上次',
  shortcut: 'Shift+Z',
  description: '<el-text>取消上次的编辑</el-text>',
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
  icon: 'mynaui:redo',
  name: '重做上次',
  shortcut: 'Shift+D',
  description: '<el-text>重做上次的编辑</el-text>',
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
  icon: 'mingcute:upload-3-line',
  name: '保存标注',
  shortcut: 'Shift+S',
  description: '<el-text>保存当前帧所有件</el-text>',
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'save-annotation' })
  }
})
const loadButtonConf = {
  id: 'load-annotation',
  icon: 'uis:refresh',
  name: '加载标注',
  shortcut: 'Shift+R',
  description: '<el-text>重新从后台加载已经保存的标签</el-text>',
  showButton: true,
  loading: false,
  handle: () => {
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'load-annotation' })
  }
}

const commonButtons = [saveButtonConf, loadButtonConf]

const delButtons = [
  {
    id: 'delete',
    icon: 'ep:delete',
    name: '删除选中',
    shortcut: 'X',
    description: '<el-text>删除选中件</el-text>',
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete' })
    }
  },
  {
    id: 'delete-all',
    icon: 'ep:delete-filled',
    name: '删除本帧',
    shortcut: 'Shift+X',
    description: '<el-text>清除本帧所有标注</el-text>',
    showButton: true,
    loading: false,
    handle: () => {
      commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'delete-all' })
    }
  },
  {
    id: 'delete-seq-all',
    icon: 'mdi:database-remove',
    name: '删除任务标签',
    shortcut: '',
    description: '<el-text>删除本任务所有标签</el-text>',
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
  globalStates.mainAnnoater.deletedObjs?.forEach((v: any) => {
    if (v.userData?.anno) {
      frame_labels.push({ ...v.userData.anno, attributes: { opType: 'remove' } })
    } else {
      frame_labels.push({ ...v, attributes: { opType: 'remove' } })
    }
  })

  if (frame_labels.length === 0) {
    messages.lastInfo = '没有修改，无需保存'
    saveButtonConf.loading = false
    return
  }

  labelApi
    .save({
      frame_labels,
      jobConfig: jobConfig,
      current_mission: jobConfig.mission,
      current_tool: globalStates.mainTool,
      frame_properties: {
        width: globalStates.imageObject?.width,
        height: globalStates.imageObject?.height,
        uri: globalStates.current_data?.image_uri
      }
    })
    .then((res: any) => {
      // messages.lastSuccess = `帧${jobConfig.frame}保存成功，共${frame_labels.length}个`
      ElMessage.success(`帧${jobConfig.frame}：` + res.statusText)
      globalStates.mainAnnoater.deletedObjs?.clear()
    })
    .catch(() => {
      ElMessage.error(`帧${jobConfig.frame}保存失败`)
    })
    .finally(() => {
      saveButtonConf.loading = false
    })
}

const loadAnnos = async () => {
  globalStates.anno.beforeLoadAnno += 1

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
    .then(async (res: any) => {
      const rtn = res.data
      if (_.isEmpty(rtn)) return
      for (const item of rtn) {
        if (jobConfig.frame === item.jobConfig.frame) {
          const datas = listify(item.frame_labels, (key, value) => value)
          await globalStates.mainAnnoater.import('default', datas)
        }
      }
      globalStates.anno.annoDataLoaded += 1
    })
    .finally(() => {
      loadButtonConf.loading = false
      globalStates.anno.afterLoadAnno += 1
    })
}
/**
 * 保存标签
 */
commonChannel.sub(commonChannel.Events.ButtonClicked, async (msg: any) => {
  switch (msg.data) {
    case 'common-undo':
      globalStates.mainAnnoater.undoLastOp()
      break
    case 'load-annotation':
      await loadAnnos()
      break
    case 'save-annotation':
      saveLabel()
      break
    case 'delete':
      globalStates.mainAnnoater.removeSelected()
      break
    case 'delete-all':
      ElMessageBox.confirm('是否删除？本操作将清空本帧所有已标注的数据。', 'Confirm', {
        distinguishCancelAndClose: true,
        confirmButtonText: '是',
        cancelButtonText: '否'
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          messages.lastInfo = '清空'
        })
        .catch((action: Action) => {
          if (action === 'cancel') {
            // do nothing
          }
        })
      break
    case 'delete-seq-all':
      ElMessageBox.confirm('本操作将清除本任务所有标签数据，无法恢复。是否删除？', 'Confirm', {
        distinguishCancelAndClose: true,
        confirmButtonText: '是',
        cancelButtonText: '否'
      })
        .then(() => {
          globalStates.mainAnnoater.cleanData()
          labelApi
            .deleteSeqAll({
              jobConfig: jobConfig,
              current_mission: jobConfig.mission
            })
            .then(() => {
              commonChannel.pub(commonChannel.Events.UpdateObjectCounts, {})
              ElMessage.success('删除成功')
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
watch(
  () => userSettings.value.savePerSeconds.enabled,
  (newVal, oldVal) => {
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
  },
  { immediate: true }
)

onMounted(() => {
  init()
})
</script>
