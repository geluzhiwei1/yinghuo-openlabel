<template>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: 400, y: 150 }" :prevent-default="true" :style="[topDivStyle]"
    :handle="dHandle" :key="refreshKey" :resizeable="true" :onDragEnd="dragHandle" :on-resized="resizedHandle" v-show="autoImageViewVisible">
    <div ref="dHandle" class="cursor-move">
      <el-text class="mx-1" type="primary">自动图像</el-text>
      <el-popover
        class="box-item"
        content="Left Top prompts info"
        placement="left-start"
      >
          <template #reference>
        <el-button size="small" type="default">设置</el-button>
      </template>
      <div>
        <el-checkbox v-model="visiable" label="显示" size="large"></el-checkbox>
      </div>
    </el-popover>
    </div>
    <canvas id="canvaAutoImage"></canvas>
  </Draggable>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import _ from 'lodash'
import { UseDraggable as Draggable } from '../../../components/DraggableResizeableComponents'
import { eventBus } from '../../event/EventBus'
import { fabric } from 'fabric'
import * as THREE from 'three'
import { glBoxAnnotationManager, FrameAnnotation } from '@/pointcloud/render/annotation/box3d-annotation'
import { pySeqData } from '@/pointcloud/api'
import { jobConfig } from '@/states/job-config'
import type { BBox3d } from '@/openlabel'
import { userAuth } from '@/states/UserState'


const autoImageViewVisible = ref(false)

// const elRef = ref<HTMLElement | null>(null)
const dHandle = ref<HTMLElement | null>(null)
const topDivStyle = ref({
  width: 400 + 'px',
  boxShadow: `var(--el-box-shadow-lighter)`
})
const refreshKey = ref(1)
const visiable = ref(true)
// const divPos = reactive({ x: 400, y: 100 })
let canvasObj: fabric.Canvas | null = null
let imageObj: fabric.Image | null = null
let currentSrc = '#'
let canvasEvents

const color_conf = reactive({
    field_index: -1,
    range_min: .1,
    range_max: 1.0,
    color_map_name: 'jet'
  })
const undistort_conf = reactive({
  enabled: false,
  alpha: 1,
})
const plot_conf = reactive({
  image: true,
  lidar: true,
  box: true,
})
const crop_box_conf = reactive({
  enabled: false,
  expand_px: 20,
})

const resizeCanvas = () => {
  const height = dHandle.value?.parentElement.clientHeight - dHandle.value?.clientHeight
  const width = dHandle.value?.parentElement.clientWidth
  // // const dimensions = { height, width }
  // // const { height, width } = elRef.value?.getClientRect()
  canvasObj?.setDimensions({ height, width })
  // renderImage(currentSrc)
  ajustImageObj()
}

const resizedHandle = (rect: DOMRect, event: PointerEvent) => {
  resizeCanvas()
}

const dragHandle = (rect: DOMRect, event: PointerEvent) => {
  // resizeCanvas()
}

