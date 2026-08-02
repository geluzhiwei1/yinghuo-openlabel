<template>
<div style="position:absolute;left: 0px;top: 0px;" >
  <MainView></MainView>
  <XView></XView>
  <ZView></ZView>
  <YView></YView>
  
  <Hotbar></Hotbar>
  <!-- <BoxImageView ref="refBoxImageView"></BoxImageView> -->
  <ImageView ref="refImageView"></ImageView>

  <div id="gl-css2d-container" style="pointer-events: none;"></div>
  <div style="position: absolute;left: 0px;top:0px;" id="imagesViewContainer">
    <canvas id="imagesView"></canvas>
  </div>
  <div id="gl-scene-container">
    <canvas id="glMainViewCanvas"></canvas>
  </div>
</div>
</template>
<script setup lang="ts">
import '../render/Ego'
import '../render/globject/GlGrid'
import '../render/globject/RangeRuler'
import '../render/globject/SensorAxes'
// import '../render/-GlCameraManager'
import '../render/main-view'
import '../render/gl-pcs'
import '../render/annotation/box3d-annotation'
import '../render/point3d-highlight'
import '../render/annotation/polyline3d-annotation'
import { glGlobals } from '../render/GlObjectsHolder'
// import { Mouse } from '@/pointcloud/editor/mouse'
// import { useEventBridge } from '@/pointcloud/event'
// import UiTemplate from './parts/UiTemplate.vue'
import { commonChannel } from '../event/channel'
// import { Editor } from '@/pointcloud/editor/js/editor'
// import { Data } from '@/pointcloud/editor/js/data'
// import { useWindowSize } from '@vueuse/core'
import { eventBus } from '../event/EventBus'
import _ from 'lodash'
import { onMounted, ref } from 'vue'
// import { BoxBrush } from '@/pointcloud/editor/BoxBrush'

// import Hotbar from '../toolbar/hotbar.vue'
import ZView from './views/ZView.vue'
import XView from './views/XView.vue'
import YView from './views/YView.vue'
import MainView from './views/main-view.vue'
import '../render/three-view'
import { MainAnnotator } from '../tools/main-annotator'

import ImageView from './views/auto-image-view.vue'
const refImageView = ref()

/**
 * 当前帧发生变化
 */
const handleSeqDataChange = () => {
}

onMounted(() => {
  commonChannel.sub(commonChannel.Events.DataLoaded, () => {
    handleSeqDataChange()
  })

  glGlobals.init()

  // let boxBrush = null
  eventBus.on(eventBus.SeqData.Loaded, () => {
    // boxBrush = BoxBrush('mainCanva')
  })
})

const initCanvas = () => {

  // const canvas = new fabric.Canvas(, {
  //   width: appLayout.editor.width,
  //   height: appLayout.editor.height,
  // });

  // const textValue = 'fabric.js sandbox';
  // const text = new fabric.Textbox(textValue, {
  //   originX: 'center',
  //   splitByGrapheme: true,
  //   width: 200,
  //   top: 20,
  //   styles: fabric.util.stylesFromArray(
  //     [
  //       {
  //         style: {
  //           fontWeight: 'bold',
  //           fontSize: 64,
  //         },
  //         start: 0,
  //         end: 9,
  //       },
  //     ],
  //     textValue
  //   ),
  // });
  // canvas.add(text);
  // canvas.centerObjectH(text);

  // var circle = new fabric.Circle({
  //   radius: 20, fill: 'green', left: 100, top: 100
  // });
  // var triangle = new fabric.Triangle({
  //   width: 20, height: 30, fill: 'blue', left: 50, top: 50
  // });

  // canvas.add(circle, triangle);

  // canvas.on('mouse:down', function (options) {
  //   console.log(options.e.clientX, options.e.clientY);
  // });
}


const handleRightClick = (event) => {
  // select new object

  if (!this.data.world) {
    return
  }

  if (event.shiftKey || event.ctrlKey) {
    // if ctrl or shift hold, don't select any object.
    this.contextMenu.show('world', event.layerX, event.layerY, this)
    return
  }

  const intersects = this.mouse.getIntersects(
    this.mouse.onUpPosition,
    this.data.world.annotation.boxes
  )
  if (intersects.length > 0) {
    // var object = intersects[ 0 ].object;
    const object = intersects[0].object
    let targetObj = object.userData.object
    if (targetObj === undefined) {
      // helper
      targetObj = object
    }

    if (targetObj !== this.selectedBox) {
      this.selectBox(targetObj)
    }

    // this.hideWorldContextMenu();
    // this.showObjectContextMenu(event.layerX, event.layerY);
    this.contextMenu.show('object', event.layerX, event.layerY, this)
  } else {
    // if no object is selected, popup context menu
    // var pos = getMousePosition(renderer.domElement, event.clientX, event.clientY );
    this.contextMenu.show('world', event.layerX, event.layerY, this)
  }
}
/**
 * 处理鼠标事件
 * @param {} event
 * @returns
 */
const handleLeftClick = (event) => {
  if (event.ctrlKey) {
    // Ctrl+left click to smart paste!
    // smart_paste();
  } else {
    let allBoxes = this.data.world.annotation.boxes
    // let allBoxes = this.data.world.annotation.boxes.concat(this.data.world.radars.getAllBoxes())
    // allBoxes = allBoxes.concat(this.data.world.aux_lidars.getAllBoxes())

    let intersects = this.mouse.getIntersects(this.mouse.onUpPosition, allBoxes)

    if (intersects.length === 0) {
      if (this.data.world.radar_box) {
        intersects = this.mouse.getIntersects(this.mouse.onUpPosition, [
          this.data.world.radar_box
        ])
      }
    }

    if (intersects.length > 0) {
      // var object = intersects[ 0 ].object;
      const object = intersects[0].object
      if (object.userData.object !== undefined) {
        // helper
        this.selectBox(object.userData.object)
      } else {
        this.selectBox(object)
      }
    } else {
      this.unselectBox(null)
    }

    // render();
  }
}




const handleSelectRect = (x, y, w, h, ctrl, shift) => {

  // const boxes = this.data.world.annotation.findBoxesInsideRect(
  //   x,
  //   y,
  //   w,
  //   h,
  //   glGlobals.glCameraManager.mainView.camera
  // )
  // if (boxes.length > 0) {
  //   if (boxes.length === 1) {
  //     this.selectBox(boxes[0])
  //   } else {
  //   }

  //   return
  // }

  const points = selectPointsByViewRect(
    x,
    y,
    w,
    h
  )

  const initRoationZ = glGlobals.glCameraManager.mainView.camera.rotation.z + Math.PI / 2

}


</script>