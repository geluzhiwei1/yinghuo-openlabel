<template>
  <el-button-group class="ml-4">
    <el-popover placement="bottom-end" :width="400" trigger="click" :visible="ui_datas.entityInfo.visible">
      <template #reference>
        <el-button type="info"
          @click.stop="ui_datas.entityInfo.visible = !ui_datas.entityInfo.visible"
          :aria-label="t('aria.addEntity')"><Icon icon="lucide:plus-circle" /></el-button>
      </template>
      <div>
        <EntityInfoEditer @button-click="handleEntityInfoEditorButtonClick" />
      </div>
    </el-popover>

    <el-popconfirm width="220" confirm-button-text="是" cancel-button-text="否"
      :title="t('pcStatus.deleteAllConfirm')" @confirm.stop="handleDeleteAll">
      <template #reference>
        <el-button type="danger" :aria-label="t('aria.deleteAll')"><Icon icon="lucide:trash-2" /></el-button>
      </template>
    </el-popconfirm>
    <el-button>{{ t('aria.copyObject') }}</el-button>
    <el-button>{{ t('aria.pasteObject') }}</el-button>
    <el-button>{{ t('aria.focusObject') }}</el-button>
    <el-button>{{ t('aria.editObject') }}</el-button>
    <el-button>{{ t('aria.reverseOrder') }}</el-button>
    <el-button>{{ t('aria.autoAnnotate') }}</el-button>
  </el-button-group>
  <div style="">
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2 :columns="columns" :data="tableDataRef" :width="width" :height="height" :row-class="rowClass"
          :row-event-handlers="rowEventHandlers" :row-height="40" ref="tableRef" fixed />
      </template>
    </el-auto-resizer>
  </div>
</template>

<script lang="tsx" setup>
import { Icon } from "@iconify/vue"
import { ref } from 'vue'
import { ElButton, ElTag, type Column } from 'element-plus'
import EntityInfoEditer from './EntityInfoEditer.vue'
import { entityChannel, worldChannel } from '@/pointcloud/event/channel'
import type { TableV2Instance, RowClassNameGetter } from 'element-plus'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)
// type SelectionCellProps = {
//   value: boolean
//   intermediate?: boolean
//   onChange: (value: CheckboxValueType) => void
// }

const tableRef = ref<TableV2Instance>()

const ui_datas = ref({
  entityInfo: {
    visible: false
  },
  span1: 12,
  span2: 12,
  entity: {
    type: '',
    uid: '',
    trackId: ''
  }
})

const handleEntityInfoEditorButtonClick = ({ command }) => {
  if ('close' === command) {
    ui_datas.value.entityInfo.visible = false
  }
}

const handleDeleteAll = () => { }
// const SelectionCell: FunctionalComponent<SelectionCellProps> = ({
//   value,
//   intermediate = false,
//   onChange
// }) => {
//   return <ElCheckbox onChange={onChange} modelValue={value} indeterminate={intermediate} />
// }

const tableDataRef = ref([])
const tableSelectedRowIndex = ref(-1)

//#mark 在tsx中使用slot
const columns: Column<any>[] = [
  {
    width: 50,
    cellRenderer: ({ rowData: row }) => (
      <ElPopover
        effect="light"
        trigger="hover"
        placement="top"
        width="auto"
        v-slots={{
          default: () => <p>类别：{row.object_type}</p>,
          reference: () => (
            <ElButton
              circle
              size="small"
              style={{ 'font-size': '20px', color: row.color }}
            ><Icon icon="lucide:info" /></ElButton>
          )
        }}
      />
    )
  },
  // {
  //   width: 50,
  //   headerCellRenderer: () => {
  //     const _data = unref(tableDataRef)
  //     const onChange = (value: CheckboxValueType) =>
  //       (tableDataRef.value = _data.map((row) => {
  //         row.checked = value
  //         return row
  //       }))
  //     const allSelected = _data.every((row) => row.checked)
  //     const containsChecked = _data.some((row) => row.checked)

  //     return (
  //       <SelectionCell
  //         value={allSelected}
  //         intermediate={containsChecked && !allSelected}
  //         onChange={onChange}
  //       />
  //     )
  //   },
  //   cellRenderer: ({ rowData, rowIndex }) => {
  //     const onChange = (value: CheckboxValueType) => {
  //       rowData.checked = value
  //       tableSelectedRowIndex.value = rowIndex
  //       if (value && rowIndex !== -1 && window.editorPC) {
  //         window.editorPC.selectBoxById(tableDataRef.value[rowIndex].objId)
  //       }
  //     }
  //     return <SelectionCell value={rowData.checked} onChange={onChange} />
  //   }
  // },
  {
    key: 'objType',
    title: '类别',
    dataKey: 'objType',
    width: 100,
    align: 'center',
    cellRenderer: ({ cellData: objType }) => <ElTag>{objType}</ElTag>
  },
  {
    key: 'operations',
    cellRenderer: () => (
      <>
        <ElButton size="small" type="danger" circle><Icon icon="lucide:trash-2" /></ElButton>
      </>
    ),
    width: 150,
    align: 'center'
  }
]

const rowClass = ({ rowIndex }: Parameters<RowClassNameGetter<any>>[0]) => {
  if (rowIndex === tableSelectedRowIndex.value) {
    return 'bg-red-100'
  }
  return ''
}

const rowEventHandlers = {
  onClick: ({ rowIndex }) => {
    tableSelectedRowIndex.value = rowIndex
    if (rowIndex !== -1 && window.editorPC) {
      window.editorPC.selectBoxById(tableDataRef.value[rowIndex].objId)
    }
  }
}

// 定阅消息，更新数据
worldChannel.sub(worldChannel.Events.Activated, (msg) => {
  const boxes = msg.boxes.map((box) => {
    box.checked = false
    return box
  })
  tableDataRef.value = boxes
  tableDataRef.value = msg.boxes
})

entityChannel.sub(entityChannel.Events.SelectedBoxChanged, function (box) {
  if (box) {
    // find by objId: String(box.objId)
    const index = tableDataRef.value.findIndex((item) => item.objId === box.objId)
    if (-1 !== index) {
      tableRef.value?.scrollToRow(index)
      tableSelectedRowIndex.value = index
      tableDataRef.value[index].checked = true
    }
  } else {
    tableRef.value?.scrollToRow(0)
  }
})

entityChannel.sub(entityChannel.Events.Loaded, (msg) => {
  msg
  // logger.debug(msg)
  // window.editorPC.annotation.boxes
})
</script>
