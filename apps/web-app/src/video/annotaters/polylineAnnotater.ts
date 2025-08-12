/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月12日16:07:03
 * @date 甲辰 [龙] 年 三月初四
 */
import { watch, reactive, computed } from 'vue'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { SequenceGenerator } from './sequenceGenerator'
import colormap from 'colormap'
import Color from 'color'
import { get, toFloat, isEmpty } from 'radash'
import { v4 as uuidv4 } from 'uuid'
import {
  type BBox,
  type Poly2d,
  type Mask2dBase64,
  OlTypeEnum
} from '@/openlabel'
import { cxcywhToCorners, parsePoly2d } from '@/openlabel/utils'
import { UndoRedoStack, UndoRedoOp } from '@/libs/undoRedoStack'
import { shortcutCallback, canvasToScreen } from './utils'
import { jobConfig } from '@/states/job-config'
import { PolygonEditor } from './polygonEditor'
import { commonChannel } from '@/video/channel'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { set, clone } from 'radash'
import { commonAnnotaterSetting } from './common-annotater-settings'
import { messages } from '@/states'
import async from 'async'
import { labelApi } from '@/api'
import { taxonomyState } from '@/states/TaxonomyState'

type PointLike = {
  x: number,
  y: number
}

fabric.Group.prototype.needsItsOwnCache = function () {
  const would = fabric.Object.prototype.needsItsOwnCache.call(this)
  if (would === false) {
    for (let i = 0; i < this._objects.length; i++) {
      if (this._objects[i].globalCompositeOperation !== 'source-over') {
        return true
      }
    }
  }
  return would
}

function getObjectSizeWithStroke(object) {
  const stroke = new fabric.Point(
    object.strokeUniform ? 1 / object.scaleX : 1,
    object.strokeUniform ? 1 / object.scaleY : 1
  ).multiply(object.strokeWidth)
  return new fabric.Point(object.width + stroke.x, object.height + stroke.y)
}

function anchorWrapper(anchorIndex, fn) {
  return function (eventData, transform, x, y) {
    const fabricObject = transform.target
    const absolutePoint = fabric.util.transformPoint(
      {
        x: fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x,
        y: fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y
      },
      fabricObject.calcTransformMatrix()
    )
    const actionPerformed = fn(eventData, transform, x, y)
    const newDim = fabricObject._setPositionDimensions({})
    const polygonBaseSize = getObjectSizeWithStroke(fabricObject)
    const newX =
      (fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x) / polygonBaseSize.x
    const newY =
      (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y) / polygonBaseSize.y
    fabricObject.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5)
    return actionPerformed
  }
}

function polygonPositionHandler(dim, finalMatrix, fabricObject) {
  if (get(fabricObject, 'userData.action', undefined)) {
    return
  }
  const x = fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x
  const y = fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y
  return fabric.util.transformPoint(
    { x: x, y: y },
    fabric.util.multiplyTransformMatrices(
      fabricObject.canvas.viewportTransform,
      fabricObject.calcTransformMatrix()
    )
  )
}

function actionHandler(eventData, transform, x, y) {
  const polygon = transform.target
  if (get(polygon, 'userData.action', undefined)) {
    return
  }

  const currentControl = polygon.controls[polygon.__corner]
  const mouseLocalPosition = polygon.toLocalPoint(new fabric.Point(x, y), 'center', 'center')
  const polygonBaseSize = getObjectSizeWithStroke(polygon)
  const size = polygon._getTransformedDimensions(0, 0)
  const finalPointPosition = {
    x: (mouseLocalPosition.x * polygonBaseSize.x) / size.x + polygon.pathOffset.x,
    y: (mouseLocalPosition.y * polygonBaseSize.y) / size.y + polygon.pathOffset.y
  }
  polygon.points[currentControl.pointIndex] = finalPointPosition
  return true
}

const fabricObjectControlMouseDown = (
  eventData: MouseEvent,
  transformData: fabric.Transform,
  x: number,
  y: number
) => {
  if (eventData.shiftKey) {
    // 删除点
    const polygon = transformData.target
    const currentControl = polygon.controls[polygon.__corner]
    polygon.points.splice(currentControl.pointIndex, 1)
    // polygon.controls.delete(currentControl.pointIndex)
    // delete polygon.controls['p' + currentControl.pointIndex]

    polygon.userData = {
      action: 'removePoint',
      ...polygon.userData
    }

    poly2dAnnotaterStates.rebuildByUUID = polygon.userData.anno.label_uuid
    // polygon.setCoords()
    // doEditObject(polygon)
  } else if (eventData.ctrlKey) {
    // 增加点
    const polygon = transformData.target
    const currentControl = polygon.controls[polygon.__corner]

    let newPoint = {
      x: polygon.points[currentControl.pointIndex].x - 1,
      y: polygon.points[currentControl.pointIndex].y + 1
    }
    if (currentControl.pointIndex + 1 < polygon.points.length) {
      newPoint = {
        x:
          0.5 *
          (polygon.points[currentControl.pointIndex].x +
            polygon.points[currentControl.pointIndex + 1].x),
        y:
          0.5 *
          (polygon.points[currentControl.pointIndex].y +
            polygon.points[currentControl.pointIndex + 1].y)
      }
    }
    polygon.points.splice(currentControl.pointIndex + 1, 0, newPoint)

    polygon.userData = {
      action: 'addPoint',
      ...polygon.userData
    }

    poly2dAnnotaterStates.rebuildByUUID = polygon.userData.anno.label_uuid
  }

  return true
}

