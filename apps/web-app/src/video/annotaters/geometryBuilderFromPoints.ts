/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月23日12:14:03
 * @date 甲辰 [龙] 年 三月十五
 */
import { computed, watch, reactive } from 'vue'
import { fabric } from 'fabric'
import { useMagicKeys, whenever } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import colormap from 'colormap'
import { get, toFloat, isEmpty, range, select } from 'radash'

import { ltrbToXywh } from '@/openlabel/utils'
import { SequenceGenerator } from './sequenceGenerator'
import { Annotater } from './annotater'
import { Vector2, AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { type Point2d, OlTypeEnum, type BBox, type RBBox } from '@/openlabel'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { setRectFromBoxObj, angleToTheta, cornersToCxcydxdyangle } from './utils'
import { loadRustWasm } from '@/libs/plugin'
import type { RenderHelper } from '../RenderHelper'


const { current } = useMagicKeys()
const currentKeyboard = current

type UserFabricObject = fabric.Circle & {
    userData: {
        zIndex: number,
        obj: Point2d,
    }
}

const geometryBuilderFromPointsStates = reactive({
    selectedObject: undefined as UserFabricObject | undefined,
    defaultObjType: 'object' as string,
    setting: {
        defaultObjType: 'object' as string,
        objTypes: ['object', 'newBorn'] as string[], // 类别名
        outGeometryType: OlTypeEnum.BBox as OlTypeEnum,
    },
})

const defaultSettingFormData = {
    defaultRadius: 3,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.2)',
    }
}

