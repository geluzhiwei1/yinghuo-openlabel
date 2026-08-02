<template>
  <el-button-group>
    <el-tooltip
      placement="bottom-start"
      raw-content
      :content="
        '<span>' +
        item.name +
        '</br>' +
        item.description +
        '</span>'
      "
      v-for="(item, index) in toolButtons"
      :key="index"
    >
      <el-button
        type="primary"
        :style="{ color: globalStates.mainTool === item.id ? 'blue' : '' }"
        @click="handleButtonClick(item.id)"
      >
        <!-- <Icon :icon="item.icon" /> -->{{ item.name }}
      </el-button>
    </el-tooltip>
  </el-button-group>
</template>
<script lang="tsx" setup>
import { ElButtonGroup } from 'element-plus'
import { globalStates } from '@/states'
import { ElMessage, ElMessageBox } from 'element-plus'
import { eventBus } from '../../event/EventBus'
import { HotkeysManager } from '@/libs/hotkeys-manager'
import { i18n } from '@/locales'
import { Icon } from '@iconify/vue'

const t = (key: string) => i18n.global.t(key)

const toolButtons = [
  {
    id: 'box3dTool',
    icon: 'lucide:pen-line',
    name: t('workbench.box3d'),
    description: `<el-text>${t('workbench.box3dDesc')}</el-text>`,
    showButton: true,
    handler: () => {}
  },
  {
    id: 'polylineTool',
    icon: 'lets-icons:3d-box',
    name: t('workbench.line3d'),
    description: `<el-text>${t('workbench.line3dDesc')}</el-text>`,
    showButton: true,
    handler: () => {}
  },
  {
    id: 'point3dTool',
    icon: 'lucide:mouse-pointer-click',
    name: t('workbench.point3d'),
    description: `<el-text>${t('workbench.point3dDesc')}</el-text>`,
    showButton: true,
    handler: () => {}
  }
]

// // 遍历toolButtons，为每个按钮添加shortcut的handle
// toolButtons.forEach((btn) => {
//   if (btn.shortcut) {
//     hotkeys.registerHotkeys({
//       keys: btn.shortcut,
//       cb: () => {
//         toggleMainTool(btn.id)
//       },
//       toolId: 'pc-obj-bar'
//     })
//   }
// })

// const toolsManager = new ToolsManager()
const handleButtonClick = (btnId) => {
  switch (btnId) {
    case 'delete':
      eventBus.emit(eventBus.Box3d.RemoveSeleted, 'delete')
      break
    case 'delete-all':
      ElMessageBox.confirm('是否清除本帧所有数据?', 'Warning', {
        confirmButtonText: '是',
        cancelButtonText: '否',
        type: 'warning'
      })
        .then(() => {
          eventBus.emit(eventBus.Box3d.RemoveFrameAll)
        })
        .catch(() => {
          ElMessage({
            type: 'info',
            message: '删除异常'
          })
        })
      break
    case 'point3dTool':
    case 'box3dTool':
    case 'polylineTool':
      toggleMainTool(btnId)
      break
    default:
      break
  }
}

const toggleMainTool = (tool: string | undefined) => {
  if (globalStates.mainTool === tool) {
    globalStates.mainTool = undefined
  } else {
    globalStates.mainTool = tool
  }
}
</script>
