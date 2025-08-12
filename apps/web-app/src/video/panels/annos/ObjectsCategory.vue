<template>
    <el-table-v2 v-loading="loading" :columns="tableColumns" :data="tableDataRef" :row-height="40" row-key="uuid"
        :height="dataPanel.panelTableHeight - 5" :width="dataPanel.panelWidth" ref="tableRef" fixed
        :row-event-handlers="{}" />
    <el-dialog v-model="dialogFormVisible" title="类别设置" width="500" :draggable="true" :modal="false">
        <el-form :model="formData">
            <el-form-item label="类别">
                <el-input v-model="formData.settings.category" autocomplete="off" readonly />
            </el-form-item>
            <el-form-item label="是否显示">
                <el-switch v-model="formData.settings.annoVisible" />
            </el-form-item>
            <el-form-item label="填充色">
                <el-color-picker v-model="formData.settings.fill" show-alpha></el-color-picker>
            </el-form-item>
        </el-form>
        <template #footer>
            <div class="items-center">
                <el-button @click="doCancel">取消</el-button>
                <el-button @click="submitForm">
                    确定
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script lang="tsx" setup>
import { ref, watch, reactive } from 'vue'
import { ElTableV2, ElDialog, ElColorPicker } from 'element-plus'
import type { Column, RowEventHandlerParams } from 'element-plus'
import { dataPanel } from '@/states/UiState'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'

const tableDataRef = ref([] as any[])
const loading = ref(false)
const dialogFormVisible = ref(false)
const updateFormKey = ref(0)
const formData = reactive({
    settings: {
        category: '',
        annoVisible: true,
        fill: ''
    }
})
const schema = {
    title: "",
    type: "object",
    description: "",
    properties: {
        settings: {
            type: "object",
            properties: {
                annoVisible: {
                    title: "是否显示",
                    description: "是否显示该类别的标注",
                    type: 'boolean'
                },
                fill: {
                    title: '填充色',
                    type: 'string',
                    'ui:widget': ColorPickerWidget,
                    description: "类别填充颜色",
                },
            }
        },
    }
}

const submitForm = () => {
    globalStates.mainAnnoater.updateCategoryStyle(
        formData.settings.category,
        {
            options: {
                fill: formData.settings.fill,
                visible: formData.settings.annoVisible
            }
        }
    )
    dialogFormVisible.value = false
}

const doCancel = () => {
    dialogFormVisible.value = false
}

const reloadTableData = () => {
    loading.value = true
    tableDataRef.value = []
    let ind = 0

    globalStates.mainAnnoater.objectsStyles().forEach((v, k) => {
        tableDataRef.value.push(
            {
                no: ind++,
                object_type: k,
                style: { ...v },
            }
        )
    })

    loading.value = false
}

const tableColumns: Column<any>[] = [
    {
        title: 'No.',
        key: 'no',
        dataKey: 'no',
        width: 40
    },
    {
        title: '',
        key: 'operations',
        width: 130,
        align: 'center',
        cellRenderer: ({ rowData }) => {
            const onSetting = () => {
                schema.title = rowData.object_type
                // 默认值
                formData.settings.category = rowData.object_type
                formData.settings.annoVisible = rowData.style.options.visible
                formData.settings.fill = rowData.style.options.fill

                updateFormKey.value++
                dialogFormVisible.value = true
            }
            const onDeleteRow = () => {
                // globalStates.mainAnnoater.removeObject()
            }
            const onToggleVisible = () => {
                rowData.style.options.visible = !rowData.style.options.visible
            }
            return (
                <div>
                    <el-button size="small" onClick={onSetting} circle>
                        <Icon icon='material-symbols-light:tv-options-input-settings-outline'></Icon>
                    </el-button>
                    <el-button size="small" onClick={onToggleVisible} circle>
                        <Icon icon={rowData.style.options.visible ? 'mdi:show-outline' : 'mdi:hide-outline'}></Icon>
                    </el-button>
                    <el-button size="small" onClick={onDeleteRow} circle>
                        <Icon icon='material-symbols-light:delete-outline' ></Icon>
                    </el-button>
                </div>
            )
        },
    },
    {
        title: 'object_type',
        key: 'object_type',
        dataKey: 'object_type',
        width: 150,
        cellRenderer: ({ rowData }) => {
            return (
                <div style={{ width: '100%', backgroundColor: rowData.style.options.fill }}>
                    {rowData.object_type}
                </div>
            )
        }
    },
]

watch(() => globalStates.toolsInited, (newVal, oldVal) => {
    if (newVal) {
        watch(() => globalStates.mainAnnoater.publicStates.objStylesUpdated,
            (newVal, oldVal) => {
                reloadTableData()
            })
    }
}, { immediate: true })

</script>