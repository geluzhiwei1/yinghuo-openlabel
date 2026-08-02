import { Points3DSelector } from './point3d-selector'
import { eventBus } from '../event/EventBus'
import { reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import * as THREE from 'three'
import { glGlobals } from '../render/GlObjectsHolder'
import _ from 'lodash'
import PointInPoly from 'point-in-polygon-extended'
import { getRustHelper } from '../utils/rust-helper'


class Box3DSelectorRect extends Points3DSelector {
  static Name = 'points3DSelectorRect'
  public states = reactive({
    activated: false
  })
  static instance: Box3DSelectorRect

  startX = NaN
  startY = NaN

  private pointer = new THREE.Vector2()
  private canvasMouse: HTMLCanvasElement
  contextMouse
  viewWidth
  viewHeight
  viewWidth2
  viewHeight2
  raycaster
  frustum
  drawing = false
  

  constructor(domContainer: HTMLElement = document.body) {
    super(domContainer)
    const canvaId = 'mainCanva'
    this.canvasMouse = document.getElementById(canvaId) as HTMLCanvasElement
    this.resize()

    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.Points.threshold = 0.1
    this.frustum = new THREE.Frustum()

    this.mouseup = this.mouseup.bind(this)
    this.mousemove = this.mousemove.bind(this)
  }

  resize() {
    const divBox = this.domContainer.getBoundingClientRect()
    this.canvasMouse.width = divBox.width
    this.canvasMouse.height = divBox.height

    const box = this.canvasMouse.getBoundingClientRect()
    this.viewWidth = box.width
    this.viewHeight = box.height
    this.viewWidth2 = box.width / 2
    this.viewHeight2 = box.height / 2

    this.contextMouse = this.canvasMouse.getContext('2d')
}

  private watchers = [] as any[]
  private bindAutoOffEvents() {
    this.domContainer?.addEventListener('mouseup', this.mouseup)
    this.domContainer?.addEventListener('mousemove', this.mousemove)
    this.watchers.push(
      watch(
        () => jobConfig.frame,
        (v) => {
          // 取消选择
          this.reset()
        }
      )
    )
  }

  private unBindAutoOffEvents() {
    this.domContainer?.removeEventListener('mouseup', this.mouseup)
    this.domContainer?.removeEventListener('mousemove', this.mousemove)
    // this.domContainer?.removeEventListener('pointerdown', this.pointerdown)
    this.watchers.forEach((unwatch) => unwatch())
  }

  activate() {
    this.resize()
    this.bindAutoOffEvents()
    this.states.activated = true
  }

  deactivate(): void {
    this.unBindAutoOffEvents()
    this.states.activated = false
    this.drawing = false
    this.clearCanvasMouse()
    super.deactivate()
  }

  toggle(enable: boolean) {
    if (enable) {
      this.activate()
    } else {
      this.deactivate()
    }
  }

  toSelect() {
      const result = this.selectedPoints()
      if (!result) return
      const {inside, maxZ} = result
      // const scale = this.calculateWidthHeight(maxZ)
      // console.log(scale)

      eventBus.emit(eventBus.Box3d.Command, {
          data: inside, command: 'createByPoints',
      })
      this.polygon.length = 0
  }

  mouseup(event: MouseEvent) {
    if (event.ctrlKey) {
      if (this.drawing) {
        this.drawing = false
        this.toSelect()
      } else {
        this.drawing = true
        this.startX = event.offsetX
        this.startY = event.offsetY
      }
    }
  }

  mousemove(event) {
    this.clearCanvasMouse()
    if (this.drawing) {
      this.polygon.length = 0
      const fx = this.startX
      const fy = this.startY
      this.pushPoint(fx, fy)
      this.pushPoint(event.offsetX, fy)
      this.pushPoint(event.offsetX, event.offsetY)
      this.pushPoint(fx, event.offsetY)
      this.pushPoint(fx, fy)

      // console.log(this.polygon[0], this.polygon[2])
      this.drawPolyLine(this.contextMouse, this.polygon, '#0000FF', 0, 1, false)
    } else if (event.ctrlKey){
      const xy = [event.offsetX, event.offsetY]
      this.pointer.x = (2 * xy[0]) / event.target.clientWidth - 1
      this.pointer.y = (-2 * xy[1]) / event.target.clientHeight + 1
  
      this.drawCanvasMouse(event)
    }
  }
  clearCanvasMouse() {
    this.contextMouse!.clearRect(0, 0, this.viewWidth, this.viewHeight)
  }
  drawPolyLine(context, pts, color, xField = 0, yField = 1, close) {
    if (!pts || !pts.length) return
    context.beginPath()
    context.lineWidth = 1
    context.strokeStyle = color
    context.moveTo(pts[0][xField], pts[0][yField])

    for (let i = 1; i < pts.length; i++) {
      context.lineTo(pts[i][xField], pts[i][yField])
    }

    if (close) context.lineTo(pts[0][xField], pts[0][yField])
    context.stroke()
  }
  getCurrentPcd() {
    return glGlobals
      .getCurrentSensorGroup()!
      .getObjectByName(glGlobals.buildPcdMeshName(jobConfig)) as THREE.Points
  }
  _raycasting() {
    this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)

    const pcdMesh = this.getCurrentPcd()
    const intersects = this.raycaster.intersectObjects([pcdMesh], false)

    if (intersects.length > 0) {
      intersects.sort((a, b) => (a.distanceToRay < b.distanceToRay ? -1 : 1))
      return intersects
    } else {
      return null
    }
  }

  drawCanvasMouse(event) {
    const ctx = this.contextMouse!

    // 绘制鼠标位置点，高亮显示
    const intersectObjects = this._raycasting()
    if (!intersectObjects) return
    // eventBus.emit(eventBus.Points3DAnnotation.Highlight, {
    //   command: 'mousemove',
    //   glObj: intersectObjects
    // })
    const obj = intersectObjects[0]
    // const localPos = obj.object.worldToLocal(obj.point)
    const pj = this.pointToPixel(obj.point)
    if (pj) {
      ctx.beginPath()
      ctx.strokeStyle = '#0000FF'
      ctx.lineWidth = 1
      ctx.arc(pj.pixelX, pj.pixelY, 5, 0, Math.PI * 2.0)
      ctx.stroke()
    }
  }

  pixelToPoint(p: {x:number, y:number}, maxZ: number): THREE.Vector3 | null {
      const coords = new THREE.Vector2(
          (p.x / this.canvasMouse.width) * 2 - 1,
          -(p.y / this.canvasMouse.height) * 2 + 1,
      )
      const worldPosition = new THREE.Vector3()
      const plane = new THREE.Plane(new THREE.Vector3(0.0, 0.0, maxZ))
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(coords, glGlobals.mainView.camera)
      return raycaster.ray.intersectPlane(plane, worldPosition)
  }

  /**
   * 根据手绘的框，计算宽度和高度
   *
   * @returns 包含宽度和高度的对象
   */
  calculateWidthHeight(maxZ: number) {
    const polygon = this.polygon
    const p1 = this.pixelToPoint(new THREE.Vector2(polygon[0][0], polygon[0][1]), maxZ)
    const p2 = this.pixelToPoint(new THREE.Vector2(polygon[2][0], polygon[2][1]), maxZ)
    if (!p1 || !p2) return null
    const width = Math.abs(p1.x - p2.x)
    const height = Math.abs(p1.y - p2.y)
    return {width, height }
  }

  /**
   * 框选算法 — 优先走 rust_wasm 的 pc_select_points_in_polygon,把整段
   * `vector.project + pointInPolyWindingNumber` 循环搬进 wasm。
   * wasm 不可用 / 抛错时回退到 selectedPointsJS。
   *
   * 矩阵传参:
   * - matrixWorld:pcdMesh.matrixWorld.elements(mesh-local → world)
   * - viewProjMatrix:camera.projectionMatrix * camera.matrixWorldInverse(world → NDC)
   * wasm 内部合并为 mvp = viewProj * matrixWorld,逐点投影。
   */
  selectedPoints() {
    const pcdMesh = this.getCurrentPcd()
    if (!pcdMesh) return

    const helper = getRustHelper()
    if (helper?.pc_select_points_in_polygon) {
      try {
        const positionAttr = pcdMesh.geometry.attributes.position
        const camera = glGlobals.mainView.camera
        const box = glGlobals.mainView.container.getBoundingClientRect()

        // viewProj = projectionMatrix * matrixWorldInverse
        const viewProj = new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse
        )

        const polygon = this.polygon as number[][]
        const polyFlat = Float32Array.from(polygon.flat())

        const indices = helper.pc_select_points_in_polygon(
          positionAttr.array as Float32Array,
          pcdMesh.matrixWorld.elements,
          viewProj.elements,
          box.width,
          box.height,
          polyFlat,
        )

        if (indices) {
          const inside = new Set<number>()
          for (let i = 0; i < indices.length; i++) inside.add(indices[i])

          // maxZ 单独扫一遍 positionAttr(数据局部性好,代价小)。
          // 与原实现一致:maxZ 是 mesh-local z。
          let maxZ = Number.NEGATIVE_INFINITY
          for (let i = 0; i < indices.length; i++) {
            const z = positionAttr.getZ(indices[i])
            if (z > maxZ) maxZ = z
          }
          return { inside, maxZ }
        }
      } catch (err) {
        console.warn('[wasm select] fallback to JS:', err)
      }
    }
    return this.selectedPointsJS()
  }

  selectedPointsJS() {
    const polygon = this.polygon

    const inside = new Set()
    const pcdMesh = this.getCurrentPcd()
    if (!pcdMesh) return

    let maxZ = Number.NEGATIVE_INFINITY
    let temp = 0.0
    // 遍历pcdMesh的顶点
    for (let i = 0; i < pcdMesh.geometry.attributes.position.count; i++) {
        const pt = new THREE.Vector3().fromBufferAttribute(pcdMesh.geometry.attributes.position, i)
        temp = pt.z
        pt.applyMatrix4(pcdMesh.matrixWorld)
        // const local = pcdMesh.worldToLocal(pt)
        const pixel = this.pointToPixel(pt)

        const inPolygon = PointInPoly.pointInPolyWindingNumber(
            [pixel.pixelX, pixel.pixelY],
            polygon
        )

        if (inPolygon) {
            inside.add(i)

            maxZ = Math.max(temp, maxZ)
        }
    }

    return {inside, maxZ}
}

  pointToPixel(vector: THREE.Vector3) {
    const camera = glGlobals.mainView.camera
    const box = glGlobals.mainView.container.getBoundingClientRect()
    const viewWidth = box.width
    const viewHeight = box.height
    const viewWidth2 = box.width / 2
    const viewHeight2 = box.height / 2
    const clippingBox = [-2, -2, viewWidth + 4, viewHeight + 4]

    this.frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    )

    let pixelX = NaN
    let pixelY = NaN
    const inFrustrum = this.frustum.containsPoint(vector)
    if (inFrustrum) {
      vector.project(camera)
      pixelX = Math.round(vector.x * viewWidth2 + viewWidth2)
      pixelY = Math.round(-vector.y * viewHeight2 + viewHeight2)
    }

    return {
      pixelX,
      pixelY
    }
  }
}

eventBus.on(eventBus.pcEditor.Inited, () => {
  Box3DSelectorRect.instance = new Box3DSelectorRect(
    document.getElementById('m-view-manipulator') as HTMLElement
  )
})

export { Box3DSelectorRect }
