<template>
  <Teleport to="#_Draggable_teleport">
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolStates.toolConf.id" storage-type="session" v-show="toolStates.activated" :handle="dragHandle"
    :resizeable="false" :style="[topDivStyle]">
    <div ref="dragHandle" class="cursor-move" style="text-align: center;">新增</div>
    <el-card>
      <el-row  class="justify-center">
        <el-button-group>
          <el-button size="default" @click="toolStates.subTool = 'event'"
            :type="toolStates.subTool === 'event' ? 'success' : ''">事件(1)</el-button>
          <el-button size="default" @click="toolStates.subTool = 'action'"
            :type="toolStates.subTool === 'action' ? 'success' : ''">活动(2)</el-button>
          <el-button size="default" @click="toolStates.subTool = 'context'"
            :type="toolStates.subTool === 'context' ? 'success' : ''">场景(3)</el-button>
        </el-button-group>
      </el-row>
      <el-row class="justify-center">
        <el-tex>
          第{{ annotatorStates.player.currentTime }} / {{ annotatorStates.player.duration }} 秒
        </el-tex>
      </el-row>
      <el-row v-if="toolStates.subTool === 'event'">
        <el-col span="8">发生时刻
        </el-col>
        <el-col span="12">
          <el-input v-model="frameInterval.time_start"></el-input>
        </el-col>
        <el-col span="4"><el-button type="success" size="small" @click="frameInterval.time_start = annotatorStates.player.currentTime">获取</el-button>
        </el-col>
      </el-row>
      <div v-else>
      <el-row>
        <el-col span="8">开始时间
        </el-col>
        <el-col span="12">
          <el-input v-model="frameInterval.time_start"></el-input>
        </el-col>
        <el-col span="4"><el-button type="success" size="small" @click="frameInterval.time_start = annotatorStates.player.currentTime">获取</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col span="8">结束时间
        </el-col>
        <el-col span="12">
          <el-input v-model="frameInterval.time_end"></el-input>
        </el-col>
        <el-col span="4"><el-button type="success" size="small" @click="frameInterval.time_end = annotatorStates.player.currentTime">获取</el-button>
        </el-col>
      </el-row>
    </div>
      <el-row class="justify-center">
        <el-button-group>
          <el-button type="primary" @click="handleBuild">确定</el-button>
        </el-button-group>
      </el-row>
    </el-card>
  </Draggable>
</Teleport>
</template>

<script lang="ts" setup>
import _ from 'lodash'
import { ref, onMounted, reactive } from 'vue'
import * as THREE from 'three'
import { globalStates } from '@/states'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolStates, VideoEventTool } from './video-event-tool'
import { toolStates as annotatorStates } from './video-annotator'
import { ElMessage } from 'element-plus'

const frameInterval = reactive({
  time_start: 0,
  time_end: 0
})

const handleBuild = () => {
  if (!frameInterval.time_start || !frameInterval.time_end) {
    ElMessage.warning('请输入时间')
    return
  }
  if (frameInterval.time_start > frameInterval.time_end) {
    ElMessage.warning('开始时间不能大于结束时间')
    return
  }
  VideoEventTool.instance.doBuildObject(frameInterval)

  frameInterval.time_end = 0
  frameInterval.time_start = 0
}

const dragHandle = ref<HTMLElement | null>(null)
const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})

onMounted(() => {
})
</script>
