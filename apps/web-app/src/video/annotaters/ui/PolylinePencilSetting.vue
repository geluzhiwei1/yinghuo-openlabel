<template>
  <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
    <el-button :type="activated ? 'success' : 'primary'" @click="toolButtonClick(toolConf.id)">
      <Icon :icon="toolConf.icon" />
    </el-button>
  </el-tooltip>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session"
    v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings" :resizeable="true"
    :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move">
      {{ toolConf.name }}
    </div>
    <el-card>
      <VueForm label-width="auto" class="myclass" v-model="toolOptions.settingFormData" :schema="toolSettingUi.schema"
        :formProps="{ labelPosition: 'right', layoutColumn: 1 }" :formFooter="{ show: false }" size="small" />
      <el-row>
        <ol style="text-align: left;">
          <li>按住Ctrl键，移动鼠标</li>
          <li>敲击Z键，取消之前画的点</li>
          <li>敲击Space或Enter键，完成绘制</li>
          <li>再次敲击Space键，重新开始</li>
        </ol>
      </el-row>
    </el-card>
  </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { formatTooltipContent, toolButtonClick } from './utils'
import { toolOptions, toolSettingUi, toolConf } from '../polylinePencil'
import { ElRow, ElCol, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem } from 'element-plus'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'

const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)
const settingOptionsVisible = ref(false)
const activated = computed(() => {
  return globalStates.subTool === toolConf.id
})
</script>
