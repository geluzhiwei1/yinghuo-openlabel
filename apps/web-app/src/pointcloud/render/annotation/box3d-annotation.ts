import * as THREE from 'three'
import { glGlobals } from '../GlObjectsHolder'
import { eventBus } from '../../event/EventBus'
import _ from 'lodash'
import { ElMessage, ElMessageBox, ElOption } from 'element-plus'
import { createGlTextObj, renderDiv } from '../DivRender'
import { glObjectToBBox3d } from '@/pointcloud/utils/Box3d'
import { pySeqData } from '../../api'
import { v4 as uuidv4 } from 'uuid'
import { jobConfig } from '@/states/job-config'
import { commonChannel } from '../../channel'
import { glObjectState, mainAnnoStates } from '../../states'
import { set } from 'lodash'
import { OlTypeEnum, type BBox3d } from '@/openlabel'
import { glPcs } from '../gl-pcs'
import { getRustHelper } from '@/pointcloud/utils/rust-helper'
import { fileAPi, labelApi } from '@/api'
const newCube = () => {
  const h = 0.5
  const body = [
    // top
    -h,
    h,
    h,
    h,
    h,
    h,
    h,
    h,
    h,
    h,
    -h,
    h,
    h,
    -h,
    h,
    -h,
    -h,
    h,
    -h,
    -h,
    h,
    -h,
    h,
    h,

    // botom
    -h,
    h,
    -h,
    h,
    h,
    -h,
    h,
    h,
    -h,
    h,
    -h,
    -h,
    h,
    -h,
    -h,
    -h,
    -h,
    -h,
    -h,
    -h,
    -h,
    -h,
    h,
    -h,

    // vertical lines
    -h,
    h,
    h,
    -h,
    h,
    -h,
    h,
    h,
    h,
    h,
    h,
    -h,
    h,
    -h,
    h,
    h,
    -h,
    -h,
    -h,
    -h,
    h,
    -h,
    -h,
    -h,

    // direction
    h,
    0,
    h,
    1.5 * h,
    0,
    h,
    //   0, h, h, 0, h, 1.5 * h,
    // h,h,0,h,1.5 * h,0

    // h/2, -h, h+0.1,  h, 0, h+0.1,
    // h/2,  h, h+0.1,  h, 0, h+0.1,

    // side direction
    //   h, h/2, h,  h, h, 0,
    //   h, h/2, -h,  h, h, 0,
    // h, 0, 0,  h, h, 0,
  ]

  // this.world.data.dbg.alloc('box')

  const bbox = new THREE.BufferGeometry()
  bbox.setAttribute('position', new THREE.Float32BufferAttribute(body, 3))

  const color = 0x00ff00
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 1,
    opacity: 1,
    transparent: true
  })
  const box = new THREE.LineSegments(bbox, material)

  // box.scale.x = 1.8
  // box.scale.y = 4.5
  // box.scale.z = 1.5
  // box.name = 'bbox'
  // box.object_type = 'car'

  // box.computeLineDistances();

  return box
}

const createBox3d = (anno: BBox3d) => {
  const { val, object_id, object_type, label_uuid, attributes, ol_type_, object_attributes } = anno
  const mesh = newCube()
  mesh.position.x = val[0]
  mesh.position.y = val[1]
  mesh.position.z = val[2]

  mesh.scale.x = val[6]
  mesh.scale.y = val[7]
  mesh.scale.z = val[8]

  mesh.rotation.x = val[3]
  mesh.rotation.y = val[4]
  mesh.rotation.z = val[5]

  let uid = label_uuid
  if (!_.isString(uid)) {
    uid = uuidv4()
  }
  mesh.name = OlTypeEnum.BBox3d + uid

  mesh.userData = {
    anno: {
      ol_type_: OlTypeEnum.BBox3d,
      object_type,
      object_id,
      label_uuid: uid,
      attributes: attributes ?? {},
      val,
      object_attributes
    },
    ...mesh.userData
  }
  mesh.matrixWorldNeedsUpdate = true

  const cssPos = [0, 0, mesh.position.z + mesh.scale.z / 2 + 1.0]
  const t = createGlTextObj(cssPos, `${object_type}-${object_id}`, "background-color:transparent;")
  t.matrixWorldNeedsUpdate = true
  mesh.add(t)

  return mesh
}


