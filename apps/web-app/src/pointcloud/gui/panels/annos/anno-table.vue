<template>
  <el-table-v2
    v-loading="loading"
    :columns="tableColumns"
    :data="tableDataRef"
    :row-height="40"
    row-key="label_uuid"
    :height="dataPanel.panelTableHeight - 5"
    :width="dataPanel.panelWidth"
    ref="tableRef"
    fixed
    :row-event-handlers="{ onClick: rowClick }"
    :row-class="rowClass"
  />
</template>

<script lang="tsx" setup>
import { onMounted, ref, watch } from 'vue'
import { ElTableV2 } from 'element-plus'
import type { Column, RowClassNameGetter, RowEventHandlerParams } from 'element-plus'
import { dataPanel } from '@/states/UiState'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { eventBus } from '@/pointcloud/event/EventBus'
import { OlTypeEnum } from '@/openlabel'
import { mainAnnoStates } from '../../../states'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const tableDataRef = ref([] as any[])
const loading = ref(false)

const rowClick = (row: RowEventHandlerParams) => {
  // globalStates.mainAnnoater.selectObject(row.rowData.label_uuid)
}

const rowClass = ({ rowIndex, rowData }: Parameters<RowClassNameGetter<any>>[0]) => {
  if (rowData.label_uuid === mainAnnoStates.selected.label_uuid) {
    return 'bg-blue-400'
  }
  return ''
}

const reloadTableData = () => {
  loading.value = true
  tableDataRef.value = []
  let ind = 0

  globalStates.mainAnnoater?.objectsMap()?.forEach((v, k) => {
    tableDataRef.value.push({
      no: ind++,
      ...v,
    })
  })

  loading.value = false
}

const tableColumns: Column<any>[] = [
  {
    title: 'No.',
    key: 'no',
    dataKey: 'no',
    width: 50
  },
  {
    title: '类型',
    key: 'ol_type_',
    dataKey: 'ol_type_',
    width: 80
  },

  {
    title: '',
    key: 'operations',
    width: 120,
    align: 'center',
    cellRenderer: ({ rowData }) => {
      const onDeleteRow = () => {
        globalStates.mainAnnoater.doDeleteObj(rowData)
      }
      const onToggleVisible = () => {
        globalStates.mainAnnoater.updateVisible({
          label_uuid: rowData.label_uuid,
          visible: !rowData.attributes.visible,
          ol_type_: rowData.ol_type_
        })
      }
      const onEditRow = () => {
        mainAnnoStates.selectingLabelUid = rowData.label_uuid
        switch (rowData.ol_type_) {
          case OlTypeEnum.Point3d:
            globalStates.mainTool = 'point3dTool'
            break
          case OlTypeEnum.Polyline3d:
            globalStates.mainTool = 'polylineTool'
            break
          case OlTypeEnum.BBox3d:
            globalStates.mainTool = 'box3dTool'
            break
          default:
            console.warn('暂不支持的类型')
        }
      }
      return (
        <div>
          <el-button size="small" onClick={onEditRow} circle aria-label={t('aria.editObject')}>
                        <Icon icon='material-symbols-light:edit-outline'></Icon>
                    </el-button>
          <el-button size="small" onClick={onToggleVisible} circle aria-label={t('aria.toggleVisibility')}>
            <Icon icon={rowData.attributes.visible ? 'mdi:hide-outline' : 'mdi:show-outline'}></Icon>
          </el-button>
          <el-button size="small" onClick={onDeleteRow} circle aria-label={t('aria.action.delete')}>
            <Icon icon="material-symbols-light:delete-outline"></Icon>
          </el-button>
        </div>
      )
    }
  },
  {
    title: '类别',
    key: 'object_type',
    dataKey: 'object_type',
    width: 100
  }
]

eventBus.on(eventBus.pcEditor.Inited, () => {
  watch(
    () => mainAnnoStates.triger.objectsUpdated,
    (newVal, oldVal) => {
      reloadTableData()
    }
  )
})

onMounted(() => {
  reloadTableData()
})

</script>
