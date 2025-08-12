/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月29日17:09:58
 * @date 甲辰 [龙] 年 三月廿一
 */
import { watch, reactive } from 'vue'
import * as THREE from 'three'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from "./common"
import { globalStates } from '@/states'
import { type Poly2d, OlTypeEnum } from '@/openlabel'
import { v4 as uuidv4 } from 'uuid'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { shortcutCallback } from './utils'
import type { RenderHelper } from '../RenderHelper'


const defaultSettingFormData = {
    closed: true,
    interior: 0,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(0,200,0,0.3)',
    },
}
export const polygonBuilderOptions = reactive({
    zIndex: 50,
    curvetype: 'default',
    settingFormData: {
        ...defaultSettingFormData,
    }
})

export const ui = {
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
            //     // "ui:widget": "RadioWidget",
            //     "enum": [
            //         0,
            //         1,
            //     ],
            //     "enumNames": [
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

const TOOL_ID = 'polygonBuilder'
export const polygonBuilderConf = {
    id: TOOL_ID,
    icon: 'mdi:vector-polygon',
    name: '多边形-选点绘制',
    shortcut: 'H',
    description: '<el-text>单击鼠标左键开始，敲击Z键取消已经选择的点。</el-text>',
    handler: () => { },
    shortcutCallback: () => { shortcutCallback(TOOL_ID) }
}

class PolygonBuilder extends Annotater {
    static name = TOOL_ID
    private drawing = false
    private points: fabric.Point[] = []
    private curPoly: fabric.Polyline | fabric.Polygon | undefined = undefined
    private lastPoint: THREE.Vector2 | undefined
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
            ...polygonBuilderOptions.settingFormData.options,
        })
        this.baseCanva.fabricObjects.set(polygonBuilderOptions.zIndex + 1, this.tipsLine)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)

        this.onWatch = this.onWatch.bind(this)
        this.offWatch = this.offWatch.bind(this)
        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'z', cb: this.onKeyZ.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: polygonBuilderConf.shortcut, cb: polygonBuilderConf.shortcutCallback })
        
        this.initSub({toolId: TOOL_ID})
    }

    cleanState(): void {
        this.drawing = false
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
    }

    onKeyZ() {
        this.removePoint()
    }

    onEsc() {
        if (this.drawing) {
            this.cleanState()
            this.clearData()
        } else {
            globalStates.subTool = ''
        }
    }

    onEnter() {
        this.doFinishDrawing()
        this.cleanState()
        this.clearData()
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
                ...polygonBuilderOptions.settingFormData.options
            })
        } else {
            if (polygonBuilderOptions.settingFormData.closed) {
                this.curPoly = new fabric.Polygon(points, {
                    strokeUniform: true,
                    objectCaching: false,
                    ...polygonBuilderOptions.settingFormData.options
                })
            } else {
                this.curPoly = new fabric.Polyline(points, {
                    strokeUniform: true,
                    objectCaching: false,
                    ...polygonBuilderOptions.settingFormData.options
                })
            }
        }

        // 是否空洞
        if (polygonBuilderOptions.settingFormData.interior === 1) {
            this.curPoly?.set({ globalCompositeOperation: 'destination-out' })
        }

        this.baseCanva.fabricObjects.set(polygonBuilderOptions.zIndex + 2, this.curPoly)
        this.baseCanva.emit("render:all")
    }

    public onWatch() {

        this.watchers.push(
            watch(() => polygonBuilderOptions.settingFormData.options, (newValue, oldValue) => {
                if (this.curPoly) {
                    this.curPoly.set(newValue)
                }
                this.canvasObj.renderAll()
            }, { deep: true })
        )

        this.watchers.push(
            // 线创建后，可以改变类型
            watch(() => polygonBuilderOptions.settingFormData.closed, (newValue, oldValue) => {
                if (newValue === oldValue) return
                this.reBuildPolyline(this.points)
            }, { deep: true, immediate: true })
        )
    }

    /**
     * 构建图形
     *
     * @param x 横坐标
     * @param y 纵坐标
     */
    private build(x: number, y: number) {
        if (this.lastPoint) {
            this.lastPoint.x = x
            this.lastPoint.y = y
        } else {
            this.lastPoint = new THREE.Vector2(x, y)
        }
        this.addPoint(x, y)
        this.canvasObj.renderAll()
    }

    private addPoint(x: number, y: number) {
        this.points.push(new fabric.Point(x, y))
        if (!this.curPoly) {
            // 创建
            this.reBuildPolyline(this.points)
        }
    }

    private removePoint() {
        if (this.points.length === 0 ) return
        this.points.pop()
        this.lastPoint = undefined
        this.canvasObj.requestRenderAll()

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

            const vals: number[] = []
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

                    val: vals,
                    attributes: {
                        mode: 'MODE_POLY2D_ABSOLUTE',
                        // interior: polygonBuilderOptions.settingFormData.interior,
                        closed: polygonBuilderOptions.settingFormData.closed,
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
            this.baseCanva.fabricObjects.delete(polygonBuilderOptions.zIndex + 2)
            this.curPoly?.dispose?.()
            this.baseCanva.emit("render:all")
        }
        this.tipsLine.set({
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
        })
        this.curPoly = undefined
        this.lastPoint = undefined
        this.points = []
        this.canvasObj.renderAll()
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            // 鼠标左键
            // globalStates.working = AnnoWorkEnum.SUBTOOL_DRAWING
            const p = this.canvasObj.getPointer(options.e, false)
            this.build(p.x, p.y)
            this.drawing = true
            // else {
            //     this.drawing = false
            //     this.editing = true
            //     if (this.curPoly) this.canvasObj.setActiveObject(this.curPoly)
            // }
        }
    }

    public onMouseMove(options: any) {
        if (this.lastPoint) {
            const p = this.canvasObj.getPointer(options.e)
            this.tipsLine.set({
                x1: this.lastPoint.x,
                y1: this.lastPoint.y,
                x2: p.x,
                y2: p.y,
                visible: true
            })
            this.canvasObj.requestRenderAll()
        } else {
            this.tipsLine.set({
                visible: false
            })
        }
    }
}

export { PolygonBuilder }