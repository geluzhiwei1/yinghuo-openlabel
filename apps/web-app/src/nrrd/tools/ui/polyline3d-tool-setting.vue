<template>
  <Draggable
  v-slot="{ x, y }"
      p="x-4 y-2"
      border="~ gray-400/30 rounded"
      shadow="~ hover:lg"
      class="fixed bg-$vp-c-bg select-none cursor-move z-24"
    :initial-value="{ x: 350, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + PolylineTool.Name"
    storage-type="session"
    v-show="polylineToolstates.activated"
    :resizeable="true"
    :style="[topDivStyle]"
    :handle="dragHandle"
  >
    <div ref="dragHandle" class="cursor-move">
      <el-text class="mx-1" type="primary">工具选项-{{ polylineToolstates.mode }}</el-text>
    </div>
    <div>
      <el-row  class="justify-center">
        <el-button-group v-if="polylineToolstates.mode === 'editingSelected'">
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('editing-finish')">完成</el-button>
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('editing-cancel')">取消</el-button>
        </el-button-group>
        <el-button-group v-else>
          <el-button size="small" type="primary"  @click="PolylineTool.instance?.onCommand('createNew')" :disabled="polylineToolstates.mode === 'createNew'">新建</el-button>
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('createNew-finish')" :disabled="polylineToolstates.mode !== 'createNew'">完成</el-button>
          <el-button size="small" type="primary" @click="PolylineTool.instance?.onCommand('createNew-cancel')" :disabled="polylineToolstates.mode !== 'createNew'">取消</el-button>
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
      <!-- <el-row>
        <el-col :span="2"> </el-col>
        <el-col :span="22">
          <el-checkbox v-model="settingForm.highlight.toPlane" label="贴近地面" />
          <el-input v-model="settingForm.highlight.threshold" style="width: 150px">
            <template #prepend>threshold</template>
          </el-input>
          <el-input v-model="settingForm.highlight.pointCount" style="width: 150px">
            <template #prepend>count</template>
          </el-input>
          <el-color-picker v-model="settingForm.highlight.color" />
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="2"> 当前点 </el-col>
        <el-col :span="22">
          <el-select
            v-model="settingForm.highlight.coordinateSystem"
            style="width: 100px"
            placeholder="坐标"
          >
            <el-option label="世界坐标" value="world" />
            <el-option label="本地坐标" value="local" />
          </el-select>
          <el-input v-model="settingForm.selected.point.x" style="width: 80px"> </el-input>
          <el-input v-model="settingForm.selected.point.y" style="width: 80px"> </el-input>
          <el-input v-model="settingForm.selected.point.z" style="width: 80px"> </el-input>
          <el-button>删除</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="2"> 线 </el-col>
        <el-col :span="22">
          <el-input v-model="settingForm.line.pointCount" style="width: 80px"> </el-input>
          <el-select v-model="settingForm.line.type" style="width: 100px">
            <el-option label="世界坐标" value="world" />
            <el-option label="本地坐标" value="local" selected="true" />
          </el-select>
          <el-checkbox v-model="settingForm.line.closed" label="封闭" />
          <el-select v-model="settingForm.line.dashed" style="width: 100px">
            <el-option label="实线" value="solid" selected />
            <el-option label="虚线" value="dashed" />
          </el-select>
          <el-color-picker v-model="settingForm.line.color" />
          <el-button>删除</el-button>
        </el-col>
      </el-row>
      <el-row class="justify-center">
        <el-button-group>
          <el-button type="primary">恢复默认值</el-button>
        </el-button-group>
      </el-row> -->
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
// import { polylineToolstates, PolylineTool } from '../polyline-tool'

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
</script>
