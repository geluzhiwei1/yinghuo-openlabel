<template>
  <!-- <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
    <el-button :type="activated ? 'success' : 'primary'" @click="toolButtonClick(toolConf.id)">
      <Icon :icon="toolConf.icon" />
    </el-button>
  </el-tooltip> -->
  <el-popover placement="bottom" :width="400" trigger="hover">
      <template #reference>
        <el-button :type="activated ? 'success' : 'primary'">
          <Icon :icon="toolConf.icon" />
        </el-button>
      </template>
      <div>
        <div v-html="formatTooltipContent(toolConf)"></div>
        <el-button type="primary" size="small" @click="toolButtonClick(toolConf.id)">新建掩膜Mask</el-button>
      </div>
    </el-popover>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session" v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings"
    :resizeable="true" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move">
      {{ toolConf.name }}
    </div>
    <el-card>
      <!-- <VueForm label-width="100px" class="myclass" v-model="toolOptions.settingFormData" :schema="toolSettingUi.schema"
        :formProps="{ labelPosition: 'right', layoutColumn: 1 }" :formFooter="{ show: false }" /> -->
        <el-button-group>
          <el-button size="small" @click="freeDrawOptions.brushType = 'brush'" :type="freeDrawOptions.brushType === 'brush' ? 'success' : ''">画刷(1)</el-button>
          <el-button size="small" @click="freeDrawOptions.brushType = 'eraser'" :type="freeDrawOptions.brushType === 'eraser' ? 'success' : ''">擦除(2)</el-button>
          <el-button size="small" @click="freeDrawOptions.brushType = ''" :type="freeDrawOptions.brushType === '' ? 'success' : ''">鼠标(3)</el-button>
        </el-button-group>
        <div v-show="freeDrawOptions.brushType === 'brush'">
          <el-row style="width: 100%">
            <el-col :span="8">大小</el-col>
            <el-col :span="16">
              <el-slider size="small" v-model="freeDrawOptions.brush.width" :min="1" :max="100" />
            </el-col>
          </el-row>
          <el-row style="width: 100%" >
            <el-col :span="8">颜色</el-col>
            <el-col :span="16">
              <el-color-picker v-model="freeDrawOptions.brush.color" show-alpha/>
            </el-col>
          </el-row>
        </div>
        <div v-show="freeDrawOptions.brushType === 'eraser'">
          <el-row style="width: 100%" >
            <el-col :span="8">大小</el-col>
            <el-col :span="16">
              <el-slider size="small" v-model="freeDrawOptions.eraser.width" :min="1" :max="100" />
            </el-col>
          </el-row>
          <el-row style="width: 100%" >
            <el-col :span="8">颜色</el-col>
            <el-col :span="16">
              <el-color-picker v-model="freeDrawOptions.eraser.color"/>
            </el-col>
          </el-row>
        </div>
        <!-- <el-row style="width: 100%" >
          <el-col :span="8">鼠标颜色</el-col>
            <el-col :span="16">
            <el-color-picker v-model="freeDrawOptions.cursor.fill" show-alpha/>
          </el-col>
        </el-row> -->
      <el-row>
          <ol style="text-align: left;">
            <li>敲击1、2、3键，切换模式</li>
            <li>敲击Space或Enter键，完成</li>
            <li>敲击键盘A/D调整画笔大小</li>
          </ol>
      </el-row>
    </el-card>
  </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref } from 'vue'
import { formatTooltipContent, toolButtonClick } from './utils'
import { toolConf } from '../maskBrush'
import { ElRow, ElCol, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem } from 'element-plus'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'
import { freeDrawOptions } from '@/libs/free-draw'

const dragHandle = ref<HTMLElement | null>(null)
const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const activated = computed(() => {
  return globalStates.subTool === toolConf.id
})
</script>
