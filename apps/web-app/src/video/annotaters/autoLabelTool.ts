/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月22日10:54:14
 * @date 甲辰 [龙] 年 三月十四
 */
import { computed, watch, reactive } from 'vue'
import { AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { Annotater } from './annotater'
import { dnnModelApi } from '@/api'
import { shortcutCallback } from './utils'
import { OlTypeEnum, type RBBox } from '@/openlabel'
import { parseBBoxes, parseMask2dBase64, parsePoly2d } from '@/openlabel/utils'
import { fabric } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { ElLoading } from 'element-plus'
import type { RenderHelper } from '../RenderHelper'

export const funcsApiState = reactive({
    apiList: null,
    selectedApi: {
        "api_group": "未选择",
        "api_id": "",
        "serv_info": {
            "endpoint": "",
            "api_path": "",
            "reference": "",
            "model_info": {
                "name": "",
                "dataset": [""],
                "classes": ""
            },
            "api_tags": [
            ]
        }
    }
})
export const toolStates = reactive({
    setting: {
        outGeometryType: OlTypeEnum.BBox
    }
})
export const autoLabelToolOptions = reactive({
    apiParams: {
        formData: {},
    },
    doAction: 0,
    options: {
    },
    apiParamsUI: {
        schema: {
            type: 'object',
            required: [],
            'ui:order': ['*'],
            properties: {
                threshold: {
                    type: 'number',
                    title: '阈值',
                    description: "仅输大于此阈值的件",
                    default: 0.8
                },
                prefer_classes: {
                    type: 'array',
                    title: '类别过滤',
                    description: "仅输出指定的类别",
                    items: {
                        "title": "输入类别名称",
                        "type": "string",
                    },
                    "ui:widget": "SelectWidget",
                    'ui:options': {
                        multiple: true,
                        filterable: true,
                        "allow-create": true,
                        "default-first-option": true,
                    }
                }
            }
        }
    }
})

const TOOL_ID = 'autoLabelTool'
export const autoLabelToolConf = {
    id: TOOL_ID,
    icon: 'material-symbols:robot-2-rounded',
    name: '自动标注',
    shortcut: 'M',
    description: '当前应用模型：' + funcsApiState.selectedApi.api_id,
    shortcutCallback: () => { shortcutCallback(TOOL_ID) }
}
class AutoLabelTool extends Annotater {
    static name = TOOL_ID

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)

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
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: autoLabelToolConf.shortcut, cb: autoLabelToolConf.shortcutCallback })
    }

    protected onEnter() {
        autoLabelToolOptions.doAction += 1
    }

    protected onEsc() {
        globalStates.subTool = ''
    }

    callModel() {
        switch (funcsApiState.selectedApi.apiCategory) {
            case 'onnx-web': {
                if (!funcsApiState.selectedApi.infer) return

                const loading = ElLoading.service({
                    lock: true,
                    text: '模型推理...',
                    background: 'rgba(0, 0, 0, 0.7)',
                })
                funcsApiState.selectedApi.infer.inference({ imageEle: globalStates.toolsets!.get('imageCanvas').getImageEle() }).then(
                    (openlabel) => {
                        // olObjs.forEach((obj: any) => {
                        //     globalStates.mainAnnoater?.onMessage(obj)
                        // })
                        this.doFinishDrawing(openlabel)
                    }
                // ).catch(
                //     (err) => { console.log(err) }
                ).finally(() => {
                        loading.close()
                })
                break;
            }
            default: {
                const loading = ElLoading.service({
                    lock: true,
                    text: '模型推理...',
                    background: 'rgba(0, 0, 0, 0.7)',
                })

                const imgBlob = globalStates.toolsets!.get('imageCanvas')!.getImageBlob()
                const data = {
                    req: {},
                    image: {
                        image: globalStates.current_data.image_uri,
                        type: 'jpg',
                        data_type: 'uri',
                    },
                    params: {
                        ...autoLabelToolOptions.apiParams.formData,
                        tool: globalStates.mainTool,
                        sub_tool: globalStates.subTool,
                    }
                }
                dnnModelApi.funcapi2(
                    funcsApiState.selectedApi.api_group,
                    funcsApiState.selectedApi.api_id,
                    data, imgBlob).then(
                    (res) => {
                        const openlabel = res.data
                        this.doFinishDrawing(openlabel)
                    }).finally(() => {
                        loading.close()
                    })
                break
            }
        }
    }

    
    doFinishDrawing(openlabel: any) {
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
                                label_uuid: uuidv4(),

                                object_id: undefined,
                                object_type: 'default',
                                object_uuid: uuidv4(),
                                object_attributes: {},

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
            case OlTypeEnum.Mask2dBase64:
            case OlTypeEnum.Poly2d: {
                const polys = parsePoly2d(openlabel, undefined)
                if (polys) {
                    polys.forEach((poly) => {
                        if (poly.val) {
                            globalStates.mainAnnoater!.onMessage(poly)
                        }
                    })
                }
                const masks = parseMask2dBase64(openlabel, undefined)
                if (masks) {
                    masks.forEach((mask) => {
                        globalStates.mainAnnoater!.onMessage(mask)
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

    public onWatch() {
        this.watchers.push(
            watch(() => autoLabelToolOptions.doAction, (newValue, oldValue) => {
                if (newValue === oldValue) return
                this.callModel()
            }
            ))
    }
}

export { AutoLabelTool }