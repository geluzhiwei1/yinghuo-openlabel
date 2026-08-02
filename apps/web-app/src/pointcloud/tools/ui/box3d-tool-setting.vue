<template>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: 350, y: topBar.height_px + 5 }"
    :storage-key="'yh-pc-tool-pos-' + box3dToolStates.toolConf.id" storage-type="session"
    v-show="globalStates.mainTool === Box3dTool.Name" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move" style="text-align: center">
      <el-text class="mx-1" type="primary">3D框</el-text>
    </div>
    <el-card>
      <el-row>
        <el-button-group>
          <el-button size="default" @click="toggleSubTool('rect')"
            :type="box3dToolStates.subTool === 'rect' ? 'success' : ''">画框(1)</el-button>
          <!-- <el-button size="default" @click="toggleSubTool('rect2')"
            :type="box3dToolStates.subTool === 'rect' ? 'success' : ''">画框(1)</el-button> -->
          <el-button size="default" @click="toggleSubTool('point')"
            :type="box3dToolStates.subTool === 'point' ? 'success' : ''">选点(2)</el-button>
          <!-- <el-button size="default" @click="toggleSubTool('mouse')"
            :type="box3dToolStates.subTool === 'mouse' ? 'success' : ''">点坐标(3)</el-button> -->
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
      <el-row v-if="box3dToolStates.subTool === 'point'">
        点数：{{ box3dToolStates.mousePointToolStates.pointsCount }}
        <el-button type="primary" size="small" @click="Box3dTool.instance.mousePointTool.clearPoints()">清除</el-button>
        <el-button type="primary" @click="handleBuild" size="small"
          v-show="box3dToolStates.subTool === 'point'">确定</el-button>
      </el-row>
      <el-row v-show="box3dToolStates.subTool === 'rect'">
        <ol>
          <li>按下Ctrl键，移动鼠标</li>
          <li>单击左键，选择框的顶点</li>
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
    </el-card>
  </Draggable>
</template>

<script lang="ts" setup>
import _ from 'lodash'
import { ref, onMounted, computed, watch } from 'vue'
import * as THREE from 'three'
import { eventBus } from '../../event/EventBus'
import { UseDraggable as Draggable } from '../../../components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar, dataPanel } from '@/states/UiState'
import { box3dToolStates, Box3dTool } from '../box3d-main'
import { globalStates } from '@/states'

const highlightPoint = ref({
  x: 0,
  y: 0,
  z: 0
})

const selectedPointsCount = ref(0)

const handleBuild = () => {
  Box3dTool.instance.doBuildObject()
}

const toggleSubTool = (buttonId: string) => {
  if (box3dToolStates.subTool === buttonId) {
    box3dToolStates.subTool = undefined
  } else {
    box3dToolStates.subTool = buttonId
  }
}

const dragHandle = ref<HTMLElement | null>(null)
const topDivStyle = ref({
  width: 400 + 'px',
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

// eventBus.on(eventBus.PolylineAnnotation.Highlight, (params) => {
//   const { command, glObj } = params
//   if (command === 'mousemove') {
//     updateHighlightPoint(glObj, command)
//   }
// })

// const updateHighlightPoint = (intersectObjects: Array<THREE.Object3D>, subCommand: string) => {
//   const obj = intersectObjects[0]
//   const worldPos = new THREE.Vector3().copy(obj.point)
//   let curPpoint
//   if (settingForm.value.highlight.coordinateSystem === 'local') {
//     curPpoint = { ...obj.object.worldToLocal(worldPos) }
//   } else {
//     curPpoint = { ...obj.point }
//   }
//   settingForm.value.highlight.currentPoint.x = curPpoint.x
//   settingForm.value.highlight.currentPoint.y = curPpoint.y
//   settingForm.value.highlight.currentPoint.z = curPpoint.z
// }

eventBus.on(eventBus.PointAnnotation.Highlight, (params) => {
  const { command, glObj } = params
  if (glObj.length < 1) return
  if (settingForm.value.highlight.coordinateSystem === 'local') {
    highlightPoint.value = { ...glObj[0].point }
  } else {
    const pos = new THREE.Vector3()
      .setFromMatrixPosition(glObj[0].object.matrixWorld)
      .add(glObj[0].point)
    highlightPoint.value = { ...pos }
  }
})

onMounted(() => {
  settingFormDefault = { ...settingForm.value }
  // watch(
  //   () => Box3dTool.instance.mousePointTool.states.pointsChanged,
  //   (newVal) => {
  //     selectedPointsCount.value =
  //       Box3dTool.instance.mousePointTool.seletedPointsManager.pointsCount()
  //   }
  // )
})
</script>
