/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年7月4日 15:11:44
 * @date 甲辰 [龙] 年 五月廿九
 */
import { watch, reactive, computed } from 'vue'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { type Poly2d, type Mask2dBase64, OlTypeEnum } from '@/openlabel'
import { v4 as uuidv4 } from 'uuid'
import { shortcutCallback } from './utils'
import { get, set } from 'lodash'
import { ImageCanvas } from './imageCanvas'
import { poly2dAnnotaterStates, type UserObject } from './polylineAnnotater'
import { SequenceGenerator } from './sequenceGenerator'
import { freeDrawOptions, FreeDrawingCursor } from '@/libs/free-draw'

export const toolOptions = reactive({
  zIndex: 90,
  enabled: true,
  settingFormData: {}
})

const TOOL_ID = 'maskBrush'
export const toolConf = {
  id: TOOL_ID,
  icon: 'ph:paint-brush-duotone',
  name: '画刷',
  shortcut: 'G',
  description: '<el-text>按住Ctrl键，再按下鼠标左键的同时移动鼠标</el-text>',
  handler: () => { },
  shortcutCallback: () => {
    shortcutCallback(TOOL_ID)
  }
}

class MaskBrush extends Annotater {
  static name = TOOL_ID
  static instance: MaskBrush

  private freeDrawingCursor: FreeDrawingCursor
  private maskCanvas: fabric.Canvas | undefined = undefined
  /**
   * 当前正在编辑的mask2d对象
   */
  private seqGener: SequenceGenerator = new SequenceGenerator(
    toolOptions.zIndex * 10000,
    (toolOptions.zIndex + 1) * 10000
  )
  constructor(baseCanva: RenderHelper) {
    super(baseCanva)

    if (MaskBrush.instance) throw new Error('MaskBrush is a singleton class')

    this.freeDrawingCursor = new FreeDrawingCursor(baseCanva.canvasObj)

    // 本工具管理的对象
    this.baseCanva.fabricObjects.set(this.seqGener.useNext(), this.freeDrawingCursor.cursor)

    // this.onMouseUp = this.onMouseUp.bind(this)
    // this.onMouseMove = this.onMouseMove.bind(this)
    // this.offWatch = this.offWatch.bind(this)
    this.onPathCreated = this.onPathCreated.bind(this)

    // hotkeys
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'enter| ',
      cb: this.onEnter.bind(this)
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'escape',
      cb: this.onEsc.bind(this)
    })

    // 调整画笔大小
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'd',
      cb: () => {
        switch (freeDrawOptions.brushType)  {
          case 'brush':
            freeDrawOptions.brush.width -= freeDrawOptions.step
            break
          case 'eraser':
            freeDrawOptions.eraser.width -= freeDrawOptions.step
            break
          default:
            break
        }
      }
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: 'a',
      cb: () => {
        switch (freeDrawOptions.brushType)  {
          case 'brush':
            freeDrawOptions.brush.width += freeDrawOptions.step
            break
          case 'eraser':
            freeDrawOptions.eraser.width += freeDrawOptions.step
            break
          default:
            break
        }
      }
    })

    // this.hotkeysManagerAutoOff.registerHotkeys({
    //   toolId: TOOL_ID,
    //   keys: 'z',
    //   cb: this.onKeyZ.bind(this)
    // })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: '1',
      cb: () => {
        this.setBrushType('brush')
      }
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: '2',
      cb: () => {
        this.setBrushType('eraser')
      }
    })
    this.hotkeysManagerAutoOff.registerHotkeys({
      toolId: TOOL_ID,
      keys: '3',
      cb: () => {
        this.setBrushType('')
      }
    })

    this.initSub({ toolId: TOOL_ID })

    // this.showMaskCanvas(false)
    MaskBrush.instance = this
  }

  // public onMouseMove(options: any) { }

  /**
   * 通过创建Image对象，加载图片
   * @param uri string
   */
  loadImage(uri: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = (err: Event | string) => {
        console.error('Image loading failed:', err)
        reject(new Error('Image loading failed'))
        image.src = ''
      }
      image.crossOrigin = 'anonymous'
      image.src = uri
    })
  }

  public bindAutoOffEvents() {
    // this.canvasObj.on('mouse:up', this.onMouseUp)
    // this.canvasObj.on('mouse:down', this.onMouseDown)
    // this.canvasObj.on('mouse:move', this.onMouseMove)
    this.canvasObj.on('path:created', this.onPathCreated)
  }

  public unBindAutoOffEvents() {
    // this.canvasObj.off('mouse:up', this.onMouseUp)
    // this.canvasObj.off('mouse:down', this.onMouseDown)
    // this.canvasObj.off('mouse:move', this.onMouseMove)
    this.canvasObj.off('path:created', this.onPathCreated)
  }

  public setBrushType(type: string) {
    freeDrawOptions.brushType = type
    switch (type) {
      case 'brush':
        break
      case 'erase':
        break
      case '':
        this.clearData()
        break
      default:
        break
    }
  }

  private attachedUUID: string | undefined = undefined
  /**
   * 工具关联到一个对象
   * @param uuid
   */
  attach(uuid: string) {
    if (!uuid) return
    if (uuid === this.attachedUUID) return

    // 释放老的
    this.unattach()

    this.attachedUUID = uuid
    set(globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID), 'userData.ownTool', TOOL_ID)
    globalStates.mainAnnoater.lockSeleted([this.attachedUUID])
  }

  /**
   * 工具不再关联
   */
  unattach() {
    if (this.attachedUUID) {
      set(globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID), 'userData.ownTool', undefined)
      globalStates.mainAnnoater.unlockSeleted([this.attachedUUID])
      this.attachedUUID = undefined
    }
  }

  public createMask(backgroundImage: any, others: fabric.Object[]) {
    this.maskCanvas = new fabric.Canvas('maskCanvas')
    const { maskCanvas } = this
    maskCanvas.clear()
    maskCanvas.setDimensions({
      width: this.canvasObj.getWidth(),
      height: this.canvasObj.getHeight()
    })
    ImageCanvas.instance.getImageObj()?.clone((imageObj: any) => {
      maskCanvas.setBackgroundImage(imageObj, maskCanvas.renderAll.bind(maskCanvas))
    })

    // test data
    const rect = new fabric.Rect({
      left: 40,
      top: 40,
      width: 50,
      height: 50,
      fill: 'transparent',
      stroke: 'green',
      strokeWidth: 5
    })
    maskCanvas.add(rect)
    this.maskCanvas.getElement().parentElement!.parentElement!.style.zIndex = 'auto'
  }
  onPathCreated(e) {
    this.eraseOrDrawPath(e).finally(() => {
      if (this.attachedUUID) {
        globalStates.mainAnnoater.selectObject(this.attachedUUID)
      }
    })
  }

  private cloneFabricObj(obj: fabric.Object): Promise<fabric.Object | undefined> {
    return new Promise((resolve, reject) => {
      if (!obj) {
        resolve(undefined);
        return;
      }
      obj.clone((newObj: fabric.Object) => {
        resolve(newObj);
      }, ['userData']);
    });
  }

  async fabricImageFromURL(image_url) {                                                                          
    return new Promise(function(resolve, reject) {                                                                        
      try {                                                                                                               
        fabric.Image.fromURL(image_url, function (image) {                                                                
          resolve(image);                                                                                                 
        });                                                                                                               
      } catch (error) {                                                                                                   
        reject(error);                                                                                                    
      }                                                                                                                   
    });                                                                                                                   
  }

  private async eraseOrDrawPath(e) {
    const path = e.path
    path.set({
      // globalCompositeOperation: 'destination-out',
      selectable: false,
      evented: false
    })

    const editingObj:UserObject|undefined = globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID)

    let __oldObj = undefined 
    if (editingObj) {
      __oldObj = await this.cloneFabricObj(editingObj) // 把修改之前的对象保存下来
    }

    // let objectsToRemove = [] as any
    let pos = undefined
    let newDataURL = undefined
    if (freeDrawOptions.brushType === 'eraser') {
      if (!editingObj) {
        this.baseCanva.canvasObj.remove(path)
        return // 没有什么可以擦除的
      }
      if (!path.intersectsWithObject(editingObj)) {
        this.baseCanva.canvasObj.remove(path)
        return  // 没有什么可以擦除的
      }

      path.set({
        globalCompositeOperation: 'destination-out'
      })

      const newPath = new fabric.Group([editingObj, path])
      console.log('newPath left top ', newPath.left, newPath.top)
      pos = { x: newPath.left, y: newPath.top }
      newDataURL = newPath.toDataURL({ withoutTransform: true })

    } else if (freeDrawOptions.brushType === 'brush') {
      // this.drawNewPath(e)
      if (editingObj) {
        // 修改画
        const newPath = new fabric.Group([editingObj, path])
        // console.log('newPath left top ', newPath.left, newPath.top)
        newDataURL = newPath.toDataURL({ withoutTransform: true })
        pos = { x: newPath.aCoords.tl.x, y: newPath.aCoords.tl.y }
      } else {
        // 新画
        const newPath = new fabric.Group([path])
        // console.log('newPath left top ', newPath.left, newPath.top)
        newDataURL = newPath.toDataURL({ withoutTransform: true })
        pos = { x: newPath.aCoords.tl.x, y: newPath.aCoords.tl.y }
      }
    }

    const fabricImage = await this.fabricImageFromURL(newDataURL)
    // if (objectsToRemove.length > 0) {
    // fabric.Image.fromURL(newDataURL, async (fabricImage) => {
      // const filter = new fabric.Image.filters.BlendColor({
      //   color:'red',
      //   mode: 'tint',
      //   alpha: 0.5
      //  })
      //  fabricImage.filters.push(filter);
      fabricImage.set({
        left: pos.x,
        top: pos.y,
        perPixelTargetFind: true,
        selectable: false,
        originX: 'left',
        originY: 'top',
        fill: 'rgba(55,0,0,0.3)',
        // stroke: path.stroke,
        // strokeWidth: path.strokeWidth,
        evented: false
      })
      this.baseCanva.canvasObj.add(fabricImage)
      this.baseCanva.canvasObj.remove(path)
      // this.baseCanva.canvasObj.remove(...objectsToRemove)
      fabricImage.setCoords()
      const jo = fabricImage.toJSON(['userData'])
      // const mask = {
      //   type: OlTypeEnum.Mask2dBase64,
      //   object_id: get(editingObj, 'userData.anno.object_id', ''),
      //   object_type: get(editingObj, 'userData.anno.object_type', ''),
      //   val: jo.src,
      //   uuid: get(editingObj, 'userData.anno.uuid', uuidv4()),
      //   attributes: {
      //     ...get(editingObj, 'userData.anno.attributes', {}),
      //     left: jo.left,
      //     top: jo.top,
      //     width: jo.width,
      //     height: jo.height,
      //     __oldObj
      //   }
      // } as Mask2dBase64

      const mask = {
        ol_type_: OlTypeEnum.Mask2dBase64,
        label_uuid: uuidv4(),
        object_id: '',
        object_type: '',
        object_uuid: uuidv4(),

        ...editingObj?.userData.anno,
        val: jo.src,
        attributes: {
          ...editingObj?.userData.anno.attributes,
          ltwh: [jo.left, jo.top,jo.width, jo.height],
          image_shape: [globalStates.imageObject?.width, globalStates.imageObject?.height]
        }
      } as Mask2dBase64

      set(mask.attributes, '__oldObj', __oldObj)
      await globalStates.mainAnnoater.onMessage(mask)

      // set current edit
      this.attachedUUID = mask.label_uuid
    // })
  }

  doActivate() {
    const selectedUUID = globalStates.mainAnnoater.getSelectedFabricObjectUUID()
    if (selectedUUID) {
      this.attach(selectedUUID)
    } else {
      this.attachedUUID = undefined
    }
    ImageCanvas.instance.getImageObj()?.clone((imageObj: any) => {
      this.baseCanva.canvasObj.setBackgroundImage(imageObj, () => {
        this.baseCanva.canvasObj.requestRenderAll()
      })
    })
    this.freeDrawingCursor.activate()
  }

  doDeactivate() {
    this.freeDrawingCursor.deActivate()
    this.attachedUUID = undefined
  }

  public setVisible(visible: boolean) {
    // this.freeDrawingCursor.set({visible: visible})
  }

  // onKeyZ() {
  //   this.undoLastOp()
  // }

  onEsc() {
    this.clearData()
    globalStates.subTool = ''
  }

  onEnter() {
    this.doFinishDrawing()
    this.clearData()
    globalStates.subTool = ''
  }

  public onWatch() {
    this.watchers.push(
      // 修改brush
      watch(() => freeDrawOptions.brushType, (newValue, oldValue) => {
        this.setBrushType(newValue)
      }, { deep: true })
    )

    this.watchers.push(
      watch(() => poly2dAnnotaterStates.selectedFabricObj, (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
          if (newValue instanceof fabric.Object) {
            const uuid = newValue.userData?.obj?.label_uuid
            this.attach(uuid)
          }
        }
      })
    )
  }

  private doFinishDrawing() {
    this.clearData()
  }

  public cleanData() {
    this.clearData()
  }

  private clearData() {
    this.unattach()
    this.attachedUUID = undefined
    this.canvasObj.renderAll()
  }
}

export { MaskBrush }
