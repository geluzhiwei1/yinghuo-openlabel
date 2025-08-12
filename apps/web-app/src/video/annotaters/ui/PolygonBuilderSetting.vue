<template>
    <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
        <el-button :type="activated ? 'success' : 'primary'" @click="toolButtonClick(toolConf.id)">
            <Icon :icon="toolConf.icon" />
        </el-button>
    </el-tooltip>
    <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
        :prevent-default="true" :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session" :handle="dragHandle"
        v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings" :resizeable="true" :style="[topDivStyle]">
        <div ref="dragHandle" class="cursor-move" :handle="dragHandle">
            {{ toolConf.name }}
        </div>
        <el-card>
            <VueForm size="small" label-width="100px" 
                v-model="polygonBuilderOptions.settingFormData" :schema="ui.schema"
                :formProps="{ labelPosition: 'left', layoutColumn: 1 }" :formFooter="{ show: false }" />
            <el-row>
                <ol style="text-align: left;">
                    <li>单击鼠标左键选点，开始勾画目标</li>
                    <li>敲击Z键，取消上次画的点</li>
                    <li>敲击Space键，完成绘制</li>
                    <li>再次敲击Space键，重新开始</li>
                </ol>
            </el-row>
        </el-card>
    </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { formatTooltipContent, toolButtonClick } from './utils'
import { polygonBuilderOptions, ui, polygonBuilderConf } from '@/video/annotaters/polygonBuilder'
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

const toolConf = ref(polygonBuilderConf)
const activated = computed(() => {
    return (globalStates.subTool === polygonBuilderConf.id)
})
</script>
