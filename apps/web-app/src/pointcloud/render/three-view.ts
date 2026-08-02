import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { eventBus } from '../event/EventBus'
import { entityChannel } from '../event/channel'
import { glGlobals } from './GlObjectsHolder'
import _ from 'lodash'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { get, set } from 'radash'
import { OlTypeEnum } from '@/openlabel'
import { reactive } from 'vue'

abstract class AbstrctBoxView {
  protected viewDiv: HTMLElement | null = null
  protected domContainer: HTMLElement | null = null

  protected scene: THREE.Scene
  protected renderer: THREE.WebGLRenderer
  protected zoomRatio = 1.0

  protected camera: any
  // protected cameraHelper: THREE.CameraHelper
  // protected cameraGroup: THREE.Group

  protected target: any

  // protected canvas: fabric.Canvas
  // protected rectObject: fabric.Rect
  protected control: TransformControls
  protected orbit: OrbitControls

  // states
  protected states = reactive({
    visiable: false
  })

  // 防御 (a):viewDiv 在 v-show 刚切到 true 的同一帧里 clientWidth/Height 还是 0,
  // 此时算 aspect 会得到 0/Infinity/NaN,把投影矩阵写成坏值,后续 render 全空
  // (典型表现:旋转主视图后三视图变白块,拖一下面板宽度才恢复)。
  // 跳过这次更新,等下一帧 DOM 真正布局完再补一次。
  protected resizeRetryPending = false

  constructor(
    viewDiv: HTMLElement,
    domContainer: HTMLElement,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer
  ) {
    this.scene = new THREE.Scene()
    this.renderer = renderer
    this.viewDiv = viewDiv
    this.init()
    this.initGl()
    // this.initMouseEvent(viewDiv)
    this.onResize()
  }

  protected initMouseEvent(viewDiv: HTMLElement) {
    viewDiv.addEventListener('wheel', (event) => {
      event.stopPropagation()
      event.preventDefault()
      let multiplier = 1.0
      if (event.deltaY > 0) {
        multiplier = 1.1
      } else {
        multiplier = 0.9
      }
      this.zoomRatio *= multiplier

      this.updateCameraRange()
      this.render()
    })
  }

