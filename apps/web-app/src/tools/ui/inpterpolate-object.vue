<template>
  <Draggable
    v-slot="{ x, y }"
    class="fixed"
    :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 50 }"
    :storage-key="'yh-vd-tool-pos-' + toolStates.toolConf.id"
    storage-type="session"
    v-show="toolStates.activated"
    :style="[topDivStyle]"
    :handle="dragHandle"
  >
    <div ref="dragHandle" class="cursor-move">
      {{ toolStates.toolConf.name }}
    </div>
    <el-card>
      <el-row style="width: 100%">
        <el-button type="primary" @click="btnClik('doRequest')" :loading="toolStates.act.processing"
          >确定</el-button
        >
        <el-button @click="btnClik('clearPrompts')" plain>重置</el-button>
      </el-row>
      <div style="width: 100%; height: 150px">
        <el-auto-resizer
          ><template #default="{ height, width }">
            <el-table-v2
              :columns="columns"
              :row-height="35"
              :header-height="35"
              :data="toolStates.promptsTableDatas"
              :max-height="height"
              :width="width"
              :height="100"
              :key="refreshKey"
            >
              <template #empty>
                <div class="flex items-center justify-center h-100%">
                  <el-text type="success">请添加对象</el-text>
                </div>
              </template>
            </el-table-v2></template
          >
        </el-auto-resizer>
      </div>
    </el-card>
  </Draggable>
</template>
<script lang="tsx" setup>
import { ref, onMounted, computed } from 'vue'
import { globalStates } from '@/states'
import { Icon } from '@iconify/vue'
import type { CheckboxValueType, Column } from 'element-plus'
import { commonChannel } from '../../video/channel'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { toolStates, InpterpolateObject } from '../inpterpolate-object'

const topDivStyle = ref({
  width: 350 + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)
// 表格
const refreshKey = ref(0)
const columns: Column<any>[] = [
  {
    key: 'frameNo',
    title: '帧',
    dataKey: 'frameNo',
    width: 100,
    align: 'center',
    sortable: true
  },
  {
    key: 'ol_type_',
    title: '',
    dataKey: 'ol_type_',
    width: 150,
    align: 'center',
    sortable: true
  },
  {
    key: 'object_type',
    title: '对象类型',
    dataKey: 'object_type',
    width: 150,
    align: 'center',
    sortable: true
  },
  {
    key: 'operations',
    title: '',
    cellRenderer: ({ rowData }) => {
      const onViewClick = () => {
        commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: rowData.frameNo } })
      }
      const onRemoveClick = () => {
        InpterpolateObject.instance().removeGeometry(rowData.label_uuid)
      }
      return (
        <>
          <el-button size="small" onClick={onViewClick}>
            查看
          </el-button>
          <el-button size="small" onClick={onRemoveClick}>
            删除
          </el-button>
        </>
      )
    },
    width: 250,
    align: 'center'
  }
]

const btnClik = (cmdId: string) => {
  switch (cmdId) {
    case 'doRequest':
      toolStates.act.doAction += 1
      break
    case 'clearPrompts':
      InpterpolateObject.instance().reset()
      break
    default:
      break
  }
}
</script>
