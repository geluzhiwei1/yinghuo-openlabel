/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年12月13日 23:10:13
 */
import { computed, watch, reactive } from 'vue'
import { fabric } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { algoApi, dnnModelApi } from '@/api'
import { OlTypeEnum, type RBBox, type BBox, type Poly2d, type Mask2dBase64 } from '@/openlabel'
import { ElMessage } from 'element-plus'
import { globalStates } from '@/states'
import { jobConfig } from '../states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import { get } from 'radash'
import { AnnoTool } from '@/core/anno-tool'
import { HotkeysManager } from '@/libs/hotkeys-manager'
import { set } from 'lodash'
import { parseBBoxes, parsePoly2d } from '@/openlabel/utils'
import { messages } from '@/states'

type UserFabricObject = (fabric.Circle | fabric.Rect) & {
  userData: {
    zIndex: number
    obj: Point2d | BBox
    frameNo: number
  }
}

const Name = 'inpterpolateObject'
export const toolStates = reactive({
  activated: false,
  /** 表格显示的内容 */
  promptsTableDatas: [] as any[],
  /** 模型返回的数据 */
  labelsByModel: undefined,

  selectedApi: undefined,

  // 工具描述
  toolConf: {
    id: Name,
    icon: 'fluent:video-clip-wand-24-regular',
    name: '插值',
    shortcut: 'B',
    description: '设置前景点、背景点或辅助框，辅助分割'
  },

  act: {
    doAction: 0,
    processing: false
  }
})

export class InpterpolateObject extends AnnoTool {
  static name = Name
  static _instance: InpterpolateObject
  static instance() {
    if (!InpterpolateObject._instance) {
      InpterpolateObject._instance = new InpterpolateObject()
    }
    return InpterpolateObject._instance
  }

  hotkeysManager = new HotkeysManager()
  protected watchers: any[] = []

  private objects: Map<string, BBox | Mask2dBase64> = new Map() // uuid -> Circle

  /** 当前操作的帧 */
  private constructor() {
    super()
    this.hotkeysManager.registerHotkeys({
      toolId: Name,
      keys: 'escape',
      cb: this.onEsc.bind(this)
    })
    this.hotkeysManager.registerHotkeys({
      toolId: Name,
      keys: 'delete|backspace|x',
      cb: this.onDel.bind(this)
    })
    // this.hotkeysManager.registerHotkeys({
    //     toolId: Name,
    //     keys: 'e',
    //     cb: this.onChangePromoteType.bind(this)
    // })
    // this.hotkeysManager.registerHotkeys({
    //     toolId: Name,
    //     keys: pointsPromoteSegmentToolConf.shortcut,
    //     cb: pointsPromoteSegmentToolConf.shortcutCallback
    // })

    // 一直watch
    // watch(() => globalStates.anno.annoDataLoaded, (newVal, oldVal) => {
    //     this.afterAnnoDataLoaded()
    // }, { deep: true })
  }

  public setConf(conf: any) {
    toolStates.setting = {
      ...toolStates.setting,
      ...conf
    }
  }

  reset(): void {
    this.objects.clear()
    this.updatePromptsTableDatas()
  }

  activate() {
    if (toolStates.activated) {
      return
    }
    this.doActivate()
    toolStates.activated = true
  }

  deactivate() {
    if (!toolStates.activated) {
      return
    }
    this.doDeactivate()
    toolStates.activated = false
  }

  doActivate() {
    this.hotkeysManager.onWatchHotKeys()
    this.onWatch()
  }
  doDeactivate(): void {
    this.hotkeysManager.offWatchHotKeys()
    this.offWatch()
  }

  onEnter() {
    this.callModel()
  }

  onEsc() {
    this.doCancelDrawing()
  }

  onDel() {
    this.removeSelected()
  }

  convertFabricObjectToLabel(obj: UserFabricObject): Point2d {
    // 转换坐标： canvas to image
    const relaPos = globalStates.imageObject!.toLocalPoint(
      new fabric.Point(obj.left!, obj.top!),
      'left',
      'top'
    )
    const point = {
      ...obj.userData.anno,
      val: [relaPos.x, relaPos.y]
    }
    return point
  }

  // public exportPoints(format: string = 'default'): Point2d[] {
  //     const objs: Array<Point2d> = new Array()
  //     for (const obj of this.objects.values()) {
  //         if (obj.userData.anno.type !== OlTypeEnum.Point2d) {
  //             continue
  //         }
  //         objs.push(this.convertFabricObjectToLabel(obj))
  //     }
  //     return objs
  // }

  getFrameNames() {
    const arr: string[] = []
    Object.entries(dataSeqState.streamMeta.openlabel.frames).forEach(([key, streamObj], index) => {
      arr.push(get(streamObj, 'frame_properties.name', ''))
    })
    return arr
  }