const doEditObject = (poly: fabric.Object | undefined) => {
  if (!poly) {
    return
  }
  poly.edit = !poly.edit
  if (poly.edit) {
    const lastControl = poly.points.length - 1
    poly.cornerColor = 'rgba(255,0,0,0.5)'
    poly.controls = poly.points.reduce(function (acc, point, index) {
      acc['p' + index] = new fabric.Control({
        positionHandler: polygonPositionHandler,
        actionHandler: anchorWrapper(index > 0 ? index - 1 : lastControl, actionHandler),
        mouseUpHandler: fabricObjectControlMouseDown,
        actionName: 'modifyPolygon',
        pointIndex: index
      })
      return acc
    }, {})
  } else {
    // poly.cornerColor = 'blue';
    // poly.cornerStyle = 'rect';
    poly.controls = fabric.Object.prototype.controls
  }
  poly.hasBorders = !poly.edit

  // render
  // globalStates.toolsets!.render()
  return true
}

const defaultObjValue = {
  userData: {
    anno: {
      object_type: undefined as string | undefined,
      object_id: undefined as string | undefined,
      object_uuid: '',
      geometryId: undefined as string | undefined,
      ol_type_: undefined as string | undefined,
      label_uuid: '',
    },
    ownTool: undefined as string | undefined,
    zIndex: -1
  }
}

export type UserObject = (fabric.Polyline | fabric.Polygon | fabric.Image) & {
  userData: {
    zIndex: number
    ownTool: string | undefined
    anno: Poly2d | Mask2dBase64,
  }
}

export const poly2dAnnotaterStates = reactive({
  setting: {
    objTypes: ['default'] as string[] // 类别名
  },
  // selectedObject: undefined as Poly2d | undefined,
  selectedFabricObj: defaultObjValue as UserObject,
  defaultObjType: 'default' as string | undefined,
  rebuildByUUID: '',
})

const defaultSettingFormData = {
  settings: {},
  defaultObjType: {
    stroke: 'white',
    strokeWidth: 1,
    fill: 'rgba(0,0,55,0.1)'
  },
  theOthersObjType: {
    stroke: 'red',
    strokeWidth: 1,
    fill: 'rgba(55,0,0,0.1)'
  },
  // validObjType: {
  //   stroke: 'black',
  //   strokeWidth: 1,
  //   fillAlpha: 0.1
  // }
}

export const settingUISchema = {
  schema: {
    type: 'object',
    required: [],
    'ui:order': ['*'],
    properties: {
      // default type
      defaultObjType: {
        type: 'object',
        properties: {
          stroke: {
            title: '默认类别-边颜色',
            type: 'string',
            'ui:widget': ColorPickerWidget,
            description: '默认类别边颜色',
            default: defaultSettingFormData.defaultObjType.stroke
          },
          strokeWidth: {
            type: 'integer',
            title: '边宽度',
            description: '默认类别边宽度',
            default: defaultSettingFormData.defaultObjType.strokeWidth
          },
          fill: {
            title: '填充色',
            type: 'string',
            'ui:widget': ColorPickerWidget,
            description: '默认类别填充色',
            default: defaultSettingFormData.defaultObjType.fill
          }
        }
      },
      // 类别列表意外的其他类别
      theOthersObjType: {
        type: 'object',
        properties: {
          stroke: {
            title: '其他类别-边颜色',
            type: 'string',
            'ui:widget': ColorPickerWidget,
            description: '其他类别边颜色',
            default: defaultSettingFormData.theOthersObjType.stroke
          },
          strokeWidth: {
            type: 'integer',
            title: '边宽度',
            description: '其他类别边宽度',
            default: defaultSettingFormData.theOthersObjType.strokeWidth
          },
          fill: {
            title: '填充色',
            type: 'string',
            'ui:widget': ColorPickerWidget,
            description: '其他类别填充色',
            default: defaultSettingFormData.theOthersObjType.fill
          }
        }
      },
      // 类别列表以内的类别全局设置
      // validObjType: {
      //   type: 'object',
      //   properties: {
      //     stroke: {
      //       title: '默认边颜色',
      //       type: 'string',
      //       'ui:widget': ColorPickerWidget,
      //       description: '默认边的颜色',
      //       default: defaultSettingFormData.validObjType.stroke
      //     },
      //     strokeWidth: {
      //       type: 'integer',
      //       title: '边宽度',
      //       description: '默认边的宽度',
      //       default: defaultSettingFormData.validObjType.strokeWidth,
      //       maximum: 100,
      //       minimum: 1
      //     },
      //     fill: {
      //       title: '透明度',
      //       type: 'number',
      //       description: '默认透明度',
      //       default: defaultSettingFormData.validObjType.fillAlpha,
      //       maximum: 1.0,
      //       minimum: 0.0
      //     }
      //   }
      // }
    }
  }
}

export const polylineAnnotaterSetting = reactive({
  formData1: {
    ...clone(defaultSettingFormData)
  }
})

export const hotBarOptions = reactive({
  enabled: true,
  visible: false,
  style: {
    top: 0 + 'px',
    left: 0 + 'px',
    position: 'absolute',
    // justifyContent: 'center',
    // alignItems: 'center',
    width: '100%'
  },
  pointsEditBtn: {
    enabled: true,
  },
  polygonEditBtn: {
    visible: true,
    enabled: true,
  },
  maskEditBtn: {
    visible: true,
    enabled: true,
  },
  copiedDatas: {} // 支持工具栏复制粘贴
})

const TOOL_ID = 'polylineAnnotater'
export const toolBarConf = {
  id: TOOL_ID,
  icon: 'tdesign:user-setting',
  name: '设置',
  shortcut: 'Y',
  style: computed(() => ({
    color: globalStates.subTool === TOOL_ID ? 'blue' : ''
  })),
  description: '<el-text>标注设置</el-text>',
  shortcutCallback: () => {
    shortcutCallback(TOOL_ID)
  }
}

