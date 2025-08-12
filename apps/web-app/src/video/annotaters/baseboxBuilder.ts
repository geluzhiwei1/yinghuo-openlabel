/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月19日15:33:11
 * @date 甲辰 [龙] 年 三月十一 谷雨
 */
import { watch } from 'vue'
import { fabric } from 'fabric'
import { useMagicKeys, whenever } from '@vueuse/core'
import { Vector2, AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { Annotater } from './annotater'
import type { RenderHelper } from '../RenderHelper'

const { current } = useMagicKeys()
const currentKeyboard = current

abstract class BaseBoxBuilder extends Annotater {
    protected pointerStart: Vector2 | undefined = undefined
    protected drawing = false
    protected curRect: fabric.Rect

    constructor(baseCanva: RenderHelper, defaultOptions: any, zIndex: number) {
        super(baseCanva)

        this.curRect = new fabric.Rect({
            opacity: 0.3,
            strokeUniform: true,
            noScaleCache: false,
            selectable: false,
            ...defaultOptions,
        })

        this.baseCanva.fabricObjects.set(zIndex + 1, this.curRect)

        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)

        watch(() => globalStates.subTool, (newValue, oldValue) => {
            switch (newValue) {
                case this.name: {
                    // 被激活
                    this.statesCore.watching = true
                    this.statesCore.showObjets = true
                    this.statesCore.listeningMouseEvents = true
                    this.statesCore.listenHotkeys = true
                    globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
                    break
                }
                default: {
                    // 被取消
                    this.statesCore.watching = false
                    this.statesCore.showObjets = false
                    this.statesCore.listeningMouseEvents = false
                    this.statesCore.listenHotkeys = false
                    break
                }
            }
        })

        watch(() => globalStates.listenHotkeys, (newValue, oldValue) => {
            if (newValue === oldValue) {
                return
            }
            if (newValue === 1) {
                this.statesCore.listenHotkeys = true
            } else {
                this.statesCore.listenHotkeys = false
            }
        })
        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: 'baseboxBuilder', keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: 'baseboxBuilder', keys: 'escape', cb: this.onEsc.bind(this) })
    }

    private clearData() {
        this.pointerStart = undefined
        this.curRect.set({ left: 0, top: 0, width: 0, height: 0 })
    }

    onEsc() {
        if (this.drawing) {
            this.doCancelDrawing()
            this.clearData()
        } else {
            globalStates.subTool = ''
        }
    }

    onEnter() {
        this.doFinishDrawing()
        this.clearData()
        globalStates.subTool = ''
    }

    protected onWatchHotKeys() {
        // this.watchersHotkeys.push(
        //     whenever(() => (currentKeyboard.has('enter') || 
        //             currentKeyboard.has(' ')), () => {
        //         this.onEnter()
        //     }),
        //     whenever(() => currentKeyboard.has('escape'), () => {
        //         this.onEsc()
        //     })
        // )
    }

    protected doOnWatch() {

    }

    public onWatch() {
        this.doOnWatch()
        this.watchers.push(
            // subtool被激活时，监听状态变化
            watch(() => globalStates.working, (newValue, oldValue) => {
                if (newValue === oldValue) {
                    return
                }
                switch (newValue) {
                    case AnnoWorkEnum.SUBTOOL_DRAWING: {
                        this.statesCore.showObjets = true
                        break
                    }
                    case AnnoWorkEnum.SUBTOOL_WAITING: {
                        this.statesCore.showObjets = false
                        break
                    }
                    default: {
                        break
                    }
                }
            })
        )
    }

    // public getRect(options: any) {
    //     const end = this.canvasObj.getPointer(options.e)
    //     const x1 = Math.min(end.x, this.pointerStart.x)
    //     const y1 = Math.min(end.y, this.pointerStart.y)
    //     const x2 = Math.min(end.x, this.pointerStart.x)
    //     const y2 = Math.min(end.y, this.pointerStart.y)
    //     const rect = [x1, y1, x2, y2]
    //     return rect
    // }

    protected doFinishDrawing() {
    }
    protected doCancelDrawing() {
        this.drawing = false
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            // 鼠标左键
            if (!this.drawing) {
                this.pointerStart = this.canvasObj.getPointer(options.e, false)
                this.drawing = true
                globalStates.working = AnnoWorkEnum.SUBTOOL_DRAWING
            } else {
                this.onEnter()
            }
        }
    }

    public onMouseMove(options: any) {
        if (this.drawing && this.pointerStart) {
            const pointer = this.canvasObj.getPointer(options.e)
            const x = pointer.x
            const y = pointer.y

            const left =
                Math.min(this.pointerStart.x, x)
            const top =
                Math.min(this.pointerStart.y, y)
            const width =
                Math.abs(this.pointerStart.x - x)
            const height =
                Math.abs(this.pointerStart.y - y)
            this.curRect.set({ left, top, width, height })
            this.curRect.setCoords()

            this.canvasObj.renderAll()
        }
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
        this.canvasObj.on('mouse:move', this.onMouseMove)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
        this.canvasObj.off('mouse:move', this.onMouseMove)
    }
}

export { BaseBoxBuilder }