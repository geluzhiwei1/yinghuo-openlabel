/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024-08-24 甲辰 [龙] 年 七月廿一
 */
import { computed, watch, reactive } from 'vue'
import { fabric } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { Annotater } from './annotater'
import { dnnModelApi } from '@/api'
import { type Point2d, OlTypeEnum,type Poly2d, type RBBox, type BBox, BBoxTypeEnum} from '@/openlabel'
import { parseBBoxes, parsePoly2d } from '@/openlabel/utils'
import { SequenceGenerator } from './sequenceGenerator'
import { shortcutCallback, setRectFromBoxObj } from './utils'
import { ElMessage } from 'element-plus'
import { Vector2 } from './common'
import { globalStates } from '@/states'
import { jobConfig } from '../../states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import { get } from 'radash'
import type { RenderHelper } from '../RenderHelper'


type UserFabricObject = (fabric.Circle | fabric.Rect) & {
    userData: {
        zIndex: number
        obj: Point2d | BBox
        frameNo: number
    }
}

const defaultToolSettings = {
    promoteType: 'bbox',
    pointType: 'object',
    defaultRadius: 3,
    minForgroundPointCount: 0,
    minBackgroundPointCount: 0,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.2)'
    },
    objTypes: ['none', 'bbox', 'object', 'background'] as string[], // 类别名
    objTypeNames: ['2D框', '前景点', '背景点'] as string[] // 类别名
}
export const toolStates = reactive({
    selectedObject: undefined as UserFabricObject | undefined,
    calling: false,
    setting: {
        objTypes: defaultToolSettings.objTypes,
        objTypeNames: defaultToolSettings.objTypeNames,
        outGeometryType: OlTypeEnum.Poly2d as OlTypeEnum
    },
    /** 表格显示的内容 */
    promptsTableDatas: [] as any[],
    /** 模型返回的数据 */
    labelsByModel:undefined
})
export const settingUISchema = {
    schema: {
        type: 'object',
        required: [],
        'ui:order': ['*'],
        properties: {
            // pointType: {
            //     type: "string",
            //     title: "前/背景点",
            //     description: "Shift + Click 切换为背景点",
            //     enum: defaultToolSettings.objTypes,
            //     enumNames: defaultToolSettings.objTypeNames,
            //     "ui:widget": "RadioWidget",
            // },
            // autoClearPoints: {
            //     type: 'boolean',
            //     title: '自动清空',
            //     default: true,
            //     description: '模型返回结果后，自动清空关键点'
            // },
            // autoCallModel: {
            //     type: 'boolean',
            //     title: '自动调用模型',
            //     default: true,
            //     description: '修改提示词后，自动调用模型'
            // },
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
            // threshold: {
            //     type: 'number',
            //     title: '阈值',
            //     description: '仅输大于此阈值的件',
            //     default: 0.8
            // },
            // defaultRadius: {
            //     type: 'number',
            //     title: '点半径',
            //     description: '点大小',
            //     default: defaultToolSettings.defaultRadius
            // }
            // options: {
            //     type: "object",
            //     properties: {
            //         stroke: {
            //             title: '边颜色',
            //             type: 'string',
            //             'ui:widget': ColorPickerWidget,
            //             default: defaultToolSettings.options.stroke,
            //         },
            //         strokeWidth: {
            //             type: 'number',
            //             title: '边宽度',
            //             description: "边的宽度",
            //             default: defaultToolSettings.options.strokeWidth,
            //         },
            //         fill: {
            //             title: '填充色',
            //             type: 'string',
            //             'ui:widget': ColorPickerWidget,
            //             default: defaultToolSettings.options.fill,
            //         },
            //     }
            // },
        }
    }
}
export const toolOptions = reactive({
    zIndex: 80,
    doAction: 0,
    formData: {
        ...defaultToolSettings
    },
    selectedApi: undefined,
})

