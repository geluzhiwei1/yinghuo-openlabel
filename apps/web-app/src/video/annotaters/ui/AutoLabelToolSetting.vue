<template>
  <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(currentTool)">
    <el-button :type="activated ? 'success' : 'primary'"  @click="toolConf.shortcutCallback()" disabled>
          <Icon :icon="currentTool.icon" />
    </el-button>
  </el-tooltip>
  <Teleport to="#_Draggable_teleport">
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session" v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings"
    :resizeable="true" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move" style="text-align:center">
      {{ toolConf.name }} {{ toolConf.shortcut }}
    </div>
    <el-card>
      <el-row style="width: 100%"><el-text>
          模型：{{ funcsApiState.selectedApi ? funcsApiState.selectedApi.api_group + "-" +
            funcsApiState.selectedApi.api_id : "未选择" }}</el-text><el-button size="small" @click="btnClik('showModelSelector')" plain>选择模型</el-button>
        </el-row>
        <el-row style="width: 100%">
          <el-col :span="6">
            <el-text>输出类型：</el-text>
          </el-col><el-col :span="12">
             <el-select size="small" v-model="toolStates.setting.outGeometryType"  placeholder="输出结果">
              <el-option :value="OlTypeEnum.BBox" :label="'2D框'"></el-option>
              <el-option :value="OlTypeEnum.RBBox" :label="'2D旋转框'"></el-option>
              <el-option :value="OlTypeEnum.Mask2dBase64" :label="'掩码'"></el-option>
            </el-select>
          </el-col>
          <el-col :span="6"><el-button type="primary" size="small" @click="btnClik('doRequest')" 
            :disabled="!funcsApiState.selectedApi">确定</el-button></el-col>
        </el-row>
      <VueForm size="small" id="propertyForm" ref="propertyForm" label-width="auto" v-model="toolOptions.apiParams.formData"
        :schema="toolOptions.apiParamsUI.schema" :formProps="{ labelPosition: 'right', layoutColumn: 1}"
        :formFooter="{ show: false }" />
    </el-card>
  </Draggable>
</Teleport>
</template>
<script lang="tsx" setup>
import { ref, computed, onMounted } from 'vue'
import {
  ElTag, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem, ElCol, ElRow,
} from 'element-plus'
import { Icon } from '@iconify/vue'
import VueForm from '@lljj/vue3-form-element'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import { funcsApiState, autoLabelToolConf as toolConf, autoLabelToolOptions as toolOptions } from '@/video/annotaters/autoLabelTool'
import { dnnModelSelectorState } from '@/components/dnn'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'
import { toolStates } from '../autoLabelTool'
import { OlTypeEnum } from '@/openlabel'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'

const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)

const currentTool = ref(toolConf)
const modelLoaded = ref(false)

const activated = computed(() => {
  return globalStates.subTool === toolConf.id
})

const btnClik = (cmdId: string) => {
  switch (cmdId) {
    case 'doRequest':
      toolOptions.doAction += 1
      break
    case 'showModelSelector':
      dnnModelSelectorState.onOk = () => {
        funcsApiState.selectedApi = dnnModelSelectorState.selectedApi
        dnnModelSelectorState.dialogVisible = false
        modelLoaded.value = true
      }
      dnnModelSelectorState.dialogVisible = true
      break
    default:
      break
  }
}

onMounted(() => {
  switch (jobConfig.mission) {
    case Mission.ObjectBBox2d:
      toolStates.setting.outGeometryType = OlTypeEnum.BBox
      break;
    case Mission.ObjectRBBox2d:
      toolStates.setting.outGeometryType = OlTypeEnum.RBBox
      break;
    case Mission.Semantic2d:
      toolStates.setting.outGeometryType = OlTypeEnum.Mask2dBase64
      break;
    default:
      break;
  }
})

</script>
