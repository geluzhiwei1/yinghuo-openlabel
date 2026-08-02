import { globalStates } from '@/states'
import { eventBus } from '../event/EventBus'
import { glBoxAnnotationManager } from '../render/annotation/box3d-annotation'
import { glPolylineAnnotationManager } from '../render/annotation/polyline3d-annotation'
import { glPoint3DAnnotationManager } from '../render/annotation/point3d-annotation'
// import { glMapAnnoManager } from '../render/annotation/map-annotation'
import { reactive, watch } from 'vue'
import { UndoRedoStack } from '@/libs/undoRedoStack'
import colormap from 'colormap'
import { set, clone } from 'radash'
import _ from 'lodash'
import { Box3dTool } from './box3d-main'
import { PolylineTool } from './polyline3d-tool'
import { uiState } from '@/states/UiState'
import { OlTypeEnum, type BBox3d, type Polyline3d, type Point3d} from '@/openlabel'
import { HotkeysManager } from '@/libs/hotkeys-manager'
import { Point3dTool } from './point3d-main'
import {mainAnnoStates, glObjectState} from '../states'
import { glGlobals } from '../render/GlObjectsHolder'

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
  }
}
export const polylineAnnotaterSetting = reactive({
  ...clone(defaultSettingFormData)
})

class MainAnnotator {
  private static instance: MainAnnotator
  private hotkeysManager = new HotkeysManager()

  private constructor() {
    watch(() => globalStates.doClearCanvas, (newVal, oldVal) => {
      this.cleanData()
    }, { deep: true })
    this.onWatch()

    // this.hotkeysManagerAutoOff.registerHotkeys({
    //   toolId: Name,
    //   keys: 'tab',
    //   cb: this.doSelecteNextObject.bind(this)
    // })

  }
  protected watchers: any[] = []
  public undoRedo = new UndoRedoStack<Map<string, fabric.Object>>(5)
  private copiedObjects: Map<number, [any]> = new Map()
  public deletedObjs: Map<string, any> = new Map()

  protected offWatch() {
    this.watchers.forEach((unwatch) => {
      unwatch()
    })
    this.watchers = []
  }
  public static getInstance(): MainAnnotator {
    if (!this.instance) {
      this.instance = new MainAnnotator()
    }
    return this.instance
  }

  /**
   * 状态，外部监听
   */
  public publicStates = reactive({

  })

  public onWatch() {
    this.watchers.push(
      // 改变类别
      watch(
        () => mainAnnoStates.selected.object_type,
        (newVal, oldVal) => {
            mainAnnoStates.defaultObjType = newVal
            // 更新当前对象的样式
            const selected = mainAnnoStates.selected
            const newc = this.objStyles.get(newVal)?.pointColor
            if (newc) {
              // selected.attributes.pointColor = newc

              if (selected.ol_type_ === OlTypeEnum.Point3d) {
                // 改变颜色
                const anno = selected as Point3d
                eventBus.emit(eventBus.PointCloud.LabelToPointsChanged, [{
                  label: `p3d-${anno.label_uuid}`,
                  points: anno.val,
                  pointColor: this.objStyles.get(anno.object_type).pointColor,
                }])
              } else if (selected.ol_type_ === OlTypeEnum.Polyline3d) {
                // 改变颜色
                const anno = selected as Polyline3d
                eventBus.emit(eventBus.PolylineAnnotation.Command, {command: 'doSelect', uuid: anno.label_uuid})
              } else if (selected.ol_type_ === OlTypeEnum.BBox3d) {
                // 改变颜色
                const anno = selected as BBox3d
                eventBus.emit(eventBus.Box3d.Command, {command: 'doSelect', uuid: anno.label_uuid})
              }
            }
        }, {deep: true, immediate: true}
      )
    )

    this.watchers.push(
      // 类别发生变化
      watch(
        () => mainAnnoStates.setting.objectTypes,
        (newVal, oldVal) => {
          if (mainAnnoStates.setting.objectTypes.length > 1) {
            // 设置颜色空间
            const fillColors = colormap({
              colormap: 'jet',
              nshades:
                mainAnnoStates.setting.objectTypes.length < 9
                  ? 9
                  : mainAnnoStates.setting.objectTypes.length,
              format: 'float',
              alpha: 1.
            })
            mainAnnoStates.setting.objectTypes.forEach((objType, index) => {
              this.objStyles.set(objType, {
                pointColor: fillColors[index].slice(0, 3),
                box3dColor: fillColors[index].slice(0, 3),
                polyline3dColor: fillColors[index].slice(0, 3)
              })
            })

            mainAnnoStates.setting.objStyles = this.objStyles
            mainAnnoStates.triger.objStylesUpdated += 1
          }
        }
      )
    )

    // this.watchers.push(
    //   watch(
    //     () => polylineAnnotaterSetting.settings.hideAllLabels,
    //     (newVal, oldVal) => {
    //       if (newVal === oldVal) return
    //       if (newVal) {
    //         this.setVisible(false)
    //       } else {
    //         this.setVisible(true)
    //       }
    //       this.canvasObj.requestRenderAll()
    //     }
    //   )
    // )

    this.watchers.push(
      // 切换主工具
      watch(
        () => globalStates.mainTool,
        (newVal, oldVal) => {
          // this.updateCategoryStyle
          this.setMainTool(newVal)
        }
      )
    )
  }

  setMainTool(tool: string) {
    switch (tool) {
      case Point3dTool.Name:
        Point3dTool.getInstance().activate()
        Box3dTool.getInstance().deactivate()
        PolylineTool.getInstance().deactivate()
        break
      case Box3dTool.Name:
        Point3dTool.getInstance().deactivate()
        Box3dTool.getInstance().activate()
        PolylineTool.getInstance().deactivate()
        break
      case PolylineTool.Name:
        Point3dTool.getInstance().deactivate()
        Box3dTool.getInstance().deactivate()
        PolylineTool.getInstance().activate()
        break
      default:
        Point3dTool.getInstance().deactivate()
        Box3dTool.getInstance().deactivate()
        PolylineTool.getInstance().deactivate()
        break
    }
  }

