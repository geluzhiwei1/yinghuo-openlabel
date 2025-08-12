/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024-05-30
 * @date 甲辰 [龙] 年 四月廿三
 */
import { computed, watch, reactive } from 'vue'
import { fabric } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { Annotater } from './annotater'
import { dnnModelApi } from '@/api'
import { parsePoly2d, ltrbToCxcywh, ltrbToXywh, parseBBoxes } from '@/openlabel/utils'
import { SequenceGenerator } from './sequenceGenerator'
import { BBoxTypeEnum, type Point2d, OlTypeEnum, type Poly2d, type RBBox, type BBox } from '@/openlabel'
import { shortcutCallback, setRectFromBoxObj } from './utils'
import { ElMessage } from 'element-plus'
import { Vector2, AnnoWorkEnum } from './common'
import { jobConfig } from '@/states/job-config'
import { globalStates } from '@/states'
import type { RenderHelper } from '../RenderHelper'


type UserFabricObject = (fabric.Circle | fabric.Rect) & {
    userData: {
        zIndex: number
        obj: Point2d | BBox
    }
}

const defaultToolSettings = {
    promoteType: 'object',
    pointType: 'object',
    defaultRadius: 3,
    minForgroundPointCount: 2,
    minBackgroundPointCount: 2,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.2)'
    },
    objTypes: ['none', 'box', 'object', 'ignore'] as string[], // 类别名
    objTypeNames: ['', '2D框', '前景点', '背景点'] as string[] // 类别名
    //   objTypeChangeHotkey: 'Shift'
}
export const toolStates = reactive({
    selectedObject: undefined as UserFabricObject | undefined,
    calling: false,
    setting: {
        objTypes: defaultToolSettings.objTypes,
        objTypeNames: defaultToolSettings.objTypeNames,
        // objTypeChangeHotkey: defaultToolSettings.objTypeChangeHotkey,
        outGeometryType: OlTypeEnum.BBox
    }
})
export const settingUISchema = {
    schema: {
        type: 'object',
        required: [],
        'ui:order': ['*'],
        properties: {
            minForgroundPointCount: {
                type: 'integer',
                title: '前景最少点数',
                maximum: 20,
                minimum: 0
            },
            minBackgroundPointCount: {
                type: 'integer',
                title: '背景景最少点数',
                maximum: 20,
                minimum: 0
            },
        }
    }
}
export const toolOptions = reactive({
    zIndex: 190,
    doAction: 0,
    formData: {
        ...defaultToolSettings
    },
    selectedApi: undefined
})

const TOOL_ID = 'promptSegment'
export const pointsPromoteSegmentToolConf = {
    id: TOOL_ID,
    icon: 'fluent:image-sparkle-16-regular',
    name: '鼠标辅助',
    shortcut: 'U',
    description: '设置前景点、背景点或辅助框',
    handler: () => { },
    shortcutCallback: () => {
        shortcutCallback(TOOL_ID)
    }
}

export class PromptSegment extends Annotater {
    static name = TOOL_ID

    protected pointerStart: Vector2 | undefined = undefined
    protected curRect: fabric.Rect
    private lastBoxUUID: string | undefined = undefined

    private drawing = false
    private objects: Map<string, UserFabricObject> = new Map() // uuid -> Circle
    private seqGener: SequenceGenerator = new SequenceGenerator(
        toolOptions.zIndex * 10000,
        (toolOptions.zIndex + 1) * 10000
    )
    private objStyles: Map<string, any> = new Map([
        [
            'object',
            {
                options: {
                    stroke: 'green',
                    strokeWidth: 1,
                    fill: 'rgba(0,255,0,0.5)'
                }
            }
        ],
        [
            'ignore',
            {
                options: {
                    stroke: 'red',
                    strokeWidth: 1,
                    fill: 'rgba(255,0,0,0.5)'
                }
            }
        ],
        [
            'bbox',
            {
                options: {
                    stroke: 'green',
                    strokeWidth: 1,
                    fill: 'rgba(0,255,0,0.3)'
                }
            }
        ]
    ])

