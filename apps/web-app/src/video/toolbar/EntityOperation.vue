<template>
  <el-button-group v-if="jobConfig.mission === Mission.ObjectBBox2d">
    <BBoxBuilderToolSetting />
    <GeometryBuilderFromPointsSetting />
    <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary" disabled>
          {{ $t('video.toolbar.ai') }}
        </el-button>
      </template>
      <div style="text-align: center">
        <el-button-group>
          <TextPromptBBoxToolSetting />
          <PromoteSegmentSetting />
          <AutoLabelToolSetting />
          <VideoPromoteSegmentSetting />
        </el-button-group>
      </div>
    </el-popover>
    <BBoxAnnotaterSetting />
  </el-button-group>
  <el-button-group v-else-if="jobConfig.mission === Mission.ObjectRBBox2d">
    <RBBoxBuilderToolSetting />
    <GeometryBuilderFromPointsSetting />
    <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary">
          {{ $t('video.toolbar.ai') }}
        </el-button>
      </template>
      <div style="text-align: center">
        <el-button-group>
          <TextPromptBBoxToolSetting />
          <PromoteSegmentSetting />
          <AutoLabelToolSetting />
          <VideoPromoteSegmentSetting />
        </el-button-group>
      </div>
    </el-popover>
    <BBoxAnnotaterSetting />
  </el-button-group>
  <el-button-group v-else-if="jobConfig.mission === Mission.Semantic2d">
    <!-- <PolylineBuilderTool /> -->
    <PolygonBuilderSetting />
    <PolylinePencilSetting />
    <MaskBrushSetting />
    <PolygonEditorSetting />
    <el-popover placement="bottom" width="250" trigger="hover">
      <template #reference>
        <el-button type="primary">
          {{ $t('video.toolbar.ai') }}
        </el-button>
      </template>
      <div style="text-align: center">
        <el-button-group>
          <TextPromptBBoxToolSetting />
          <PromoteSegmentSetting />
          <AutoLabelToolSetting />
          <VideoPromoteSegmentSetting />
        </el-button-group>
      </div>
    </el-popover>
    <PolylineAnnotaterSetting />
  </el-button-group>
  <el-button-group v-else-if="jobConfig.mission === Mission.VideoEvents">
    <VideoEventToolUi></VideoEventToolUi>
    <el-button type="primary" :style="{ color: globalStates.mainTool === VideoEventTool.Name ? 'blue' : '' }"
      @click="globalStates.mainTool = (globalStates.mainTool === VideoEventTool.Name) ? undefined : VideoEventTool.Name">
      {{ $t('video.toolbar.add') }}(N)
    </el-button>
  </el-button-group>
</template>
<script lang="tsx" setup>
import { globalStates } from '@/states'
import { jobConfig } from '@/states/job-config'
import { Mission } from '@/constants'
import BBoxBuilderToolSetting from '../annotaters/ui/BBoxBuilderTool.vue'
import RBBoxBuilderToolSetting from '../annotaters/ui/RBBoxBuilderTool.vue'
import TextPromptBBoxToolSetting from '../annotaters/ui/TextPromptBBoxTool.vue'
import BBoxAnnotaterSetting from '../annotaters/ui/boxAnnotaterSetting.vue'
import AutoLabelToolSetting from '../annotaters/ui/AutoLabelToolSetting.vue'
import GeometryBuilderFromPointsSetting from '../annotaters/ui/GeometryBuilderFromPointsSetting.vue'
import PromoteSegmentSetting from '../annotaters/ui/PromptSegmentSetting.vue'
import VideoPromoteSegmentSetting from '../annotaters/ui/VideoPromptSegmentSetting.vue'

// import PolylineBuilderTool from '../annotaters/ui/PolylineBuilderSetting.vue'
import PolylinePencilSetting from '../annotaters/ui/PolylinePencilSetting.vue'
import MaskBrushSetting from '../annotaters/ui/MaskBrush.vue'
import PolygonBuilderSetting from '../annotaters/ui/PolygonBuilderSetting.vue'
import PolylineAnnotaterSetting from '../annotaters/ui/PolylineAnnotaterSetting.vue'
import PolygonEditorSetting from '../annotaters/ui/PolygonEditor.vue'
import { watch } from 'vue'
import { OlTypeEnum } from '@/openlabel'

import { VideoEventToolUi, toolStates as videoEventToolStates, VideoEventTool } from '../tools/video-event-tool'

watch(
  () => jobConfig.mission,
  (newVal, oldVal) => {
    if (!newVal || newVal === oldVal) return
    switch (newVal) {
      case Mission.ObjectBBox2d:
        globalStates.subTools = ['bboxBuilder', 'geometryBuilderFromPoints', 'textPromptBBoxTool', 'promptSegment', 'autoLabelTool', 'videoPromptSegment', 'bboxAnnotater'] // 'textPromptBBoxTool', 
        globalStates.toolsSettings = {
          bboxAnnotater: {
            outGeometryType: OlTypeEnum.BBox
          },
          geometryBuilderFromPoints: {
            outGeometryType: OlTypeEnum.BBox
          }
        }
        break
      case Mission.ObjectRBBox2d:
        globalStates.subTools = ['rbboxBuilder', 'geometryBuilderFromPoints', 'textPromptBBoxTool', 'promptSegment', 'autoLabelTool', 'videoPromptSegment', 'bboxAnnotater']
        globalStates.toolsSettings = {
          bboxAnnotater: {
            outGeometryType: OlTypeEnum.RBBox
          },
          geometryBuilderFromPoints: {
            outGeometryType: OlTypeEnum.RBBox
          },
          promptSegment: {
            outGeometryType: OlTypeEnum.RBBox
          },
        }
        break
      case Mission.Semantic2d:
        globalStates.subTools = ['polygonBuilder', 'polylinePencil', 'maskBrush', 'promptSegment', 'videoPromptSegment', 'autoLabelTool', 'polygonEditor', 'polylineAnnotater']
        globalStates.toolsSettings = {
          promptSegment: {
            outGeometryType: OlTypeEnum.Poly2d
          }
        }
        break
      case Mission.TrafficLine2d:
        globalStates.subTools = ['polylineBuilder', 'polylinePencil', 'bboxBuilder', 'textPromoteBBoxTool']
        break
      case Mission.TrafficSignal2d:
        break
      case Mission.TrafficSign2d:
        break
      case Mission.ParkingSlot2d:
        break
      case Mission.VideoEvents:
        break
      default:
        break
    }
  },
  { deep: true, immediate: true }
)

</script>