class FrameAnnotation {
  private streamId
  private ts
  private frame
  private glGroupBoxes: THREE.Group
  // private glBoxMap:Map<string, GlBox>
  constructor(options:any) {
    const { stream, frame, ts } = options
    this.streamId = stream
    this.ts = ts
    this.frame = frame
    this.buildGlGroup()
  }

  private buildGlGroup() {
    const glSensorGroup = glGlobals.getSensorGroup({ stream: this.streamId , ts: this.ts , frame: this.frame })
    const glGroupBoxes = new THREE.Group()
    glGroupBoxes.name = `boxes3d-${this.frame}-${this.ts}`
    glSensorGroup.add(glGroupBoxes)
    this.glGroupBoxes = glGroupBoxes
  }

  private async buildGlBoxes(annos) {
    await Promise.all(annos.map(async (anno) => {
      // 同步操作前置
      this.doDeleteBy(anno.label_uuid);
      
      // 异步加载数据
      if (anno.val_ref) {
        const params = {
          stream: jobConfig.stream,
          uuid: jobConfig.uuid,
          label_uuid: anno.label_uuid
        };
        const res = await labelApi.load_val(params);
        anno.val = res.data;
        anno.val_ref = undefined; // 清除引用
      }
  
      // 同步创建对象
      const glBox = createBox3d(anno);
      this.glGroupBoxes.add(glBox);
      this.glObjUuidMap.set(anno.label_uuid, glBox);
    }));
  
    eventBus.emit(eventBus.pcEditor.Gl.Updated);
    mainAnnoStates.triger.objectsUpdated += 1;
  }

  public rectToolAddBox(anno) {
    const glBox = createBox3d(anno)
    set(glBox.userData.anno.attributes, 'opType', 'create')
    this.glGroupBoxes.add(glBox)
    this.glObjUuidMap.set(anno['label_uuid'], glBox)

    eventBus.emit(eventBus.Box3d.SelectedChanged, { glBox })
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
    mainAnnoStates.triger.objectsUpdated += 1
  }

  public async onAutoLabelBoxes(annos) {
    await this.buildGlBoxes(annos)
  }

  public remove(obj:any, dispose:boolean=true) {
    this.doDeleteBy(obj.label_uuid)
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
    mainAnnoStates.triger.objectsUpdated += 1
  }

  public removeFrameAll() {
    this.getGlObj().forEach(element => {
      this.doDeleteBy(element.userData.anno.label_uuid)
    })
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
    mainAnnoStates.triger.objectsUpdated += 1
  }

  public update(uuid:string, anno: BBox3d) {
    const glo = this.glObjUuidMap.get(uuid)
    if (!glo) return
    glo.userData.anno.attributes.opType = 'update'
    glo.position.set(anno.val[0], anno.val[1], anno.val[2])
    glo.rotation.set(anno.val[3], anno.val[4], anno.val[5])
    glo.scale.set(anno.val[6], anno.val[7], anno.val[8])
  }

    /**
     * 缓存到map，方便查找
     */
    private glObjUuidMap = new Map<string, THREE.Object3D>()
    doSelectBy(labelUuid: string) {
      const glObj = this.glObjUuidMap.get(labelUuid)
      if (!glObj) {
        glGlobals.mainView.dettachTransformControl()
        return
      }
      mainAnnoStates.selected = glObj.userData.anno
      mainAnnoStates.triger.objectsUpdated += 1
      this.colorObject()

      glGlobals.mainView.attachTransformControl(glObj)
    }
  
    doDeleteBy(labelUuid: string) {
      const glObj = this.glObjUuidMap.get(labelUuid)
      if (!glObj) return
      this.glObjUuidMap.delete(labelUuid)
      this.glGroupBoxes.remove(glObj)
      glObj.material?.dispose()
      glObj.geometry?.dispose()
      eventBus.emit(eventBus.pcEditor.Gl.Updated)
      mainAnnoStates.triger.objectsUpdated += 1
    }