const TOOL_ID = 'videoPromptSegment'
export const pointsPromoteSegmentToolConf = {
    id: TOOL_ID,
    icon: 'fluent:video-clip-wand-24-regular',
    name: '视频标注',
    shortcut: 'V',
    description: '设置前景点、背景点或辅助框，辅助标注',
    handler: () => { },
    shortcutCallback: () => {
        shortcutCallback(TOOL_ID)
    }
}

export class VideoPromptSegment extends Annotater {
    static name = TOOL_ID

    protected pointerStart: Vector2 | undefined = undefined
    protected curRect: fabric.Rect

    private drawing = false
    private objects: Map<string, UserFabricObject> = new Map() // uuid -> Circle
    private seqGener: SequenceGenerator = new SequenceGenerator(
        toolOptions.zIndex * 10000,
        (toolOptions.zIndex + 1) * 10000
    )
    /** 当前操作的帧 */
    private frameNo = -1
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
            'background',
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
        // this.hotkeysManagerAutoOff.registerHotkeys({
        //     toolId: TOOL_ID,
        //     keys: 'enter| ',
        //     cb: this.onEnter.bind(this)
        // })
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
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: 'e',
            cb: this.onChangePromoteType.bind(this)
        })
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
                toolOptions.formData.promoteType = 'background'
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

        // 一直watch
        watch(() => globalStates.anno.annoDataLoaded, (newVal, oldVal) => {
            this.afterAnnoDataLoaded()
        }, { deep: true })
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
        toolStates.calling = true

        const data = {
            req: {},
            params: {frame_names:[], start_frame_index:-1},
            prompts: [],
        }

        const rows = this.updatePromptsTableDatas()

        const frameNos = []
        rows.forEach((row) => {
            const point_coords: any[] = []
            const point_labels: Number[] = []

            row.object.forEach((point) => {
                point_coords.push({ x: point.val[0], y: point.val[1] })
                point_labels.push(1)
            })
            row.background.forEach((point) => {
                point_coords.push({ x: point.val[0], y: point.val[1] })
                point_labels.push(0)
            })
            const prompt = {
                image: row.image,
                box: row.box,
                point_coords: point_coords,
                point_labels: point_labels
            }
            data.prompts.push(prompt)

            frameNos.push(row.image.index)
        })

        let start = 0
        let end = Object.keys(dataSeqState.streamMeta.openlabel.frames).length - 1
        if (frameNos.length === 1) {
            start = frameNos[0]
        } else if (frameNos.length > 1) {
            start = Math.min(...frameNos)
            end = Math.max(...frameNos)
        } else {
            ElMessage.error('必须有提示框或者前景点')
            toolStates.calling = false
            return
        }
        if (end - start >= 0) {
            const allFrameNames = this.getFrameNames()
            data.params = {
                frame_names: allFrameNames.slice(start, end + 1),
                start_frame_index: start,
                tool: globalStates.mainTool,
                sub_tool: globalStates.subTool,
            }
        } else {
            ElMessage.error('请刷新页面重试')
            toolStates.calling = false
            return
        }

        // call api
        dnnModelApi
            .funcapi('segmentation.video.2d', 'sam.SAM2.large', data)
            .then((res) => {
                toolStates.labelsByModel = res.data
                this.updateAnnos()
            })
            .catch((err) => {
                ElMessage.error('请求模型时异常：' + err)
            })
            .finally(()=> {
                toolStates.calling = false
            })
    }

    public onWatch() {
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

    findBoxByFrameNo(frameNo: number) {
        for (const obj of this.objects.values()) {
            if (obj.userData.frameNo === frameNo) {
                if (obj.userData.anno.ol_type_ === OlTypeEnum.BBox) {
                    return obj
                }
            }
        }
        return undefined
    }

    afterAnnoDataLoaded() {
        this.frameNo = jobConfig.frame
        // 隐藏其他帧的对象
        this.objects.forEach((obj, key) => {
            if (obj.userData.frameNo !== this.frameNo) {
                obj.visible = false
            } else {
                obj.visible = true
            }
        })
        // 更新anno
        this.updateAnnos()
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
        // 重写父类方法，什么都不做
    }

    doCleanData() {
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
        
        toolStates.promptsTableDatas = []
        toolStates.labelsByModel = undefined
    }

    doCancelDrawing() {
        this.drawing = false
        this.doCleanData()
        globalStates.subTool = ''
    }

    updateAnnos() {
        if (toolStates.labelsByModel === undefined) {
            return
        }
        if (!globalStates.mainAnnoater) return

        switch (toolStates.setting.outGeometryType) {
            case OlTypeEnum.BBox: {
                const bboxes = parseBBoxes(toolStates.labelsByModel, this.frameNo)
                if (!bboxes || bboxes.length === 0) {
                  return
                }
                bboxes.forEach((bbox) => {
                    globalStates.mainAnnoater?.onMessage(bbox)
                })
                break
            }
            case OlTypeEnum.RBBox: {
                const polys = parsePoly2d(toolStates.labelsByModel, this.frameNo)
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
                                geometryId: '',
                                label_uuid: uuidv4(),
                                ol_type_: OlTypeEnum.RBBox,

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
            case OlTypeEnum.Poly2d: {
                const polys = parsePoly2d(toolStates.labelsByModel, this.frameNo)
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
    }

    doFinishDrawing(openlabel: any) {
        this.drawing = false
        if (!globalStates.mainAnnoater) return
        globalStates.subTool = ''
        this.doCleanData()
    }

    /** 提示词发生变化了，调用此函数，更新到表格 */
    updatePromptsTableDatas() {
        const datas = new Map<number, { bbox?: any, object: any[], background: any[] }>()
        this.objects.forEach((obj) => {
            if (!datas.get(obj.userData.frameNo)) {
                datas.set(obj.userData.frameNo, {
                    bbox: undefined,
                    object: [],
                    background: []
                })
            }
            switch (obj.userData.anno?.object_type) {
                case 'bbox':
                    datas.get(obj.userData.frameNo)!.bbox = obj.userData.anno
                    break;
                case 'object':
                    datas.get(obj.userData.frameNo)!.object.push(this.convertFabricObjectToLabel(obj))
                    break;
                case 'background':
                    datas.get(obj.userData.frameNo)!.background.push(this.convertFabricObjectToLabel(obj))
                    break;
                default:
                    break;
            }
        })

        const rows:any[] = []
        datas.forEach((v, k) => {
            rows.push({
                image: {
                    index: k,
                    image: '',
                    type: 'jpg',
                    data_type: 'uri'},
                frameNo: k,
                box: v.bbox ? v.bbox : undefined,
                object: v.object,
                background: v.background
            })
        })
        // 更新UI 表格
        toolStates.promptsTableDatas = rows

        return rows
    }

    addGeometry(objs: Point2d[] | BBox[]) {
        if (objs.length === 0) {
            return
        }
        objs.forEach((obj, index) => {
            const objType = obj.object_type
            let newObj: UserFabricObject
            if (objType === 'object' || objType === 'background') {
                newObj = new fabric.Circle({
                    fill: 'rgba(255,0,0,0.5)',
                    opacity: 0.7,
                    stroke: 'green',
                    strokeWidth: 1,
                    strokeUniform: true,
                    noScaleCache: false,
                    userData: {
                        frameNo: this.frameNo,
                        zIndex: 0,
                        obj: obj
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
                        frameNo: this.frameNo,
                        zIndex: 0,
                        obj: obj
                    },
                    //   label: objType,
                    // fill 等属性
                    ...this.objStyles.get(objType).options
                }) as UserFabricObject

                setRectFromBoxObj(newObj, obj)

                // 删除已有 box
                const currentBox = this.findBoxByFrameNo(this.frameNo)
                if (currentBox) {
                    this.doRemove(currentBox)
                }
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

        this.updatePromptsTableDatas()
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
