import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { eventBus } from '../event/EventBus'
import { glGlobals } from './GlObjectsHolder'
import _, { get } from 'lodash'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import {
  canvaPanel,
  threeView
} from '@/states/UiState'
import { set } from 'radash'
import { useDark } from '@vueuse/core'
import { watch } from 'vue'
import { OlTypeEnum, type BBox3d } from '@/openlabel'
import { globalStates, } from '@/states'
import {mainAnnoStates, glObjectState} from '../states'
import { jobConfig } from '@/states/job-config'
import { glPolylineAnnotationManager } from './annotation/polyline3d-annotation'

const isDark = useDark()
class MainView {
  private container: HTMLElement

  public camera: THREE.OrthographicCamera
  public orbitControl: OrbitControls
  public transformControl: TransformControls
  private scene: THREE.Scene | null = null
  // 当前选中的对象
  public selectedGlObject: any = null

  private backgroundColor = document.documentElement.classList.contains('dark')
    ? new THREE.Color(0.0, 0.0, 0.0)
    : new THREE.Color(1.0, 1.0, 1.0)

  public setBackgroundColor(color: THREE.Color) {
    this.backgroundColor = color
  }

  constructor(container: HTMLElement, scene: THREE.Scene) {
    this.container = container
    this.scene = scene
    // build main camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.0001,
      10000
    )
    camera.layers.enableAll()
    // const camera = (this.camera = new THREE.PerspectiveCamera(
    //   75,
    //   window.innerWidth / window.innerHeight,
    //   0.00001,
    //   10000
    // ))
    camera.position.x = 0
    camera.position.z = 50
    camera.position.y = 0
    camera.up.set(0, 0, 1)
    camera.lookAt(0, 0, 0)
    camera.name = 'main view camera'
    this.camera = camera

    const orbit = new OrbitControls(camera, this.container)
    orbit.update()
    orbit.addEventListener('change', () => {
      // eventBus.emit(eventBus.pcEditor.OrbitControls.Change)
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    })
    this.orbitControl = orbit
    // controls.minDistance = Infinity
    // controls.maxDistance = 10
    // this.controls = controls
    const control = new TransformControls(camera, this.container)
    control.addEventListener('change', () => {
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    })
    control.addEventListener('dragging-changed', (event) => {
      this.orbitControl.enabled = !event.value
    })

