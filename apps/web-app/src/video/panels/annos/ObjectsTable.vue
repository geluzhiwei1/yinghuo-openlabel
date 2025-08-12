<template>
    <el-table-v2 v-loading="loading" :columns="tableColumns" :data="tableDataRef" :row-height="40" row-key="uuid"
        :height="dataPanel.panelTableHeight - 5" :width="dataPanel.panelWidth" ref="tableRef" fixed
        :row-class="rowClass" />
</template>

<script lang="tsx" setup>
import { computed, ref, watch } from 'vue'
import { ElTableV2 } from 'element-plus'
import type { Column, RowClassNameGetter, RowEventHandlerParams } from 'element-plus'
import { dataPanel } from '@/states/UiState'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'

const tableDataRef = ref([] as any[])
const loading = ref(false)

const rowClass = ({ rowIndex, rowData }: Parameters<RowClassNameGetter<any>>[0]) => {
  if (rowData.uuid === globalStates.mainAnnoater.getSelectedObject()?.userData.anno?.label_uuid) {
    return 'bg-blue-400'
  }
  return ''
}

const reloadTableData = () => {
    loading.value = true
    tableDataRef.value = []
    let ind = 0

    switch(jobConfig.mission) {
        case Mission.VideoEvents:
            globalStates.mainAnnoater.objectsMap().forEach((v, k) => {
                tableDataRef.value.push(
                    {
                        no: ind++,
                        uuid: k,
                        objId: v.userData.object_id,
                        object_type: v.userData.anno.ol_type_,
                        visible: true
                    }
                )
            })
            break;
        default:
            globalStates.mainAnnoater.objectsMap().forEach((v, k) => {
                tableDataRef.value.push(
                    {
                        no: ind++,
                        uuid: k,
                        ...v.userData.anno,
                        visible: true
                    }
                )
            })
            break;
    }

    loading.value = false
}

const tableColumns: Column<any>[] = [
    {
        title: 'No.',
        key: 'no',
        dataKey: 'no',
        width: 50
    },
    // {
    //     title: '',
    //     key: 'objId',
    //     dataKey: 'objId',
    //     width: 50
    // },
    {
        title: '',
        key: 'operations',
        width: 120,
        align: 'center',
        cellRenderer: ({ rowData }) => {
            const onDeleteRow = () => {
                globalStates.mainAnnoater.removeObject(rowData.uuid)
            }
            const onFocusRow = () => {
                if (globalStates.mainAnnoater.focusObject) {
                    globalStates.mainAnnoater.focusObject(rowData.uuid)
                } else {
                  globalStates.mainAnnoater.selectObject(rowData.uuid)
                }
            }
              const onToggleVisible = () => {
                switch(jobConfig.mission) {
                    case Mission.VideoEvents:
                        globalStates.mainAnnoater.selectObject(rowData.uuid)
                        break;
                    default:
                        rowData.visible = !rowData.visible
                        globalStates.mainAnnoater.updateObject(rowData.uuid, { visible: rowData.visible })
                        break;
                }
            }
            return (
                <div>
                    <el-button size="small" onClick={onFocusRow} circle>
                        <Icon icon="material-symbols-light:center-focus-strong-outline"></Icon>
                    </el-button>
                    <el-button size="small" onClick={onToggleVisible} circle >
                        <Icon icon={rowData.visible ? 'mdi:show-outline' : 'mdi:hide-outline'}></Icon>
                    </el-button>
                    <el-button size="small" onClick={onDeleteRow} circle>
                        <Icon icon='material-symbols-light:delete-outline'></Icon>
                    </el-button>
                </div>
            )
        },
    },
    {
        title: '',
        key: 'object_type',
        dataKey: 'object_type',
        width: 150
    },
]


watch(() => globalStates.toolsInited, (newVal, oldVal) => {
    if (newVal) {
        watch(() => globalStates.mainAnnoater.publicStates.objectsUpdated, (newVal, oldVal) => {
            reloadTableData()
        })
    }
}, { immediate: true })

</script>