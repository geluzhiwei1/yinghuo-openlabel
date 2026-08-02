<template>
  <el-button-group>
    <el-tooltip placement="bottom-start" raw-content :content="'<span>' + item.name + '</br>' + item.description + '</br> ' + item.shortcutLabel + '</span>'
      " v-for="(item, index) in toolButtons" :key="index">
      <el-button type="primary" :style="{color: globalStates.mainTool === item.id ? 'blue' : ''}" @click="handleButtonClick(item.id)">
        <!-- <Icon :icon="item.icon" /> -->{{ item.name }}
      </el-button>
    </el-tooltip>
    <el-popover placement="bottom" :width="400" trigger="click" :auto-close="false" :teleported="true" popper-class="y-toolbar-popper">
      <template #reference>
        <el-button type="primary">{{ t('workbench.settings') }}</el-button>
      </template>
      <div>
        <!-- <PointToolSetting></PointToolSetting> -->
        <PolylineToolSetting></PolylineToolSetting>
      </div>
    </el-popover>
  </el-button-group>
</template>
<script lang="tsx" setup>
import { ElButtonGroup } from 'element-plus'
import { globalStates } from '@/states'
import { Icon } from '@iconify/vue'
import { useAppState } from '../store'
import { ElMessage, ElMessageBox } from 'element-plus'
// import { ToolsManager } from '../tools/tools-manager'
import { eventBus } from '../event-bus'
import { i18n } from '@/locales'
// import PointToolSetting from '../tools/ui/PointToolSetting.vue'
// import PolylineToolSetting from '../tools/ui/PolylineToolSetting.vue'

const t = (key: string) => i18n.global.t(key)


const { labelAppStatus, shortcuts } = useAppState()

const toolButtons = [
  // {
  //   id: 'mouseSelectTool',
  //   icon: 'lucide:pen-line',
  //   name: t('workbench.select'),
  //   shortcut: 'A',
  //   shortcutLabel: t('shortcutCheatsheet.rotatePan'),
  //   description: '<el-text>按下左键旋转，滚轮缩放，按下右键拖动</el-text>',
  //   showButton: true,
  //   handler: () => { },
  // },
  {
    id: 'box3dTool',
    icon: 'lucide:pen-line',
    name: t('workbench.box3d'),
    shortcut: 'D',
    shortcutLabel: t('shortcutCheatsheet.box3dTool'),
    description: `<el-text>${t('workbench.box3dDesc')}</el-text>`,
    showButton: true,
    handler: () => { },
  },
  // {
  //   id: 'pointTool',
  //   icon: 'lucide:mouse-pointer-click',
  //   name: t('workbench.point3d'),
  //   shortcut: 'Shift + 右击',
  //   shortcutLabel: t('shortcutCheatsheet.point3dTool'),
  //   description: '<el-text>移动鼠标指针到目标，按下Shift，同时单击右键</el-text>',
  //   showButton: true,
  //   handler: () => { },
  // },
  // {
  //   id: 'polylineTool',
  //   icon: 'lets-icons:3d-box',
  //   name: t('workbench.line3d'),
  //   shortcut: 'T',
  //   shortcutLabel: t('shortcutCheatsheet.polylineTool'),
  //   description: '选中一个框后，按键盘T，自动框选同类别',
  //   showButton: true,
  //   handler: () => { },
  // }
]


// const toolsManager = new ToolsManager()
const handleButtonClick = (btnId) => {
  switch (btnId) {
    // case 'mouseSelectTool':
    //   toolsManager.activate('mouseSelectTool')
    //   labelAppStatus.currentSubTool = 'mouseSelectTool'
    //   break
    case 'delete':
      eventBus.emit(eventBus.Box3d.RemoveSeleted, 'delete')
      break
    case 'delete-all':
      ElMessageBox.confirm(
        t('workbench.deleteConfirm'),
        t('result.warningTitle'),
        {
          confirmButtonText: t('workbench.yes'),
          cancelButtonText: t('workbench.no'),
          type: 'warning',
        }
      )
        .then(() => {
          eventBus.emit(eventBus.Box3d.RemoveFrameAll)
        })
        .catch(() => {
          ElMessage({
            type: 'info',
            message: t('workbench.deleteAbnormal'),
          })
        })
      break
    // case 'mouseSelectTool':
    case 'box3dTool':
    case 'polylineTool':
      globalStates.mainTool = btnId
      break
    default:
      break
  }
}

const hoverStyle = (subTool: string = '') => {
  return {
    color: globalStates.mainTool === subTool ? 'blue' : ''
  }
}
</script>