  callModel() {
    if (this.objects.size !== 2) {
      ElMessage.error('请选择两个目标。')
      return
    }

    toolStates.act.processing = true

    const rows = this.objects.values()
    const frameNos = [] as number[]
    const objs = [] as any[]
    rows.forEach((obj) => {
      frameNos.push(obj.attributes.frameNo)
      objs.push(obj)
    })

    let start = 0
    let end = 0
    start = Math.min(...frameNos)
    end = Math.max(...frameNos)

    if (end - start <= 1) {
      ElMessage.error('请选择合适的帧进行操作。')
      toolStates.act.processing = false
      return
    }

    const data = {
      object1: undefined as any,
      object2: undefined as any
    }
    data.object1 = objs[0]
    data.object2 = objs[1]
    // call algo
    let api = undefined
    switch (data.object1.ol_type_) {
      case OlTypeEnum.Poly2d:
        api = 'interpolate_polygon'
        break
      case OlTypeEnum.Mask2dBase64:
        api = 'interpolate_mask'
        break
      case OlTypeEnum.BBox:
        api = 'interpolate_bbox'
        break
      case OlTypeEnum.RBBox:
        api = 'interpolate_rbbox'
        break
      default:
        break
    }
    if (!api) return

    algoApi
      .run(api, data)
      .then((res) => {
        toolStates.labelsByModel = res.data
        const msg = '操作成功，请进入中间帧查看结果。'
        ElMessage.success(msg)
        messages.lastSuccess = msg
      })
      .catch((err) => {
        ElMessage.error('请求模型时异常：' + err)
      })
      .finally(() => {
        toolStates.act.processing = false
      })
  }

  protected offWatch() {
    this.watchers.forEach((unwatch) => {
      unwatch()
    })
    this.watchers = []
  }
  public onWatch() {
    this.watchers.push(
      watch(
        () => toolStates.act.doAction,
        (newValue, oldValue) => {
          if (newValue === oldValue) return
          this.callModel()
        }
      ),

      watch(
        () => globalStates.afterClearCanvas,
        () => {
          this.updateAnnos()
        }
      )
    )
  }

  doRemove(obj: UserFabricObject) {
    if (!obj) {
      return
    }
    this.objects?.delete(obj.userData.anno.uuid)
    this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
    this.seqGener.release(obj.userData.zIndex)
    obj?.dispose()
    this.baseCanva.reRenderAll()
  }

  removeSelected() {
    if (toolStates.selectedObject) {
      this.doRemove(toolStates.selectedObject)
    }
  }

  cleanData() {
    // 重写父类方法，什么都不做
  }

  doCleanData() {
    toolStates.promptsTableDatas = []
    toolStates.labelsByModel = undefined
  }

  doCancelDrawing() {
    this.doCleanData()
  }

  addGeometryAndActivate(obj: BBox | Mask2dBase64 | undefined, frameNo: number) {
    this.addGeometry(obj, frameNo)
    this.activate()
  }

  removeGeometry(uuid: string) {
    if (uuid) {
      this.objects?.delete(uuid)
      this.updatePromptsTableDatas()
    }
  }

  addGeometry(obj: BBox | Mask2dBase64 | undefined, frameNo: number) {
    if (!obj) {
      return
    }

    set(obj.attributes, 'frameNo', frameNo)
    this.objects.set(obj.label_uuid, obj)

    this.updatePromptsTableDatas()
  }

  updateAnnos() {
    const ol_type_ = this.objects.values().next().value!.ol_type_
    switch (ol_type_) {
      case OlTypeEnum.Poly2d:
      case OlTypeEnum.Mask2dBase64:
        {
          const polys = parsePoly2d(toolStates.labelsByModel, jobConfig.frame)
          if (polys) {
            polys.forEach((poly) => {
              if (poly.val) {
                globalStates.mainAnnoater!.onMessage(poly)
              }
            })
          }
        }
        break
      case OlTypeEnum.BBox:
      case OlTypeEnum.RBBox:
        {
          const polys = parseBBoxes(toolStates.labelsByModel, jobConfig.frame)
          if (polys) {
            polys.forEach((poly) => {
              if (poly.val) {
                globalStates.mainAnnoater!.onMessage(poly)
              }
            })
          }
        }
        break
      default:
        break
    }
  }

  doFinishDrawing(openlabel: any) {
    if (!globalStates.mainAnnoater) return
    this.doCleanData()
  }

  updatePromptsTableDatas() {
    const rows: any[] = []
    this.objects.forEach((obj) => {
      rows.push({
        frameNo: get(obj.attributes, 'frameNo'),
        ...obj
      })
    })

    // 更新UI 表格
    toolStates.promptsTableDatas = rows

    return rows
  }
}