class PolylineAnnotater extends Annotater {
  static name = TOOL_ID
  static instance: PolylineAnnotater

  private zindex: number = 60
  // private polys: fabric.Object[] = []

  private selectedIndex = 0
  // private selectedFabricObj: fabric.Object|undefined = undefined
  private objects: Map<string, UserObject> = new Map() // uuid -> Poly2d
  private seqGener: SequenceGenerator = new SequenceGenerator(
    this.zindex * 10000,
    (this.zindex + 1) * 10000
  )
  private objStyles: Map<string, any> = new Map([
    [
      'default',
      {
        options: {
          fill: 'rgba(55,0,0,0.1)'
        }
      }
    ]
  ])

  public undoRedo = new UndoRedoStack<UndoRedoOp>(20)
  /**
   * getter函数，返回objects
   */
  public objectsMap(): Map<string, UserObject> {
    return this.objects
  }

  /**
   * 根据条件过滤对象
   * @param condition 过滤条件，一个空对象表示不进行过滤
   * @returns 返回一个包含字符串键和UserFabricObject值的Map对象
   */
  public filterObjectsMap(condition: {}): Map<string, UserObject> {
    return this.objects
  }

  /**
   * 获取对象的类别和样式
   *
   * @returns 返回对象样式
   */
  public objectsStyles() {
    return this.objStyles
  }
  public updateCategoryStyle(category: string, conf: any) {
    this.objStyles.set(category, { ...conf })
    this.canvasObj.requestRenderAll()
  }

  /**
   * 返回对象所有的tag，包括sys和user
   * @returns
   */
  public objectsTags() {
    // TODO
    return undefined
  }

  public setVisible(visible: boolean) {
    // this.curRect?.set({ visible })
    this.objects?.forEach((obj) => {
      obj.set({ visible: get(obj, 'userData.ownTool', undefined) ? true : false || visible })
    })
  }

  public visualAll() {
    this.objects?.forEach((obj) => {
      obj.set({ visible: true, evented: true, selectable: true })
    })
  }

  public visualSeletedOnly(uuids: string[]) {
    this.objects?.forEach((obj) => {
      obj.set({ visible: false })
    })
    uuids.forEach((uuid) => {
      if (this.objects?.has(uuid)) {
        const obj = this.objects.get(uuid)
        obj?.set({ visible: true })
      }
    })
  }

  public lockSeleted(uuids: string[]) {
    uuids.forEach((uuid) => {
      const obj = this.objects.get(uuid)
      if (obj) {
        // const oColor = new Color(obj.fill)
        // const fill = oColor.alpha(oColor.alpha() * 0.25).toString()
        // obj.set({ evented: false, selectable: false})
        set(obj.userData, '__bordercolor', obj.bordercolor)
        obj.set({ bordercolor: 'rgb(255,0,0)'})
        this.baseCanva.canvasObj.requestRenderAll()
      }
    })
    // this.locking = true
  }

  public unlockSeleted(uuids: string[]) {
    uuids.forEach((uuid) => {
      const obj = this.objects.get(uuid)
      if (obj) {
        // const obj = this.objects.get(uuid)
        // const oColor = new Color(obj.fill)
        // const fill = oColor.alpha(oColor.alpha() * 4.0).toString()
        // obj.set({ evented: true, selectable: true, fill })
        obj.set({ bordercolor: get(obj.userData, '__bordercolor', "rgb(178,204,255)")})
        this.baseCanva.canvasObj.requestRenderAll()
      }
    })
    // this.locking = false
  }

  constructor(baseCanva: RenderHelper) {
    super(baseCanva)

    this.onMouseUp = this.onMouseUp.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)
    this.onSelectionCleared = this.onSelectionCleared.bind(this)
    this.onSelectionCreated = this.onSelectionCreated.bind(this)
    this.onSelectionUpdated = this.onSelectionUpdated.bind(this)
    this.onObjectModified = this.onObjectModified.bind(this)

