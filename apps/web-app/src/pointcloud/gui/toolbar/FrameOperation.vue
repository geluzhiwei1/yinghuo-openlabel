<template>
  <el-button-group>
    <el-tooltip placement="bottom-start" raw-content :content="'<span>' + item.name + '</br>' + item.description + '</span>'
      " v-for="(item, index) in frameNaviButtons" :key="index">
      <el-button type="primary" @click="handleImageOp(item.id)">
        <Icon :icon="item.icon" />
      </el-button>
    </el-tooltip>
  </el-button-group>
  <el-button-group>
    <el-popover placement="bottom" :width="400" trigger="click" :auto-close="false" :teleported="true" popper-class="y-toolbar-popper">
      <template #reference>
        <el-button type="primary">{{ t('workbench.show') }}</el-button>
      </template>
      <div><PointToolSetting></PointToolSetting>
      </div>
    </el-popover>
  <el-dropdown split-button type="primary" :teleported="true" popper-class="y-toolbar-popper" @command="pcViewButtonClick">
      {{ t('workbench.viewAngle') }}
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="topView">Z+</el-dropdown-item>
          <el-dropdown-item command="leftView">Y+</el-dropdown-item>
          <el-dropdown-item command="backView">X+</el-dropdown-item>
          <el-dropdown-item command="resetView">{{ t('workbench.reset') }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-button-group>
</template>

<script lang="tsx" setup>
import { ref, watch, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import _ from 'lodash'
import { hotkeysManager } from '../../hotkeysManager'
import { commonChannel } from '../../channel'
import { eventBus } from '../../event/EventBus'
import { i18n } from '@/locales'
import PointToolSetting from './PointCloudSetting.vue'

const t = (key: string) => i18n.global.t(key)

const frameNaviButtons = [
  {
    id: 'image-first',
    icon: 'uis:previous',
    name: t('workbench.firstFrame'),
    shortcut: '',
    description: `<el-text>${t('workbench.jumpFirst')}</el-text>`,
    showButton: true,
    handle: () => {}
  },
  {
    id: 'image-previous',
    icon: 'uis:angle-left',
    name: t('workbench.prevFrame'),
    shortcut: 'R',
    description: `<el-text>${t('workbench.jumpPrev')}</el-text>`,
    showButton: true,
    handle: () => {}
  },
  {
    id: 'image-next',
    icon: 'uis:angle-right',
    name: t('workbench.nextFrame'),
    shortcut: 'F',
    description: `<el-text>${t('workbench.jumpNext')}</el-text>`,
    showButton: true,
    handle: () => {}
  },
  {
    id: 'image-last',
    icon: 'uis:step-forward',
    name: t('workbench.lastFrame'),
    shortcut: '',
    description: `<el-text>${t('workbench.jumpLast')}</el-text>`,
    showButton: true,
    handle: () => {}
  }
]
const pcViewButtonClick = (command: string | number | object) => {
  eventBus.emit(eventBus.pcEditor.MainViewChange, command)
}

const default_image_attibute = {
  filterValues: {
    contrast: {
      enabled: false,
      prop: 'contrast',
      value: 0
    },
    saturation: {
      enabled: false,
      prop: 'saturation',
      value: 0
    },
    brightness: {
      enabled: false,
      prop: 'brightness',
      value: 0
    },
    hue: {
      enabled: false,
      prop: 'rotation',
      value: 0
    },
    pixelate: {
      enabled: false,
      prop: 'blocksize',
      value: 1,
    },
    grayscale: {
      enabled: false,
      prop: 'mode',
      value: 'average',
    },
    blackwhite: {
      enabled: false,
    }
  },
  zoomRatio: 1,
  isOriginalSize: false
}
const imgAttribute = ref(_.cloneDeep(default_image_attibute))

watch(
  imgAttribute,
  () => {
    globalStates.toolsManager!.get("imageCanvas")?.filterImage(imgAttribute.value)
  },
  { deep: true }
)

const handleImageOp = (op: string) => {
  switch (op) {
    case 'image-next':
    case 'image-last':
    case 'image-previous':
    case 'image-first':
      {
        // 发送消息
        commonChannel.pub(commonChannel.Events.ButtonClicked, { type: 'image-op', data: op })
      }
      break
  }
}


const init = () => {
  const filterdButtns = frameNaviButtons.filter((btn) => btn.shortcut && (btn.shortcut !== ''))
  const keys = filterdButtns.map((btn) => btn.shortcut)
  const handles = filterdButtns.map((btn) => () => handleImageOp(btn.id))

  keys.forEach((key, index) => {
    hotkeysManager.registerHotkeys({ toolId: 'imageOp', keys: key, cb: handles[index] })
  })
}

onMounted(() => {
  init()
})

</script>
