<template>
  <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(currentTool)">
    <el-button :type="activated ? 'success' : 'primary'" @click="toolButtonClick(currentTool.id)" disabled>
      <Icon :icon="currentTool.icon" />
    </el-button>
  </el-tooltip>
  <Teleport to="#_Draggable_teleport">
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session" v-show="activated && !commonAnnotaterSetting.settingFormData.settings.hideToolSettings"
    :resizeable="true" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move" style="text-align: center;">
      {{ toolConf.name }}
    </div>
    <el-card>
      <el-row style="width: 100%">
        <el-col :span="24">模型：SAM2</el-col>
      </el-row>
      <el-row style="width: 100%">
        <el-col :span="6">
            <el-text>输出类型：</el-text>
          </el-col><el-col :span="6">
             <el-select size="small" v-model="toolStates.setting.outGeometryType"  placeholder="输出结果">
              <el-option :value="OlTypeEnum.BBox" :label="'2D框'"></el-option>
              <el-option :value="OlTypeEnum.RBBox" :label="'2D旋转框'"></el-option>
              <el-option :value="OlTypeEnum.Poly2d" :label="'多边形'"></el-option>
              <el-option :value="OlTypeEnum.Mask2dRle" :label="'掩码(RLE)'"></el-option>
            </el-select>
          </el-col>
        <el-col :span="12">
          <el-button type="primary" size="small" @click="btnClik('doRequest')"
            :loading="toolStates.calling" disabled>确定</el-button>
          <el-button size="small" @click="btnClik('clearPrompts')" plain disabled>重置</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="4"><el-text>提示：</el-text></el-col><el-col :span="20">
      <el-button-group>
          <el-button disabled size="small" @click="toolOptions.formData.promoteType = 'bbox'" :type="toolOptions.formData.promoteType === 'bbox' ? 'success' : ''">框(1)</el-button>
          <el-button disabled size="small" @click="toolOptions.formData.promoteType = 'object'" :type="toolOptions.formData.promoteType === 'object' ? 'success' : ''">前景(2)</el-button>
          <el-button disabled size="small" @click="toolOptions.formData.promoteType = 'background'" :type="toolOptions.formData.promoteType === 'background' ? 'success' : ''">背景(3)</el-button>
          <el-button disabled size="small" @click="toolOptions.formData.promoteType = 'none'" :type="toolOptions.formData.promoteType === 'none' ? 'success' : ''">鼠标(4)</el-button>
        </el-button-group></el-col>
      </el-row>
      <VueForm size="small" id="propertyForm" ref="propertyForm" label-width="auto"
        :formProps="{ labelPosition: 'right', layoutColumn: 1 }" v-model="toolOptions.formData"
        :schema="settingUISchema.schema" :formFooter="{ show: false }" />
      <div style="width:100%; height:150px;">
        <el-auto-resizer><template #default="{ height, width }">
            <el-table-v2 :columns="columns" :row-height="35" :header-height="35" :data="toolStates.promptsTableDatas"
              :max-height=height :width="width" :height="100" :key="refreshKey">
              <template #empty>
                <div class="flex items-center justify-center h-100%">
                  <el-text type="success">请添加提示</el-text>
                </div>
              </template>
            </el-table-v2></template> </el-auto-resizer>
      </div>
    </el-card>
  </Draggable>
</Teleport>
</template>
<script lang="tsx" setup>
import { ref, onMounted, computed } from 'vue'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import { ElTag, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem, ElCol, ElRow, ElNotification } from 'element-plus'
import VueForm from '@lljj/vue3-form-element'
import { Icon } from '@iconify/vue'
import { pointsPromoteSegmentToolConf as toolConf, toolOptions, settingUISchema, toolStates, VideoPromptSegment } from '../videoPromptSegment'
import type { CheckboxValueType, Column } from 'element-plus'
import { commonChannel } from '../../channel'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { commonAnnotaterSetting } from '../common-annotater-settings'
import { OlTypeEnum } from '@/openlabel'

const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
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
    width: 150,
    align: 'center',
    sortable: true,
  },
  {
    key: 'bbox',
    title: '2D框',
    dataKey: 'bbox',
    width: 150,
    align: 'center',
    cellRenderer: ({ rowData }) => (
      <>
        {rowData.box ? 1 : 0}
      </>
    ),
    sortable: true,
  },
  {
    key: 'object',
    title: '前景点',
    dataKey: 'object',
    width: 150,
    align: 'center',
    cellRenderer: ({ rowData }) => (
      <>
        {rowData.object.length}
      </>
    ),
    sortable: true,
  },
  {
    key: 'background',
    title: '背景点',
    dataKey: 'background',
    width: 150,
    align: 'center',
    cellRenderer: ({ rowData }) => (
      <>
        {rowData.background.length}
      </>
    ),
    sortable: true,
  },
  {
    key: 'operations',
    title: '',
    cellRenderer: ({ rowData }) => {
      const onClick = () => {
        commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: rowData.frameNo } })
      }
      return <>
        <el-button onClick={onClick} size="small">查看</el-button>
      </>
    },
    width: 150,
    align: 'center',
  }
]

const currentTool = ref(toolConf)
const activated = computed(() => {
  return globalStates.subTool === toolConf.id
})

const btnClik = (cmdId: string) => {
  const toolIns: VideoPromptSegment = globalStates.toolsets!.get(VideoPromptSegment.name)
  switch (cmdId) {
    case 'doRequest':
      toolOptions.doAction += 1
      break
    case 'clearPrompts':
      toolIns.doCleanData()
      break;
    default:
      break
  }
}
</script>
