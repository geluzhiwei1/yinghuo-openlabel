import * as THREE from 'three'
import { glGlobals } from './GlObjectsHolder'
import { eventBus } from '../event/EventBus'
import _ from 'lodash'

import { SimpleObjectPool } from '../utils/SimpleObjectPool'
import { pcUserSettings } from '../states'
import { jobConfig } from '@/states/job-config'

class HighlightMeshPool extends SimpleObjectPool<THREE.Object3D> {
  createObject(): THREE.Object3D {
    const sphereGeometry = new THREE.SphereGeometry(0.1)
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.highlightColor).getHex()})
    const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    return mesh
  }
  destroyObject(object: THREE.Object3D): void {
    if (!object) return
    object.material?.dispose()
    object.geometry?.dispose()
    object = null
  }
}

class FrameAnnotation {
    private streamId
  private ts
  //基础group
  private pointsGroup: THREE.Group
  // 点标注的对象
  private pointsObjectGroup: THREE.Group
  // 当前鼠标选择的点
  public selectedGroup: THREE.Group
  private selectedSetIndexMap = new Map()
  // 鼠标滑过的点
  public highlightGroup: THREE.Group
  private highlightSetIndexMap = new Map()
  private highlightMeshPool = new HighlightMeshPool(5)
  private frame: any
    constructor(options: any) {
      const { stream, ts, frame } = options
        this.streamId = stream
        this.frame = frame
        this.ts = ts
        this.buildGlGroup()
    }
  
  private pointToKey(x:number, y:number, z:number) {
    return _.toString(_.round(x, 3)) + _.toString(_.round(y, 3)) + _.toString(_.round(z, 3))
  }
  private pointToIndex(x: number, y: number, z: number) {
    const key = this.pointToKey(x, y, z)
    if (key in this.selectedSetIndexMap)
    return Math.floor(x) + Math.floor(y) * 1000 + Math.floor(z) * 1000 * 1000
  }

  private buildGlSelectedPoint(point: THREE.Vector3) {
    const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32)
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: THREE.Color(pcUserSettings.value.tools.selectedColor)})
    const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    mesh.position.copy(point)
    mesh.scale.set( 1, 1, 1 )
    this.selectedGroup.add(mesh)
  }

    private buildGlGroup() {
      this.pointsGroup = new THREE.Group()
      this.pointsGroup.name = `points-anno-${this.frame}-${this.ts}`
      const glSensorGroup = glGlobals.getSensorGroup({frame: this.frame, stream: this.streamId , ts: this.ts })
      glSensorGroup.add(this.pointsGroup)
      
      this.selectedGroup = new THREE.Group()
      this.selectedGroup.name = `points-anno-selected-${this.frame}-${this.ts}`
      this.pointsGroup.add(this.selectedGroup)

      this.highlightGroup = new THREE.Group()
      this.highlightGroup.name = (`points-anno-highlight-${this.frame}-${this.ts}`)
      this.pointsGroup.add(this.highlightGroup)

        this.pointsObjectGroup = new THREE.Group()
        this.pointsObjectGroup.name = `points-anno-pointsObject-${this.frame}-${this.ts}`
        this.pointsGroup.add(this.pointsObjectGroup)
    }

  /**
   * 更新点集合
   * @param subCommand 
   */
  public updateHighlightSet(intersectObjects: Array<THREE.Object3D>, subCommand: string) {
    this.highlightMeshPool.returnObjects(this.highlightGroup.children)
    this.highlightGroup.clear()
    const MaxCount = 1
    const maxCount = intersectObjects.length > MaxCount ? MaxCount : intersectObjects.length
    const meshs = this.highlightMeshPool.getObjects(maxCount)
    intersectObjects.slice(0, maxCount).forEach((obj, index) => {
      // meshs[index].position.copy(obj.point)// world pos
      const localPos = obj.object.worldToLocal(obj.point)
      meshs[index].position.copy(localPos)
      // meshs[index].matrixWorld.copy(obj.object.matrixWorld)
      // meshs[index].matrixWorldNeedsUpdate = true
      // meshs[index].matrixAutoUpdate = false
      this.highlightGroup.add(meshs[index])
    })
  }
}

class FrameAnnotationManager {
    private frames = new Map<string, FrameAnnotation>
    constructor() {
    }
    private toName(streamId: string, ts: number, frame: number): string {
        return `${streamId}-${frame}-${ts}`
    }
    public async buildGl(options:any): Promise<FrameAnnotation> {
      const { stream, frame, ts } = options
        const gl = this.frames.get(this.toName(stream, ts, frame))
        if (gl) {
            return gl
        } else {
          const frameAnno = new FrameAnnotation({ stream: stream, ts, frame })
          this.frames.set(this.toName(stream, ts, frame), frameAnno)
          return frameAnno
        }
    }

  public getCurrent() {
    return this.frames.get(this.toName(jobConfig.stream, jobConfig.ts, jobConfig.frame))
  }
}

const glPointAnnotationManager = new FrameAnnotationManager()
eventBus.on(eventBus.SeqData.FrameChanged, async (params) => {
    const frameAnno = await glPointAnnotationManager.buildGl(jobConfig)
})

eventBus.on(eventBus.PointAnnotation.Command, (params) => {
  const { command, glObj } = params
  const frameAnno = glPointAnnotationManager.getCurrent()
  frameAnno.updateHighlightSet(glObj, command)
  eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

eventBus.on(eventBus.PointAnnotation.Highlight, (params) => {
  const { command, glObj } = params
  const frameAnno = glPointAnnotationManager.getCurrent()
  frameAnno.updateHighlightSet(glObj, command)
  eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

export { glPointAnnotationManager, FrameAnnotation }