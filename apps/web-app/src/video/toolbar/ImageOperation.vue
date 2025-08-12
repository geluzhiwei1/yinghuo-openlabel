<template>
      <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary">
          {{ $t('video.toolbar.navigation') }}
        </el-button>
      </template>
      <div style="text-align: center">
        <el-button-group>
          <el-tooltip placement="bottom-start" raw-content :content="'<span>' + $t(item.name) + '</br>' + $t(item.description) + '</br> 快捷键：' + item.shortcut + '</span>'
            " v-for="(item, index) in naviButtons" :key="index">
            <el-button type="primary" @click="handleImageOp(item.id)">
              <Icon :icon="item.icon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </el-popover>
  <el-button-group v-if="jobConfig.mission !== Mission.VideoEvents">
    <!-- <el-button type="primary" @click.stop="handleImageOp('rotateLeft')">
      <Icon size="16" icon="zmdi:rotate-left" />
    </el-button>
    <el-button type="primary" @click.stop="handleImageOp('rotateRight')">
      <Icon size="16" icon="zmdi:rotate-right" />
    </el-button> -->
    <el-tooltip placement="bottom-start" raw-content :content="'<span>' + $t(item.name) + '</br>' + $t(item.description) + '</br> 快捷键：' + item.shortcut + '</span>'
      " v-for="(item, index) in imageButtons" :key="index">
      <el-button type="primary" @click="handleImageOp(item.id)">
        <Icon :icon="item.icon" />
      </el-button>
    </el-tooltip>
    <el-popover placement="bottom" width="550" trigger="hover">
      <template #reference>
        <el-button type="primary">
          <el-icon class="el-icon--right">
            <Icon :icon="'mdi:image-edit-outline'" />
          </el-icon>
        </el-button>
      </template>
      <div>
        <el-form :model="imgAttribute">
          <el-form-item :label="$t('video.toolbar.grayscale')">
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
          <el-form-item :label="$t('video.toolbar.blackAndWhite')">
            <el-switch v-model="imgAttribute.filterValues.blackwhite.enabled" />
          </el-form-item>
          <el-form-item :label="$t('video.toolbar.saturation')">
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
          <el-form-item :label="$t('video.toolbar.contrast')">
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
          <el-form-item :label="$t('video.toolbar.brightness')">
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
          <el-form-item :label="$t('video.toolbar.hue')">
            <el-row style="width:100%">
              <el-col :span="4">
                <el-switch v-model="imgAttribute.filterValues.hue.enabled" />
              </el-col>
              <el-col :span="20">
                <el-slider v-model="imgAttribute.filterValues.hue.value" :step="0.002" :max="2" :min="-2" show-input />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="$t('video.toolbar.pixelate')">
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
import { ArrowDown } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import {
  ElSlider, ElRow, ElCol, ElSwitch, ElRadioGroup, ElRadio,
  ElIcon,
  ElPopover,
  ElButton,
  ElButtonGroup,
  ElForm,
  ElFormItem
} from 'element-plus'
import { imageButtons, naviButtons } from '@/video/constant'
import { hotkeysManager } from '../hotkeysManager'
import { commonChannel } from '../channel'
import { Mission } from '@/constants'
import { jobConfig } from '@/states/job-config'
import { globalStates } from '@/states'


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
    globalStates.toolsets!.get("imageCanvas")?.filterImage(imgAttribute.value)
  },
  { deep: true }
)

const handleImageOp = (op: string) => {
  switch (op) {
    case 'image-reset':
      globalStates.toolsets!.get("imageCanvas").reset()
      break
    case 'rotateLeft':
      globalStates.toolsets!.renderHelper.rotate(-90, globalStates.toolsets!.get("imageCanvas").imageObj.getCenterPoint())
      break
    case 'rotateRight':
      globalStates.toolsets!.renderHelper.rotate(90, globalStates.toolsets!.get("imageCanvas").imageObj.getCenterPoint())
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
  const buttons = [...imageButtons, ...naviButtons]
  const filterdButtns = buttons.filter((btn) => btn.shortcut && (btn.shortcut !== ''))
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
