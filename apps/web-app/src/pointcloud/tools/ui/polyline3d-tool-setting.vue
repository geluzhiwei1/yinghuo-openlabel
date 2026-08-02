<template>
  <Draggable v-slot="{ x, y }" p="x-4 y-2" border="~ gray-400/30 rounded" shadow="~ hover:lg"
    class="fixed bg-$vp-c-bg select-none z-24" :initial-value="{ x: 350, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + PolylineTool.Name" storage-type="session"
    v-show="globalStates.mainTool === PolylineTool.Name" :resizeable="true" :style="[topDivStyle]" :handle="dragHandle">
    <div ref="dragHandle" class="cursor-move" style="text-align:center">
      <el-text class="mx-1" type="primary">3D线-{{ polylineToolstates.mode }}</el-text>
    </div>
    <el-card>
      <el-row>
        <el-button-group v-if="polylineToolstates.mode === 'selected'">
          <el-button size="small" type="primary"
            @click="PolylineTool.instance?.onCommand('selected-edit')">编辑(E)</el-button>
          <el-button size="small" type="primary"
            @click="PolylineTool.instance?.onCommand('selected-del')">删除(X)</el-button>
          <el-button size="small" type="primary" @click="PolylineTool.instance.onCommand('cancel')">取消(Q)</el-button>
          <!-- <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('selected-copy')">复制</el-button> -->
        </el-button-group>
        <el-button-group v-else-if="polylineToolstates.mode === 'editingSelected'">
          <el-button size="small" type="primary"
            @click="PolylineTool.instance?.onCommand('editing-finish')">完成(Q)</el-button>
          <!-- <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('editing-cancel')">取消</el-button> -->
          <el-dropdown split-button size="small" type="primary"
            @click="PolylineTool.instance?.onCommand('selected-edit')" @command="handleEditCommand">
            控制
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="a">平移</el-dropdown-item>
                <el-dropdown-item command="s">旋转</el-dropdown-item>
                <el-dropdown-item command="d">缩放</el-dropdown-item>
                <el-dropdown-item divided></el-dropdown-item>
                <el-dropdown-item command="+">控件(+)</el-dropdown-item>
                <el-dropdown-item command="-">控件(-)</el-dropdown-item>
                <el-dropdown-item divided></el-dropdown-item>
                <el-dropdown-item command="x">显/隐</el-dropdown-item>
                <el-dropdown-item command="y">显/隐</el-dropdown-item>
                <el-dropdown-item command="z">显/隐</el-dropdown-item>
                <!-- <el-dropdown-item divided></el-dropdown-item> -->
                <!-- <el-dropdown-item command="q">退出(Q)</el-dropdown-item> -->
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-button-group>
        <el-button-group v-else-if="polylineToolstates.mode === 'createNew'">
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('createNew-finish')"
            :disabled="polylineToolstates.mode !== 'createNew'">完成</el-button>
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('createNew-cancel')"
            :disabled="polylineToolstates.mode !== 'createNew'">取消(Q)</el-button>
        </el-button-group>
        <el-button-group v-else>
          <el-button size="small" type="success" @click="PolylineTool.instance?.onCommand('createNew')"
            :disabled="polylineToolstates.mode === 'createNew'">新增(N)</el-button>
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
      <el-text v-show="polylineToolstates.mode === 'createNew'">
          <ol>
            <li>按下Ctrl键，移动光标，点击左键选择点</li>
            <li>敲击Z键，取消最近添加的点</li>
          </ol>
        </el-text>
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
import { polylineToolstates, PolylineTool } from '../polyline3d-tool'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
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

eventBus.on(eventBus.ToolBar.Command, async (params) => {
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


const handleEditCommand = (cmd: string) => {
  onTransformCommand(cmd)
}

const onTransformCommand = (cmd: string) => {
  const control = glGlobals.mainView.transformControl
  if (cmd === 'e') {
    control.enabled = true
    glGlobals.mainView.attachTransformControlToSeleted()
  }

  if (!control.enabled) {
    return
  }
  switch (cmd) {
    case 'q':
      control.enabled = false
      control.reset()
      control.detach()
      break
    case 'a':
      control.setMode('translate')
      break
    case 's':
      control.setMode('rotate')
      break
    case 'd':
      control.setMode('scale')
      break
    case '+':
    case '=':
      control.setSize(control.size + 0.1)
      break
    case '-':
    case '_':
      control.setSize(Math.max(control.size - 0.1, 0.1))
      break
    case 'x':
      control.showX = !control.showX
      break
    case 'y':
      control.showY = !control.showY
      break
    case 'z':
      control.showZ = !control.showZ
      break
    default:
      break
  }
}

onMounted(() => {
  // window.addEventListener('keydown', (event: any) => {
  //   onTransformCommand(event.key)
  // })
})
</script>
