import { globalStates } from '@/states'
import { reactive, watch } from 'vue';
import { UndoRedoOp, UndoRedoStack } from '@/libs/undoRedoStack'
import { set, clone } from 'radash'
import _, { get } from 'lodash'
import type { Context, Action, Event } from '@/openlabel'
import { messages } from '@/states'
import { LabelOpType } from '@/constants';
import { VideoEventTool } from './video-event-tool';
import { commonChannel } from '../channel';
import { jobConfig } from '@/states/job-config';
import { HotkeysManager } from '@/libs/hotkeys-manager';

const emptyObject = {
  userData: {
    anno: {
      object_id: undefined,
      object_type: 'default',
      object_uuid: '',
      object_attributes: {},
      frame_intervals: [{
        frame_start: 0,
        frame_end: 0,
        time_start: 0,
        time_end: 0
      }],
    attributes: {},
    }
  }
} as UserObject

export const toolStates = reactive({
  activated: false,
  player: {
    instance: undefined as any,
    src: undefined as string | undefined,
    title: '',
    canplay: false,
    duration: 0,
    currentTime: 0.0, // seconds
    timestamp: 0, // an integer indicating the timestamp of the video in microseconds
  },
  selected: { ...emptyObject } as UserObject,
  setting: {
    objTypes: ['default'] as string[] // 类别名
  },
  defaultObjType: 'default' as string,
  observer: {
    /**
     * 对象更新了，可能需要重新渲染
     */
    objectsUpdated: 0,
    /**
     * 对象tag更新了，可能需要重新渲染
     */
    objectsTagsUpdated: 0,
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
  copiedDatas: {} // 支持工具栏复制粘贴
})

export const annotaterStates = reactive({

  rebuildByUUID: '',
  auxiliaryFrames: [], // 要显示的辅助帧
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
}
export const polylineAnnotaterSetting = reactive({
  ...clone(defaultSettingFormData)
})


type UserObject = {
  userData: {
    zIndex: number
    ownTool: string | undefined
    anno: Context | Action | Event
  }
}
const Name = 'videoAnnotator'
class VideoAnnotator {
  static name = Name

  private static instance: VideoAnnotator;
  private constructor() {
    this.onWatch()

    this.hotkeysManager.registerHotkeys({
        toolId: VideoAnnotator.name,
        keys: 'n',
        cb: () => {
          globalStates.mainTool = (globalStates.mainTool === VideoEventTool.Name) ? undefined : VideoEventTool.Name
        }
    })
  }
  protected watchers: any[] = []
  public undoRedo = new UndoRedoStack<Map<string, fabric.Object>>(5)
  private copiedObjects: Map<number, [any]> = new Map()
  public deletedObjs: Map<string, any> = new Map()
  private objects: Map<string, UserObject> = new Map() // uuid -> UserObject
  hotkeysManager = new HotkeysManager(false)

  public publicStates = toolStates.observer

  protected offWatch() {
    this.watchers.forEach((unwatch) => {
      unwatch()
    })
    this.watchers = []

    this.hotkeysManager.offWatchHotKeys()
  }
  public static getInstance(): VideoAnnotator {
    if (!this.instance) {
      this.instance = new VideoAnnotator();
    }
    return this.instance
  }

  setMainTool(tool: string|undefined) {
    switch (tool) {
      case VideoEventTool.Name:
        VideoEventTool.getInstance().activate()
        break
      default:
        VideoEventTool.getInstance().deactivate()
        break
    }
  }

  public onWatch() {
    this.watchers.push(
      watch(
        () => globalStates.mainTool,
        (newVal, oldVal) => {
          // this.updateCategoryStyle
          if(oldVal !== newVal) {
            this.setMainTool(newVal)
          } else {
            this.setMainTool(undefined)
          }
        }
      )
    )

    this.watchers.push(
      watch(
        () => globalStates.image.beforeLoadImage,
        (newVal, oldVal) => {
          this.cleanData()
        }
      ),

      watch(
        () => toolStates.selected.userData.anno,
        (newVal, oldVal) => {
          this.publicStates.objectsUpdated++
        },
        {deep: true}
      )
    )

    this.hotkeysManager.onWatchHotKeys()
  }

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
          obj.attributes.opType = LabelOpType.Create
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
          obj.attributes.opType = LabelOpType.Create
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


  public cleanData() {
    this.setSelectedObject(undefined)
    this.objects.clear()
    this.publicStates.objectsUpdated += 1
    this.readCopyedObjects()
  }

  public updateObject() {
    throw "Not implemented yet!"
  }

  public removeObject(uuid:string) {
    const obj = this.objects.get(uuid)
    if (obj) {
      this.doDeleteObj(obj)
    }
  }

  private doDeleteObj(uobj:UserObject | undefined, op2:string='') {
    if (!uobj) {
      return
    }
    this.deletedObjs.set(uobj.userData.anno.label_uuid, uobj)
    this.objects.delete(uobj.userData.anno.label_uuid)
    this.publicStates.objectsUpdated += 1

    this.logOP(uobj, undefined, LabelOpType.Remove, op2)
  }

  public setSelectedObject(uobj: undefined | UserObject | string) {
    if (uobj === undefined) {
      toolStates.selected = { ...emptyObject }
      return
    } else {
      let o = uobj
      if (typeof uobj === "string") {
        o = this.objects.get(uobj) as UserObject
      }
      toolStates.selected = o
      if (toolStates.player.instance) {
        toolStates.player.instance.getVideoElement().pause()
        toolStates.player.instance.getVideoElement().currentTime = o.userData.anno.frame_intervals[0].time_start
      }
      // toolStates.player.instance.player.getVideoElement().fastSeek(uobj.userData.anno.frame_intervals[0].start_time)
    }

    toolStates.defaultObjType = toolStates.selected?.userData?.anno?.ol_type_
  }

  public getSelectedObject() {
    return toolStates.selected
  }

  public removeSelected() {
    if (toolStates.selected) {
      const obj = toolStates.selected
      this.doDeleteObj(obj)
    }
  }
  public export(format: string = 'default') {
    const bboxes: Array<any> = new Array()
    this.objects?.forEach((obj) => {
      bboxes.push(obj.userData.anno)
    })
    return bboxes
  }

  public import(format: string = 'default', annos: any[]) {
    annos.forEach((box, index) => {
      if (!box) return
      const uobj = {
        userData: {
          zIndex: 0,
          ownTool: undefined,
          anno: box
        }
      } as UserObject

      this.doAddObject(uobj, LabelOpType.Redo)
    })
    toolStates.observer.objectsUpdated += 1
  }

  public objectsMap() {
    return this.objects
  }

  public selectObject(uuid:string | undefined) {
    if (!uuid) return
    const obj = this.objects.get(uuid)
    if (!obj) return
    this.setSelectedObject(obj)
  }

  /**
   * 新增标注对象
   * @param uobj UserObject
   */
  private doAddObject(uobj: any, op2:string|undefined = undefined) {
    this.objects.set(uobj.userData.anno.label_uuid, uobj)
    

    this.logOP(undefined, _.cloneDeep(uobj), LabelOpType.Create, op2)

    // 如果有，从删除列表中移除该对象
    if (this.deletedObjs.has(uobj.userData.anno.label_uuid)) {
      this.deletedObjs.delete(uobj.userData.anno.label_uuid)
    }

    this.setSelectedObject(uobj)

    this.publicStates.objectsUpdated += 1
  }

  public onMessage(msg: any) {
    switch (msg.ol_type_) {
      case 'Context':
        break
      case 'Action':
        break
      case 'Event':
        break
      default:
        break
    }
    const o = {
      userData: {
        anno: msg
      }
    } as UserObject
    this.doAddObject(o)
  }
  
  private logOP(oldObj: UserObject | undefined, 
    newObj:UserObject | undefined, 
    opType: string, op2=undefined as string | undefined) {
    const OP = new UndoRedoOp()
    OP.o1 = oldObj
    OP.op = opType
    OP.o2 = newObj
    OP.op2 = op2
    this.undoRedo.do(OP)
  }

  undoLastOp() {
    const oper = this.undoRedo.undo()
    if (!oper) return
    const { o1, op, o2 } = oper
    switch(op)  {
      case LabelOpType.Create:
        this.doDeleteObj(o2, LabelOpType.Undo)
        messages.lastInfo = '恢复创建操作'
        break
      case LabelOpType.Remove:
        {
          const uuid = get(o1, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.doAddObject(o1, LabelOpType.Undo)
            messages.lastInfo = '恢复删除操作'
          }
        }
        break
      default:
        {
          const uuid = get(o1, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.doAddObject(o1, LabelOpType.Undo)
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
      case LabelOpType.Remove:
        this.doDeleteObj(o1, LabelOpType.Redo)
        messages.lastInfo = '重做删除'
        break
      case LabelOpType.Create:
        {
          const uuid = get(o2, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.doAddObject(o2, LabelOpType.Redo)
            messages.lastInfo = '重做创建'
          }
        }
        break
      default:
        {
          const uuid = get(o2, 'userData.anno.label_uuid', undefined)
          if (uuid) {
            this.doAddObject(o2, LabelOpType.Redo)
            messages.lastInfo = '重做修改'
          }
        }
        break
    }
  }
}

export { VideoAnnotator }
