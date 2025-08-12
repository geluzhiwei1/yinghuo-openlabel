<template>
    <el-tooltip v-if="toolVisible" placement="bottom-start" raw-content :content="tooltipText">
        <el-button type="primary" :style="{ color: globalStates.subTool === 'bboxBuilder' ? 'blue' : '' }"
            @click="toolConf.shortcutCallback()">
            <Icon :icon="toolConf.icon" />
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
            <el-text>
                <ol>
                <li>移动鼠标到目标左上点，单击开始拉框</li>
                <li>再移动鼠标到目标右下点，单击完成</li>
            </ol></el-text>
            <VueForm label-width="auto" 
                v-model="toolOptions.settingFormData" :schema="settingUI.schema"
                :formProps="{ labelPosition: 'right', layoutColumn: 1 }" :formFooter="{ show: false }"
                @change="handleProptertyFormChange" />
        </el-card>
    </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref, watch } from 'vue'
import {
    ElButton,
    ElTooltip,
    ElCol,
    ElRow,
} from 'element-plus'
import VueForm from '@lljj/vue3-form-element'
import { Icon } from '@iconify/vue'
import { formatTooltipContent, toolButtonClick } from './utils'
import { globalStates } from '@/states'
import { bboxBuilderOptions as toolOptions, settingUI, toolBarConf as toolConf } from '@/video/annotaters/bboxBuilder'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'

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

const tooltipText = computed(() => {
    return formatTooltipContent(toolConf)
})

const handleProptertyFormChange = (formData: any) => {
}

</script>
<style scoped>
.el-form-item {
    margin-bottom: 0px;
}
</style>