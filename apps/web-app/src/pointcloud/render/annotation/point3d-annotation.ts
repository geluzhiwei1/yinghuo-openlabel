import * as THREE from 'three'
import { eventBus } from '../../event/EventBus'
import _ from 'lodash'
import { mainAnnoStates } from '../../states'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import { globalStates } from '@/states'
import { OlTypeEnum, type Point3d } from '@/openlabel'
import { v4 as uuidv4 } from 'uuid'
import { pcUserSettings } from '@/pointcloud/states'
import { jobConfig } from '@/states/job-config'
import { labelApi } from '@/api'


const defaultAnno = {
  "val": [],
  ol_type_: OlTypeEnum.Point3d,
  label_uuid: '',
  label_id: '',
  object_attributes: {},
  object_id: '',
  object_uuid: '',
  object_type: "default",
  "attributes": {
  }
} as Point3d

class FrameAnnotation {
  private streamId
  private ts
  private frame
  private boxGeometry = new THREE.BoxGeometry(
    pcUserSettings.value.tools.polyline.handle.scale,
    pcUserSettings.value.tools.polyline.handle.scale,
    pcUserSettings.value.tools.polyline.handle.scale,
  );
  private boxMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.polyline.handle.color).getHex() });
  // 标注的对象
  private _point3dObjectGroup: THREE.Group = new THREE.Group()

  constructor(options:any) {
    const { stream, ts, frame } = options
    this.streamId = stream
    this.ts = ts
    this.frame = frame
    this.buildGlGroup()
  }

  public async fromJson(annos: Array<Object>) {
    await this.buildGlObjects(annos)
  }

  private buildGlGroup() {
    this._point3dObjectGroup.name = `point3d-anno-${this.frame}-${this.ts}`
    const glSensorGroup = glGlobals.getSensorGroup({frame: this.frame, stream: this.streamId , ts: this.ts })
    glSensorGroup.add(this._point3dObjectGroup)
  }

  public create(pointIndexes: Set<number>) {
    const anno = _.cloneDeep(defaultAnno)
    anno.val = Array.from(pointIndexes)
    if (!anno.label_uuid || anno.label_uuid === '') {
      anno.label_uuid = uuidv4()
    }
    this.buildGlObject(anno)
  }

  /**
   * 更新已有标注的点集
   * @param uuid 标注的uuid
   * @param pointIndexes 新的点
   */
  public update(uuid:string, pointIndexes: Set<number>) {
    const anno = this.glObjUuidMap.get(uuid)?.userData.anno

    anno.val = Array.from(pointIndexes)
    eventBus.emit(eventBus.PointCloud.LabelToPointsChanged, [{
      label: `p3d-${anno.label_uuid}`,
      points: anno.val,
    }])
  }

  private buildGlObject(anno: Point3d) {
    const sphereGeometry = new THREE.SphereGeometry(0.1)
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.selectedColor).getHex()})
    const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    mesh.userData.anno = anno

    // TODO 获取点，计算中心
    // const worldPos = new THREE.Vector3().copy(obj.point)
    // const localPos = obj.object.worldToLocal(worldPos)
    // meshs[index].position.copy(localPos)

    let pointColor = globalStates.mainAnnoater.objectsStyles().get(anno.object_type)?.pointColor
    if (!pointColor) {
      pointColor = globalStates.mainAnnoater.objectsStyles().get('_ol_default')?.pointColor
    }
    // update point color
    eventBus.emit(eventBus.PointCloud.LabelToPointsChanged, [{
      label: `p3d-${anno.label_uuid}`,
      points: anno.val,
      pointColor,
    }])

    this._point3dObjectGroup.add(mesh)
    this.glObjUuidMap.set(anno['label_uuid'], mesh)
  }
  /**
   * 缓存到map，方便查找
   */
  private glObjUuidMap = new Map<string, THREE.Object3D>()
  doSelectBy(labelUuid: string) {
    const glObj = this.glObjUuidMap.get(labelUuid)
    if (!glObj) return
    // 更新 属性栏的显示
    mainAnnoStates.selected = this.glObjectToAnno(glObj)
  }

  doDeleteBy(labelUuid: string) {
    const glObj = this.glObjUuidMap.get(labelUuid)
    if (!glObj) return
    this.glObjUuidMap.delete(labelUuid)
    this._point3dObjectGroup.remove(glObj)
    glObj.material?.dispose()
    glObj.geometry?.dispose()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  // private buildGlObjects(annos) {
  //   annos.forEach(async (anno) => {
  //     if (this.glObjUuidMap.has(anno['label_uuid'])) {
  //       this.doDeleteBy(anno['label_uuid'])
  //     }
  //     // get anno val
  //     const params = {
  //       stream: jobConfig.stream,
  //       uuid: jobConfig.uuid,
  //       label_uuid: anno['label_uuid']
  //     }
  //     const val = await labelApi.load_val(params)
  //     anno['val'] = val
  //     this.buildGlObject(anno)
  //   })
  //   eventBus.emit(eventBus.pcEditor.Gl.Updated)
  // }
  private async buildGlObjects(annos) {
    await Promise.all(annos.map(async (anno) => {
      if (this.glObjUuidMap.has(anno.label_uuid)) {
        this.doDeleteBy(anno.label_uuid);
      }

      const params = {
        stream: jobConfig.stream,
        uuid: jobConfig.uuid,
        label_uuid: anno['label_uuid']
      }
      const res = await labelApi.load_val(params);
      anno.val = res.data
      this.buildGlObject(anno);
    }));
    eventBus.emit(eventBus.pcEditor.Gl.Updated); // 确保在所有异步操作完成后触发

    mainAnnoStates.triger.objectsUpdated += 1
  }

  public getGlObjects() {
    // return this._point3dObjectGroup.children
    return this.glObjUuidMap.values()
  }


  private glObjectToAnno(glo: THREE.Object3D) {
    const anno = glo.userData.anno
    return anno
  }

  public toJson() {
    const annos = []
    this.getGlObjects().forEach(element => {
      const anno = this.glObjectToAnno(element)

      // set all update
      anno.attributes.opType = 'update'

      annos.push(anno)
    })
    return annos
  }


  public updateVisible(obj:any) {
    if (obj.label_uuid) {
      this.setVisibleBy(obj.label_uuid, obj.visible)
    } else if (obj.objType) {
      this.setVisibleByObjectType(obj.objType, obj.visible)
    }
  }

  public setVisibleBy(uuid: string, visible: boolean) {
    const glObj = this.glObjUuidMap.get(uuid)
    if (!glObj) return
    glObj.visible = visible
    glObj.userData.anno.attributes.visible = glObj.visible

    eventBus.emit(eventBus.PointCloud.UpdatePointVisible, {
      points: glObj.userData.anno.val, visible
    })

    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public setVisibleByObjectType(objType: string, visible: boolean) {
    this.glObjUuidMap.values().forEach(glObj => {
      if (objType === glObj.userData.anno.object_type) {
        glObj.visible = visible
        glObj.userData.anno.attributes.visible = glObj.visible

        eventBus.emit(eventBus.PointCloud.UpdatePointVisible, {
          points: glObj.userData.anno.val, visible
        })
      }
    })
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }
}

class FrameAnnotationManager {
  private frames = new Map<string, FrameAnnotation>
  constructor() {
  }
  private toName(streamId: string, ts: number): string {
    return `${streamId}-${ts}`
  }
  public async buildGl(streamId: string, ts: number): Promise<FrameAnnotation> {
    const gl = this.frames.get(this.toName(streamId, ts))
    if (gl) {
      return gl
    } else {
      const frameAnno = new FrameAnnotation(streamId, ts)
      this.frames.set(this.toName(streamId, ts), frameAnno)
      return frameAnno
    }
  }

  public getCurrent() {
    return this.frames.get(this.toName(jobConfig.stream, jobConfig.ts))!
  }
}

const glPoint3DAnnotationManager = new FrameAnnotationManager()
eventBus.on(eventBus.SeqData.FrameChanged, async (params) => {
  const { ts } = params
  const stream_id = jobConfig.stream
  const frameAnno = await glPoint3DAnnotationManager.buildGl(stream_id, ts)
})

eventBus.on(eventBus.Points3DAnnotation.Command, (params) => {
  const { source, command, data, uuid } = params
  switch (command) {
    case 'clickPoint':
      break
    case 'removeLine':
      glPoint3DAnnotationManager.getCurrent().removeSelectedLine()
      break
    case 'removeByUuid':
      glPoint3DAnnotationManager.getCurrent().doDeleteBy(uuid)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    case 'addPoint':
      glPoint3DAnnotationManager.getCurrent().addLinePoint(glObj)
      break
    case 'create':
      glPoint3DAnnotationManager.getCurrent().create(data)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    case 'update':
      glPoint3DAnnotationManager.getCurrent().update(uuid, data)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    case 'doSelect':
      glPoint3DAnnotationManager.getCurrent().doSelectBy(uuid)
      break
    default:
      break
  }
})

export { glPoint3DAnnotationManager, FrameAnnotation }