    createByPoints(xyzIndexes: number[]) {
      // 初始化边界值
      let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, minZ = Number.MAX_VALUE;
      let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;

      const positionArr = glPcs.getCurrentMesh()?.geometry.getAttribute('position')!

      // === WASM fast path ===
      // 优先调 pc_compute_aabb,失败回退到下面原 JS 循环。
      const helper = getRustHelper()
      if (helper?.pc_compute_aabb && xyzIndexes.length > 0) {
        try {
          const aabb = helper.pc_compute_aabb(
            positionArr.array as Float32Array,
            Uint32Array.from(xyzIndexes),
          )
          if (aabb && aabb.length === 6) {
            minX = aabb[0]; minY = aabb[1]; minZ = aabb[2]
            maxX = aabb[3]; maxY = aabb[4]; maxZ = aabb[5]
            return this._finalizeCreateByPoints(minX, minY, minZ, maxX, maxY, maxZ)
          }
        } catch (err) {
          console.warn('[wasm aabb] fallback to JS:', err)
        }
      }

      // 遍历所有点，找到边界
      for (const idx of xyzIndexes) {
        const point = [positionArr.getX(idx), positionArr.getY(idx), positionArr.getZ(idx)]
          if (point[0] < minX) minX = point[0];
          if (point[1] < minY) minY = point[1];
          if (point[2] < minZ) minZ = point[2];

          if (point[0] > maxX) maxX = point[0];
          if (point[1] > maxY) maxY = point[1];
          if (point[2] > maxZ) maxZ = point[2];
      }

      return this._finalizeCreateByPoints(minX, minY, minZ, maxX, maxY, maxZ)
    }

    /**
     * AABB 计算完之后组装 3D 框的逻辑(原 createByPoints 后半段)。
     * WASM 路径和 JS fallback 共用。
     */
    private _finalizeCreateByPoints(
      minX: number, minY: number, minZ: number,
      maxX: number, maxY: number, maxZ: number,
    ) {
      // 计算位置（中心点）
      const position = {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          z: (minZ + maxZ) / 2
      };

      // 计算尺寸（宽度、高度、深度）
      const scale = {
          width: maxX - minX > 100.0 ? 100.0 : maxX - minX,
          height: maxY - minY > 100.0 ? 100.0 : maxY - minY,
          depth: maxZ - minZ > 100.0 ? 100.0 : maxZ - minZ,
      };

      const rotationZ = glGlobals.mainView.camera.rotation.z + Math.PI / 2
      const label_uuid = uuidv4()
      const attributes = {
          meta: {
              generated: 'box3d-selector-rect-tool',
              timeMs: new Date().getTime()
          },
          opType: 'create',
      }

      const val = [position.x, position.y, position.z,
          0.0, 0.0, rotationZ,
          scale.width, scale.height, scale.depth]
      this.rectToolAddBox({val, label_uuid, attributes, ol_type_: OlTypeEnum.BBox3d})
    }

  public getGlObj() {
    return this.glGroupBoxes.children
  }

  public toJson() {
    const annos = []
    this.getGlObj().forEach(element => {
      const anno = glObjectToBBox3d(element)
      annos.push(anno)
    })
    return annos
  }

  public async fromJson(annos) {
    await this.buildGlBoxes(annos)
  }

