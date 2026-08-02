<template>
  <Draggable v-slot="{ x, y }" p="x-4 y-2" border="~ gray-400/30 rounded" shadow="~ hover:lg"
    class="fixed " :initial-value="{ x: 350, y: topBar.height_px + 5 }"
    :storage-key="'yh-pc-tool-pos-' + box3dToolStates.toolConf.id" storage-type="session" v-show="box3dToolStates.activated"
    :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move">
      <el-text class="mx-1" type="primary">工具选项</el-text>
    </div>
    <div>
      <el-row  class="justify-center">
        <el-button-group>
          <el-button size="default" @click="box3dToolStates.subTool = 'rect'"
            :type="box3dToolStates.subTool === 'rect' ? 'success' : ''">画框(1)</el-button>
          <el-button size="default" @click="box3dToolStates.subTool = 'point'"
            :type="box3dToolStates.subTool === 'point' ? 'success' : ''">选点(2)</el-button>
          <el-button size="default" @click="box3dToolStates.subTool = 'mouse'"
            :type="box3dToolStates.subTool === 'mouse' ? 'success' : ''">鼠标(3)</el-button>
        </el-button-group>
      </el-row>
      <el-row>
        <el-col :span="6">
          <el-select v-model="settingForm.highlight.coordinateSystem" style="width: 100px" placeholder="坐标">
              <el-option label="world" value="world" />
              <el-option label="local" value="local" />
          </el-select>
        </el-col>
        <el-col :span="18">
          <el-input v-model="highlightPoint.x" style="width: 80px"> </el-input>
          <el-input v-model="highlightPoint.y" style="width: 80px"> </el-input>
          <el-input v-model="highlightPoint.z" style="width: 80px"> </el-input>
        </el-col>
      </el-row>
      <el-row class="justify-center" v-show="box3dToolStates.subTool === 'point'">
        <el-button-group>
          <el-button type="primary" @click="handleBuild">创建</el-button>
        </el-button-group>
      </el-row>
      <el-row v-show="box3dToolStates.subTool === 'rect'">
        <ol>
          <li>移动鼠标到目标点</li>
          <li>按下鼠标左键，拖动鼠标</li>
        </ol>
      </el-row>
      <el-row v-show="box3dToolStates.subTool === 'point'">
        <ol>
          <li>移动鼠标到目标点</li>
          <li>Ctrl + 左键点击，选择点</li>
          <li>按Z键取消上次选择的点</li>
          <li>点击创建，根据选择的点创建</li>
        </ol>
      </el-row>
    </div>
  </Draggable>
</template>

<script lang="ts" setup>
import _ from 'lodash'
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { eventBus } from '../../event-bus'
import { UseDraggable as Draggable } from '../../../components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar, dataPanel } from '@/states/UiState'
import { box3dToolStates, Box3dTool } from '../box3d-tool'

const highlightPoint = ref({
  x: 0,
  y: 0,
  z: 0
})

const handleBuild = () => {
  Box3dTool.instance.doBuildObject()
}

const dragHandle = ref<HTMLElement | null>(null)
const topDivStyle = ref({
  width: 350 + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})

const settingForm = ref({
  plane: {
    normal: {
      x: 0,
      y: 0,
      z: 0
    },
    normalStr: '',
    constant: 0,
    visible: false,
    color: '#ff0000'
  },
  highlight: {
    toPlane: true,
    color: '#ff0000',
    threshold: 0.1,
    pointCount: 1,
    coordinateSystem: 'local',
    currentPoint: {
      x: 0,
      y: 0,
      z: 0
    }
  },
  selected: {
    coordinateSystem: 'local',
    point: {
      x: 0,
      y: 0,
      z: 0
    }
  }
})
let settingFormDefault = {}
const inputSize = ref('small')

eventBus.on(eventBus.PolylineAnnotation.Highlight, (params) => {
  const { command, glObj } = params
  if (command === 'mousemove') {
    updateHighlightPoint(glObj, command)
  }
})

const updateHighlightPoint = (intersectObjects: Array<THREE.Object3D>, subCommand: string) => {
  const obj = intersectObjects[0]
  const worldPos = new THREE.Vector3().copy(obj.point)
  let curPpoint
  if (settingForm.value.highlight.coordinateSystem === 'local') {
    curPpoint = { ...obj.object.worldToLocal(worldPos) }
  } else {
    curPpoint = { ...obj.point }
  }
  settingForm.value.highlight.currentPoint.x = curPpoint.x
  settingForm.value.highlight.currentPoint.y = curPpoint.y
  settingForm.value.highlight.currentPoint.z = curPpoint.z
}

// eventBus.on(eventBus.ToolBar.Command, async (params) => {
//   // if (!params) {
//   //     visible.value = false
//   //     return
//   // }
//   const { toolName, command } = params
//   if (toolName !== 'polylineTool') {
//     return
//   }

//   switch (command) {
//     case 'activate':
//       visible.value = true
//       break
//     case 'deactivate':
//       visible.value = false
//       break
//     default:
//       break
//   }
// })

eventBus.on(eventBus.PointAnnotation.Highlight, (params) => {
  const { command, glObj } = params
  const frameAnno = glPointAnnotationManager.getCurrent()
  if (glObj.length < 1) return
  if (settingForm.value.highlight.coordinateSystem === 'local') {
    highlightPoint.value = { ...glObj[0].point }
  } else {
    const pos = new THREE.Vector3().setFromMatrixPosition(glObj[0].object.matrixWorld).add(glObj[0].point)
    highlightPoint.value = { ...pos }
  }
  // frameAnno.updateHighlightSet(glObj, command)
  // eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

onMounted(() => {
  // copy default value
  settingFormDefault = { ...settingForm.value }
})
</script>
