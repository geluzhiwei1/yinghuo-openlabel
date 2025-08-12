<template>
    <el-tooltip v-if="toolVisible" placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
        <el-button type="primary" :style="toolConf.style" @click="toolButtonClick(toolConf.id)">
            <Icon :icon="toolConf.icon" />
        </el-button>
    </el-tooltip>
    <Teleport to="#_Draggable_teleport">
    <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
        :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session"
        v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings" :resizeable="true"
        :style="[topDivStyle]" :handle="dragHandle">
        <div ref="dragHandle" class="cursor-move" style="text-align:center">
            {{ toolConf.name }} <el-tag>{{ toolConf.shortcut }}</el-tag>
        </div>
        <el-card>
            <el-form label-width="auto">
                        <el-form-item label="最小宽度">
                            <el-input-number v-model="builderOptions.rect.minWidth" :min="1"
                                :max="100"></el-input-number>
                        </el-form-item>
                        <el-form-item label="最小高度">
                            <el-input-number v-model="builderOptions.rect.minHeight" :min="1"
                                :max="100"></el-input-number>
                        </el-form-item>
                        <el-form-item label="线色">
                            <el-color-picker v-model="builderOptions.options.stroke" show-alpha />
                        </el-form-item>
                        <el-form-item label="线宽">
                            <el-input-number v-model="builderOptions.options.strokeWidth" :min="1"
                                :max="10"></el-input-number>
                        </el-form-item>
                        <el-form-item label="填充">
                            <el-color-picker v-model="builderOptions.options.fill" show-alpha />
                        </el-form-item>
                    </el-form>
        </el-card>
    </Draggable>
</Teleport>
</template>
<script lang="tsx" setup>
import { computed, ref, watch } from 'vue'
import { formatTooltipContent, toolButtonClick } from './utils'
import { rbboxBuilderTool as toolConf } from '@/video/annotaters/rbboxBuilder'
import {
    ElInputNumber,
    ElButton,
    ElTooltip,
    ElPopover,
    ElForm,
    ElFormItem,
    ElColorPicker,
    ElRow,
    ElInput
} from 'element-plus'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { rbboxBuilderOptions as builderOptions } from '@/video/annotaters/rbboxBuilder'
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


</script>
<style scoped>
.el-form-item {
    margin-bottom: 0px;
}
</style>