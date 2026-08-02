import * as THREE from 'three'
import { eventBus } from '../../event/EventBus'
import _ from 'lodash'
import { SimpleObjectPool } from '../../utils/SimpleObjectPool'
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { glObjectState, mainAnnoStates } from '../../states'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import { OlTypeEnum, type Polyline3d } from '@/openlabel'
import { pcUserSettings } from '@/pointcloud/states'
import { jobConfig } from '@/states/job-config'
import { fileAPi, labelApi } from '@/api';
import { v4 as uuidv4 } from 'uuid'
import { MAP_LAYER_CONFIG } from './map-config'

const defaultAnno = {
  "val": [],
  ol_type_: OlTypeEnum.Polyline3d,
  label_uuid: '',
  label_id: '',
  object_attributes: {},
  object_id: '',
  object_uuid: '',
  "object_type": "",
  "attributes": {
    "closed": false,
    "color": "white",
    "style": "solid",
    "curve": {
      "type": "polyline",
      "sub_type": "centripetal",
    },
  }
} as Polyline3d

class HighlightMeshPool extends SimpleObjectPool<THREE.Object3D> {
  createObject(): THREE.Object3D {
    const sphereGeometry = new THREE.SphereGeometry(0.1)
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.highlightColor).getHex() })
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
  private ts:number = 0
  private frame:number = 0
  private boxGeometry = new THREE.BoxGeometry(
    pcUserSettings.value.tools.polyline.handle.scale,
    pcUserSettings.value.tools.polyline.handle.scale,
    pcUserSettings.value.tools.polyline.handle.scale,
  );
  private controlBoxMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.polyline.handle.color).getHex() });
  //基础group
  private polylineGroup: THREE.Group
  // 标注的对象
  private _polylineObjectGroup: THREE.Group
  // 当前鼠标选择的点
  private selectedGroup: THREE.Group
  private _selectedPointsGroup: THREE.Group
  // 鼠标滑过的点
  private _highlightPointsGroup: THREE.Group
  private highlightMeshPool = new HighlightMeshPool(5)

  /**
   * 缓存到map，方便查找
   */
  private glObjUuidMap = new Map<string, THREE.Object3D>()
  private controlPointsGroupMap = new Map<string, THREE.Object3D>()

  constructor(options: { stream: string, ts: number, frame: number }) {
    this.streamId = options.stream
    this.ts = options.ts
    this.frame = options.frame
    this.buildGlGroup()
  }

  public async fromJson(annos: Array<Object> | Object) {
    await this.buildGlObjects(annos)
  }

  private polyline_controlPointsGroup: THREE.Group
  // private polyline_lineGroup: THREE.Group
  private buildGlGroup() {
    this.polylineGroup = new THREE.Group()
    this.polylineGroup.name = `polyline-${this.ts}`
    const glSensorGroup = glGlobals.getSensorGroup({ stream: this.streamId, ts: this.ts , frame: this.frame })
    glSensorGroup.add(this.polylineGroup)

    this.selectedGroup = new THREE.Group()
    this.selectedGroup.name = `selected-${this.ts}`
    this.polylineGroup.add(this.selectedGroup)

    this._highlightPointsGroup = new THREE.Group()
    this._highlightPointsGroup.name = (`highlight-${this.ts}`)
    this.polylineGroup.add(this._highlightPointsGroup)

    this._selectedPointsGroup = new THREE.Group()
    this._selectedPointsGroup.name = (`selected-points-${this.ts}`)
    this.polylineGroup.add(this._selectedPointsGroup)

    this._polylineObjectGroup = new THREE.Group()
    this._polylineObjectGroup.name = `polylineObject-${this.ts}`

    // control points
    this.polyline_controlPointsGroup = new THREE.Group()
    this.polyline_controlPointsGroup.name = `polyline-cp-${this.ts}`
    // // line object
    // this.polyline_lineGroup = new THREE.Group()
    // this.polyline_lineGroup.name = `polyline-${this.ts}`

    this.polylineGroup.add(this.polyline_controlPointsGroup)
    this.polylineGroup.add(this._polylineObjectGroup)
  }

  /**
   * 当前选中线里包含的点
   */
  get polylineObjectGroup(): THREE.Group {
    return this._polylineObjectGroup
  }

  /**
   * 鼠标移动时，高亮点
   */
  get highlightPointsGroup(): THREE.Group {
    return this._highlightPointsGroup
  }

  /**
   * 从高亮中选择的点
   */
  get selectedPointsGroup(): THREE.Group {
    return this._selectedPointsGroup
  }

  public addLine(glObj) {
    const val = []
    glObj.children.forEach((child) => {
      const { x, y, z } = child.position
      val.push(x, y, z)
    })
    const anno = {
      "val": val,
      ol_type_: OlTypeEnum.Polyline3d,
      label_uuid: uuidv4(),
      label_id: '',
      "object_type": "unlabelled",
      "attributes": {
        "closed": false,
        "color": "white",
        "style": "solid",
        "curve": {
          "type": "polyline",
          "sub_type": "centripetal",
        },
        "meta": {
          "mannual-label": {
            time: new Date().getTime(),
          }
        }
      }
    }
    this.buildGlLine(anno)
  }

  private buildGlLine(anno) {

    const curveType = anno['attributes']['curve']['type']
    const lineClosed = anno['attributes']['closed']
    const curveSubType = anno['attributes']['curve']['sub_type']

    const curveHandles = []
    const initialPoints = anno['val']
    const controlPointsGroup = new THREE.Group()
    for (let i = 0; i < initialPoints.length; i += 3) {

      // 线的控制点
      const boxMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(pcUserSettings.value.tools.polyline.handle.color).getHex() });
      const handle = new THREE.Mesh(this.boxGeometry, boxMaterial);
      handle.position.set(initialPoints[i], initialPoints[i + 1], initialPoints[i + 2])
      handle.userData = {
        anno: {
          ol_type_: OlTypeEnum.Point3d // 自定义标记
        }
      }

      curveHandles.push(handle)
      controlPointsGroup.add(handle)
    }
    // 控制点组单独放到一个group
    this.polyline_controlPointsGroup.add(controlPointsGroup)
    this.controlPointsGroupMap.set(anno['label_uuid'], controlPointsGroup)

    const curve = new THREE.CatmullRomCurve3(
      curveHandles.map((handle) => handle.position)
    )
    curve.curveType = curveSubType;
    if (lineClosed) {
      curve.closed = true
    }

    let line
    {
      // 虚线
      const geometry = new LineGeometry();
      // const t = new THREE.BufferGeometry().setFromPoints( points )
      // geometry.setPositions( t.attributes.position.array )
      // geometry.setColors( colors );

      const matLine = new LineMaterial({
        color: 0x00ff00,
        linewidth: 2, // in world units with size attenuation, pixels otherwise
        vertexColors: false,
        //resolution:  // to be set by renderer, eventually
        dashed: false,
        alphaToCoverage: true,
      });

      line = new Line2(geometry, matLine);
      // line.computeLineDistances();
      line.scale.set(1, 1, 1);
    }

    line.name = 'polyline-' + anno['label_uuid']
    line.userData = {
      anno: {
        ol_type_: OlTypeEnum.Polyline3d,
        label_uuid: anno['label_uuid'],
        object_attributes: anno['object_attributes'] || {},
        object_type: anno['object_type'],
        attributes: anno['attributes'] || {},
        object_id: anno['object_id'],
        // meta: anno['meta'],
      },
      // 方便使用
      splineCurve: curve,
      splineControlPoints: controlPointsGroup,
    }

    this._updatePolyline(line)

    // _polylineObjectGroup保存所有的线
    this._polylineObjectGroup.add(line)
    this.glObjUuidMap.set(anno['label_uuid'], line)
  }

  doSelectBy(labelUuid: string) {

    // 恢复
    if (mainAnnoStates.selected?.label_uuid) {
      const old = this.glObjUuidMap.get(labelUuid)
      if (old) {
        old.userData.selected = false
        old.userData.splineControlPoints.children.forEach(element => {
          element.scale.setScalar(1)
          element.material.color.setHex(0x00ff00)
        })
      }
    }

    const glObj = this.glObjUuidMap.get(labelUuid)
    if (!glObj) return
    glObj.userData.selected = true
    glObj.userData.splineControlPoints.children.forEach(element => {
      element.scale.setScalar(3)
      // element.material.color.setHex(0xff0000)
    })

    mainAnnoStates.selected = this.glObjectToAnno(glObj)

    this.colorObject()
  }

  /**
   * 删除当前选择的目标
   */
  public removeSelectedLine() {
    this._polylineObjectGroup.children.forEach((line, index, arr) => {
      if (line.userData.selected) {
        this.removePolyline(line.userData.anno['label_uuid'])
      }
    })
  }

  public getPolylineBy(uuid: string) {
    return this.glObjUuidMap.get(uuid)
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

  public doDeleteBy(uuid: string) {

    if (!this.glObjUuidMap.has(uuid)) {
      return
    }

    const line = this.glObjUuidMap.get(uuid)
    if (!line) return
    // 删除line
    this._polylineObjectGroup.remove(line)
    line.material?.dispose()
    line.geometry?.dispose()

    // 删除控制点
    const controlPointsGroup = this.controlPointsGroupMap.get(uuid)
    this.polyline_controlPointsGroup.remove(controlPointsGroup)
    controlPointsGroup!.children.forEach(mesh => {
      mesh.material?.dispose()
      mesh.geometry?.dispose()
    })

    // 删除uuid映射
    this.glObjUuidMap.delete(uuid)
    this.controlPointsGroupMap.delete(uuid)
    mainAnnoStates.triger.objectsUpdated += 1
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  private async buildGlObjects(annos) {
    if (!Array.isArray(annos)) {
      // map
      this.buildMapGlObjects(annos)
    } else {
      // annos.forEach((anno) => {
      //   this.doDeleteBy(anno['label_uuid'])
      //   this.buildGlLine(anno)
      // })

      await Promise.all(annos.map(async (anno) => {
        this.doDeleteBy(anno.label_uuid);
        
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
        this.buildGlLine(anno)
      }));
    }

    mainAnnoStates.triger.objectsUpdated += 1
    
    this.colorObject()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  private buildMapGlObjects(annos: Object) {
    Object.entries(annos).forEach(([geoType, geoObjArr]) => {
      const annos = this.geoToAnnos(geoType, geoObjArr)
      for (const anno of annos) {
        this.doDeleteBy(anno['label_uuid'])
        this.buildGlLine(anno)
      }
    })
  }

    geoToAnnos(geoObjType:string, geoObjArr: Array<Polyline3d>) {
  
      const annos = []
      for (const geo of geoObjArr) {
        const geoType = geo.type
        for (const coordinate of geo.coordinates) {
          if (geoType === 'Polygon') {
            const val = coordinate.map(item => [item[0], item[1], -0.5] ).flat()
            annos.push({
              "val": val,
              ol_type_: OlTypeEnum.Polyline3d,
              label_uuid: uuidv4(),
              "object_type": geoObjType,
              "attributes": {
                "closed": false,
                "color": "white",
                "style": "solid",
                "curve": {
                  "type": "polyline",
                  "sub_type": "centripetal",
                },
                "meta": {}
              }
            })
          }
        }
      }
  
      return annos
    }

  /**
   * 更新点集合
   * @param subCommand 
   */
  public updateHighlightSet(intersectObjects: Array<THREE.Object3D>, subCommand: string) {
    this.highlightMeshPool.returnObjects(this.highlightPointsGroup.children)
    this.highlightPointsGroup.clear()
    const MaxCount = 1
    const maxCount = intersectObjects.length > MaxCount ? MaxCount : intersectObjects.length
    const meshs = this.highlightMeshPool.getObjects(maxCount)
    intersectObjects.slice(0, maxCount).forEach((obj, index) => {
      // meshs[index].position.copy(obj.point)// world pos
      const worldPos = new THREE.Vector3().copy(obj.point)
      const localPos = obj.object.worldToLocal(worldPos)
      meshs[index].position.copy(localPos)
      // meshs[index].matrixWorld.copy(obj.object.matrixWorld)
      // meshs[index].matrixWorldNeedsUpdate = true
      // meshs[index].matrixAutoUpdate = false
      this.highlightPointsGroup.add(meshs[index])
    })
    // const glBox = createBox3d(anno)
    //     this.glGroupBoxes.add(glBox)
    // eventBus.emit(eventBus.Box3d.SelectedChanged, {glBox})
    // eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  /**
   * 当前选择的点
   * @param glObject 
   * @param subCommand 
   */

  // /**
  //  * 更新点集合
  //  * 
  //  */
  // public updateSelectedSet(glObject: THREE.Object3D, subCommand: string) {
  //   // const glBox = createBox3d(anno)
  //   // this.glGroupBoxes.add(glBox)
  //   // eventBus.emit(eventBus.Box3d.SelectedChanged, { glBox })
  //   eventBus.emit(eventBus.pcEditor.Gl.Updated)
  // }

  private getLineFromGroup() {
    const lineGroup = this.getSelectedGlLines()[0]
    lineGroup.children.forEach(child => {
      if ('Line' === child.type ||
        'LineLoop' === child.type) {
        return child
      }
    })
    return null
    // return lineGroup.children[lineGroup.children.length - 1]
  }

  /**
   * 获取控制点
   * @param glLine 
   * @returns 
   */
  private glLineToControlPoints(glLine: THREE.Object3D) {
    const points = []
    glLine.userData.splineControlPoints.children.forEach(mesh => {
      const { x, y, z } = mesh.position
      points.push([x, y, z])
    })
    return points
  }

  /**
   * 确定把点增加到线的哪个位置
   * @param xyz_array 
   * @param xyz_point 
   */
  private addOnePointToLine(xyz_array, xyz_point) {
    // TODO 测试：直接放最后
    xyz_array.push(xyz_point)
    return xyz_array
  }

  /**
   * 给曲线增加点
   * @param glObj 
   */
  public addLinePoint(glObj) {
    const { x, y, z } = glObj.position
    const xyz_array = [[x, y, z]]
    const glLine = this.getSelectedGlLines()[0]
    let new_positions = this.glLineToControlPoints(glLine)
    xyz_array.forEach(xyz => {
      new_positions = this.addOnePointToLine(new_positions, xyz)
    })

    // create new mesh
    for (let i = 0; i < xyz_array.length; i++) {
      const handle = new THREE.Mesh(this.boxGeometry, this.controlBoxMaterial);
      handle.position.set(0, 0, 0)
      glLine.userData.splineControlPoints.add(handle)
    }

    // copy position
    const curve = glLine.userData.splineCurve
    // curve.points = []
    glLine.userData.splineControlPoints.children.forEach((mesh, i) => {
      mesh.position.set(new_positions[i][0], new_positions[i][1], new_positions[i][2])
      mesh.matrixWorldNeedsUpdate = true
      // curve.points.push(new THREE.Vector3().copy(mesh.position))
    })

    this._updatePolyline(glLine)
  }

  private _updatePolyline(glLine) {
    const curve = glLine.userData.splineCurve
    curve.points = []
    glLine.userData.splineControlPoints.children.forEach((mesh, i) => {
      curve.points.push(new THREE.Vector3().copy(mesh.position))
    })

    const anno = glLine.userData.anno
    const curveType = anno['attributes']['curve']['type']
    const lineClosed = anno['attributes']['closed']
    const curveSubType = anno['attributes']['curve']['sub_type']

    const matLine = glLine.material
    if (anno['attributes']['width']) {
      glLine.linewidth = _.toNumber(anno['attributes']['width'], 3)
    }

    if (anno['attributes']['dashed']) {
      matLine.dashed = true;
      matLine.dashScale = 1
      matLine.dashOffset = 0
      matLine.dashSize = 1
      matLine.gapSize = 1
    } else {
      matLine.dashed = false
    }

    curve.curveType = curveSubType;
    if (lineClosed) {
      curve.closed = true
    }

    const points = curve.getPoints(50)
    if (glLine.type === 'Line2') {
      const positions = []
      // const colors = []
      // const color = new THREE.Color();
      points.forEach(p => {
        positions.push(p.x, p.y, p.z);
        // colors.push( color.r, color.g, color.b );
      })
      glLine.geometry.setPositions(positions)
      glLine.material.resolution.set(window.innerWidth, window.innerHeight); // resolution of the viewport
      glLine.computeLineDistances();
    } else {
      glLine.geometry.setFromPoints(points)
    }
  }

  public updatePolyline() {
    this.getSelectedGlLines().forEach(glLine => {
      this._updatePolyline(glLine)
    })
  }

  public getGlLines() {
    return this._polylineObjectGroup.children
  }

  public getSelectedGlLines() {
    return this._polylineObjectGroup.children.filter(element => element.userData.selected)
  }

  public getControlPoints() {
    let controlPoints = []
    this.getSelectedGlLines().forEach(element => {
      controlPoints = [
        ...controlPoints,
        ...element.userData.splineControlPoints.children]
    })

    return controlPoints
  }

  private glObjectToAnno(glLine: THREE.Object3D) {
    // const anno = {
    //   val: [] as any[],
    //   ...glLine.userData.anno,
    //   }
    const anno = glLine.userData.anno
    anno.val = []
    glLine.userData.splineCurve.points.forEach(point => {
      anno.val.push(point.x, point.y, point.z)
    })
    return anno
  }

  public toJson() {
    const annos = []
    this.getGlLines().forEach(element => {
      const anno = this.glObjectToAnno(element)

      // set all update
      anno.attributes.opType = 'update'

      annos.push(anno)
    })
    return annos
  }

  public colorObject() {
    this.getGlLines().forEach(element => {
      const tp = element.userData?.anno?.object_type
      // const c = mainAnnoStates.setting.objStyles.get(tp)?.polyline3dColor || [0., 0., 0.5]
      const style_def = _.get(MAP_LAYER_CONFIG, tp)
      const c = style_def?.line_color || '#000088'
      element.material.color.setStyle(c)
    })

    // 选择的设置为红色
    this.glObjUuidMap.get(mainAnnoStates.selected.label_uuid)?.material.color.set(0xff0000)
    
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  public editingLine = false
  public selectLine(params) {
    const { intersections, command } = params

    let glObj = undefined
    for (let i = 0; i < intersections.length; i++) {
      glObj = intersections[i]
      if (glObj.object.type === 'LineLoop' ||
        glObj.object.type === 'Line' ||
        glObj.object.type === 'Line2') {
        break
      }
    }
    this.cancelSelectLine(params)
    if (glObj) {
      glObj.object.userData.selected = true
      glObj.object.userData.splineControlPoints.children.forEach(element => {
        element.scale.multiplyScalar(pcUserSettings.value.tools.polyline.highlight.scale)
      })
      this.editingLine = true
    } else {
      this.editingLine = false
      mainAnnoStates.selected = _.cloneDeep(defaultAnno)
    }
    this.colorObject()

    // 更新 属性栏的显示
    mainAnnoStates.selected = this.glObjectToAnno(glObj.object)
  }

  public cancelSelectLine(params) {
    this.getGlLines().forEach(element => {
      element.userData.selected = false
      element.userData.splineControlPoints.children.forEach(child => {
        child.scale.set(
          pcUserSettings.value.tools.polyline.handle.scale,
          pcUserSettings.value.tools.polyline.handle.scale,
          pcUserSettings.value.tools.polyline.handle.scale
        )
      })
    })
    this.colorObject()

    mainAnnoStates.selected = {}
  }
}

class FrameAnnotationManager {
  private frames = new Map<string, FrameAnnotation>
  constructor() {
  }
  private toName(streamId: string, ts: number): string {
    return `${streamId}-${ts}`
  }
  public async buildGl(options: any): Promise<FrameAnnotation> {
    const { stream, ts, frame } = options
    const gl = this.frames.get(this.toName(stream, ts))
    if (gl) {
      return gl
    } else {
      const frameAnno = new FrameAnnotation(options)
      this.frames.set(this.toName(stream, ts), frameAnno)
      return frameAnno
    }
  }

  // public async buildMapGl(streamId: string, ts: number, mapJson:object): Promise<FrameAnnotation> {
  //   const gl = this.frames.get(this.toName(streamId, ts))
  //   if (gl) {
  //     return gl
  //   } else {
  //     const frameAnno = new FrameAnnotation(streamId, ts)
  //     frameAnno.fromJson(mapJson)
  //     this.frames.set(this.toName(streamId, ts), frameAnno)
  //     return frameAnno
  //   }
  // }

  public getCurrent() {
    return this.frames.get(this.toName(jobConfig.stream, jobConfig.ts))!
  }
}

const glPolylineAnnotationManager = new FrameAnnotationManager()
eventBus.on(eventBus.SeqData.FrameChanged, async (params) => {
  const { frame, ts } = params
  const stream = jobConfig.stream
  const frameAnno = await glPolylineAnnotationManager.buildGl({stream, ts, frame})

  // if (glObjectState.layers.map.visible) {
  //     // load map annotation from file
  //     const res = await fileAPi.mapJson({
  //         uuid: jobConfig.uuid,
  //         stream: '_yh_output/map',
  //         frame,
  //         ts,
  //     })
  //     await glPolylineAnnotationManager.buildMapGl(stream_id, ts, res.data)
  // }
})

eventBus.on(eventBus.PolylineAnnotation.Command, (params) => {
  const { toolName, command, glObj, uuid } = params

  const frameAnno = glPolylineAnnotationManager.getCurrent()!
  switch (command) {
    case 'clickPoint':
      break
    case 'removeLine':
      glPolylineAnnotationManager.getCurrent().removeSelectedLine()
      break
    case 'removeLineByUuid':
      glPolylineAnnotationManager.getCurrent().removePolyline(uuid)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    case 'addPoint':
      glPolylineAnnotationManager.getCurrent().addLinePoint(glObj)
      break
    case 'addLine':
      glPolylineAnnotationManager.getCurrent().addLine(glObj)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    case 'doSelect':
      frameAnno.doSelectBy(uuid)
      break
    case 'doDeleteBy':
      glPolylineAnnotationManager.getCurrent().doDeleteBy(uuid)
      mainAnnoStates.triger.objectsUpdated += 1
      break
    default:
      break
  }
})

eventBus.on(eventBus.PolylineAnnotation.Highlight, (params) => {
  const { command, glObj } = params
  const frameAnno = glPolylineAnnotationManager.getCurrent()
  const intersectObjects: Array<THREE.Object3D> = glObj
  const rtn = intersectObjects.filter((obj) => {
    return obj.object.type === 'Points'
  })
  frameAnno.updateHighlightSet(rtn, command)
  eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

eventBus.on(eventBus.PolylineAnnotation.SelectedChanged, async (params) => {
  if (!params) {
    return
  }
  const { intersections, command } = params
  const frameAnno = glPolylineAnnotationManager.getCurrent()
  if (!frameAnno) return
  if ('cancel' === command) {
    frameAnno.cancelSelectLine(params)
  } else {
    frameAnno.selectLine(params)
  }
  eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

eventBus.on(eventBus.PolylineAnnotation.ControlPointsChanged, () => {
  glPolylineAnnotationManager.getCurrent().updatePolyline()
  eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

export { glPolylineAnnotationManager, FrameAnnotation }