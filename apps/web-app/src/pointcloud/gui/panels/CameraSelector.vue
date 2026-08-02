<template>
  <el-checkbox v-model="autoCamera" style="margin-left: 20px" @change="handleChangeAuto">自动选择</el-checkbox>
  <el-table-v2 :columns="tableColumns" :data="tableDataRef" :width="550" :height="300" :row-height="30" ref="tableRef"
    fixed />
</template>
<script lang="tsx" setup>
import { ref, unref, toRaw, watch } from 'vue'
import { ElCheckbox } from 'element-plus'
import { commonChannel, cameraChannel } from '@/pointcloud/event/channel'
import type { FunctionalComponent } from 'vue'
import type { CheckboxValueType, Column } from 'element-plus'
import _ from 'lodash'
import { useDataState } from '@/pointcloud/data-seq'
import { appLayoutStatus } from '@/pointcloud/states'

const { getCameras } = useDataState()

const autoCamera = ref(true)
// watch(
//   () => autoCamera.value,
//   (val: boolean) => {
//     const data = { camera_id: 'auto', camera_type: 'auto', checked: val }
//     cameraChannel.pub(cameraChannel.Events.Changed, data)
//   }
// )

const handleChangeAuto = () => {
  const data = { camera_id: 'auto', camera_type: 'auto', checked: autoCamera.value }
  cameraChannel.pub(cameraChannel.Events.Changed, data)
}

watch(() => appLayoutStatus.imageViews, (newValue) => {
  if (_.get(newValue, 'auto', false)) {
    autoCamera.value = true
  } else {
    autoCamera.value = false
  }
  tableDataRef.value = tableDataRef.value.map((row) => {
    if (_.get(newValue, 'camera:' + row.camera_id, false)) {
      row.checked = true
    } else {
      row.checked = false
    }
    return row
  })
}, { deep: true })

// 表格数据
type SelectionCellProps = {
  value: boolean
  intermediate?: boolean
  onChange: (value: CheckboxValueType) => void
}
const SelectionCell: FunctionalComponent<SelectionCellProps> = ({
  value,
  intermediate = false,
  onChange
}) => {
  return <ElCheckbox onChange={onChange} modelValue={value} indeterminate={intermediate} />
}

const tableDataRef = ref([])

const tableColumns: Column<any>[] = [
  {
    width: 50,
    cellRenderer: ({ rowData }) => {
      const onChange = (value: CheckboxValueType) => {
        rowData.checked = value
        // 发送消息
        // tableDataRef.value[rowIndex]
        cameraChannel.pub(cameraChannel.Events.Changed, toRaw(rowData))
      }
      return <SelectionCell value={rowData.checked} onChange={onChange} />
    }
  },
  {
    title: '相机',
    key: 'camera_id',
    dataKey: 'camera_id',
    width: 150
  },
  {
    title: '分类',
    key: 'group_name',
    dataKey: 'group_name',
    width: 100
  },
  {
    key: 'group_value',
    dataKey: 'group_value',
    width: 100
  },
  {
    title: '宽x高',
    key: 'camera_resolution',
    dataKey: 'camera_resolution',
    width: 100
  }
]

const loadData = () => {
  tableDataRef.value = getCameras()
}
commonChannel.sub(commonChannel.Events.DataLoaded, () => {
  loadData()
})
</script>