  public doSelectBy(tool: string, uuid: string) {
    switch (tool) {
      case Point3dTool.Name:
          eventBus.emit(eventBus.Points3DAnnotation.Command, {
            source: 'anno-table',
            command: 'doSelect',
            uuid: uuid
        })
        break
      case Box3dTool.Name:
        eventBus.emit(eventBus.Box3d.Command, {
          source: 'anno-table',
          command: 'doSelect',
          uuid: uuid
        })
        break
      case PolylineTool.Name:
        eventBus.emit(eventBus.PolylineAnnotation.Command, {
            source: 'anno-table',
            command: 'doSelect',
            uuid: uuid
        })
        break
      default:

        break
    }
  }

  private objStyles: Map<string, any> = new Map([
    [
      'default',
      {
        pointColor: [0., 0., 0.7],
      }
    ]
  ])
  public objectsStyles() {
    return this.objStyles
  }
  public updateCategoryStyle(category: string, conf: any) {
    this.objStyles.set(category, { ...conf })
  }
  public copyTo(cmd: string) {
    const o = this.getSelectedObject()
    if (!o) return
    switch (cmd) {
      case 'copyToNext':
        {
          const obj = this.convertFabricObjectToObj(o)
          if (!obj) return
          // clean obj
          obj.label_uuid = undefined
          obj.op_log = []
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
          obj.label_uuid = undefined
          obj.op_log = []
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

  }

  public cleanData() {
    mainAnnoStates.triger.objectsUpdated += 1
    mainAnnoStates.selected = {}
    mainAnnoStates.defaultObjType = 'default'

    this.readCopyedObjects()
  }

  public doDeleteObj(obj) {
    if (!obj) {
      return
    }
    switch(obj.ol_type_) {
      case OlTypeEnum.BBox3d:
      case OlTypeEnum.Cuboid:
        glBoxAnnotationManager.getCurrent()?.doDeleteBy(obj.label_uuid)
        break
      case OlTypeEnum.Polyline3d:
        glPolylineAnnotationManager.getCurrent()?.removePolyline(obj.label_uuid)
        break
      case OlTypeEnum.Point3d:
        glPoint3DAnnotationManager.getCurrent()?.doDeleteBy(obj.label_uuid)
        break
      default:
        return
    }

    this.deletedObjs.set(obj.label_uuid, obj)
    mainAnnoStates.triger.objectsUpdated += 1
  }

  public updateVisible(obj:any) {
    switch(obj.ol_type_) {
      case OlTypeEnum.BBox3d:
        glBoxAnnotationManager.getCurrent()?.updateVisible(obj)
        break
      case OlTypeEnum.Polyline3d:
        {
          glPolylineAnnotationManager.getCurrent()?.updateVisible(obj)
          // glPolylineAnnotationManager.getCurrent()?.setVisibleBy(obj.label_uuid, obj.visible)
        }
        break
      case OlTypeEnum.Point3d:
        glPoint3DAnnotationManager.getCurrent()?.updateVisible?.(obj)
        break
      default:
        return
    }
    mainAnnoStates.triger.objectsUpdated += 1
  }

  public removeSelected() {
    if (mainAnnoStates.selected) {
      const obj = mainAnnoStates.selected
      glGlobals.mainView.transformControl.detach()
      this.doDeleteObj(obj)
    }
  }

  public removeObject(label_uuid: string) {
    return this.doDeleteObj()
  }

  public export(format: string = 'default') {
    let annos = glBoxAnnotationManager.getCurrent()?.toJson()
    if (format === 'createOrUpdated') {
      annos = annos?.filter((anno) => {
        return anno.attributes?.opType
      })
    }
    let annos2 = glPolylineAnnotationManager.getCurrent()?.toJson()
    if (format === 'createOrUpdated') {
      annos2 = annos2?.filter((anno) => {
        return anno.attributes?.opType
      })
    }
    let annos3 = glPoint3DAnnotationManager.getCurrent()?.toJson()
    if (format === 'createOrUpdated') {
      annos3 = annos3?.filter((anno) => {
        return anno.attributes?.opType
      })
    }

    return (annos || []).concat(annos2 || []).concat(annos3 || [])
  }

  public async import(format: string = 'default', annos: any) {
    if (format === 'fileMap') {
      await glPolylineAnnotationManager.getCurrent()?.fromJson(annos)
    }else {
      const filterd_box = annos.filter((anno) => {
        if (anno && anno.ol_type_ === OlTypeEnum.BBox3d) return anno
      })
      await glBoxAnnotationManager.getCurrent()?.fromJson(filterd_box)
  
      const filterd_lines = annos.filter((anno) => {
        if (anno && anno.ol_type_ === OlTypeEnum.Polyline3d) return anno
      })
      await glPolylineAnnotationManager.getCurrent()?.fromJson(filterd_lines)
  
      const filterd_point3d = annos.filter((anno) => {
        if (anno && anno.ol_type_ === OlTypeEnum.Point3d) return anno
      })
      await glPoint3DAnnotationManager.getCurrent()?.fromJson(filterd_point3d)
    }

    mainAnnoStates.triger.objectsUpdated += 1
  }

  /**
   * 获取当前帧已经标注的对象
   * @returns
   */
  public objectsMap() {
    return this.export()
  }
}

watch([() => glObjectState.viewsInited, () => uiState.mounted], (val) => {
  globalStates.mainTool = undefined
})

export { MainAnnotator }
