/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月12日16:07:03
 * @date 甲辰 [龙] 年 三月初四
 */
import { watch, reactive, computed } from 'vue'
import * as THREE from 'three'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { globalStates } from '@/states'
import { v4 as uuidv4 } from 'uuid'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { type Poly2d, OlTypeEnum } from '@/openlabel'
import { shortcutCallback } from './utils'
import type { RenderHelper } from '../RenderHelper'


const defaultSettingFormData = {
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(0,200,0,0.1)',
    },
}
const polylineBuilderOptions = reactive({
    zIndex: 90,
    curvetype: 'default',
    settingFormData: {
        closed: false,
        interior: 0,
        ...defaultSettingFormData,
    }
})

export const ui = {
    schema: {
        type: 'object',
        required: [],
        'ui:order': ['*'],
        properties: {
            options: {
                type: "object",
                properties: {
                    stroke: {
                        title: '边颜色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        default: defaultSettingFormData.options.stroke,
                    },
                    strokeWidth: {
                        type: 'number',
                        title: '边宽度',
                        description: "边的宽度",
                        default: defaultSettingFormData.options.strokeWidth,
                    },
                    fill: {
                        title: '填充色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        default: defaultSettingFormData.options.fill,
                    },
                }
            },
        }
    }
}

const TOOL_ID = 'polylineBuilder'
export const polylineBuilderConf = {
    id: TOOL_ID,
    icon: 'ic:outline-polyline',
    name: '选点画曲线',
    shortcut: 'H',
    description: '<el-text>单击鼠标左键开始</el-text>',
    handler: () => { },
    style: computed(() => ({
      color: globalStates.subTool === TOOL_ID ? 'blue' : ''
    })),
    shortcutCallback: () => { shortcutCallback(TOOL_ID) }
  }

class PolylineBuilder extends Annotater {
    static name = TOOL_ID

    // private editing = false
    private drawing = false

    private points:fabric.Point[] = []
    private curPoly:fabric.Polyline|undefined = undefined

    private lastPoint: THREE.Vector2|undefined
    private tipsLine