    // const modes = ['translate', 'rotate', 'scale']
    // control.addEventListener('mouseUp', (event, p2) => {
    //     if (event) {
    //       control.setMode(modes[(modes.indexOf(event.mode) + 1) % modes.length])
    //     }
    // })
    control.addEventListener('objectChange', (event) => {
      set(control.object.userData, 'anno.attributes.opType', 'update')
      if (OlTypeEnum.BBox3d === get(control.object.userData, "anno.ol_type_", undefined)) {
        eventBus.emit(eventBus.Box3d.TransformEdited, {
          event,
          data: control.object
        })
      }
    })
    const gizmo = control.getHelper()
    glGlobals.scene.add(gizmo)
    this.transformControl = control
  }

  public attachTransformControl(glObject) {
    if (glObject !== this.transformControl.object) {
      this.transformControl.attach(glObject)
      eventBus.emit(eventBus.pcEditor.TransformControls.ObjectChange, glObject)
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }
  }

  public dettachTransformControl() {
      this.transformControl.detach()
      // eventBus.emit(eventBus.pcEditor.TransformControls.ObjectChange, glObject)
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public attachTransformControlToSeleted() {
    if (this.selectedGlObject) {
      this.attachTransformControl(this.selectedGlObject)
    }
  }

  protected getViewPort() {
    const rect = this.container.getBoundingClientRect()
    const parentRect = glGlobals.renderer.domElement.getBoundingClientRect()
    return {
      left: rect.left - parentRect.left,
      bottom: parentRect.height + parentRect.top - rect.bottom,
      width: rect.width,
      height: rect.height
    }

    // return {
    //   left: 350,
    //   bottom: 0,
    //   width: 600,
    //   height: 600,
    // }
  }

  public render() {
    const vp = this.getViewPort()
    // this.renderer.clearDepth()
    glGlobals.renderer.setScissorTest(true)
    glGlobals.renderer.setViewport(vp.left, vp.bottom, vp.width, vp.height)
    glGlobals.renderer.setScissor(vp.left, vp.bottom, vp.width, vp.height)
    glGlobals.renderer.render(this.scene, this.camera)

    glGlobals.labelRenderer.render(this.scene, this.camera)

    glGlobals.renderer.setScissorTest(false)
  }

  public onResize() {
    // const left = 0
    // const bottom = 0
    const width = canvaPanel.width_px - threeView.backView.width
    const height = canvaPanel.height_px

    // 守卫:canvaPanel 在 App.vue.onResize 跑完之前是 0,
    // 此时 aspect = x/0 = Infinity/NaN,会把投影矩阵写坏。
    // 跳过等下一次 WindowResized。
    if (!width || !height) {
      return
    }

    // this.renderer.setViewport(left, bottom, width, height)
    // this.renderer.setScissor(left, bottom, width, height)
    // this.renderer.setScissorTest(true)

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
  public onBox3dEdited(event: any, glBox: THREE.Object3D) {
    if (OlTypeEnum.BBox3d === glBox.userData.anno.ol_type_) {
      if (event.target.domElement.id === this.container.id) {
        // 自己改的，不处理
        return
      }

      const oldBox = glGlobals.framesGroup.getObjectByName(OlTypeEnum.BBox3d + glBox.userData.anno.label_uuid)
      if (oldBox) {
        oldBox.copy(glBox)
        oldBox.userData.anno.val = [glBox.position.x, glBox.position.y, glBox.position.z,
                glBox.rotation.x, glBox.rotation.y, glBox.rotation.z,
                glBox.scale.x, glBox.scale.y, glBox.scale.z]
        mainAnnoStates.selected = oldBox.userData.anno
      }
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }
  }
}

// let mainViews
eventBus.on(eventBus.pcEditor.Inited, () => {
  // eventBus.on(eventBus.Common.WindowResized, () => {
  const mainView = new MainView(document.getElementById('m-view-manipulator')!, glGlobals.scene)
  glGlobals.mainView = mainView
  // mainViews = { mainView }
  // glGlobals.mainView.camera = mainView.camera

  eventBus.on(eventBus.pcEditor.Gl.Updated, () => {
    mainView.render()
  })

  eventBus.on(eventBus.Common.WindowResized, () => {
    mainView.onResize()
  })

  const changeMainView = (command: string) => {
    const currentFrameGroup: THREE.Group = glGlobals.getCurrentEgoGroup()
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    currentFrameGroup.matrix.decompose(t, q, s)
    switch (command) {
      case 'resetView':
        {
          // 移动相机到当前frame
          mainView.camera.position.x = t.x
          mainView.camera.position.y = t.y
          mainView.camera.position.z = t.z + 50
          mainView.camera.quaternion.copy(q)

          mainView.orbitControl.target.x = t.x
          mainView.orbitControl.target.y = t.y
          mainView.orbitControl.target.z = t.z
        }
        break
      case 'leftView':
        {
          // mainView.controls.zoomSpeed = 3.0
          const camEuler = new THREE.Euler(-Math.PI / 4, 0, Math.PI, 'XYZ')
          mainView.camera.position.x = t.x
          mainView.camera.position.y = t.y + 100
          mainView.camera.position.z = t.z
          mainView.camera.quaternion.setFromEuler(camEuler)
        }
        break
      case 'topView':
        {
          const camEuler = new THREE.Euler(Math.PI, 0, Math.PI / 2, 'XYZ')
          mainView.camera.position.x = t.x
          mainView.camera.position.y = t.y
          mainView.camera.position.z = t.z + 100
          mainView.camera.quaternion.setFromEuler(camEuler)
        }
        break
      case 'backView':
        {
          const camEuler = new THREE.Euler(-Math.PI / 4, 0, -Math.PI, 'XYZ')
          mainView.camera.position.x = t.x + 100
          mainView.camera.position.y = t.y
          mainView.camera.position.z = t.z
          mainView.camera.quaternion.setFromEuler(camEuler)
        }
        break
      default:
        break
    }

    mainView.camera.updateProjectionMatrix()
    mainView.orbitControl.update()
    mainView.transformControl.detach()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  const lookAtObject = (target: THREE.Object3D) => {

    if (!target || !(target instanceof THREE.Object3D)) {
      return
    }

    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()

    target.updateMatrixWorld()
    target.matrixWorld.decompose(t, q, s)

    mainView.camera.position.x = t.x
    mainView.camera.position.y = t.y
    mainView.camera.position.z = t.z + 10
    mainView.camera.quaternion.copy(q)

    mainView.orbitControl.target.x = t.x
    mainView.orbitControl.target.y = t.y
    mainView.orbitControl.target.z = t.z

    mainView.camera.updateProjectionMatrix()
    mainView.orbitControl.update()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  eventBus.on(eventBus.SeqData.FrameChanged, () => {
    globalStates.doClearCanvas += 1
    changeMainView('resetView')
  })

  eventBus.on(eventBus.pcEditor.MainViewChange, (buttonId) => {
    changeMainView(buttonId)
  })

  eventBus.on(eventBus.Box3d.SelectedChanged, (params) => {
    let target
    if (!params || !params.glBox) {
      const pcdMeshName = glGlobals.buildPcdMeshName(jobConfig)
      target = glGlobals.getCurrentSensorGroup().getObjectByName(pcdMeshName)
    } else {
      const { glBox } = params
      target = glBox
      // lookAtObject(glBox)
    }
    if (!target) {
      return
    }
    mainView.selectedGlObject = target
  })

  // eventBus.on(eventBus.PolylineAnnotation.Command, (params) => {
  //   const { source, command, uuid } = params
  //   const obj = glPolylineAnnotationManager.getCurrent().getPolylineBy(uuid)
  //   if (!obj) return
  //   lookAtObject(obj)
  // })

  eventBus.on(eventBus.Box3d.TransformEdited, (params) => {
    mainView.onBox3dEdited(params.event, params.data)
  })

  eventBus.on(eventBus.Common.PointClicked, (params) => {
    const { point } = params
  })

  glObjectState.viewsInited = true
  // TODO 默认关掉objLabel
  // mainView.camera.layers.toggle(glObjectState.layers.objLabel.id)
  // if (!glObjectState.layers.objLabel.visible) {
  //   mainView.camera.layers.disable(glObjectState.layers.objLabel.id)
  // }
})

watch(isDark, (dark) => {
  if (glGlobals.mainView) {
    glGlobals.mainView.setBackgroundColor(
      dark ? new THREE.Color(0.0, 0.0, 0.0) : new THREE.Color(1.0, 1.0, 1.0)
    )
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }
}, { immediate: true })

watch(
  [() => glObjectState.viewsInited, () => glObjectState.layers.objLabel.visible],
  (newValue, oldValue) => {
    if (!newValue[0]) return
    if (newValue[1]) {
      glGlobals.mainView.camera.layers.enable(glObjectState.layers.objLabel.id)
    } else {
      glGlobals.mainView.camera.layers.disable(glObjectState.layers.objLabel.id)
    }
  },
  { immediate: true }
)