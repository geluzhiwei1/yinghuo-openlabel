/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年11月27日 17:47:47
 * @date 甲辰 [龙] 年 十月廿七
 */

import { reactive, watch } from 'vue'
import { fabric } from 'fabric'

/**
 * @description 配置项的默认值
 */
const defaultFreeDrawSettingFormData = {
  brushType: 'brush',
  brush: {
    width: 50,
    color: 'rgba(0,200,0,0.3)'
  },
  eraser: {
    width: 50,
    color: 'rgba(255,0,0,1.0)'
  },
  step: 5,
  cursor: {
    fill: 'rgba(0,200,0,0.3)'
  }
}

/**
 * @description 配置项
 */
export const freeDrawOptions = reactive({
  ...defaultFreeDrawSettingFormData
})

/**
 * @description 画笔/擦除实现
 */
export class FreeDrawingCursor {
  cursorOpacity: number = 0.5
  lastPos: fabric.Point = new fabric.Point(0, 0)
  canvas: fabric.Canvas

  cursor: fabric.Circle

  eraser: fabric.PencilBrush
  brush: fabric.PencilBrush

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas
    this.cursor = new fabric.Circle({
      left: -100,
      top: -100,
      radius: 20,
      fill: 'rgba(255,0,0,' + this.cursorOpacity + ')',
      stroke: 'black',
      originX: 'center',
      originY: 'center',
      visible: false
    })
    this.eraser = new fabric.PencilBrush(canvas)
    this.brush = new fabric.PencilBrush(canvas)

    this.onMouseMove = this.onMouseMove.bind(this)
  }

  private watchers: any[] = []
  onWatch() {
    this.watchers.push(
      watch(
        () => freeDrawOptions.brushType,
        (newVal, oldVal) => {
          this.setMode(newVal)
        },
        { immediate: true }
      ),
      watch(
        () => freeDrawOptions.brush,
        (newVal, oldVal) => {
          this.setBrush(newVal)
        },
        { deep: true }
      ),
      watch(
        () => freeDrawOptions.eraser,
        (newVal, oldVal) => {
          this.setEraser(newVal)
        },
        { deep: true }
      ),
      watch(
        () => freeDrawOptions.cursor,
        () => {
          this.setCursor(freeDrawOptions.cursor)
        },
        { deep: true, immediate: true }
      )
    )
  }
  offWatch() {
    this.watchers.forEach((unwatch) => {
      unwatch()
    })
    this.watchers = []
  }

  onMouseMove(options: any) {
    const _mouse = this.canvas.getPointer(options.e)
    this.moveTo(_mouse.x, _mouse.y)
  }

  private activated = false
  activate() {
    if (this.activated) return
    this.onWatch()
    this.activated = true
  }

  setMode(mode: string) {
    switch (mode) {
      case 'brush':
        // this.setCursor({fill:'rgba(0,255,0,' + this.cursorOpacity + ')'})
        this.canvas.freeDrawingBrush = this.brush
        this.canvas.freeDrawingBrush.width = freeDrawOptions.brush.width
        this.canvas.freeDrawingBrush.color = freeDrawOptions.brush.color
        break
      case 'eraser':
        // this.setCursor({fill:'rgba(255,0,0,' + this.cursorOpacity + ')'})
        this.canvas.freeDrawingBrush = this.eraser
        this.canvas.freeDrawingBrush.width = freeDrawOptions.eraser.width
        this.canvas.freeDrawingBrush.color = freeDrawOptions.eraser.color
        break
      default:
        this.clearDrawing()
        return
    }
    this.canvas.isDrawingMode = true
    this.canvas.freeDrawingCursor = this.cursor

    this.cursor.set({
      left: this.lastPos.x,
      top: this.lastPos.y,
      radius: this.canvas.freeDrawingBrush.width / 2,
      visible: true
    })
    this.canvas.on('mouse:move', this.onMouseMove)
    this.cursor.bringToFront()
    this._render()
  }

  clearDrawing() {
    if (!this.cursor.visible) return
    this.canvas.isDrawingMode = false
    this.canvas.freeDrawingCursor = 'none'
    this.canvas.off('mouse:move', this.onMouseMove)
    this.cursor.set({ visible: false })
    this._render()
  }

  deActivate() {
    if (!this.activated) return
    this.offWatch()
    this.clearDrawing()
    this.activated = false
  }

  _render() {
    this.cursor.setCoords()
    this.canvas.requestRenderAll()
  }

  moveTo(x: number, y: number) {
    this.cursor.set({
      left: x,
      top: y
    })
    this.lastPos.x = x
    this.lastPos.y = y

    this._render()
  }

  /**
   *
   * @param options {
   *  width: number
   *  color: string
   * }
   */
  setBrush(options: any) {
    if (options.width) this.canvas.freeDrawingBrush.width = options.width
    if (options.color) this.canvas.freeDrawingBrush.color = options.color
    this.cursor.set({
      left: this.lastPos.x,
      top: this.lastPos.y,
      radius: this.canvas.freeDrawingBrush.width / 2,
      fill: this.canvas.freeDrawingBrush.color
    })
    this._render()
  }

  setEraser(options: any) {
    if (options.width) this.canvas.freeDrawingBrush.width = options.width
    if (options.color) this.canvas.freeDrawingBrush.color = options.color
    this.cursor.set({
      left: this.lastPos.x,
      top: this.lastPos.y,
      radius: this.canvas.freeDrawingBrush.width / 2,
      fill: this.canvas.freeDrawingBrush.color
    })
    this._render()
  }

  /**
   *
   * @param options {
   *  fill: string
   * }
   */
  setCursor(options: any) {
    this.cursor.set({
      left: this.lastPos.x,
      top: this.lastPos.y,
      ...options
    })
    this._render()
  }
}