  public colorObject() {
    // 按照类别设置颜色
    this.getGlObj().forEach(element => {
      const tp = element.userData?.anno?.object_type || '_ol_default'
      const c = mainAnnoStates.setting.objStyles.get(tp)?.box3dColor || [0., 0., 0.5]
      element.material.color.setRGB(c[0], c[1], c[2])
    })

    // 选择的设置为红色
    this.glObjUuidMap.get(mainAnnoStates.selected.label_uuid)?.material.color.set(0xff0000)
    
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public selectBox(params) {
    const { glBox } = params
    if (!glBox) {
      return
    }

    this.doSelectBy(glBox.userData?.anno?.label_uuid)
  }

  public setVisibleBy(uuid: string, visible: boolean) {
    const glObj = this.glObjUuidMap.get(uuid)
    if (!glObj) return
    glObj.visible = visible
    glObj.userData.anno.attributes.visible = glObj.visible

    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public setVisibleByObjectType(objType: string, visible: boolean) {
    this.glObjUuidMap.values().forEach(glObj => {
      if (objType === glObj.userData.anno.object_type) {
        glObj.visible = visible
        glObj.userData.anno.attributes.visible = glObj.visible
      }
    })
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public updateVisible(obj:any) {
    if (obj.label_uuid) {
      this.setVisibleBy(obj.label_uuid, obj.visible)
    } else if (obj.objType) {
      this.setVisibleByObjectType(obj.objType, obj.visible)
    }
  }
}

class FrameAnnotationManager {
  private frames = new Map<string, FrameAnnotation>
  constructor() {
  }
  private toName(streamId: string, ts: number): string {
    return `${streamId}-${ts}`
  }
  public async buildGl(options:any): Promise<FrameAnnotation> {
    const { stream, ts, frame} = options
    const gl = this.frames.get(this.toName(stream, ts))
    if (gl) {
      return gl
    } else {
      const annos = []
      const frameAnno = new FrameAnnotation(options)
      await frameAnno.fromJson(annos)
      this.frames.set(this.toName(stream, ts), frameAnno)
      return frameAnno
    }
  }

  public getCurrent() {
    return this.frames.get(this.toName(jobConfig.stream, jobConfig.ts))!
  }
}

const glBoxAnnotationManager = new FrameAnnotationManager()
eventBus.on(eventBus.SeqData.FrameChanged, async (params) => {
  const { frame, ts } = params
  const stream_id = jobConfig.stream
  const frameAnno = await glBoxAnnotationManager.buildGl({stream:stream_id, ts, frame})
  if (glObjectState.layers.box3d.visible) {
    // load file annotation
    const res = await fileAPi.mapJson({
      uuid: jobConfig.uuid,
      stream: '_yh_output/bbox3d',
      frame,
      ts,
    })
    const objects = _.get(res, `data.openlabel.frames.${frame}.objects`, [])
    const annos = []
    Object.values(objects).forEach(obj => {
      annos.push({
        ...obj.object_data.bbox3d[0],
        ol_type_: OlTypeEnum.BBox3d
      })
    })
    await frameAnno.fromJson(annos)
  }
  commonChannel.pub(commonChannel.Events.ButtonClicked, {data: 'load-annotation'})
})

eventBus.on(eventBus.Box3d.RectToolAddingBox, (anno) => {
  const frameAnno = glBoxAnnotationManager.getCurrent()
  frameAnno.rectToolAddBox(anno)
})

eventBus.on(eventBus.Box3d.AutoLabelBoxes, async (annos) => {
  const frameAnno = glBoxAnnotationManager.getCurrent()
  await frameAnno.onAutoLabelBoxes(annos)
})

eventBus.on(eventBus.Box3d.SelectedChanged, async (params) => {
  if (!params) {
    return
  }
  const frameAnno = glBoxAnnotationManager.getCurrent()
  frameAnno.selectBox(params)
})

eventBus.on(eventBus.Box3d.RemoveSeleted, async () => {
  const frameAnno = glBoxAnnotationManager.getCurrent()
  frameAnno.doDeleteBy(mainAnnoStates.selected.label_uuid)
  ElMessage({
    type: 'info',
    message: '删除成功。',
  })
})

eventBus.on(eventBus.Box3d.RemoveFrameAll, async () => {
  const frameAnno = glBoxAnnotationManager.getCurrent()
  frameAnno.removeFrameAll()
  ElMessage({
    type: 'info',
    message: '删除成功。',
  })
})


eventBus.on(eventBus.Box3d.Command, (params) => {
  const { command, data, newAnno, uuid } = params
  const frameAnno = glBoxAnnotationManager.getCurrent()!

  switch (command) {
    case 'createByPoints':
      frameAnno.createByPoints(data)
      break;
    case 'add':
      // val [x,y,z,rx,ry,rz,sx,sy,sz]
      // label_uuid, attributes
      frameAnno.rectToolAddBox(newAnno)
      break;
    case 'doSelect':
      frameAnno.doSelectBy(uuid)
      break;
    default:
      break;
  }
  
})

export { glBoxAnnotationManager, FrameAnnotation }