  private cameraPersp: any
  private cameraOrtho: any
  protected init() {
    const { viewDiv } = this
    const width = viewDiv.clientWidth
    const height = viewDiv.clientHeight
    const aspect = width / height
    const frustumSize = 5

    this.cameraPersp = new THREE.PerspectiveCamera(75, aspect, 0.001, 1000)
    this.cameraOrtho = new THREE.OrthographicCamera(
      -frustumSize * aspect,
      frustumSize * aspect,
      frustumSize,
      -frustumSize,
      0.1,
      100
    )
    // left : Number, right : Number, top : Number, bottom : Number, near : Number, far : Number
    this.camera = this.cameraOrtho
    // this.cameraHelper = new THREE.CameraHelper(this.camera)
    // this.cameraHelper.visible = true
    // this.cameraGroup = new THREE.Group()
    // this.cameraGroup.name = viewDiv?.id
    // this.cameraGroup.add(this.camera)
    // control
    // this.render = this.render.bind(this)
    const controls = new TransformControls(this.camera, viewDiv)
    // controls.addEventListener('mouseUp', (event) => {
    //   console.log(event);
    // });

    // 编辑了对象，触发事件，更新数据
    controls.addEventListener('objectChange', (event) => {
      if (!controls.object?.userData?.anno) {
        return
      }
      set(controls.object.userData, 'anno.attributes.opType', 'update')
      switch (controls.object?.userData.anno.ol_type_) {
        case OlTypeEnum.BBox3d:
          eventBus.emit(eventBus.Box3d.TransformEdited, {
            event,
            data: controls.object
          })
          break
        case OlTypeEnum.Point3d: // 线的控制点
          // this.onPolylineEdited(event, controls.object)
          eventBus.emit(eventBus.PolylineAnnotation.TransformEdited, {
            event,
            data: controls.object
          })
          break
        default:
          break
      }
    })

    controls.addEventListener('change', () => {
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    })
    this.orbit = new OrbitControls(this.camera, viewDiv)
    controls.addEventListener('dragging-changed', (event) => {
      this.orbit.enabled = !event.value
    })
    this.orbit.update()
    this.orbit.addEventListener('change', () => {
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    })

    this.control = controls

    // 控件模式
    const controlModes: string[] = ['translate', 'scale', 'rotate']
    let currentMode = controlModes[0]
    viewDiv?.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      const currentIndex = controlModes.indexOf(currentMode)
      const nextIndex = (currentIndex + 1) % controlModes.length // 循环切换
      currentMode = controlModes[nextIndex]
      this.setContolMode(currentMode) // 更新控件模式
    })
  }

  /**
   * 当折线被编辑时触发的回调函数
   *
   * @param event 事件对象
   * @param box 被编辑的折线对象
   */
  public onPolylineEdited(event: any, box: THREE.Object3D) {
    if (OlTypeEnum.Point3d === box.userData.anno.ol_type_) {
      if (event.target.domElement.id === this.viewDiv.id) {
        // 自己改的，不处理
        return
      }
      if (this.target) {
        this.target.copy(box)
      }
      eventBus.emit(eventBus.PolylineAnnotation.ControlPointsChanged)
    }
  }

  abstract setContolMode(mode: string): void

  abstract initGl(): void

  public onResize() {
    const width = this.viewDiv.clientWidth
    const height = this.viewDiv.clientHeight

    // 守卫 (a):viewDiv 还没真正布局(v-show 刚切到 true 的同一帧,
    // 或父容器还没展开),clientWidth/Height 为 0。直接写 aspect 会让
    // 投影矩阵变成 NaN,之后所有 render 都渲染不出内容。
    // 跳过这次更新,等下一帧 layout 完成后再补一次。
    if (!width || !height) {
      if (!this.resizeRetryPending) {
        this.resizeRetryPending = true
        requestAnimationFrame(() => {
          this.resizeRetryPending = false
          this.onResize()
        })
      }
      return
    }

    const aspect = width / height
    // const aspect = window.innerWidth / window.innerHeight

    this.cameraPersp.aspect = aspect
    this.cameraPersp.updateProjectionMatrix()

    this.cameraOrtho.left = this.cameraOrtho.bottom * aspect
    this.cameraOrtho.right = this.cameraOrtho.top * aspect
    this.cameraOrtho.updateProjectionMatrix()

    // this.camera.aspect = aspect
    // this.camera.updateProjectionMatrix()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public onRectChanged(rect) {}

  public updateRectView(objectDimension) {
    const viewRatio = this.viewDiv.clientWidth / this.viewDiv.clientHeight
    const boxRatio = objectDimension.x / objectDimension.y

    let width = this.viewDiv.clientWidth / 1.5
    let height = this.viewDiv.clientHeight / 1.5

    if (boxRatio > viewRatio) {
      // handle width is viewport.width*2/3
      width = width / this.zoomRatio
      height = width / boxRatio
    } else {
      // handle height is viewport.height*2/3
      height = height / this.zoomRatio
      width = height * boxRatio
    }

    // this.viewHandleDimension.x = width
    // this.viewHandleDimension.y = height

    const x = this.viewDiv.clientWidth / 2
    const y = this.viewDiv.clientHeight / 2

    const left = x - width / 2
    const right = x + width / 2
    const top = y - height / 2
    const bottom = y + height / 2

    const rect = { left, top, width, height }
    this.onRectChanged(rect)

    return rect
  }

  public updateCameraRange() {
    if (!this.target) return
    const box = this.target
    const { viewDiv, camera, cameraHelper } = this

    // let expCameraHeight = box.scale.x * 1.5 * zoomRatio;
    // let expCameraWidth = box.scale.y * 1.5 * zoomRatio;
    // const expCameraClip = box.scale.z + 0.8;
    const { zoomRatio } = this
    let expCameraHeight = zoomRatio,
      expCameraWidth = zoomRatio,
      expCameraClip = zoomRatio
    if (box instanceof THREE.Object3D) {
      expCameraHeight = box.scale.x * 1.5 * zoomRatio
      expCameraWidth = box.scale.y * 1.5 * zoomRatio
      expCameraClip = box.scale.z + 0.8
    }

    const viewWidth = viewDiv.clientWidth
    const viewHeight = viewDiv.clientHeight
    if (expCameraWidth / expCameraHeight > viewWidth / viewHeight) {
      expCameraHeight = (expCameraWidth * viewHeight) / viewWidth
    } else {
      expCameraWidth = (expCameraHeight * viewWidth) / viewHeight
    }

    camera.top = expCameraHeight / 2
    camera.bottom = expCameraHeight / -2
    camera.right = expCameraWidth / 2
    camera.left = expCameraWidth / -2

    camera.near = expCameraClip / -2
    camera.far = expCameraClip / 2
    // camera.top = 3
    // camera.bottom = -3
    // camera.right = 3
    // camera.left = -3

    // camera.near = 0.1;
    // camera.far = 20000;

    // camera.position.z = 10

    camera.updateProjectionMatrix()
    cameraHelper.update()

    // // cameraGroup.matrix.copy(box.matrixWorld)
    // let p,r
    // p = new THREE.Vector3().setFromMatrixPosition(box.matrixWorld)
    // r = new THREE.Euler().setFromRotationMatrix(box.matrixWorld)
    // // console.log(r);
    // //

    if (box instanceof THREE.Object3D) {
      // const rect = this.updateRectView({x:box.scale.x, y:box.scale.y, z:box.scale.z})
      // const rect = this.calcRectView(box)
      // const vector = new THREE.Vector3();
      // box.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。
      // //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
      // vector.setFromMatrixPosition(box.matrixWorld);
      // const rect = objectPositionToScreen(this.camera, box, this.renderer!)
      // // this.onRectChanged(rect)
      // console.log('object pos', rect)
      // if (this.canvas) {
      // const ctx = this.canvas.getContext("2d");
      // ctx.lineWidth = 50;
      // ctx.moveTo(rect.x, rect.y);
      // ctx.lineTo(rect.x, rect.y);
      // ctx.stroke();
      // }
    }
  }

  abstract updateCameraPose(): void

  public calcRectView(object) {
    let pos = new THREE.Vector3()
    object.updateMatrixWorld()
    pos = pos.setFromMatrixPosition(object.matrixWorld)
    pos.project(this.camera)
    const widthHalf = this.viewDiv.clientWidth / 2
    const heightHalf = this.viewDiv.clientHeight / 2

    pos.x = pos.x * widthHalf + widthHalf
    pos.y = -(pos.y * heightHalf) + heightHalf
    pos.z = 0

    console.log(pos)

    return {
      scaleY: 1
    }
  }

  public render() {
    const vp = this.getViewPort()
    // const backgroundColor = isDark ? new THREE.Color(0.1, 0.05, 0.05) : new THREE.Color(0.95, 0.9, 0.9)
    glGlobals.renderer.setScissorTest(true)
    glGlobals.renderer.setViewport(vp.left, vp.bottom, vp.width, vp.height)
    glGlobals.renderer.setScissor(vp.left, vp.bottom, vp.width, vp.height)
    // glGlobals.renderer.setClearColor(backgroundColor)
    glGlobals.renderer.render(this.scene, this.camera)
    glGlobals.renderer.setScissorTest(false)
  }

  protected getViewPort() {
    const { viewDiv, zoomRatio } = this
    const rect = viewDiv.getBoundingClientRect()
    const parentRect = glGlobals.renderer.domElement.getBoundingClientRect()
    return {
      left: rect.left - parentRect.left,
      bottom: parentRect.height + parentRect.top - rect.bottom,
      width: rect.width,
      height: rect.height,
      zoomRatio: zoomRatio
    }
  }

  public onBox3dEdited(event: any, box: THREE.Object3D) {
    if (OlTypeEnum.BBox3d === box.userData.anno.ol_type_) {
      if (event.target.domElement.id === this.viewDiv.id) {
        // 自己改的，不处理
        return
      }
      if (this.target) {
        this.target.copy(box)
      }
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }
  }

  public onBoxChanged(box: THREE.Object3D) {
    // 重建场景
    const copiedGroup = glGlobals.framesGroup.clone(true)
    this.scene?.clear()
    this.scene?.add(copiedGroup)
    // this.scene?.add(this.camera)
    // this.scene?.add(this.cameraHelper)
    // this.scene?.add(box)
    if (this.control && box && OlTypeEnum.BBox3d === box.userData?.anno?.ol_type_) {
      //
      const copiedBox = copiedGroup.getObjectByName(
        OlTypeEnum.BBox3d + box.userData.anno.label_uuid
      )
      // this.scene?.add(copiedBox)
      const gizmo = this.control.getHelper()
      this.scene?.add(gizmo)
      this.control.attach(copiedBox)

      this.target = copiedBox
      this.updateCameraPose()
      // this.updateCameraRange()

      // const { camera } = this
      // camera.top = 300
      // camera.bottom = -300
      // camera.right = 300
      // camera.left = -300
      // camera.near = 0.1;
      // camera.far = 20000;
      // camera.position.z = 10
    }

    this.camera.updateProjectionMatrix()
    if (this.orbit) {
      this.orbit.update()
    }
    this.onResize()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public focusPoint(point: any) {
    const copiedGroup = glGlobals.framesGroup.clone(true)
    this.scene?.clear()
    this.scene?.add(copiedGroup)
    if (this.control && point) {
      // this.scene?.add(copiedBox)
      const gizmo = this.control.getHelper()
      this.scene?.add(gizmo)
      this.control.attach(point)

      this.target = point
      this.updateCameraPose()
      // this.updateCameraRange()

      // const { camera } = this
      // camera.top = 300
      // camera.bottom = -300
      // camera.right = 300
      // camera.left = -300
      // camera.near = 0.1;
      // camera.far = 20000;
      // camera.position.z = 10
    }

    this.camera.updateProjectionMatrix()
    if (this.orbit) {
      this.orbit.update()
    }
    this.onResize()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  // public onZoomChanged(zoomRatio: number) {
  //   this.zoomRatio = zoomRatio
  //   this.render()
  // }
}

class ZView extends AbstrctBoxView {
  initGl() {
    this.camera.position.set(0, 0, 50)
    this.camera.up.set(1, 0, 0) // 将向上向量设置为(0, 0, 1)，即垂直于屏幕的方向
    this.camera.lookAt(0, 0, 0)
    if (this.control) {
      this.control.setSize(3)
      // this.control.showZ = false
    }
  }
  updateCameraPose() {
    if (!this.target) return
    const box = this.target as THREE.Object3D
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    box.updateMatrixWorld()
    box.matrixWorld.decompose(t, q, s)

    this.camera.position.x = t.x
    this.camera.position.y = t.y
    this.camera.position.z = t.z + 5
    this.camera.quaternion.copy(q)

    this.orbit.target.x = t.x
    this.orbit.target.y = t.y
    this.orbit.target.z = t.z
  }
  public setContolMode(mode: string) {
    // 检查当前编辑的对象是否是BBox3d类型，如果不是则不执行后续操作
    if (this.target?.userData?.anno?.ol_type_ === OlTypeEnum.Point3d) {
      // 强制只能是translate模式
      mode = 'translate'
    }
    const { control } = this
    if (!control) return
    switch (mode) {
      case 'translate':
        control.setMode('translate')
        control.showX = true
        control.showY = true
        control.showZ = false
        break
      case 'scale':
        control.setMode('scale')
        control.showX = true
        control.showY = true
        control.showZ = false
        break
      case 'rotate':
        control.setMode('rotate')
        control.showX = false
        control.showY = false
        control.showZ = true
        break
      case 'reset':
        this.updateCameraPose()
        this.camera.updateProjectionMatrix()
        if (this.orbit) {
          this.orbit.update()
        }
        break
      default:
        break
    }
  }
}

class YView extends AbstrctBoxView {
  initGl() {
    this.camera.position.set(0, 50, 0)
    this.camera.up.set(0, 0, 1)
    this.camera.lookAt(0, 0, 0)
    if (this.control) {
      this.control.setSize(3)
    }
  }

  updateCameraPose() {
    if (!this.target) return
    const box = this.target as THREE.Object3D
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    box.updateMatrixWorld()
    box.matrixWorld.decompose(t, q, s)

    this.camera.position.x = t.x
    this.camera.position.y = t.y + 5
    this.camera.position.z = t.z
    this.camera.quaternion.copy(q)

    this.orbit.target.x = t.x
    this.orbit.target.y = t.y
    this.orbit.target.z = t.z
  }

  public setContolMode(mode: string) {
    const { control } = this
    if (!control) return
    // 检查当前编辑的对象是否是BBox3d类型，如果不是则不执行后续操作
    if (this.target?.userData?.anno?.ol_type_ === OlTypeEnum.Point3d) {
      // 强制只能是translate模式
      mode = 'translate'
    }
    switch (mode) {
      case 'translate':
        control.setMode('translate')
        control.showX = true
        control.showY = false
        control.showZ = true
        break
      case 'scale':
        control.setMode('scale')
        control.showX = true
        control.showY = false
        control.showZ = true
        break
      case 'rotate':
        control.setMode('rotate')
        control.showX = false
        control.showY = true
        control.showZ = false
        break
      case 'reset':
        this.updateCameraPose()
        this.camera.updateProjectionMatrix()
        if (this.orbit) {
          this.orbit.update()
        }
        break
      default:
    }
  }
}

class XView extends AbstrctBoxView {
  initGl() {
    this.camera.position.x = 0
    this.camera.position.y = 0
    this.camera.position.z = 50
    this.camera.up.set(0, 0, 1) // 摄像头的向上方向
    this.camera.lookAt(0, 0, 0)
    if (this.control) {
      this.control.setSize(3)
      this.control.setMode('rotate')
    }
  }

  updateCameraPose() {
    if (!this.target) return
    const box = this.target as THREE.Object3D
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    box.updateMatrixWorld()
    box.matrixWorld.decompose(t, q, s)

    this.camera.position.x = t.x + 3
    this.camera.position.y = t.y
    this.camera.position.z = t.z
    this.camera.quaternion.copy(q)

    this.orbit.target.x = t.x
    this.orbit.target.y = t.y
    this.orbit.target.z = t.z
  }

  public setContolMode(mode: string) {
    const { control } = this
    if (!control) return
    // 检查当前编辑的对象是否是BBox3d类型，如果不是则不执行后续操作
    if (this.target?.userData?.anno?.ol_type_ === OlTypeEnum.Point3d) {
      // 强制只能是translate模式
      mode = 'translate'
    }

    switch (mode) {
      case 'translate':
        control.setMode('translate')
        control.showX = false
        control.showY = true
        control.showZ = true
        break
      case 'scale':
        control.setMode('scale')
        control.showX = false
        control.showY = true
        control.showZ = true
        break
      case 'rotate':
        control.setMode('rotate')
        control.showX = true
        control.showY = false
        control.showZ = false
        break
      case 'reset':
        this.updateCameraPose()
        this.camera.updateProjectionMatrix()
        if (this.orbit) {
          this.orbit.update()
        }
        break
      default:
    }
  }
}

eventBus.on(eventBus.pcEditor.Created, () => {
  entityChannel.sub(entityChannel.Events.SelectedBoxChanged, (box: THREE.Object3D) => {})
})

eventBus.on(eventBus.pcEditor.Inited, () => {
  const zView = new ZView(
    document.getElementById('z-view-manipulator'),
    glGlobals.domContainer,
    glGlobals.scene,
    glGlobals.renderer
  )
  const yView = new YView(
    document.getElementById('y-view-manipulator'),
    glGlobals.domContainer,
    glGlobals.scene,
    glGlobals.renderer
  )
  const xView = new XView(
    document.getElementById('x-view-manipulator'),
    glGlobals.domContainer,
    glGlobals.scene,
    glGlobals.renderer
  )

  const threeViews = { xView, yView, zView }
  glGlobals.threeViews = threeViews

  eventBus.on(eventBus.pcEditor.Gl.Updated, () => {
    Object.values(threeViews).forEach((v) => {
      v.render()
    })
  })

  eventBus.on(eventBus.Common.WindowResized, () => {
    Object.values(threeViews).forEach((v) => {
      v.onResize()
    })
  })

  eventBus.on(eventBus.Box3d.SelectedChanged, (params) => {
    let target
    if (!params || !params.glBox) {
      // target = glGlobals.getCurrentSensorGroup().getObjectByName(pcdMeshName)
      Object.values(threeViews).forEach((v) => {
        v.states.visiable = false
      })
    } else {
      const { glBox } = params
      target = glBox
    }
    if (!target) {
      return
    }
    Object.values(threeViews).forEach((v) => {
      v.states.visiable = true
      v.onBoxChanged(target)
    })
  })

  eventBus.on(eventBus.PolylineAnnotation.SelectedChanged, (params) => {
    const { point } = params
    if (!point) {
      Object.values(threeViews).forEach((v) => {
        v.states.visiable = false
      })
      return
    }
    Object.values(threeViews).forEach((v) => {
      v.states.visiable = true
      v.onBoxChanged(point)
    })
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  })

  eventBus.on(eventBus.Common.FocusPoint, (params) => {
    const { point } = params
    Object.values(threeViews).forEach((v) => {
      v.focusPoint(point)
      v.states.visiable = true
      v.setContolMode('translate')
    })
  })

  eventBus.on(eventBus.pcEditor.TransformControls.ObjectChange, (obj) => {
    Object.values(threeViews).forEach((v) => {
      v.onBoxChanged(obj)
    })
  })

  eventBus.on(eventBus.Box3d.TransformEdited, (params) => {
    Object.values(threeViews).forEach((v) => {
      v.onBox3dEdited(params.event, params.data)
    })
  })

  eventBus.on(eventBus.PolylineAnnotation.TransformEdited, (params) => {
    Object.values(threeViews).forEach((v) => {
      v.onPolylineEdited(params.event, params.data)
    })
  })
})