class CanvasEvents {
  constructor(canvas) {
    // canvas.on('mouse:wheel', function (opt) {
    //   var delta = opt.e.deltaY;
    //   var zoom = canvas.getZoom();
    //   zoom *= 0.999 ** delta;
    //   if (zoom > 20) zoom = 20;
    //   if (zoom < 0.01) zoom = 0.01;
    //   canvas.setZoom(zoom);
    //   opt.e.preventDefault();
    //   opt.e.stopPropagation();
    // });
    canvas.on('mouse:down', function (opt) {
      var evt = opt.e;
      // if (evt.altKey === true) {
      if (evt.button === 2) {
        // 右键
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
      }
    });
    canvas.on('mouse:move', function (opt) {
      if (this.isDragging) {
        var e = opt.e;
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
      }
    });
    canvas.on('mouse:wheel', function (opt) {
      var delta = opt.e.deltaY;
      var zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    canvas.on('mouse:up', function (opt) {
      this.setViewportTransform(this.viewportTransform);
      this.isDragging = false;
      this.selection = true;
    });
  }
}

const initCanvas = () => {
  if (canvasObj) {
    canvasObj.dispose()
    canvasObj = null
    imageObj = null
  }
  canvasObj = new fabric.Canvas(document.getElementById('canvaAutoImage'),
    { fireRightClick: true })
  canvasEvents = new CanvasEvents(canvasObj)
  // const imgElement = document.getElementById('autoImage')
  // imageObj = new fabric.Image(imgElement, {
  //   left: 0,
  //   top: 0,
  // })
  // imageObj.centeredScaling = true
  // canvasObj?.add(imageObj)
}

const renderImage = (newSrc: string) => {
  if (!visiable.value) {
    return
  }
  if (!newSrc || newSrc === '' || newSrc === '#') {
    // imageObj.visible = false
    return
  }
  // if (newSrc === currentSrc) {
  //   imageObj?.scaleToHeight(canvasObj.getHeight())
  //   imageObj?.adjustPosition('center')
  //   canvasObj?.renderAll()
  //   return
  // }
  // change src
  // imageObj?.setSrc(
  //   newSrc,
  //   function (image) {
  //     imageObj.visible = true
  //     // set pos, scale
  //     const height = elRef.value?.clientHeight
  //     imageObj?.scaleToHeight(height)
  //     imageObj?.adjustPosition('center')
  //     canvasObj?.renderAll()
  //     currentSrc = newSrc
  //   }
  // )

  imageObj?.dispose()
  fabric.Image.fromURL(newSrc, (newImageObj) => {
    imageObj = newImageObj
    imageObj.selectable = false
    canvasObj.add(imageObj)
    currentSrc = newSrc
    ajustImageObj()
  }, { crossOrigin: '' })
}

const ajustImageObj = () => {
  if (!imageObj) {
    return
  }
  imageObj?.scaleToHeight(canvasObj.getHeight() - 4)
  // imageObj?.adjustPosition('center')
  imageObj?.center()
  canvasObj?.renderAll()
}

const paintOnImage = async (targetBox) => {
  const lidarId = jobConfig.stream
  let annos = []
  const frameAnno: FrameAnnotation = glBoxAnnotationManager.getCurrent()
  if (frameAnno) {
    annos = frameAnno.toJson()
  }
  const res = await pySeqData.visualizer.plot_boxes_on_synced_image({
    ...jobConfig,
    psr_boxes:annos,
    target_box:targetBox,
    frame_id:undefined,
    ts:jobConfig.ts,
    stream_cam_id: undefined,
    stream_lidar_id: lidarId,
    plot_conf: plot_conf,
    crop_box_conf: crop_box_conf,
    points_color_conf: color_conf,
    undistort_conf: undistort_conf,
    }
  )

  return res.data
}

const glObjectToBBox3d = (glBox: THREE.Object3D):BBox3d => {
  const ann = {
    ...glBox.userData.anno,
    val: [glBox.position.x, glBox.position.y, glBox.position.z,
          glBox.rotation.x, glBox.rotation.y, glBox.rotation.z,
          glBox.scale.x, glBox.scale.y, glBox.scale.z]
  } as BBox3d
  return ann
}

eventBus.on(eventBus.Box3d.SelectedChanged, async (params) => {
  if (jobConfig.data_source === 'localImage') {
    return
  }

  if (!params) {
    autoImageViewVisible.value = false
    return
  }
  const { glBox } = params
  if (!glBox) {
    autoImageViewVisible.value = false
    return
  }
  autoImageViewVisible.value = true
  const targetBox = glObjectToBBox3d(glBox)

  const src = await paintOnImage(targetBox)
  renderImage(src)
})

eventBus.on(eventBus.Common.FocusPoint, async (params) => {
  if (jobConfig.data_source === 'localImage') {
    return
  }
  if (!params) {
    autoImageViewVisible.value = false
    return
  }
  const { point } = params
  if (!point) {
    autoImageViewVisible.value = false
    return
  }
  autoImageViewVisible.value = true
  const res = await pySeqData.seq_sort_camera_by_point({
    ...jobConfig,
    point: [point.position.x, point.position.y, point.position.z],
    stream_lidar_id: jobConfig.stream,
  })
  if (Array.isArray(res.data) && res.data.length > 0) {
    const firstUri = `${res.data[0].uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
    renderImage(firstUri)
  }
})

onMounted(() => {
  // divPos.x = appLayout.editor.imageView.left
  // divPos.y = appLayout.editor.imageView.top
  initCanvas()
  resizeCanvas()
})

// const reRender = () => {
//   refreshKey.value += 1
// }

// defineExpose({
//   reRender
// })
</script>
<style lang="scss" scoped>
.resizeable {
  resize: both;
  border: 1px solid green;
  border-radius: 4px;
  outline: none;
  white-space: pre;
  overflow-wrap: normal;
  overflow: hidden;
}
</style>