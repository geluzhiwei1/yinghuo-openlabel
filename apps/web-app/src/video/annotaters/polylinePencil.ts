/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月12日16:07:03
 * @date 甲辰 [龙] 年 三月初四
 */
import { watch, reactive, computed } from 'vue'
import { useMagicKeys, whenever } from '@vueuse/core'
import * as THREE from 'three'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { AnnoWorkEnum} from "./common"
import { globalStates } from '@/states'
import { OlTypeEnum, type Poly2d } from '@/openlabel'
import { v4 as uuidv4 } from 'uuid'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { shortcutCallback } from './utils'
import type { RenderHelper } from '../RenderHelper'


const { current } = useMagicKeys()
const currentKeyboard = current

const defaultSettingFormData = {
    closed: true,
    interior: 0,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(0,200,0,0.3)',
    },
}

export const toolOptions = reactive({
    zIndex: 70,
    // curvetype: 'default',
    // options: {
    //     stroke: 'red',
    //     strokeWidth: 1,
    //     fill: 'white',
    // },
    closed: true,
    settingFormData: {
        ...defaultSettingFormData,
    }
})

export const toolSettingUi = {
    schema: {
        type: 'object',
        required: [],
        'ui:order': ['*'],
        properties: {
            closed: {
                type: 'boolean',
                title: '是否闭合',
                description: "多边形是否闭合",
            },
            // interior: {
            //     type: 'number',
            //     title: '边类型',
            //     description: "多边形的外部边/内部空洞",
            //     enum: [0, 1],
            //     enumNames: [
            //         "exterior外部边",
            //         "interior内部空洞",
            //     ],
            //     "ui:hidden": "{{rootFormData.closed === false}}"
            // },
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

const TOOL_ID = "polylinePencil"
export const toolConf = {
    id: TOOL_ID,
    icon: 'carbon:paint-brush-alt',
    name: '多边形-画笔',
    shortcut: 'J',
    description: '<el-text>按住Ctrl键，同时移动鼠标</el-text>',
    handler: () => { },
    shortcutCallback: () => { shortcutCallback(TOOL_ID) }
}

class PolylinePencil extends Annotater {
    
    static name = TOOL_ID

    private points:fabric.Point[] = []
    private curPoly:fabric.Polyline|undefined = undefined
    private lastPoint: THREE.Vector2|undefined
    private tipsLine

    private keyDownCtrl = false
    private ketDownShift = false
    private ketDownAlt = false

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)
        this.tipsLine = new fabric.Line([0,0,0,0], {
            left:0,
            top:0,
            strokeWidth: 1,
            strokeUniform: true,
            strokeDashArray:[4,1],
            selectable: false,
            visible: false,
            stroke: "red"
          })
        this.baseCanva.fabricObjects.set(toolOptions.zIndex + 1, this.tipsLine)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.offWatch = this.offWatch.bind(this)

        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'z', cb: this.onKeyZ.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: toolConf.shortcut, cb: toolConf.shortcutCallback })
        this.initSub({toolId: TOOL_ID})
    }

    public setVisible(visible: boolean) {
        this.curPoly?.set({ visible })
        this.tipsLine?.set({ visible })
    }

    onKeyZ() {
        this.removePoint()
    }

    onEsc() {
        this.clearData()
        globalStates.subTool = ''
    }

    onEnter() {
        this.doFinishDrawing()
        this.clearData()
        globalStates.subTool = ''
    }
    
    private reBuildPolyline(points: fabric.Point[]) {
        if (points.length <= 1) {
            return this.curPoly = undefined
        } else if (points.length === 2) {
            this.curPoly = new fabric.Polyline(points, {
                strokeUniform: true,
                objectCaching:false,
                ...toolOptions.settingFormData.options
            })
        } else {
            if (toolOptions.settingFormData.closed) {
                this.curPoly = new fabric.Polygon(points, {
                    strokeUniform: true,
                    objectCaching:false,
                    ...toolOptions.settingFormData.options
                })
            } else {
                this.curPoly = new fabric.Polyline(points, {
                    strokeUniform: true,
                    objectCaching:false,
                    ...toolOptions.settingFormData.options
                })
            }
        }

        this.baseCanva.fabricObjects.set(toolOptions.zIndex + 2, this.curPoly)
        this.baseCanva.emit("render:all")
    }

    public onWatch() {

        this.watchers.push(
            whenever(() => currentKeyboard.has('control'), () => {
                this.keyDownCtrl = true 
            }),
            whenever(() => !currentKeyboard.has('control'), () => {
                this.keyDownCtrl = false 
            })
        )
        this.watchers.push(
            whenever(() => currentKeyboard.has('shift'), () => {
                this.ketDownShift = true 
            }),
            whenever(() => !currentKeyboard.has('shift'), () => {
                this.ketDownShift = false 
            })
        )
        this.watchers.push(
            whenever(() => currentKeyboard.has('alt'), () => {
                this.ketDownAlt = true 
            }),
            whenever(() => !currentKeyboard.has('alt'), () => {
                this.ketDownAlt = false 
            })
        )

        this.watchers.push(
            watch(() => toolOptions.settingFormData.options, (newValue, oldValue) => {
                if (this.curPoly) {
                    this.curPoly.set(newValue)
                }
                this.canvasObj.renderAll()
            }, {deep:true})
        )

        this.watchers.push(
            // 线创建后，可以改变类型
            watch(() => toolOptions.closed, (newValue, oldValue) => {
                if (newValue === oldValue) return
                this.reBuildPolyline(this.points)
            }, {deep:true, immediate:true})
        )

        // this.watchers.push(
        //     // subtool被激活时，监听状态变化
        //     watch(() => globalStates.working, (newValue, oldValue) => {
        //         if (newValue === oldValue) {
        //             return
        //         }
        //         switch (newValue) {
        //             case AnnoWorkEnum.POLY_PENCIL_DRAWING: {
        //                 this.statesCore.showObjets = true
        //                 break
        //             }
        //             case AnnoWorkEnum.POLY_PENCIL_WATING: {
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

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
        this.canvasObj.on('mouse:move', this.onMouseMove)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
        this.canvasObj.off('mouse:move', this.onMouseMove)
    }

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
        // if (this.curPoly) {
        //     this.curPoly.points?.push({x, y})
        // } else {
        //     // 创建
        //     this.reBuildPolyline(this.points)
        // }
        if (!this.curPoly) {
            // 创建
            this.reBuildPolyline(this.points)
        }
    }

    private removePoint() {
        if (this.points.length === 0) {
            return
        }
        // this.points.pop()
        const removeCount = Math.ceil(this.points.length / 5)
        if (removeCount <= 1) {
            this.points.pop()
        } else {
            this.points = this.points.slice(0, this.points.length - removeCount)
            this.reBuildPolyline(this.points)
        }
        
        this.lastPoint = undefined
        this.canvasObj.renderAll()
        
        if (this.points.length <= 2) {
            // 重建
            this.reBuildPolyline(this.points)
        }
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
                    ol_type_: OlTypeEnum.Poly2d,
                    label_uuid: uuidv4(),

                    object_id: '',
                    object_type: '',
                    object_uuid: uuidv4(),

                    val:vals,
                    attributes: {
                        mode: 'MODE_POLY2D_ABSOLUTE',
                        closed: toolOptions.settingFormData.closed,
                    }
                } as Poly2d
                globalStates.mainAnnoater.onMessage(poly)
            }
        }

        this.clearData()
    }

    public cleanData() {
        this.clearData()
    }

    private clearData() {
        if (this.curPoly) {
            this.canvasObj.remove(this.curPoly)
            this.baseCanva.fabricObjects.delete(toolOptions.zIndex + 2)
            this.curPoly.dispose()
            this.baseCanva.emit("render:all")
        }
        this.curPoly = undefined
        this.lastPoint = undefined
        this.points = []
        this.tipsLine.set({
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
        })
        this.canvasObj.renderAll()
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            ;
            // 鼠标左键
        } else if(options.e.button === 2) {
            // 鼠标右键
            // globalStates.working = AnnoWorkEnum.POLY_PENCIL_WATING
            // this.doFinishDrawing()
        }
    }

    public onMouseMove(options:any) {
        if (this.keyDownCtrl) {
            // globalStates.working = AnnoWorkEnum.POLY_PENCIL_DRAWING
            const p = this.canvasObj.getPointer(options.e, false)
            this.build(p.x, p.y)
        } else {
            if (this.lastPoint) {
                const p = this.canvasObj.getPointer(options.e)
                this.tipsLine.set({
                    x1: this.lastPoint.x,
                    y1: this.lastPoint.y,
                    x2: p.x,
                    y2: p.y,
                    visible: true
                })
                this.canvasObj.renderAll()
            } else {
                this.tipsLine.set({
                    visible: false
                })
            }
        }
    }
}

export { PolylinePencil }