    public setConf(conf: any) {
        toolStates.setting = {
            ...toolStates.setting,
            ...conf
        }
    }

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)

        this.curRect = new fabric.Rect({
            opacity: 0.3,
            strokeUniform: true,
            noScaleCache: false,
            selectable: false,
            stroke: 'red',
            strokeWidth: 1,
            fill: 'rgba(0,255,0,0.2)'
        })

        this.baseCanva.fabricObjects.set(toolOptions.zIndex + 1, this.curRect)

        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onSelectionCreated = this.onSelectionCreated.bind(this)

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
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: 'delete|backspace|x',
            cb: this.onDel.bind(this)
        })
        // this.hotkeysManagerAutoOff.registerHotkeys({
        //     toolId: TOOL_ID,
        //     keys: 'e',
        //     cb: this.onChangePromoteType.bind(this)
        // })
        this.hotkeysManager.registerHotkeys({
            toolId: TOOL_ID,
            keys: pointsPromoteSegmentToolConf.shortcut,
            cb: pointsPromoteSegmentToolConf.shortcutCallback
        })

        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '1',
            cb: () => {
                toolOptions.formData.promoteType = 'bbox'
            }
        })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '2',
            cb: () => {
                toolOptions.formData.promoteType = 'object'
            }
        })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '3',
            cb: () => {
                toolOptions.formData.promoteType = 'ignore'
            }
        })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '4',
            cb: () => {
                toolOptions.formData.promoteType = 'none'
            }
        })

        this.initSub({ toolId: TOOL_ID })
    }

    doActivate() {
        // 暂停主工具
        globalStates.mainAnnoater.statesCore.listenHotkeys = false
    }
    doDeactivate(): void {
        // 打开主工具
        globalStates.mainAnnoater.statesCore.listenHotkeys = true
    }

    onChangePromoteType() {
        const idx = defaultToolSettings.objTypes.indexOf(toolOptions.formData.promoteType)
        const new_idx = (idx + 1) % defaultToolSettings.objTypes.length
        toolOptions.formData.promoteType = defaultToolSettings.objTypes[new_idx]
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

    public exportPoints(format: string = 'default'): Point2d[] {
        const objs: Array<Point2d> = new Array()
        for (const obj of this.objects.values()) {
            if (obj.userData.anno.ol_type_ !== OlTypeEnum.Point2d) {
                continue
            }
            objs.push(this.convertFabricObjectToLabel(obj))
        }
        return objs
    }

    callModel() {
        toolStates.calling = true

        const pointList = this.exportPoints()
        const point_coords: any[] = []
        const point_labels: Number[] = []
        let forground_count = 0
        let backgrpund_count = 0
        pointList.forEach((point) => {
            point_coords.push({ x: point.val[0], y: point.val[1] })
            if (point.object_type === 'object') {
                forground_count += 1
                point_labels.push(1)
            } else {
                backgrpund_count += 1
                point_labels.push(0)
            }
        })

        // 点数够吗
        if (
            forground_count < toolOptions.formData.minForgroundPointCount
        ) {
            ElMessage.error(`前景点数最少需要：${toolOptions.formData.minForgroundPointCount}`)
            toolStates.calling = false
            return
        }
        if (
            backgrpund_count < toolOptions.formData.minBackgroundPointCount
        ) {
            ElMessage.error(`背景点数最少需要：${toolOptions.formData.minBackgroundPointCount}`)
            toolStates.calling = false
            return
        }

        // check datasource
        // if (jobConfig.data_source === 'localImage') {
        //     ElMessage.error('当前图像是本地数据，无法调用服务器上的模型')
        //     toolStates.calling = false
        //     return
        // }
        // call api
        const imgBlob = globalStates.toolsets!.get('imageCanvas')!.getImageBlob()
        const data = {
            req: {},
            image: {
                image: globalStates.current_data.image_uri,
                type: 'jpg',
                data_type: 'uri'
            },
            point_coords: point_coords,
            point_labels: point_labels,
            box: this.lastBoxUUID ? this.objects.get(this.lastBoxUUID)?.userData.anno : undefined,
            params: {
                tool: globalStates.mainTool,
                sub_tool: globalStates.subTool,
            }
        }

        if (point_coords.length === 0 && point_labels.length === 0 && data.box === undefined) {
            toolStates.calling = false
            ElMessage.error('请选择点或者框选区域，再调用模型！')
            return
        }

        dnnModelApi
            // .funcapi('segmentation.monocular.2d', 'sam.MobileSAM', data)
            .funcapi2(toolOptions.selectedApi.api_group, toolOptions.selectedApi.api_id, data, imgBlob)
            .then((res) => {
                this.doFinishDrawing(res.data)
            })
            .catch((err) => {
                ElMessage.error('请求模型时异常：' + err)
            })
            .finally(() => {
                toolStates.calling = false
            })
    }

    public onWatch() {
        // this.watchers.push(
        //   watch(
        //     () => toolOptions.formData.options,
        //     (newValue, oldValue) => {
        //       if (this.objects) {
        //         this.objects.forEach((obj, key) => {
        //           obj.set(newValue)
        //         })
        //       }
        //       this.canvasObj.renderAll()
        //     },
        //     { deep: true }
        //   )
        // )

        this.watchers.push(
            watch(
                () => toolOptions.doAction,
                (newValue, oldValue) => {
                    if (newValue === oldValue) return
                    this.callModel()
                }
            )
        )
    }

    doRemove(obj: UserFabricObject) {
        if (!obj) {
            return
        }
        this.objects?.delete(obj.userData.anno.label_uuid)
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
        // 从canvas中删除所有
        this.objects?.forEach((obj) => {
            this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
            obj?.dispose()
        })
        this.pointerStart = undefined
        this.curRect.set({ left: 0, top: 0, width: 0, height: 0 })
        this.seqGener.reset()
        this.objects.clear()
        this.baseCanva.reRenderAll()
    }

    doCancelDrawing() {
        this.drawing = false
        this.cleanData()
        globalStates.subTool = ''
    }

    doFinishDrawing(openlabel: any) {
        this.drawing = false
        if (!globalStates.mainAnnoater) return
        let obj: any
        switch (toolStates.setting.outGeometryType) {
            case OlTypeEnum.BBox: {
                const bboxes = parseBBoxes(openlabel, undefined)
                if (!bboxes || bboxes.length === 0) {
                    return
                }
                bboxes.forEach((bbox) => {
                    globalStates.mainAnnoater?.onMessage(bbox)
                })
                // const { left, top, width, height } = this.curRect
                // if (width === 0 || height === 0) {
                //     return
                // }
                // const center = this.curRect.getCenterPoint()
                // obj = {
                //     ol_type_: OlTypeEnum.BBox,
                //     geometryId: '',
                //     label_uuid: uuidv4(),

                //     object_id: undefined,
                //     object_type: toolStates.setting.outGeometryType,
                //     object_uuid: uuidv4(),
                //     objectAttributes: {},

                //     val: [center.x, center.y, width, height],
                //     attributes: {}
                // } as BBox
                break
            }
            case OlTypeEnum.RBBox: {
                const polys = parsePoly2d(openlabel, undefined)
                if (polys) {
                    polys.forEach((poly) => {
                        if (poly.val) {
                            const pointsVal = new Float32Array(poly.val.length)
                            for (let i = 0; i < poly.val.length; i++) {
                                pointsVal[i] = poly.val[i]
                            }
                            const arrCorners = window.labelHelper.minimum_rotated_rect(pointsVal, 'corners')
                            const aCoords = {
                                tl: new fabric.Point(arrCorners[0], arrCorners[1]),
                                tr: new fabric.Point(arrCorners[2], arrCorners[3]),
                                br: new fabric.Point(arrCorners[4], arrCorners[5]),
                                bl: new fabric.Point(arrCorners[6], arrCorners[7])
                            }
                            const obj = {
                                ol_type_: toolStates.setting.outGeometryType,
                                geometryId: '',
                                label_uuid: uuidv4(),

                                object_id: undefined,
                                object_type: 'default',
                                object_uuid: uuidv4(),
                                objectAttributes: {},

                                val: [
                                    // center
                                    aCoords.tl.lerp(aCoords.br, 0.5).x,
                                    aCoords.tl.lerp(aCoords.br, 0.5).y,
                                    // width, height
                                    aCoords.tl.distanceFrom(aCoords.tr),
                                    aCoords.tl.distanceFrom(aCoords.bl),
                                    // engle
                                    fabric.util.radiansToDegrees(
                                        Math.atan2(aCoords.tr.y - aCoords.tl.y, aCoords.tr.x - aCoords.tl.x)
                                    )
                                ],
                                attributes: {}
                            } as RBBox
                            globalStates.mainAnnoater!.onMessage(obj)
                        }
                    })
                }
                break
            }
            // case OlTypeEnum.Point2dGroup: {
            //     break
            // }
            case OlTypeEnum.Poly2d: {
                const polys = parsePoly2d(openlabel, undefined)
                if (polys) {
                    polys.forEach((poly) => {
                        if (poly.val) {
                            globalStates.mainAnnoater!.onMessage(poly)
                        }
                    })
                }
                break
            }
            default:
                console.error('不支持的输出类型')
        }
        globalStates.subTool = ''
        this.cleanData()
    }

    addGeometry(objs: Point2d[] | BBox[]) {
        if (objs.length === 0) {
            return
        }
        objs.forEach((obj, index) => {
            const objType = obj.object_type
            let newObj: UserFabricObject
            if (objType === 'object' || objType === 'ignore') {
                newObj = new fabric.Circle({
                    fill: 'rgba(255,0,0,0.5)',
                    opacity: 0.7,
                    stroke: 'green',
                    strokeWidth: 1,
                    strokeUniform: true,
                    noScaleCache: false,
                    userData: {
                        zIndex: 0,
                        anno: obj
                    },
                    // fill 等属性
                    ...this.objStyles.get(objType).options
                }) as UserFabricObject
                newObj.set({
                    radius: toolOptions.formData.defaultRadius,
                    left: obj.val[0] - toolOptions.formData.defaultRadius,
                    top: obj.val[1] - toolOptions.formData.defaultRadius
                })
            } else if (objType === 'bbox') {
                newObj = new fabric.Rect({
                    opacity: 1.0,
                    strokeUniform: true,
                    userData: {
                        zIndex: 0,
                        anno: obj
                    },
                    //   label: objType,
                    // fill 等属性
                    ...this.objStyles.get(objType).options
                }) as UserFabricObject

                setRectFromBoxObj(newObj, obj)

                // 删除已有，只保留最后一个
                if (this.lastBoxUUID) {
                    this.doRemove(this.objects.get(this.lastBoxUUID)!)
                }
                this.lastBoxUUID = obj.label_uuid
            } else {
                ;
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
            // newObj.on('mouseup', (opt) => {
            //     this.doRemove(newObj)
            //     // TODO
            //     opt.e.stopPropagation()
            //     opt.e.stopImmediatePropagation()
            //     opt.e.preventDefault()
            // })
        })

        this.baseCanva.reRenderAll()
    }

    private drawRect(options: any) {
        if (!this.drawing) {
            this.pointerStart = this.canvasObj.getPointer(options.e, false)
            this.drawing = true
            //   globalStates.working = AnnoWorkEnum.SUBTOOL_DRAWING
        } else {
            const obj = {
                object_type: toolOptions.formData.promoteType,
                object_id: '',

                ol_type_: OlTypeEnum.BBox,
                geometryId: '',
                label_uuid: uuidv4(),

                val: [
                    this.curRect.left! + 0.5 * this.curRect.width!,
                    this.curRect.top! + 0.5 * this.curRect.height!,
                    this.curRect.width,
                    this.curRect.height
                ],

                valType: BBoxTypeEnum.CXCYWH,
                attributes: {}
            } as BBox
            this.addGeometry([obj])

            this.drawing = false
            this.pointerStart = undefined
            this.curRect.set({ left: 0, top: 0, width: 0, height: 0 })
        }
    }
    private drawPoint(options: any) {
        const millisecondsSinceEpoch = new Date().valueOf()
        const detaT = millisecondsSinceEpoch - this.lastUp
        if (detaT < 20) {
            // 鼠标双击
        } else {
            // 鼠标单击
            this.drawing = true
            const pointer = this.canvasObj.getPointer(options.e, false)
            const point2d = {
                object_type: toolOptions.formData.promoteType,
                object_id: '',

                ol_type_: OlTypeEnum.Point2d,
                label_uuid: uuidv4(),

                attributes: {},
                val: [pointer.x, pointer.y]
            } as Point2d
            this.addGeometry([point2d])
        }

        this.lastUp = millisecondsSinceEpoch
    }
    private lastUp: number = 0
    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            if (toolOptions.formData.promoteType === 'none') {
                ;
            }
            else if (toolOptions.formData.promoteType === 'bbox') {
                // 矩形框
                this.drawRect(options)
            } else {
                // 点
                this.drawPoint(options)
            }
        }
    }

    public onMouseMove(options: any) {
        if (toolOptions.formData.promoteType !== 'bbox') {
            return
        }
        if (this.drawing && this.pointerStart) {
            const pointer = this.canvasObj.getPointer(options.e)
            const x = pointer.x
            const y = pointer.y

            const left = Math.min(this.pointerStart.x, x)
            const top = Math.min(this.pointerStart.y, y)
            const width = Math.abs(this.pointerStart.x - x)
            const height = Math.abs(this.pointerStart.y - y)
            this.curRect.set({ left, top, width, height })
            this.curRect.setCoords()

            this.canvasObj.renderAll()
        }
    }

    public onSelectionCreated(options: any) {
        const target = options.selected[0]
        if (target) {
            toolStates.selectedObject = target
        }
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
        this.canvasObj.on('mouse:move', this.onMouseMove)
        this.canvasObj.on('selection:created', this.onSelectionCreated)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
        this.canvasObj.off('mouse:move', this.onMouseMove)
        this.canvasObj.off('selection:created', this.onSelectionCreated)
    }
}