export const toolOptions = reactive({
    zIndex: 80,
    enabled: false,
    seting: {
        pointRadius: {
            min: 1,
            max: 9999,
        },
        pointCount: [3, 9],
        pointCountMax: 20,
        rect: {
            minWidth: 3,
            maxWidth: 9999,
            minHeight: 3,
            maxHeight: 9999,
        }
    },
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
            defaultRadius: {
                type: 'number',
                title: '点半径',
                description: "点大小",
                default: defaultSettingFormData.defaultRadius,
            },
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

const TOOL_ID = 'geometryBuilderFromPoints'
export const toolConf = {
    id: TOOL_ID,
    icon: 'streamline:focus-points',
    name: '点辅助标注',
    shortcut: 'G',
    description: '点击多个点，辅助标注目标',
    style: computed(() => ({
        color: globalStates.subTool === TOOL_ID ? 'blue' : ''
    })),
    shortcutCallback: () => {
        if (globalStates.subTool === TOOL_ID) {
            globalStates.subTool = ''
        } else {
            globalStates.subTool = TOOL_ID
        }
    }
}

class GeometryBuilderFromPoints extends Annotater {
    static name = TOOL_ID

    private curRect: fabric.Rect
    private drawing = false
    private objects: Map<string, UserFabricObject> = new Map() // uuid -> Circle
    private seqGener: SequenceGenerator = new SequenceGenerator(toolOptions.zIndex * 10000, (toolOptions.zIndex + 1) * 10000)
    private objStyles: Map<string, any> = new Map([
        ['object',
            {
                options: {
                    ...defaultSettingFormData.options,
                },
            }
        ],
    ])
    private selectedIndex = -1

    public setConf(conf: any) {
        geometryBuilderFromPointsStates.setting = {
            ...geometryBuilderFromPointsStates.setting,
            ...conf
        }
    }

    public setVisible(visible: boolean) {
        this.curRect?.set({ visible })
    }

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)

        this.curRect = new fabric.Rect({
            opacity: 0.7,
            strokeUniform: true,
            noScaleCache: true,
            selectable: false,
            ...defaultSettingFormData.options
        })

        this.baseCanva.fabricObjects.set(toolOptions.zIndex + 1, this.curRect)

        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onSelectionCleared = this.onSelectionCleared.bind(this)
        this.onSelectionCreated = this.onSelectionCreated.bind(this)
        this.onSelectionUpdated = this.onSelectionUpdated.bind(this)
        this.onObjectModified = this.onObjectModified.bind(this)

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

        // watch(() => globalStates.listenHotkeys, (newValue, oldValue) => {
        //     if (newValue === oldValue) {
        //         return
        //     }
        //     if (newValue === 1) {
        //         this.statesCore.listenHotkeys = true
        //     } else {
        //         this.statesCore.listenHotkeys = false
        //     }
        // })

        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: toolConf.shortcut, cb: toolConf.shortcutCallback })

        loadRustWasm().then((m) => {
            toolOptions.enabled = true
        }).catch(err => {
            toolOptions.enabled = false
            console.error(err)
        })
    }

    onEnter() {
        this.doFinishDrawing()
        this.cleanData()
    }

    onEsc() {
        this.doCancelDrawing()
    }

    onWatch() {
        this.watchers.push(
            watch(() => toolOptions.settingFormData.options, (newValue, oldValue) => {
                if (this.objects) {
                    this.objects.forEach((obj, key) => {
                        obj.set(newValue)
                    })
                }
                this.canvasObj.renderAll()
            }, { deep: true })
        )

        this.watchers.push(
            // 检测改变类别
            watch(() => geometryBuilderFromPointsStates.selectedObject, (newVal, oldVal) => {
                if (newVal && newVal !== oldVal && newVal.userData) {
                    const uuid = newVal.userData.anno.label_uuid
                    if (uuid && !this.objects.has(uuid)) {
                        return
                    }

                    geometryBuilderFromPointsStates.setting.defaultObjType = newVal.userData.anno.object_type
                    // 更新当前对象的样式
                    const selectedObject = geometryBuilderFromPointsStates.selectedObject
                    if (selectedObject?.type === 'circle') {
                        selectedObject.set({
                            ...this.objStyles.get(newVal).options
                        })
                    }
                }
            }, {deep: true })
        )

        this.watchers.push(
            // 类别发生变化
            watch(() => geometryBuilderFromPointsStates.setting.objTypes, (newVal, oldVal) => {
                if (geometryBuilderFromPointsStates.setting.objTypes.length > 1) {
                    // 设置颜色空间
                    const fillColors = colormap({
                        colormap: 'rainbow',
                        nshades: geometryBuilderFromPointsStates.setting.objTypes.length < 9 ? 9 : geometryBuilderFromPointsStates.setting.objTypes.length,
                        format: 'rgbaString',
                        alpha: 0.5
                    })
                    geometryBuilderFromPointsStates.setting.objTypes.forEach((obType, index) => {
                        this.objStyles.set(obType, {
                            options: {
                                fill: fillColors[index]
                            }
                        })
                    })
                }
            }, { immediate: true })
        )

        this.watchers.push(
            whenever(
                () => currentKeyboard.has('tab'),
                () => {
                    this.doSelecteNextObject()
                },
            ),
            whenever(
                () => currentKeyboard.has('delete'),
                () => {
                    this.removeSelected()
                },
            )
        )

    }

    doRemove(obj: UserFabricObject) {
        this.objects?.delete(obj.userData.anno.label_uuid)
        this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
        this.seqGener.release(obj.userData.zIndex)
        obj?.dispose()

        this.updateCurRectSize()

        this.baseCanva.reRenderAll()
    }

    removeSelected() {
        if (geometryBuilderFromPointsStates.selectedObject) {
            this.doRemove(geometryBuilderFromPointsStates.selectedObject)
        }
    }

    doSelecteNextObject() {
        while (this.objects.size > 0) {
            for (const [key, obj] of this.objects.entries()) {
                if (obj.userData.zIndex > this.selectedIndex) {
                    this.setSelectedObject(obj)
                    return
                }
            }
            this.selectedIndex = -1
        }
    }

    cleanData() {
        this.setSelectedObject(undefined)
        // 从canvas中删除所有
        this.objects?.forEach((obj) => {
            this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
            obj?.dispose()
        })

        this.curRect.set({ left: 0.0, top: 0.0, width: 0.0, height: 0.0 })

        this.seqGener.reset()
        this.objects.clear()
        this.baseCanva.reRenderAll()
    }

    doCancelDrawing() {
        if (this.drawing) {
            this.drawing = false
            this.cleanData()
            globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
        } else {
            globalStates.subTool = ''
        }
    }

    updateCurRectSize() {

        const pointsVal = new Float32Array((this.objects.size + 1) * 2)
        let index = 0
        this.objects.forEach((obj, k) => {
            pointsVal[index++] = obj.left! + obj.radius!
            pointsVal[index++] = obj.top! + obj.radius!
        })
        pointsVal[index++] = pointsVal[0]
        pointsVal[index++] = pointsVal[1]

        switch (geometryBuilderFromPointsStates.setting.outGeometryType) {
            case OlTypeEnum.BBox: {
                if (this.objects.size < 2) {
                    this.curRect.set({ left: 0.0, top: 0.0, width: 0.0, height: 0.0, })
                    return
                }
                const arr = window.labelHelper.minimum_rect(pointsVal)
                const xywh = ltrbToXywh(Array.from(arr))
                this.curRect.set({
                    left: xywh[0],
                    top: xywh[1],
                    width: xywh[2],
                    height: xywh[3]
                }
                )
                break
            }
            case OlTypeEnum.RBBox: {
                if (this.objects.size < 3) {
                    this.curRect.set({ left: 0.0, top: 0.0, width: 0.0, height: 0.0, })
                    return
                }
                const arrCorners = window.labelHelper.minimum_rotated_rect(pointsVal, "corners")
                // console.log(arrCorners)
                // const arr = cornersToCxcydxdyangle(arrCorners)
                // console.log(arr)
                // for (let i = 0; i < arrCorners.length - 1; i = i+2 ) {
                //     this.canvasObj.add(new fabric.Circle({
                //             fill: 'rgba(0,0,255,0.5)', 
                //             opacity: 0.7, 
                //             stroke: 'green',
                //             strokeWidth: 1,
                //             strokeUniform: true,
                //             noScaleCache: false,
                //             radius: 5,
                //             left: arrCorners[i],
                //             top: arrCorners[i + 1],
                //         })
                //     )
                //     this.canvasObj.renderAll()
                // }
                const aCoords = {
                    tl: new fabric.Point(arrCorners[0], arrCorners[1]),
                    tr: new fabric.Point(arrCorners[2], arrCorners[3]),
                    br: new fabric.Point(arrCorners[4], arrCorners[5]),
                    bl: new fabric.Point(arrCorners[6], arrCorners[7])
                }

                // const arr = window.labelHelper.minimum_rotated_rect(pointsVal, "cxcydxdyatanangle")
                // console.log(arr)
                // console.log((arr[4] + Math.PI) * 180 / Math.PI)
                // // const xywh = ltrbToXywh(Array.from(arr))
                this.curRect.set({
                    width: aCoords.tl.distanceFrom(aCoords.tr),
                    height: aCoords.tl.distanceFrom(aCoords.bl),
                    // originX: 'center',
                    // originY: 'center',
                    angle: fabric.util.radiansToDegrees(Math.atan2(aCoords.tr.y - aCoords.tl.y, aCoords.tr.x - aCoords.tl.x)),
                }
                )
                this.curRect.setPositionByOrigin({
                    x: aCoords.tl.lerp(aCoords.br, 0.5).x,
                    y: aCoords.tl.lerp(aCoords.br, 0.5).y
                }, 'center', 'center')
                // this.curRect.rotate(arr[4])
                this.canvasObj.setActiveObject(this.curRect)
                break
            }
            default:
                break
        }
    }

    doFinishDrawing() {
        this.drawing = false
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING

        if (globalStates.mainAnnoater) {
            let obj: any
            switch (geometryBuilderFromPointsStates.setting.outGeometryType) {
                case OlTypeEnum.BBox: {
                    const { left, top, width, height } = this.curRect
                    if (width === 0 || height === 0) {
                        return
                    }
                    const center = this.curRect.getCenterPoint()
                    obj = {
                        ol_type_: geometryBuilderFromPointsStates.setting.outGeometryType,
                        geometryId: '',
                        label_uuid: uuidv4(),

                        object_id: undefined,
                        object_type: 'default',
                        object_uuid: uuidv4(),
                        objectAttributes: {},

                        val: [center.x, center.y, width, height],
                        attributes: {}
                    } as BBox
                    break
                }
                case OlTypeEnum.RBBox: {
                    const center = this.curRect.getCenterPoint()
                    obj = {
                        ol_type_: geometryBuilderFromPointsStates.setting.outGeometryType,
                        geometryId: '',
                        label_uuid: uuidv4(),

                        object_id: undefined,
                        object_type: 'default',
                        object_uuid: uuidv4(),
                        objectAttributes: {},

                        val: [center.x, center.y,
                            this.curRect.width,
                            this.curRect.height,
                            angleToTheta(this.curRect.angle!)
                        ],
                        attributes: {}
                    } as RBBox
                    break
                }
                case OlTypeEnum.Point2dGroup: {
                    break
                }
                case OlTypeEnum.Poly2d: {
                    break
                }
                default:
                    console.error('不支持的输出类型')
            }
            globalStates.mainAnnoater.onMessage(obj)
            this.cleanData()
        }
    }

    addGeometry(objs: Point2d[]) {
        if (objs.length === 0) {
            return
        }
        objs.forEach((obj, index) => {
            let object_type = obj.object_type
            if (isEmpty(object_type)) {
                // 默认值
                object_type = geometryBuilderFromPointsStates.setting.defaultObjType
            }
            if (!this.objStyles.has(object_type)) {
                object_type = 'object'
            }
            const newObj = new fabric.Circle({
                fill: 'rgba(255,0,0,0.5)',
                opacity: 0.7,
                stroke: 'green',
                strokeWidth: 1,
                strokeUniform: true,
                noScaleCache: false,
                userData: {
                    zIndex: 0,
                    anno: {
                        ...obj,
                        object_type
                    }
                },
                // fill 等属性
                ...this.objStyles.get(object_type).options
            }) as UserFabricObject
            newObj.set({
                radius: toolOptions.settingFormData.defaultRadius,
                left: obj.val[0] - toolOptions.settingFormData.defaultRadius,
                top: obj.val[1] - toolOptions.settingFormData.defaultRadius,
            })

            if (!obj.label_uuid) {
                obj.label_uuid = uuidv4()
            }

            const p2d = this.objects.get(obj.label_uuid)
            if (!p2d) {
                // 新的 放到最后
                newObj.userData.zIndex = this.seqGener.useNext()
            } else {
                // 原有的
                newObj.userData.zIndex = p2d.userData.zIndex
            }

            this.baseCanva.fabricObjects.set(newObj.userData.zIndex, newObj)
            this.objects.set(obj.label_uuid, newObj)
        })

        this.updateCurRectSize()

        this.baseCanva.reRenderAll()
    }

    private lastUp: number = 0
    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            const millisecondsSinceEpoch = (new Date()).valueOf()
            const detaT = millisecondsSinceEpoch - this.lastUp
            if (detaT < 20) {
                // 鼠标双击
                ;
            } else {
                // 鼠标单击
                this.drawing = true
                const pointer = this.canvasObj.getPointer(options.e, false)
                const point2d: Point2d = {
                    type: 'Point2d',
                    object_type: geometryBuilderFromPointsStates.setting.defaultObjType,
                    uuid: uuidv4(),
                    attributes: {},
                    val: [pointer.x, pointer.y]
                } as Point2d
                this.addGeometry([point2d])
            }

            this.lastUp = millisecondsSinceEpoch
        } else if (options.e.button === 2) {
            if (options.target && options.target.type === 'circle') {
                this.doRemove(options.target as UserFabricObject)
            }
        }
    }

    public onMouseMove(options: any) {
        // if (this.boxing) {
        //     this.pointer = this.canvasObj.getPointer(options.e)
        //     const x = this.pointer.x
        //     const y = this.pointer.y

        //     const left = 
        //         Math.min(this.pointerStart.x, x)
        //     const top =
        //         Math.min(this.pointerStart.y, y)
        //     const width =
        //         Math.abs(this.pointerStart.x - x)
        //     const height =
        //         Math.abs(this.pointerStart.y - y)
        //     this.curRect.set({left, top, width, height})

        //     this.canvasObj.renderAll()
        // }
    }

    private setSelectedObject(obj: UserFabricObject | undefined) {
        geometryBuilderFromPointsStates.selectedObject = obj
        geometryBuilderFromPointsStates.setting.defaultObjType = get(obj, 'userData.anno.objType', 'object')

        this.selectedIndex = obj?.userData?.zIndex || -1
        if (geometryBuilderFromPointsStates.selectedObject) {
            this.canvasObj.setActiveObject(geometryBuilderFromPointsStates.selectedObject)
        }
    }

    public onSelectionCleared(options: any) {
        this.setSelectedObject(undefined)
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
    }
    public onSelectionCreated(options: any) {
        const target = options.selected[0]
        const uuid = get(target, 'userData.anno.label_uuid', undefined)
        if (uuid && !this.objects.has(uuid)) {
            globalStates.subTool = ''
            return
        }
        this.setSelectedObject(target)
        // globalStates.working = AnnoWorkEnum.BBOX_OBJECT_SELECTTED
    }
    public onSelectionUpdated(options: any) {
        const target = options.selected[0]
        const uuid = get(target, 'userData.anno.label_uuid', undefined)
        if (uuid && !this.objects.has(uuid)) {
            globalStates.subTool = ''
            return
        }
        this.setSelectedObject(target)
        // globalStates.working = AnnoWorkEnum.BBOX_OBJECT_SELECTTED
    }
    public onObjectModified(options: any) {
        this.setSelectedObject(options.target)
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
        this.canvasObj.on('mouse:move', this.onMouseMove)
        this.canvasObj.on('selection:cleared', this.onSelectionCleared)
        this.canvasObj.on('selection:created', this.onSelectionCreated)
        this.canvasObj.on('selection:updated', this.onSelectionUpdated)
        this.canvasObj.on('object:modified', this.onObjectModified)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
        this.canvasObj.off('mouse:move', this.onMouseMove)
        this.canvasObj.off('selection:cleared', this.onSelectionCleared)
        this.canvasObj.off('selection:created', this.onSelectionCreated)
        this.canvasObj.off('selection:updated', this.onSelectionUpdated)
        this.canvasObj.off('object:modified', this.onObjectModified)
    }
}


export { GeometryBuilderFromPoints, geometryBuilderFromPointsStates }