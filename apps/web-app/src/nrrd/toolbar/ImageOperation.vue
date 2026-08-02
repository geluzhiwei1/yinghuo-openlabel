<template>
  <el-button-group>
    <!-- <el-button type="primary" @click.stop="handleImageOp('rotateLeft')">
      <Icon size="16" icon="lucide:rotate-ccw" />
    </el-button>
    <el-button type="primary" @click.stop="handleImageOp('rotateRight')">
      <Icon size="16" icon="lucide:rotate-cw" />
    </el-button> -->
    <el-tooltip placement="bottom-start" raw-content :content="'<span>' + item.name + '</br>' + item.description + '</br>' + item.shortcutLabel + '</span>'
      " v-for="(item, index) in imageButtons" :key="index">
      <el-button type="primary" @click="handleImageOp(item.id)">
        <Icon :icon="item.icon" />
      </el-button>
    </el-tooltip>
    <el-popover placement="bottom" width="550" trigger="hover" :teleported="true" popper-class="y-toolbar-popper">
      <template #reference>
        <el-button type="primary">
          <Icon icon="lucide:arrow-down" class="el-icon--right" />
        </el-button>
      </template>
      <div>
        <el-form :model="imgAttribute">
          <el-form-item :label="t('nrrd.grayscale')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.grayscale.enabled" />
              </el-col>
              <el-col :span="20">
                <el-radio-group v-model="imgAttribute.filterValues.grayscale.value">
                  <el-radio value="average">average</el-radio>
                  <el-radio value="lightness">lightness</el-radio>
                  <el-radio value="luminosity">luminosity</el-radio>
                </el-radio-group>
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('nrrd.blackWhite')">
            <el-switch v-model="imgAttribute.filterValues.blackwhite.enabled" />
          </el-form-item>
          <el-form-item :label="t('nrrd.saturation')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.saturation.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.saturation.value" :step="0.003" :max="1" :min="-1"
                  show-input />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('nrrd.contrast')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.contrast.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.contrast.value" :step="0.003" :max="1" :min="-1"
                  show-input />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('nrrd.brightness')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.brightness.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.brightness.value" :step="0.003" :max="1" :min="-1"
                  show-input />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('nrrd.hue')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.hue.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.hue.value" :step="0.002" :max="2" :min="-2" show-input />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('nrrd.pixelate')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.pixelate.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.pixelate.value" :step="1" :max="20" :min="1" show-input />
              </el-col>
            </el-row>
          </el-form-item>
        </el-form>
      </div>
    </el-popover>
  </el-button-group>
</template>

<script lang="tsx" setup>
import { ref, watch, onMounted } from 'vue'
import _ from 'lodash'
import { Icon } from '@iconify/vue'
import {
  ElSlider, ElRow, ElCol, ElSwitch, ElRadioGroup, ElRadio,
    ElPopover,
  ElButton,
  ElButtonGroup,
  ElForm,
  ElFormItem
} from 'element-plus'
// import { imageButtons } from '@/video/constant'
import { hotkeysManager } from '../hotkeysManager'
import { commonChannel } from '../channel'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)


const imageButtons = [
  {
    id: 'image-reset',
    icon: 'ix:hard-reset',
    name: t('workbench.restoreImage'),
    shortcut: '',
    shortcutLabel: '',
    description: `<el-text>${t('workbench.restoreImageDesc')}</el-text>`,
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-reset' })
    }
  },]

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
    case 'image-reset':
      globalStates.toolsManager!.get("imageCanvas").reset()
      break
    case 'rotateLeft':
      globalStates.toolsManager!.baseCanvas.rotate(-90, globalStates.toolsManager!.get("imageCanvas").imageObj.getCenterPoint())
      break
    case 'rotateRight':
      globalStates.toolsManager!.baseCanvas.rotate(90, globalStates.toolsManager!.get("imageCanvas").imageObj.getCenterPoint())
      break
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
  const filterdButtns = imageButtons.filter((btn) => btn.shortcut && (btn.shortcut !== ''))
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
