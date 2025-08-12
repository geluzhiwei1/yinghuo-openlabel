<template>
    <el-tooltip v-if="toolVisible" placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
        <el-button type="primary" :style="toolConf.style" @click="toolButtonClick(toolConf.id)">
            <el-popover placement="bottom" :width="800" :visible="settingVisible" :auto-close="0">
                <template #reference>
                    <Icon :icon="toolConf.icon" />
                </template>
                <div>
                    <el-form label-width="120px">
                        <el-form-item>
                            <el-row style="width: 100%">
                                <el-col :span="8">{{ toolConf.name }}</el-col>
                                <el-col :span="8">快捷键：<el-tag>{{ toolConf.shortcut }}</el-tag></el-col>
                                <el-col :span="8" style="text-align:right;">
                                    <el-button circle @click="settingOptionsVisible = !settingOptionsVisible">
                                        <Icon
                                            :icon="settingOptionsVisible ? 'octicon:fold-up-16' : 'octicon:fold-down-16'" />
                                    </el-button>
                                    <el-button circle @click="settingVisible = !settingVisible">
                                        <Icon :icon="'fluent:slide-hide-24-regular'" />
                                    </el-button>
                                </el-col>
                            </el-row>
                        </el-form-item>
                    </el-form>
                    <VueForm label-width="100px" v-show="settingOptionsVisible" class="myclass"
                        v-model="polylineBuilderOptions.settingFormData" :schema="ui.schema"
                        :formProps="{ labelPosition: 'right', layoutColumn: 2 }" :formFooter="{ show: false }"
                        @change="handleProptertyFormChange" />
                </div>
            </el-popover>
        </el-button>
    </el-tooltip>
</template>
<script lang="tsx" setup>
import { reactive, ref, watch } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { formatTooltipContent, toolButtonClick } from './utils'
import { polylineBuilderOptions, ui, polylineBuilderConf } from '@/video/annotaters/polylineBuilder'
import {
    ElRow, ElCol,
    ElButton,
    ElTooltip,
    ElPopover,
    ElForm,
    ElFormItem,
} from 'element-plus'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'

const toolConf = ref(polylineBuilderConf)
const settingVisible = ref(false)
const settingOptionsVisible = ref(false)
const toolVisible = ref(true)

const handleProptertyFormChange = (formData: any) => {
}

watch(() => globalStates.subTool, (newValue, oldValue) => {
    if (toolConf.value.id === newValue) {
        settingVisible.value = true
    } else {
        settingVisible.value = false
    }
})

</script>
<style scoped>
.el-form-item {
    margin-bottom: 0px;
}
</style>
<style>
.myclass>.el-form-item {
    margin-bottom: 0px;
}

.myclass>.genFromComponent>.el-form-item {
    margin-bottom: 0px;
}
</style>