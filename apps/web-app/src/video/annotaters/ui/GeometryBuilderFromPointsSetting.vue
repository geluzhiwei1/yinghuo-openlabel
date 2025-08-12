<template>
  <el-tooltip v-if="toolVisible" placement="bottom-start" raw-content
    :content="toolOptions.enabled ? formatTooltipContent(currentTool) : '正在加载WASM组件...'">
    <el-button type="primary" :style="currentTool.style" @click="toolButtonClick(currentTool.id)"
      :disabled="!toolOptions.enabled">
      <Icon :icon="currentTool.icon" />
    </el-button>
  </el-tooltip>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session"
    v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings" :resizeable="true"
    :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move">
      {{ toolConf.name }} {{ toolConf.shortcut }}
    </div>
      <el-card>
        <el-text>在目标左、上、右、下方最外侧点击，敲击<el-tag>Space</el-tag>完成</el-text>
        <el-form label-width="auto" class="myclass">
          <el-form-item label="点数限制">
            <el-slider range show-stops v-model="toolOptions.seting.pointCount"
              :max="toolOptions.seting.pointCountMax"></el-slider>
          </el-form-item>
        </el-form>
        <VueForm label-width="auto" class="myclass"
          v-model="toolOptions.settingFormData" :schema="ui.schema"
          :formProps="{ labelPosition: 'right', layoutColumn: 1 }" :formFooter="{ show: false }"
          @change="handleProptertyFormChange" />
      </el-card>
  </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import VueForm from '@lljj/vue3-form-element'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import { toolConf, toolOptions, ui } from '@/video/annotaters/geometryBuilderFromPoints'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'

const currentTool = ref(toolConf)
const toolVisible = ref(true)

const topDivStyle = ref({
    width: toolSettingLayer.width_px + 'px',
    zIndex: 1000,
    boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)
const activated = computed(() => {
    return globalStates.subTool === toolConf.id
})
const handleProptertyFormChange = () => {
}

</script>
<style>
.myclass>.el-form-item {
  margin-bottom: 0px;
}
</style>