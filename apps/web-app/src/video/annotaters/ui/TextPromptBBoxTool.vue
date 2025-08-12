<template>
  <el-tooltip
    v-if="toolVisible"
    placement="bottom-start"
    raw-content
    :content="formatTooltipContent(toolConf)"
  >
    <el-button type="primary" :style="toolConf.style" @click="toolButtonClick(toolConf.id)" disabled>
      <Icon :icon="toolConf.icon" />
    </el-button>
  </el-tooltip>
  <Teleport to="#_Draggable_teleport">
    <Draggable
      v-slot="{ x, y }"
      class="fixed"
      :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
      :prevent-default="true"
      :storage-key="'yh-vd-tool-pos-' + toolConf.id"
      storage-type="session"
      :handle="dragHandle"
      v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings"
      :resizeable="true"
      :style="[topDivStyle]"
    >
      <div ref="dragHandle" class="cursor-move" style="text-align: center">
        {{ toolConf.name }} {{ toolConf.shortcut }}
      </div>
      <el-card>
        <el-row style="width: 100%">
          <el-col :span="6">
            <el-text>输出类型：</el-text> </el-col
          ><el-col :span="12">
            <el-select
              size="small"
              v-model="textPromptBBoxOptions.options.outGeometryType"
              placeholder="输出结果"
            >
              <el-option :value="OlTypeEnum.BBox" :label="'2D框'"></el-option>
              <el-option :value="OlTypeEnum.RBBox" :label="'2D旋转框'"></el-option>
            </el-select>
          </el-col>
          <el-col :span="6"
            ><el-button
              type="primary"
              size="small"
              @click="btnClik()"
              :loading="textPromptBBoxOptions.options.calling"
              >确定</el-button
            ></el-col
          >
        </el-row>

        <el-row>
          <el-col :span="6">
            <el-text>当前图片：</el-text> </el-col
          ><el-col :span="18">
            <el-input readonly v-model="globalStates.current_data.image_uri" />
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="6">
            <el-text>提示：</el-text> </el-col
          ><el-col :span="18">
            <el-input v-model="textPromptBBoxOptions.text_prompt" />
          </el-col>
        </el-row>
      </el-card>
    </Draggable>
  </Teleport>
</template>
<script lang="tsx" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import {
  textPromoteBBoxToolConf,
  textPromptBBoxOptions
} from '@/video/annotaters/textPromptBBoxTool'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'
import { OlTypeEnum } from '@/openlabel'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'

const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)

const toolConf = ref(textPromoteBBoxToolConf)
const toolVisible = ref(true)

const btnClik = () => {
  textPromptBBoxOptions.doAction += 1
}
const activated = computed(() => {
  return globalStates.subTool === textPromoteBBoxToolConf.id
})


onMounted(() => {
  switch (jobConfig.mission) {
    case Mission.ObjectBBox2d:
      textPromptBBoxOptions.options.outGeometryType = OlTypeEnum.BBox
      break;
    case Mission.ObjectRBBox2d:
      textPromptBBoxOptions.options.outGeometryType = OlTypeEnum.RBBox
      break;
    // case Mission.Semantic2d:
    //   textPromptBBoxOptions.options.outGeometryType = OlTypeEnum.Mask2dBase64
    //   break;
    default:
      break;
  }
})

</script>
<style scoped>
.el-form-item {
  margin-bottom: 0px;
}
</style>