    // hotkeys
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'delete|backspace',
      cb: this.removeSelected.bind(this)
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'tab',
      cb: this.doSelecteNextObject.bind(this)
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'control+z',
      cb: this.undoLastOp.bind(this)
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'control+y',
      cb: this.redoLastOp.bind(this)
    })
    this.initMain({ toolId: TOOL_ID })

    // 一直监听
    this.canvasObj.on('selection:cleared', this.onSelectionCleared)
    this.canvasObj.on('selection:created', this.onSelectionCreated)
    this.canvasObj.on('selection:updated', this.onSelectionUpdated)
    this.canvasObj.on('object:modified', this.onObjectModified)

    PolylineAnnotater.instance = this
  }

  public bindAutoOffEvents() {
    this.canvasObj.on('mouse:up', this.onMouseUp)
    this.canvasObj.on('mouse:move', this.onMouseMove)
  }

  private copiedObjects: Map<number, [any]> = new Map()
  public deletedObjs: Map<string, any> = new Map()
  /**
   * 拷贝到下一帧
   * @param cmd next
   * @returns
   */
  public copyTo(cmd: string) {
    const o = this.getSelectedObject()
    if (!o) return
    switch (cmd) {
      case 'copyToNext':
        {
          const obj = this.convertFabricObjectToObj(o)
          if (!obj) return
          // clean obj
          obj.label_uuid = uuidv4()
          obj.attributes.opType = 'create'
          const nextFrame = jobConfig.frame + 1
          if (this.copiedObjects.has(nextFrame)) {
            this.copiedObjects.get(nextFrame)?.push(obj)
          } else {
            this.copiedObjects.set(nextFrame, [obj])
          }
          // ElMessage.success(`已拷贝到下一帧`)
          commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
        }
        break
      case 'copyToLast':
        {
          const obj = this.convertFabricObjectToObj(o)
          if (!obj) return
          // clean obj
          obj.label_uuid = uuidv4()
          obj.attributes.opType = 'create'
          const nextFrame = jobConfig.frame - 1
          if (this.copiedObjects.has(nextFrame)) {
            this.copiedObjects.get(nextFrame)?.push(obj)
          } else {
            this.copiedObjects.set(nextFrame, [obj])
          }
          // ElMessage.success(`已拷贝到上一帧`)
          commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
        }
        break
      default:
        break
    }
  }

  private readCopyedObjects() {
    if (this.copiedObjects.has(jobConfig.frame)) {
      this.import('default', this.copiedObjects.get(jobConfig.frame))
      this.copiedObjects.delete(jobConfig.frame)
    }
  }

  getSelectedObject(): UserObject | undefined {
    if (poly2dAnnotaterStates.selectedFabricObj && poly2dAnnotaterStates.selectedFabricObj !== defaultObjValue) {
      return poly2dAnnotaterStates.selectedFabricObj
    }
    return undefined
  }

  getSelectedFabricObjectUUID() {
    return this.getSelectedObject()?.userData.anno.label_uuid || undefined
  }

  public unBindAutoOffEvents() {
    this.canvasObj.off('mouse:up', this.onMouseUp)
    this.canvasObj.off('mouse:move', this.onMouseMove)
    // this.canvasObj.off('selection:cleared', this.onSelectionCleared)
    // this.canvasObj.off('selection:created', this.onSelectionCreated)
    // this.canvasObj.off('selection:updated', this.onSelectionUpdated)
    // this.canvasObj.off('object:modified', this.onObjectModified)
  }

  doSelecteNextObject() {
    while (this.objects.size > 0) {
      for (const [key, obj] of this.objects.entries()) {
        if (obj.userData.zIndex > this.selectedIndex) {
          this.setselectedFabricObj(obj)
          return
        }
      }
      this.selectedIndex = -1
    }
  }

  public selectObject(uuid: string) {
    this.setselectedFabricObj(this.objects.get(uuid))
  }

  public getFabricObjByUuid(uuid: string):UserObject | undefined {
    return this.objects.get(uuid)
  }

  private setselectedFabricObj(obj: UserObject | undefined) {
    if (obj) {
      if (obj.type === 'path') {
        return
      }

      if (obj === defaultObjValue) return

      // if (get(obj, 'userData.anno.type', undefined) === OlTypeEnum.Poly2d) {
      //     const poly2d = this.convertFabricObjectToPoly2d(obj)
      //     obj.userData.anno = poly2d
      // }

      poly2dAnnotaterStates.selectedFabricObj = obj
      poly2dAnnotaterStates.defaultObjType = obj.userData.anno?.object_type // get(obj, 'userData.anno.object_type', 'default')

      this.selectedIndex = obj.userData.zIndex

      // this.baseCanva.canvasObj.setActiveObject(obj)
    } else {
      this.selectedIndex = 0
      defaultObjValue.userData.anno.object_type = poly2dAnnotaterStates.defaultObjType
      poly2dAnnotaterStates.selectedFabricObj = defaultObjValue
    }
  }
  convertFabricObjectToPoly2d(obj: fabric.Object) {
    const data = get(obj, 'userData.anno', {})

    const vals: number[] = []
    obj.points?.forEach((point, index) => {
      vals.push(point.x)
      vals.push(point.y)
    })

    const newObj = {
      ...data,
      val: vals
    } as Poly2d

    if (!newObj.attributes.opType) {
      newObj.attributes.opType = 'update'
    }

    return newObj
  }

  public cleanData() {
    this.setselectedFabricObj(undefined)
    // 从canvas中删除
    this.objects?.forEach((obj) => {
      this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
      obj?.dispose()
    })

    this.seqGener.reset()
    this.objects.clear()

    globalStates.afterClearCanvas += 1

    this.baseCanva.reRenderAll()

    this.publicStates.objectsUpdated += 1

    this.readCopyedObjects()

    this.undoRedo.reset()
  }

  public removeSelected() {
    if (poly2dAnnotaterStates.selectedFabricObj) {
      const obj = poly2dAnnotaterStates.selectedFabricObj
      this.doDeleteObj(obj)
    }
  }

  private async reBuildObj(obj) {
    if (!obj) {
      return
    }
    const newObj = this.convertFabricObjectToPoly2d(obj)
    this.doDeleteObj(obj)
    await this.addPoly2ds([newObj])
  }

  public doDeleteObj(obj:any, op2:string='') {
    if (!obj) {
      return
    }
    this.objects?.delete(obj.userData.anno.label_uuid)
    this.deletedObjs.set(obj.userData.anno.label_uuid, obj) // 暂存
    this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
    this.seqGener.release(obj.userData.zIndex)
    // obj?.dispose?.()

    this.baseCanva.reRenderAll()
    this.publicStates.objectsUpdated += 1

    const OP = new UndoRedoOp()
    OP.o1 = obj
    OP.op = 'remove'
    OP.op2 = op2
    this.undoRedo.do(OP)
  }

  public onWatch() {
    this.watchers.push(
      // 改变类别
      watch(() => taxonomyState.ontologyClassNames, (newVal, oldVal) => {
          poly2dAnnotaterStates.setting.objTypes = newVal
      }),
      watch(
        () => poly2dAnnotaterStates.selectedFabricObj.userData.anno.object_type,
        (newVal, oldVal) => {
          if (!newVal || isEmpty(newVal)) return

          poly2dAnnotaterStates.defaultObjType = newVal
          // 更新当前对象的样式
          const selectedFabricObj = poly2dAnnotaterStates.selectedFabricObj
          if (selectedFabricObj.type && this.objStyles.get(newVal)) {

            selectedFabricObj.userData.anno.attributes.opType = 'update'
            
            // if (selectedFabricObj.isType('group')) {
            //   for (let i = 0; i < selectedFabricObj.size(); i++) {
            //     const o = selectedFabricObj.item(i)
            //     if (o.isType('polygon') && 'polygon' === get(o, 'userData.userType', undefined)) {
            //       o.set({
            //         ...this.objStyles.get(newVal).options
            //       })
            //     }
            //   }
            // } else {
              selectedFabricObj.set({
                ...this.objStyles.get(newVal).options
              })
            // }

            this.canvasObj.requestRenderAll()
          }
        }
      )
    )

    this.watchers.push(
      // 类别发生变化
      watch(
        () => poly2dAnnotaterStates.setting.objTypes,
        (newVal, oldVal) => {
          if (poly2dAnnotaterStates.setting.objTypes.length > 1) {
            // 设置颜色空间
            const fillColors = colormap({
              colormap: 'rainbow',
              nshades:
                poly2dAnnotaterStates.setting.objTypes.length < 9
                  ? 9
                  : poly2dAnnotaterStates.setting.objTypes.length,
              format: 'rgbaString',
              alpha: 0.1
            })
            poly2dAnnotaterStates.setting.objTypes.forEach((obType, index) => {
              this.objStyles.set(obType, {
                options: {
                  fill: fillColors[index]
                }
              })
            })

            this.publicStates.objStylesUpdated += 1
          }
        }
      )
    )

    this.watchers.push(
      watch(
        () => poly2dAnnotaterStates.rebuildByUUID,
        (newVal, oldVal) => {
          if (newVal) {
            this.reBuildObj(this.objects.get(newVal))
            // 重置
            poly2dAnnotaterStates.rebuildByUUID = ''
          }
        }
      )
    )

    this.watchers.push(
      watch(
        () => commonAnnotaterSetting.value.settingFormData.settings.hideAllLabels,
        (newVal, oldVal) => {
          if (newVal === oldVal) return
          if (newVal) {
            this.setVisible(false)
          } else {
            this.setVisible(true)
          }
          this.canvasObj.requestRenderAll()
        }
      ),
      watch(
        () => globalStates.subTool,
        (newVal, oldVal) => {
          if (newVal === '' || newVal === TOOL_ID || newVal === PolygonEditor.name) {
            // 工具没有启用
            this.setVisible(true)
            this.hotPolyBarWithin(poly2dAnnotaterStates.selectedFabricObj)
          } else {
            // 工具启用
            if (commonAnnotaterSetting.value.settingFormData.settings.autoHideLabels) {
              this.setVisible(false)
            } else {
              this.setVisible(true)
            }
          }
          this.canvasObj.requestRenderAll()
        }
      )
    )
  }

  public onMouseUp(options: any) {
    if (options.e.button === 2) {
    }
  }

  public removeObject(uuid: string) {
    const obj = this.objects?.get(uuid)
    this.doDeleteObj(obj)
  }

  public updateObject(uuid: string, props: {}) {
    const obj = this.objects.get(uuid)
    if (!obj) {
      return
    }
    obj.set({ ...props })
    this.canvasObj.requestRenderAll()
  }

  public onMouseMove(options: any) {}

  private hotPolyBarWithin(target: any) {
    this.hoBarWithin(target)
    // if (!target || !PolygonEditor.instance?.activated) {
    //   hotPolyBarOptions.visible = false
    //   return
    // }
    // const type = target.userData.anno.type
    // if (type === OlTypeEnum.Poly2d) {
    //   target.setCoords()
    //   hotPolyBarOptions.style.left = target.oCoords.tl.x + 'px'
    //   hotPolyBarOptions.style.top = target.oCoords.tl.y - 35 + 'px'
    //   hotPolyBarOptions.visible = true
    // } else {
    //   hotPolyBarOptions.visible = false
    // }
  }

  private hoBarWithin(target: any) {
    if (!target) {
      hotBarOptions.visible = false
      return
    }
    if (globalStates.subTool !== '') {
      hotBarOptions.visible = false
      return
    }
    if (target instanceof fabric.Object) {
      target.setCoords()
      hotBarOptions.style.left = target.oCoords.tl.x + 'px'
      hotBarOptions.style.top = target.oCoords.tl.y - 35 + 'px'
      hotBarOptions.visible = true
    }
    const ol_type_ = get(target, 'userData.anno.ol_type_', undefined)
    switch(ol_type_) {
      case OlTypeEnum.Mask2dBase64:
        hotBarOptions.pointsEditBtn.enabled = false
        hotBarOptions.maskEditBtn.visible = true
        hotBarOptions.polygonEditBtn.visible = false
        break
      case OlTypeEnum.Poly2d:
        hotBarOptions.pointsEditBtn.enabled = true
        hotBarOptions.maskEditBtn.visible = false
        hotBarOptions.polygonEditBtn.visible = true
        break
      default:
        hotBarOptions.maskEditBtn.visible = false
        hotBarOptions.polygonEditBtn.visible = false
        hotBarOptions.pointsEditBtn.enabled = false
        break
    }
  }

  // private locking = false
  public onSelectionCleared(options: any) {
    // if (this.locking) return
    this.setselectedFabricObj(undefined)
    if (get(options.deselected[0], 'edit', undefined)) {
      // cancel edit
      doEditObject(options.deselected[0])
    }
    // globalStates.working = AnnoWorkEnum.POLY_ANNOTATER

    this.hotPolyBarWithin(undefined)
  }
  public onSelectionCreated(options: any) {
    // if (this.locking) return
    this.setselectedFabricObj(options.selected[0])
    globalStates.working = AnnoWorkEnum.POLY_OBJECT_SELECTTED

    this.hotPolyBarWithin(options.selected[0])
  }
  public onSelectionUpdated(options: any) {
    // if (this.locking) return
    this.setselectedFabricObj(options.selected[0])
    if (get(options.deselected[0], 'edit', undefined)) {
      // cancel edit
      doEditObject(options.deselected[0])
    }
    globalStates.working = AnnoWorkEnum.POLY_OBJECT_SELECTTED

    this.hotPolyBarWithin(options.selected[0])
  }

  public focusObject(uuid: string) {
    const fabricO = this.objects.get(uuid)
    if (!fabricO) return

    this.setselectedFabricObj(fabricO)
    globalStates.working = AnnoWorkEnum.POLY_OBJECT_SELECTTED

    this.hotPolyBarWithin(fabricO)
  }

  public onObjectModified(options: any) {
    async.parallel(
      {
        o1: function(callback){
          options.target.clone((newObj: fabric.Object) => {
            // old object
            newObj.set({ ...options.transform.original })
            callback(null, newObj)
          }, ['userData'])
        },
        o2: function(callback){
          options.target.clone((newObj: fabric.Object) => {
            // new object
            callback(null, newObj)
          }, ['userData'])
        }
      },
      (err, results) => {
        if (err) {
          console.error(err)
          return
        }
        options.target.userData.anno.attributes.opType = 'update'

        const OP = new UndoRedoOp()
        OP.o1 = results.o1
        OP.op = 'userEdit'
        OP.o2 = results.o2
        this.undoRedo.do(OP)
      }
    )

    this.setselectedFabricObj(options.target)
    // console.log('onObjectModified', options.target)
    this.canvasObj.requestRenderAll()
  }

  private async handleValRef(obj: any) {
    try {
      const params = {
        stream: jobConfig.stream,
        uuid: jobConfig.uuid,
        label_uuid: obj.label_uuid
      };
      const res = await labelApi.load_val(params);
      obj.val = res.data;
      obj.val_ref = undefined;
    } catch (error) {
      console.error(`Failed to load val for ${obj.label_uuid}:`, error);
    }
  }

  private async addPoly2ds(objs: Poly2d[]) {
    if (objs.length === 0) {
      return
    }
    const newFabricObjs = [] as any[]
    let newFabricObj: UserObject
    await async.eachSeries(objs, async (obj, index) => {
      if (!obj) {
        return
      }
      if (!obj.label_uuid) {
        obj.label_uuid = uuidv4()
      }

      let object_type = obj.object_type
      if (isEmpty(object_type)) {
        // 默认值
        object_type = poly2dAnnotaterStates.defaultObjType
      }

      if (obj.val_ref) {
        await this.handleValRef(obj)
      }

      const points: fabric.Point[] = []
      for (let i = 0; i < obj.val.length; i += 2) {
        points.push(new fabric.Point(obj.val[i], obj.val[i + 1]))
      }
      // 封闭多边形
      if (obj.attributes && obj.attributes.closed) {
        newFabricObj = new fabric.Polygon(points, {
          stroke: 'red',
          strokeWidth: 1,
          strokeUniform: true,
          fill: 'white',
          objectCaching: false,
          userData: {
            zIndex: 0,
            anno: {
              ...obj,
              object_type
            }
          },
          // fill 等属性
          ...this.objStyles.get(
            this.objStyles.has(object_type) ? object_type : poly2dAnnotaterStates.defaultObjType
          ).options
        })  as UserObject
      } else {
        newFabricObj = new fabric.Polyline(points, {
          // strokeWidth: 0,
          stroke: 'red',
          strokeWidth: 1,
          strokeUniform: true,
          objectCaching: false,
          userData: {
            zIndex: 0,
            anno: {
              ...obj,
              object_type
            }
          },
          // fill 等属性
          ...this.objStyles.get(object_type).options,
          fill: new Color(this.objStyles.get(object_type).options.fill).toString()
        }) as UserObject
      }

      const rect = this.objects.get(obj.label_uuid)
      if (!rect) {
        // 新的 放到最后
        newFabricObj.userData.zIndex = this.seqGener.useNext()
      } else {
        // 原有的
        newFabricObj.userData.zIndex = rect.userData.zIndex
        // 删除原有对象
        this.baseCanva.fabricObjects.delete(rect.userData.zIndex)
        rect?.dispose?.()
      }

      // set(newFabricObj, 'userData.ownTool', get(obj, 'attributes._userData.ownTool', undefined))

      this.addFabricObj(newFabricObj)

      newFabricObjs.push(newFabricObj)
    })

    this.publicStates.objectsUpdated += 1
    this.baseCanva.reRenderAll()

    return newFabricObjs
  }

  async loadFabricImage(obj: Mask2dBase64): Promise<UserObject | undefined> {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(obj.val, (fabricImage) => {
        fabricImage.set({
          left: obj.attributes.ltwh[0],
          top: obj.attributes.ltwh[1],
          perPixelTargetFind: true,
          originX: 'left',
          originY: 'top',
          userData: {
            zIndex: 0,
            anno:obj
          },
        });
  
        const rect = this.objects.get(obj.label_uuid); // 注意：这里的 this 可能需要根据你的上下文调整
        if (!rect) {
          // 新的 放到最后
          fabricImage.userData.zIndex = this.seqGener.useNext();
        } else {
          // 原有的
          fabricImage.userData.zIndex = rect.userData.zIndex;
        }
  
        this.addFabricObj(fabricImage); // 注意：这里的 this 可能需要根据你的上下文调整
        this.publicStates.objectsUpdated += 1; // 注意：这里的 this 可能需要根据你的上下文调整
        this.baseCanva.reRenderAll();
  
        resolve(fabricImage)
      }, (error) => {
        reject(error)
      });
    });
  }

  private async addMask(obj: Mask2dBase64):Promise<UserObject | undefined> {
    if (!obj) {
      return
    }
    let object_type = obj.object_type
    if (isEmpty(object_type)) {
      // 默认值
      object_type = poly2dAnnotaterStates.defaultObjType
    }
    if (!this.objStyles.has(object_type)) {
      object_type = 'default'
    }
    obj.object_type = object_type

    if (obj.val_ref) {
      const params = {
        stream: jobConfig.stream,
        uuid: jobConfig.uuid,
        label_uuid: obj.label_uuid
      }
      const res = await labelApi.load_val(params)
      obj.val = res.data

      // 防止重复加载，去掉引用
      obj.val_ref = undefined
    }

    const newI = await this.loadFabricImage(obj)
    this.setselectedFabricObj(newI)
    return newI
  }

  public editCurrentObject() {
    const o = this.getSelectedObject()
    if (o) {
      doEditObject(o)
      this.baseCanva.canvasObj.requestRenderAll()
    }
  }

  public addFabricObj(newFabricObj: UserObject) {
    this.baseCanva.fabricObjects.set(newFabricObj.userData.zIndex, newFabricObj)
    this.objects.set(newFabricObj.userData.anno.label_uuid, newFabricObj)
    // newFabricObj.on("mouseup", (opt) => {

    // })
    if (newFabricObj.type === 'layover') {
      return
    }
    // newFabricObj.on('mousedblclick', (opt) => {
    //   const poly = opt.target
    //   doEditObject(poly)
    //   this.canvasObj.renderAll()
    // })

    // check owner
    if (get(newFabricObj, 'userData.ownTool', undefined)) {
      this.setselectedFabricObj(newFabricObj)
    }
  }

  public async import(format: string = 'default', frameLabels: any) {
    const polys = []
    for (const obj of frameLabels) {
      if (!obj) continue
      if (obj.ol_type_ === OlTypeEnum.Poly2d) {
        polys.push(obj)
      } else if (obj.ol_type_ === OlTypeEnum.Mask2dBase64) {
        await this.addMask(obj)
      }
    }
    await this.addPoly2ds(polys)
  }

  private valToPoints(val: Array<number>): Array<PointLike> {
    const points = new Array()
    for (let i = 0; i < val.length; i += 2) {
      points.push({ x: val[i], y: val[i + 1] })
    }
    return points
  }
  private pointsToVal(points: Array<PointLike>): Array<number> {
    const val = new Array()
    for (let i = 0; i < points.length; ++i) {
      val.push(points[i].x, points[i].y)
    }
    return val
  }

  private convertFabricObjectToObj(uobj: UserObject): Mask2dBase64 | Poly2d | undefined {
    const _data = uobj.userData.anno // get(obj, 'userData.anno', {})
    if (_data.attributes?.__oldObj) {
        delete _data.attributes?.__oldObj
    }

    const type = uobj.userData.anno?.ol_type_// get(_data, 'type', undefined)

    let o = undefined
    if (type === OlTypeEnum.Poly2d) {
      const obj = uobj as fabric.Polygon
      // 计算对象被编辑之后的坐标
      const matrix = obj.calcTransformMatrix()
      const transformedPoints = obj.points!
        .map(function (p) {
          return new fabric.Point(p.x - obj.pathOffset.x, p.y - obj.pathOffset.y)
        })
        .map(function (p) {
          return fabric.util.transformPoint(p, matrix)
        })

      o = {
        ..._data,
        val: this.pointsToVal(transformedPoints),
        attributes: {
          ..._data?.attributes,
          image_shape: [globalStates.imageObject?.width, globalStates.imageObject?.height]
        }
      } as Poly2d
    } else if (type === OlTypeEnum.Mask2dBase64) {
      const obj = uobj //as fabric.Image
      obj.setCoords()
      const jo = obj.toJSON()
      o = {
        ...obj.userData.anno,
        val: jo.src,
        attributes: {
          ...uobj.userData.anno?.attributes,
          ltwh: [jo.left, jo.top,jo.width, jo.height],
          image_shape: [globalStates.imageObject?.width, globalStates.imageObject?.height]
        }
      } as Mask2dBase64
    }

    // o?.attributes?.__oldObj = undefined

    return o
  }

  public async reBuildAllObj() {
    const arr = this.export()
    await this.addPoly2ds(arr)
  }

  public export(format: string = 'default') {
    const arr: Array<any> = new Array()
    this.objects?.forEach((obj) => {
      const o = this.convertFabricObjectToObj(obj)
      if (format === 'createOrUpdated') {
        if (o.attributes.opType) arr.push(o)
      } else {
        arr.push(o)
      }
    })
    return arr
  }

  private boxToPoly(box: BBox): Poly2d {
    // 计算四个定点
    const val = cxcywhToCorners(box.val)
    const poly = {
      type: 'Poly2d',
      objId: box.objId,
      objType: box.object_type,
      val: val,
      uuid: uuidv4(),
      attributes: {
        mode: 'MODE_POLY2D_ABSOLUTE',
        closed: true
      }
    } as Poly2d
    return poly
  }

  public async onMessage(msg: any) {
    // 检查msg的类型
    if (typeof msg === 'string') {
      ;
    } else if (msg instanceof Object) {
      const uuid = get(msg, 'label_uuid', undefined)
      let opType = 'create'
      let oldFabricObj = undefined
      if (uuid) {
        oldFabricObj = this.objects.get(uuid)
        if (oldFabricObj) {
          opType = 'update'
        }
      }

      if (msg.ol_type_ === OlTypeEnum.Poly2d) {
        const obj = msg as Poly2d
        const annotator = get(obj, 'attributes.annotator', '')
        if (annotator.startsWith('auto:')) {
          if (globalStates.imageObject) {
            const t = this.calcScaleFromImage(globalStates.imageObject)
            for (let i = 0; i < obj.val.length; i++) {
              if (i % 2 === 1) {
                // y
                obj.val[i] = obj.val[i] * t.scaleY + t.top
              } else {
                // x
                obj.val[i] = obj.val[i] * t.scaleX + t.left
              }
            }
          }
        }
        obj.attributes.opType = opType
        const newFabricObjs = await this.addPoly2ds([obj])

        if (!oldFabricObj) {
          this.logOP(undefined, newFabricObjs![0], opType)
        } else {
          oldFabricObj.clone((obj:any) => {
            this.logOP(obj, newFabricObjs![0], opType)
          }, ['userData'])
        }
        return newFabricObjs
      } else if (msg.ol_type_ === 'BBox') {
        const obj = msg as BBox
        const annotator = get(obj, 'attributes.annotator', '')
        if (annotator.startsWith('auto:')) {
          if (globalStates.imageObject) {
            const t = this.calcScaleFromImage(globalStates.imageObject)
            obj.val = [
              obj.val[0] * t.scaleX + t.left,
              obj.val[1] * t.scaleY + t.top,
              obj.val[2] * t.scaleX,
              obj.val[3] * t.scaleY
            ]
          }
        }
        const poly = this.boxToPoly(obj)
        poly.attributes.opType = 'create'
        await this.addPoly2ds([poly])
      } else if (msg.ol_type_ === 'Mask2dBase64') {
        const obj = msg as Mask2dBase64
        obj.attributes.opType = opType
        const newFabricObj = await this.addMask(obj)

        oldFabricObj = obj.attributes.__oldObj
        async.parallel(
          {
            o1: function (callback) {
                // if (!oldFabricObj) {
                //     callback(null, undefined)
                // } else {
                //   oldFabricObj.clone((newObj: any) => {
                //       callback(null, newObj)
                //   }, ['userData'])
                // }
                callback(null, oldFabricObj)
            },
            o2: function (callback) {
              newFabricObj!.clone((newObj: any) => {
                    callback(null, newObj)
                }, ['userData'])
            }
          },
          (err, results) => {
              if (err) {
                  return
              }
              this.logOP(results.o1, results.o2, opType)
              // delete obj.attributes.__oldObj
          }
        )

        // if (!oldFabricObj) {
        //   this.logOP(undefined, newFabricObj, opType)
        // } else {
        //   oldFabricObj.clone((obj:any) => {
        //     this.logOP(obj, newFabricObj, opType)
        //   }, ['userData'])
        // }
      } else if (msg.ol_type_ === 'Openlabel') {
        const parsedPolys = parsePoly2d(msg, 0)
        if (!parsedPolys || parsedPolys.length === 0) {
          return
        }
        parsedPolys.forEach((p) => {
          this.onMessage(p)
        })
      }
    } else {
      // 抛出异常
      throw new Error('unknow message type')
    }
  }

  private logOP(oldObj: UserObject | undefined, newObj:UserObject | undefined, opType: string) {
    const OP = new UndoRedoOp()
    if (oldObj && newObj) {
      // 是修改
      OP.o1 = oldObj
      OP.op = opType
      OP.o2 = newObj
    } else {
      // 是新增
      OP.o1 = null
      OP.op = opType
      OP.o2 = newObj
    }
    this.undoRedo.do(OP)
  }

  undoLastOp() {
    const oper = this.undoRedo.undo()
    if (!oper) return
    const { o1, op, o2 } = oper
    switch(op)  {
      case 'create':
        this.doDeleteObj(o2, 'undo')
        this.baseCanva.reRenderAll()
        this.setselectedFabricObj(undefined)
        messages.lastInfo = '恢复创建操作'
        break
      case 'remove':
        {
          const uuid = get(o1, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.addFabricObj(o1)
            this.baseCanva.reRenderAll()
            this.setselectedFabricObj(o1)
            messages.lastInfo = '恢复删除操作'
          }
        }
        break
      default:
        {
          const uuid = get(o1, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.addMask(o1.userData.anno)
            // this.addFabricObj(o1)
            this.baseCanva.reRenderAll()
            this.setselectedFabricObj(o1)
            messages.lastInfo = '恢复编辑操作'
          }
        }
        break
    }
  }

  redoLastOp() {
    const oper = this.undoRedo.redo()
    if (!oper) return
    const { o1, op, o2 } = oper
    switch (op) {
      case 'remove':
        this.doDeleteObj(o1, 'undo')
        messages.lastInfo = '重做删除'
        break
      case 'create':
        {
          const uuid = get(o2, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.addFabricObj(o2)
            this.baseCanva.reRenderAll()
            this.setselectedFabricObj(o2)
            messages.lastInfo = '重做创建'
          }
        }
        break
      default:
        {
          const uuid = get(o2, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.addFabricObj(o2)
            this.baseCanva.reRenderAll()
            this.setselectedFabricObj(o2)
            messages.lastInfo = '重做修改'
          }
        }
        break
    }
  }
}

export { PolylineAnnotater }
