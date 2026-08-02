<template>
  <<Draggable v-slot="{ x, y }" p="x-4 y-2" border="~ gray-400/30 rounded" shadow="~ hover:lg"
    class="fixed bg-$vp-c-bg select-none z-24" :initial-value="{ x: 350, y: topBar.height_px + 5 }"
    :storage-key="'yh-pc-point-tool-pos-' + Point3dTool.Name" storage-type="session"
    v-show="globalStates.mainTool === Point3dTool.Name" :resizeable="true" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move" style="text-align: center">
      <el-text class="mx-1" type="primary">3D点-{{ point3dToolStates.mode }}</el-text>
    </div>
    <el-card>
      <el-row>
        <el-button-group v-if="point3dToolStates.mode === 'selected'">
          <el-button size="small" type="primary"
            @click="Point3dTool.getInstance().onCommand('selected-edit')">编辑(E)</el-button>
          <el-button size="small" type="primary"
            @click="Point3dTool.getInstance().onCommand('selected-del')">删除(X)</el-button>
          <el-button size="small" type="primary" @click="Point3dTool.getInstance().onCommand('cancel')">取消(Q)</el-button>
        </el-button-group>
        <div v-else-if="point3dToolStates.mode === 'createNew' || point3dToolStates.mode === 'editingSelected'">
          <el-button-group v-if="point3dToolStates.mode === 'createNew'">
            <el-button size="small" type="primary" @click="Point3dTool.getInstance().onCommand('createNew-finish')"
              :disabled="point3dToolStates.mode !== 'createNew'">完成</el-button>
            <el-button size="small" type="primary" @click="Point3dTool.getInstance().onCommand('createNew-cancel')"
              :disabled="point3dToolStates.mode !== 'createNew'">取消(Q)</el-button>
          </el-button-group>
          <el-button-group v-else-if="point3dToolStates.mode === 'editingSelected'">
            <el-button size="small" type="primary"
              @click="Point3dTool.getInstance().onCommand('editing-finish')">完成</el-button>
          </el-button-group>
          <br />
          画笔
          <el-button-group>
            <el-button size="small" @click="Point3dTool.getInstance().onCommand('set-tool-circle')"
              :type="point3dToolStates.subTool === 'circle' ? 'success' : ''">circle(1)</el-button>
            <el-button size="small" @click="Point3dTool.getInstance().onCommand('set-tool-rect')"
              :type="point3dToolStates.subTool === 'rect' ? 'success' : ''">rect(2)</el-button>
            <el-button size="small" @click="Point3dTool.getInstance().onCommand('set-tool-polyline')"
              :type="point3dToolStates.subTool === 'polyline' ? 'success' : ''">polyline(3)</el-button>
          </el-button-group>
          模式
          <el-button-group>
            <el-button size="small" @click="point3dToolStates.pointMode = 'add'"
              :type="point3dToolStates.pointMode === 'add' ? 'success' : ''">+</el-button>
            <el-button size="small" @click="point3dToolStates.pointMode = 'remove'"
              :type="point3dToolStates.pointMode === 'remove' ? 'success' : ''">-</el-button>
          </el-button-group>
        </div>
        <el-button-group v-else-if="point3dToolStates.mode === undefined">
          <el-button size="small" type="success" @click="Point3dTool.getInstance().onCommand('createNew')"
            :disabled="point3dToolStates.mode === 'createNew'">新增(N)</el-button>
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
          <el-input v-model="settingForm.highlight.currentPoint.x" style="width: 80px"> </el-input>
          <el-input v-model="settingForm.highlight.currentPoint.y" style="width: 80px"> </el-input>
          <el-input v-model="settingForm.highlight.currentPoint.z" style="width: 80px"> </el-input>
        </el-col>
      </el-row>
      <el-row>
        点数：{{ point3dToolStates.selectedPointIndexes.size }}
        <el-button type="primary" size="small" @click="Point3dTool.getInstance().clearSeltecedPoints()">清除</el-button>
      </el-row>
      <el-row>
        <el-text v-show="point3dToolStates.subTool === 'circle'">
          <ol>
            <li>增加点
              <ol>
                <li>按下Ctrl键，同时单击左键确定圆心</li>
                <li>移动光标，改变圆的大小</li>
                <li>松开Ctrl键选中园内的点</li>
              </ol>
            </li>
            <li>删除点：按下Shift键，操作同上</li>
          </ol>
        </el-text>
        <el-text v-show="point3dToolStates.subTool === 'rect'">
          <ol>
            <li>增加点：按下Ctrl键，左键单击选择点，移动光标</li>
            <li>删除点：按下Shift键，左键单击选择点，移动光标</li>
          </ol>
        </el-text>
        <el-text v-show="point3dToolStates.subTool === 'polyline'">
          <ol>
            <li>按下Ctrl键，移动光标，选择点</li>
            <li>按下Shift键，移动光标，删除点</li>
          </ol>
        </el-text>
      </el-row>
    </el-card>
    </Draggable>
</template>

<script lang="ts" setup>
import _ from 'lodash'
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { eventBus } from '../../event/EventBus'
import { UseDraggable as Draggable } from '../../../components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar, dataPanel } from '@/states/UiState'
import { Point3dTool, states as point3dToolStates } from '../point3d-main'
import { globalStates } from '@/states'

const visible = ref(true)

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
  },
  line: {
    type: '', // 直线LineCurve3，样条CatmullRomCurve，贝塞尔2次QuadraticBezierCurve3 3次CubicBezierCurve3
    closed: false,
    dashed: '',
    color: '', // 选中后的颜色
    pointList: [],
    pointCount: 0
  }
})
let settingFormDefault = {}
const inputSize = ref('small')

eventBus.on(eventBus.Points3DAnnotation.Highlight, (params) => {
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

eventBus.on(eventBus.ToolBar.Command, async (params) => {
  // if (!params) {
  //     visible.value = false
  //     return
  // }
  const { toolName, command } = params
  if (toolName !== 'polylineTool') {
    return
  }

  switch (command) {
    case 'activate':
      visible.value = true
      break
    case 'deactivate':
      visible.value = false
      break
    default:
      break
  }
})

onMounted(() => {
  // copy default value
  settingFormDefault = { ...settingForm.value }
})

// const handleEditCommand = (cmd: string) => {
//   onTransformCommand(cmd)
// }

// const onTransformCommand = (cmd: string) => {
//   const control = glGlobals.mainView.transformControl
//   if (cmd === 'e') {
//     control.enabled = true
//     glGlobals.mainView.attachTransformControlToSeleted()
//   }

//   if (!control.enabled) {
//     return
//   }
//   switch (cmd) {
//     case 'q':
//       control.enabled = false
//       control.reset()
//       control.detach()
//       break
//     case 'a':
//       control.setMode('translate')
//       break
//     case 's':
//       control.setMode('rotate')
//       break
//     case 'd':
//       control.setMode('scale')
//       break
//     case '+':
//     case '=':
//       control.setSize(control.size + 0.1)
//       break
//     case '-':
//     case '_':
//       control.setSize(Math.max(control.size - 0.1, 0.1))
//       break
//     case 'x':
//       control.showX = !control.showX
//       break
//     case 'y':
//       control.showY = !control.showY
//       break
//     case 'z':
//       control.showZ = !control.showZ
//       break
//     default:
//       break
//   }
// }

// onMounted(() => {
//   window.addEventListener('keydown', (event: any) => {
//     onTransformCommand(event.key)
//   })
// })
</script>