    /**
     * 构造函数
     *
     * @param baseCanva 基础画布
     */
    constructor(baseCanva: RenderHelper) {
        super(baseCanva)
        this.tipsLine = new fabric.Line([0, 0, 0, 0], {
            left: 0,
            top: 0,
            strokeUniform: true,
            strokeDashArray: [4, 1],
            selectable: false,
            visible: false,
            ...polylineBuilderOptions.settingFormData.options,
        })
        this.baseCanva.fabricObjects.set(polylineBuilderOptions.zIndex + 1, this.tipsLine)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        
        this.onWatch = this.onWatch.bind(this)
        this.offWatch = this.offWatch.bind(this)

        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: polylineBuilderConf.shortcut, cb: polylineBuilderConf.shortcutCallback })
    
        this.initSub({toolId: TOOL_ID})
    }

    doActivate() {
        this.drawing = true
    }

    doDeactivate() {
        this.drawing = false
    }

    cleanState(): void {
        this.drawing = false
        // this.editing = false
        // globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
        // this.canvasObj.discardActiveObject()
    }

    cleanData(): void {
        // this.curRect.set({left: 0,top: 0,width: 0,height: 0})
        this.tipsLine.set({
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
        })
    }

    onEsc() {
        if (this.drawing) {
            this.cleanState()
            this.cleanData()
        } else {
            globalStates.subTool = ''
        }
    }

    onEnter() {
        this.doFinishDrawing()
        this.cleanState()
        this.cleanData()
        globalStates.subTool = ''
    }

    public setVisible(visible: boolean) {
        this.curPoly?.set({ visible })
        this.tipsLine?.set({ visible })
    }

    private reBuildPolyline(points: fabric.Point[]) {
        if (points.length <= 1) {
            return this.curPoly = undefined
        } else if (points.length === 2) {
            this.curPoly = new fabric.Polyline(points, {
                strokeUniform: true,
                objectCaching: false,
                ...polylineBuilderOptions.settingFormData.options
            })
        }

        this.baseCanva.fabricObjects.set(polylineBuilderOptions.zIndex + 2, this.curPoly)
        this.baseCanva.reRenderAll()
    }

    public onWatch() {
        this.watchers.push(
            watch(() => polylineBuilderOptions.settingFormData.options, (newValue, oldValue) => {
                if (this.curPoly) {
                    this.curPoly.set(newValue)
                }
                this.canvasObj.renderAll()
            }, {deep:true})
        )
        
        // this.watchers.push(
        //     // subtool被激活时，监听状态变化
        //     watch(() => globalStates.working, (newValue, oldValue) => {
        //         if (newValue === oldValue) {
        //             return
        //         }
        //         switch (newValue) {
        //             case AnnoWorkEnum.SUBTOOL_DRAWING: {
        //                 this.statesCore.showObjets = true
        //                 break
        //             }
        //             case AnnoWorkEnum.SUBTOOL_WAITING: {
        //                 this.statesCore.showObjets = false
        //                 break
        //             }
        //             default: {
        //                 break
        //             }
        //         }
        //     })
        // )
    }
    
    /**
     * 构建图形
     *
     * @param x 横坐标
     * @param y 纵坐标
     */
    private build(x:number, y:number) {
        if (this.lastPoint) {
            this.lastPoint.x = x
            this.lastPoint.y = y
        } else {
            this.lastPoint = new THREE.Vector2(x, y)
        }
        this.addPoint(x, y)
        this.canvasObj.renderAll()
    }

    private addPoint(x:number, y:number) {
        this.points.push(new fabric.Point(x, y))
        if (this.curPoly) {
            this.curPoly.points?.push({x, y})
        } else {
            // 创建
            this.reBuildPolyline(this.points)
        }
    }

    private removePoint() {
        this.points.pop()
        if (this.curPoly) {
            this.curPoly.points?.pop()
        }
        
        if (this.points.length <= 2) {
            // 重建
            this.reBuildPolyline(this.points)
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

    private doFinishDrawing() {
        if (globalStates.mainAnnoater) {

            if (!this.curPoly) {
                this.clearData()
                return
            }

            const vals:number[] = []
            this.curPoly.points?.forEach((point, index) => {
                vals.push(point.x)
                vals.push(point.y)
            })

            if (vals.length > 1) {
                // 发送数据
                const poly = {
                    type: 'Poly2d',
                    objId: '',
                    objType: '',
                    val: vals,
                    uuid: uuidv4(),
                    attributes: {
                        mode: 'MODE_POLY2D_ABSOLUTE',
                        closed: polylineBuilderOptions.settingFormData.closed,
                    }
                } as Poly2d
                globalStates.mainAnnoater.onMessage(poly)
            }
        }
        this.clearData()
    }

    private clearData() {
        if (this.curPoly) {
            this.canvasObj.remove(this.curPoly)
            this.baseCanva.fabricObjects.delete(polylineBuilderOptions.zIndex + 2)
            this.curPoly.dispose()
            this.baseCanva.emit("render:all")
        }
        this.curPoly = undefined
        this.lastPoint = undefined
        this.points = []
        this.canvasObj.renderAll()
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            // 鼠标左键
            if (this.drawing) {
                // globalStates.working = AnnoWorkEnum.SUBTOOL_DRAWING
                const p = this.canvasObj.getPointer(options.e, false)
                this.build(p.x, p.y)
            }
            // } else {
            //     this.drawing = false
            //     if (this.curPoly) this.canvasObj.setActiveObject(this.curPoly)
            // }
        }
    }

    public onMouseMove(options:any) {
        if (this.lastPoint) {
            const p = this.canvasObj.getPointer(options.e)
            this.tipsLine.set({
                x1: this.lastPoint.x,
                y1: this.lastPoint.y,
                x2: p.x,
                y2: p.y
            })
            this.canvasObj.renderAll()
        }
    }
}

  
export { PolylineBuilder, polylineBuilderOptions }