/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月13日11:09:33
 * @date 甲辰 [龙] 年 三月初五
 */
import { watch, reactive, computed } from 'vue'
import { fabric } from 'fabric'
import colormap from 'colormap'
import { get, toFloat, isEmpty, range, select } from 'radash'
import { v4 as uuidv4 } from 'uuid'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from "./common"
import { globalStates } from '@/states'
import { type BBox, type RBBox, OlTypeEnum, BBoxTypeEnum } from '@/openlabel'
import { SequenceGenerator } from './sequenceGenerator'
import { setRectFromBoxObj, angleToTheta, thetaToangle } from './utils'
import { parseBBoxes } from '@/openlabel/utils'
import { set, clone } from 'radash'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { UndoRedoStack, UndoRedoOp } from '@/libs/undoRedoStack'
import { messages } from '@/states'
import { jobConfig } from '@/states/job-config'
import { commonChannel } from '@/video/channel'
import async from 'async'
import { taxonomyState } from '@/states/TaxonomyState'
import type { RenderHelper } from '../RenderHelper'


const defaultRectValue = {
    userData: {
        anno: {
            object_id: undefined,
            object_type: 'default',
            object_uuid: '',
            objectAttributes: {},

            geometryId: '',
            label_uuid: '',
            ol_type_: OlTypeEnum.BBox,

            val: [0, 0, 0, 0],
            valType: BBoxTypeEnum.CXCYWH,
            attributes: {},
        } as BBox,
    }
}


const defaultSettingFormData = {
    settings: {
        hideAllLabels: false,
        autoHideLabels: false,
    },
    defaultObjType: {
        stroke: 'white',
        strokeWidth: 1,
        fill: 'rgba(0,0,255,0.2)',
    },
    theOthersObjType: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.2)',
    },
    validObjType: {
        stroke: 'black',
        strokeWidth: 1,
        fillAlpha: 0.2,
    }
}

const defaultRRectValue = {
    userData: {
        anno: {
            object_id: undefined,
            object_type: 'default',
            object_uuid: '',
            object_attributes: {},
            label_uuid: '',
            ol_type_: OlTypeEnum.RBBox,

            val: [0, 0, 0, 0, 0],
            attributes: {},
        } as RBBox,
    }
}

fabric.LabeledRect = fabric.util.createClass(fabric.Rect, {
    type: 'labeledRect',
    tryCreateInfoElement() {
        const uuid = this.userData.anno.label_uuid
        const old = fabric.util.getById(`${uuid}`) 
        if (old) {
            // 已经存在
            this.infoDivElement = old
            return
        }
        const div = document.createElement('div')
        div.id = uuid
        div.textContent = this.userData.anno.object_type || ''
        fabric.util.getById('imageAnnoContainer')!.appendChild(div)

        this.infoDivElement = div
        this.infoDivElement.style.cssText = "position: absolute;font: 12px Verdana;"
        this.infoDivElement.style.backgroundColor = 'transparent'
        this.infoDivElement.style.left = '0px'
        this.infoDivElement.style.top = '0px'
    },

    updateInfoElement() {
        // const {x, y} = canvasToScreen(ctx, {x:this.left, y:this.top})
        // this.infoDivElement.style.left = this.left  + 'px'
        // this.infoDivElement.style.top = this.top + 'px'
        this.tryCreateInfoElement(this.canvas)
        this.infoDivElement.textContent = this.userData.anno.object_type || ''
        this.setCoords()
        this.infoDivElement.style.left = this.get('oCoords').tl.x + 'px'
        this.infoDivElement.style.top = this.get('oCoords').tl.y + 'px'
    },

    initialize: function (options) {
        options || (options = {})
        this.callSuper('initialize', options)
        this.set('type', 'labeledRect')
    },

    setVisible: function (visible:boolean) {
        // this.callSuper('set', {visible})
        this.set({ visible })
        if (!this.infoDivElement) return
        if (visible) {
            this.infoDivElement.style.display = 'block';
        } else {
            this.infoDivElement.style.display = 'none';
        }
    },

    dispose: function () {
        this.infoDivElement?.parentNode?.removeChild(this.infoDivElement)
        this.callSuper('dispose')
    },

    _render: function (ctx) {
        this.callSuper('_render', ctx)
        this.updateInfoElement(ctx)
    }
})

// 必须加https://github.com/fabricjs/fabric.js/discussions/8450
fabric.LabeledRect.fromObject = function (object, callback) {
    return fabric.Object._fromObject('LabeledRect', object, callback);
}

type UserFabricObject = typeof fabric.LabeledRect & {
    userData: {
        zIndex: number,
        obj: BBox | RBBox,
    }
}
const bboxAnnotaterStates = reactive({
    setting: {
        objTypes: ['default'] as string[], // 类别名
        defaultObjType: 'object' as string,
        outGeometryType: OlTypeEnum.BBox as OlTypeEnum,
    },
    selectedBox: undefined as BBox | RBBox | undefined,
    selectedFabricObj: defaultRectValue as UserFabricObject,
    defaultObjType: 'default' as string,
})

export const settingUISchema = {
    schema: {
        type: 'object',
        required: [],
        'ui:order': ['*'],
        definitions: {
            settings: {
                type: "object",
                properties: {
                    hideAllLabels: {
                        title: "隐藏所有标签",
                        description: "隐藏当前帧所有标签",
                        default: defaultSettingFormData.settings.hideAllLabels,
                        type: 'boolean'
                    },
                    autoHideLabels: {
                        title: "自动隐藏标签",
                        description: "当使用工具栏时，自动隐藏其他框的标签",
                        default: defaultSettingFormData.settings.autoHideLabels,
                        type: 'boolean'
                    },
                }
            },
            // default type
            defaultObjType: {
                type: "object",
                properties: {
                    stroke: {
                        title: '边颜色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        description: "默认类别边颜色",
                        default: defaultSettingFormData.defaultObjType.stroke,
                    },
                    strokeWidth: {
                        type: 'integer',
                        title: '边宽度',
                        description: "默认类别边宽度",
                        default: defaultSettingFormData.defaultObjType.strokeWidth,
                    },
                    fill: {
                        title: '填充色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        description: "默认类别填充色",
                        default: defaultSettingFormData.defaultObjType.fill,
                    },
                }
            },
            // 类别列表意外的其他类别
            theOthersObjType: {
                type: "object",
                properties: {
                    stroke: {
                        title: '边颜色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        description: "其他类别边颜色",
                        default: defaultSettingFormData.theOthersObjType.stroke,
                    },
                    strokeWidth: {
                        type: 'integer',
                        title: '边宽度',
                        description: "其他类别边宽度",
                        default: defaultSettingFormData.theOthersObjType.strokeWidth,
                    },
                    fill: {
                        title: '填充色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        description: "其他类别填充色",
                        default: defaultSettingFormData.theOthersObjType.fill,
                    },
                }
            },
            // 类别列表以内的类别全局设置
            validObjType: {
                type: "object",
                properties: {
                    stroke: {
                        title: '边颜色',
                        type: 'string',
                        'ui:widget': ColorPickerWidget,
                        description: "默认边的颜色",
                        default: defaultSettingFormData.validObjType.stroke,
                    },
                    strokeWidth: {
                        type: 'integer',
                        title: '边宽度',
                        description: "默认边的宽度",
                        default: defaultSettingFormData.validObjType.strokeWidth,
                        maximum: 100,
                        minimum: 1
                    },
                    fill: {
                        title: '透明度',
                        type: 'number',
                        description: "默认透明度",
                        default: defaultSettingFormData.validObjType.fillAlpha,
                        maximum: 1.0,
                        minimum: 0.0
                    },
                }
            },
        },
        properties: {
            settings: {
                "title": "标签",
                "$ref": "#/definitions/settings"
            },
            defaultObjType: {
                "title": "默认类别",
                "$ref": "#/definitions/defaultObjType"
            },
            validObjType: {
                "title": "类别",
                "$ref": "#/definitions/validObjType"
            },
            theOthersObjType: {
                "title": "其他类别",
                "$ref": "#/definitions/theOthersObjType"
            }
        }
    }
}

const TOOL_ID = 'bboxAnnotater'
export const toolBarConf = {
    id: TOOL_ID,
    icon: 'tdesign:user-setting',
    name: '设置',
    shortcut: 'Y',
    description: '<el-text>主标签窗口设置</el-text>',
    shortcutCallback: () => {
        if (globalStates.subTool === TOOL_ID) {
            globalStates.subTool = ''
        } else {
            globalStates.subTool = TOOL_ID
        }
    }
}

export const settingUIForm = reactive({
    formData1: {
        ...clone(defaultSettingFormData)
    }
})

export const hotBarOptions = reactive({
    enabled: true,
    visible: false,
    style: {
        top: 0 + 'px',
        left: 0 + 'px',
        position: 'absolute',
        // justifyContent: 'center',
        // alignItems: 'center',
        width: '100%'
    },
    pointsEditBtn: {
        enabled: true,
    },
    polygonEditBtn: {
        visible: true,
        enabled: true,
    },
    maskEditBtn: {
        visible: true,
        enabled: true,
    },
    copiedDatas: {} // 支持工具栏复制粘贴
})

class BBoxAnnotater extends Annotater {
    static name = TOOL_ID
    static instance: BBoxAnnotater

    private zIndex: number = 60
    private selectedIndex = 0
    private objects: Map<string, UserFabricObject> = new Map() // uuid -> BBox
    private seqGener: SequenceGenerator = new SequenceGenerator(this.zIndex * 10000, (this.zIndex + 1) * 10000)
    private objStyles: Map<string, any> = new Map([])

    public undoRedo = new UndoRedoStack<UndoRedoOp>(20)

    /**
     * getter函数，返回objects
     */
    public objectsMap(): Map<string, UserFabricObject> {
        return this.objects
    }

    /**
     * 根据条件过滤对象
     *
     * @param condition 过滤条件，一个空对象表示不进行过滤
     * @returns 返回一个包含字符串键和UserFabricObject值的Map对象
     */
    public filterObjectsMap(condition: {}): Map<string, UserFabricObject> {
        return this.objects
    }

    /**
     * 获取对象的类别和样式
     *
     * @returns 返回对象样式
     */
    public objectsStyles() {
        return this.objStyles
    }

    public updateCategoryStyle(category: string, conf: any) {
        this.objStyles.set(category, { ...conf })
        this.canvasObj.requestRenderAll()
    }

    /**
     * 返回对象所有的tag，包括sys和user
     * @returns 
     */
    public objectsTags() {
        // TODO
        return undefined
    }

    public setConf(conf: any) {
        bboxAnnotaterStates.setting = {
            ...bboxAnnotaterStates.setting,
            ...conf
        }
    }

    public setVisible(visible: boolean) {
        // this.curRect?.set({ visible })
        this.objects?.forEach((obj) => {
            obj.setVisible(visible)
        })
    }

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)

        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onSelectionCleared = this.onSelectionCleared.bind(this)
        this.onSelectionCreated = this.onSelectionCreated.bind(this)
        this.onSelectionUpdated = this.onSelectionUpdated.bind(this)
        this.onObjectModified = this.onObjectModified.bind(this)
        // this.infoDivElementCallback = this.infoDivElementCallback.bind(this)

        
    // hotkeys
    this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'delete|backspace',
        cb: this.removeSelected.bind(this)
      })
      this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'tab',
        cb: this.doSelecteNextObject.bind(this)
      })
      this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'control+z',
        cb: this.undoLastOp.bind(this)
      })
      this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'control+y',
        cb: this.redoLastOp.bind(this)
      })

        this.baseCanva.on("canvas:pan", () => {
            this.objects.forEach((obj) => {
                // this.infoDivElementCallback(obj)
                if (obj.ol_type_ === 'labeledRect') {
                    obj.updateInfoElement()
                }
            })
        })

        watch(() => globalStates.subTool, (newValue, oldValue) => {
            switch (newValue) {
                case TOOL_ID: {
                    // 选自己
                    this.setVisible(!settingUIForm.formData1.settings.hideAllLabels)
                    break
                }
                case '': {
                    // 都没选
                    this.setVisible(!settingUIForm.formData1.settings.hideAllLabels)
                    this.hotPolyBarWithin(bboxAnnotaterStates.selectedFabricObj)
                    break
                }
                default: {
                    // 选了其他工具
                    this.setVisible(!settingUIForm.formData1.settings.hideAllLabels
                        && !settingUIForm.formData1.settings.autoHideLabels)
                    break
                }
            }
            this.canvasObj.requestRenderAll()
        })

        watch(
            () => settingUIForm.formData1.settings.hideAllLabels,
            (newValue, oldValue) => {
                this.setVisible(!newValue)
                this.canvasObj.requestRenderAll()
            },
        )

        this.initMain({ toolId: TOOL_ID })

        // hotkeys
        this.hotkeysManager.registerHotkeys({ toolId: this.name, keys: 'delete|backspace', cb: this.removeSelected.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: this.name, keys: 'N', cb: this.doSelecteNextObject.bind(this) })

        BBoxAnnotater.instance = this
    }

    getSelectedObject() {
        if (bboxAnnotaterStates.selectedFabricObj && bboxAnnotaterStates.selectedFabricObj instanceof fabric.Object) {
            return bboxAnnotaterStates.selectedFabricObj
        }
        return undefined
    }

    getSelectedFabricObjectUUID() {
        return this.getSelectedObject()?.userData.anno.label_uuid || undefined
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
        // this.canvasObj.on('mouse:move', this.onMouseMove)
        this.canvasObj.on('selection:cleared', this.onSelectionCleared)
        this.canvasObj.on('selection:created', this.onSelectionCreated)
        this.canvasObj.on('selection:updated', this.onSelectionUpdated)
        this.canvasObj.on('object:modified', this.onObjectModified)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
        // this.canvasObj.off('mouse:move', this.onMouseMove)
        this.canvasObj.off('selection:cleared', this.onSelectionCleared)
        this.canvasObj.off('selection:created', this.onSelectionCreated)
        this.canvasObj.off('selection:updated', this.onSelectionUpdated)
        this.canvasObj.off('object:modified', this.onObjectModified)
    }


    private copiedObjects: Map<number, [any]> = new Map()
    public deletedObjs: Map<string, any> = new Map()
    /**
     * 拷贝到下一帧
     * @param cmd next
     * @returns
     */
    public copyTo(cmd: string) {
        const o = this.getSelectedObject()
        if (!o) return
        switch (cmd) {
            case 'copyToNext':
                {
                    const obj = this.convertFabricObjectToObj(o)
                    if (!obj) return
                    // clean obj
                    obj.label_uuid = uuidv4()
                    obj.op_log = []
                    obj.attributes.opType = 'create'
                    const nextFrame = jobConfig.frame + 1
                    if (this.copiedObjects.has(nextFrame)) {
                        this.copiedObjects.get(nextFrame)?.push(obj)
                    } else {
                        this.copiedObjects.set(nextFrame, [obj])
                    }
                    // ElMessage.success(`已拷贝到下一帧`)
                    commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
                }
                break
            case 'copyToLast':
                {
                    const obj = this.convertFabricObjectToObj(o)
                    if (!obj) return
                    // clean obj
                    obj.label_uuid = uuidv4()
                    obj.op_log = []
                    obj.attributes.opType = 'create'
                    const nextFrame = jobConfig.frame - 1
                    if (this.copiedObjects.has(nextFrame)) {
                        this.copiedObjects.get(nextFrame)?.push(obj)
                    } else {
                        this.copiedObjects.set(nextFrame, [obj])
                    }
                    // ElMessage.success(`已拷贝到上一帧`)
                    commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
                }
                break
            default:
                break
        }
    }

    private readCopyedObjects() {
        if (this.copiedObjects.has(jobConfig.frame)) {
            this.import('default', this.copiedObjects.get(jobConfig.frame))
            this.copiedObjects.delete(jobConfig.frame)
        }
    }


    private hotPolyBarWithin(target: any) {
        if (!target) {
            hotBarOptions.visible = false
            return
        }
        if (globalStates.subTool !== '') {
            hotBarOptions.visible = false
            return
        }
        if (target instanceof fabric.Object) {
            target.setCoords()
            hotBarOptions.style.left = target.oCoords.tl.x + 'px'
            hotBarOptions.style.top = target.oCoords.tl.y - 35 + 'px'
            hotBarOptions.visible = true
        }
        const ol_type_ = get(target, 'userData.anno.ol_type_', undefined)
        switch (ol_type_) {
            case OlTypeEnum.Mask2dBase64:
                hotBarOptions.pointsEditBtn.enabled = false
                hotBarOptions.maskEditBtn.visible = true
                hotBarOptions.polygonEditBtn.visible = false
                break
            case OlTypeEnum.Poly2d:
                hotBarOptions.pointsEditBtn.enabled = true
                hotBarOptions.maskEditBtn.visible = false
                hotBarOptions.polygonEditBtn.visible = true
                break
            default:
                hotBarOptions.maskEditBtn.visible = false
                hotBarOptions.polygonEditBtn.visible = false
                hotBarOptions.pointsEditBtn.enabled = false
                break
        }
    }

    setBoxStyle(obj: UserFabricObject) {
        if (!obj.userData.anno.ol_type_ || obj.type !== 'labeledRect') {
            return
        }
        if (this.objStyles.has(obj.userData.anno.object_type)) {
            // valid objType
            const style = this.objStyles.get(obj.userData.anno.object_type)
            obj.set({
                ...style.options
            })
        } else if ('default' === obj.userData.anno.object_type) {
            // defalut objType
            obj.set({
                ...settingUIForm.formData1.defaultObjType
            })
        } else {
            // theOthers ObjType
            obj.set({
                ...settingUIForm.formData1.theOthersObjType
            })
        }
    }

    updateBoxStyle(givenObjTypes: string[]) {
        const objTypes = new Set(givenObjTypes)
        if (objTypes.size == 0) {
            this.objects.forEach((obj) => {
                this.setBoxStyle(obj)
            })
        } else {
            this.objects.forEach((obj) => {
                if (objTypes.has(obj.userData.anno.object_type)) {
                    this.setBoxStyle(obj)
                }
            })
        }
    }

    public onWatch() {

        this.watchers.push(
            /** ui修改 */
            watch([
                () => bboxAnnotaterStates.selectedFabricObj.userData.anno.label_uuid,
                () => bboxAnnotaterStates.selectedFabricObj.userData.anno.val,
            ], (newValue, oldValue) => {
                if (newValue[0] === '') {
                    // 如果label_uuid为空，忽略
                    return
                }
                if (newValue[0] !== oldValue[0]) {
                    // 说明是切换label_uuid
                    return
                }
                const selectedFabricObj = bboxAnnotaterStates.selectedFabricObj
                if (selectedFabricObj) {
                    selectedFabricObj.userData.anno.attributes.opType = 'update'
                    setRectFromBoxObj(selectedFabricObj, bboxAnnotaterStates.selectedFabricObj.userData.anno)
                    selectedFabricObj.setCoords()
                    this.canvasObj.requestRenderAll()
                }
            }, { deep: true })
        )

        this.watchers.push(
            /** ui修改 */
            watch([
                () => bboxAnnotaterStates.selectedFabricObj.userData.anno.label_uuid,
                () => bboxAnnotaterStates.selectedFabricObj.userData.anno.object_id,
                () => bboxAnnotaterStates.selectedFabricObj.userData.anno.label_id,
            ], (newValue, oldValue) => {
                if (newValue[0] === '') {
                    // 如果label_uuid为空，忽略
                    return
                }
                if (newValue[0] !== oldValue[0]) {
                    // 说明是切换label_uuid
                    return
                }
                const selectedFabricObj = bboxAnnotaterStates.selectedFabricObj
                if (selectedFabricObj) {
                    selectedFabricObj.userData.anno.attributes.opType = 'update'
                }
            })
        )

        this.watchers.push(
            // 改变类别
            watch(() => bboxAnnotaterStates.selectedFabricObj.userData.anno.object_type, (newVal, oldVal) => {
                // this.afterEdit(bboxAnnotaterStates.selectedFabricObj, 'objType')
                
                bboxAnnotaterStates.defaultObjType = newVal
                // 更新当前对象的样式
                const selectedFabricObj = bboxAnnotaterStates.selectedFabricObj
                selectedFabricObj.userData.anno.attributes.opType = 'update'
                this.setBoxStyle(selectedFabricObj)
                bboxAnnotaterStates.selectedFabricObj.updateInfoElement?.()
                this.canvasObj.requestRenderAll()
            })
        )

        this.watchers.push(
            // 改变defaultObjType的样式
            watch(() => settingUIForm.formData1.defaultObjType, (newVal, oldVal) => {
                this.updateBoxStyle(['default'])
                this.canvasObj.requestRenderAll()
            }, { deep: true }),

            // 改变theOthersObjType的样式
            watch(() => settingUIForm.formData1.theOthersObjType, (newVal, oldVal) => {
                this.updateBoxStyle([])
                this.canvasObj.requestRenderAll()
            }, { deep: true }),

            // 改变theOthersObjType的样式
            watch(() => settingUIForm.formData1.validObjType, (newVal, oldVal) => {
                this.updateBoxStyle([])
                this.canvasObj.requestRenderAll()
            }, { deep: true })
        )

        this.watchers.push(
            // 类别发生变化
            watch(() => taxonomyState.ontologyClassNames, (newVal, oldVal) => {
                bboxAnnotaterStates.setting.objTypes = newVal
            }),
            watch(() => bboxAnnotaterStates.setting.objTypes, (newVal, oldVal) => {
                if (newVal && bboxAnnotaterStates.setting.objTypes.length > 1) {
                    // 设置颜色空间
                    const fillColors = colormap({
                        colormap: 'rainbow',
                        nshades: bboxAnnotaterStates.setting.objTypes.length < 9 ? 9 : bboxAnnotaterStates.setting.objTypes.length,
                        format: 'rgbaString',
                        alpha: 0.5
                    })
                    bboxAnnotaterStates.setting.objTypes.forEach((objType, index) => {
                        this.objStyles.set(objType, {
                            options: {
                                fill: fillColors[index],
                                visible: true
                            }
                        })
                    })

                    this.publicStates.objStylesUpdated += 1
                }
            }, {deep: true})
        )
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
        // }
    }

    private restoreBoxSizeByImage(box: BBox | RBBox) {
        if (box.val[2] < 1 && box.val[3] < 1) {
            // yolo format: have been scaled to 0,1
            const { width, height } = globalStates.imageObject!.getOriginalSize()
            box.val[0] *= width,
                box.val[1] *= height,
                box.val[2] *= width,
                box.val[3] *= height
        }
    }

    /**
     * 添加box
     * @param boxes 新增加的box
     */
    private addBoxes(boxes: BBox[] | RBBox[]) {
        if (boxes.length === 0) {
            return
        }

        let last = undefined

        const newFObj = []
        boxes.forEach((box, index) => {
            if (!box) return
            this.restoreBoxSizeByImage(box)

            let object_type = box.object_type
            if (isEmpty(object_type)) {
                // 默认值
                object_type = bboxAnnotaterStates.defaultObjType
            }

            let styleOptions = clone(settingUIForm.formData1.defaultObjType)  // this.objStyles.get('default').options
            if (this.objStyles.has(object_type)) {
                styleOptions = clone(this.objStyles.get(object_type).options)
            }
            // 新建rect对象
            const newRect = new fabric.LabeledRect({
                // fill: 'rgba(255,0,0,0.5)',
                opacity: 1.0,
                // stroke: 'black',
                // strokeWidth: 1,
                objectCaching: false,
                strokeUniform: true,
                userData: {
                    zIndex: 0,
                    anno: {
                        ...box,
                        object_type
                    }
                },
                // fill 等属性
                ...styleOptions
            }) as UserFabricObject

            if (bboxAnnotaterStates.setting.outGeometryType === OlTypeEnum.BBox) {
                newRect.setControlsVisibility({
                    mtr: false, // 禁止旋转
                })
            }

            setRectFromBoxObj(newRect, box)

            if (!box.label_uuid) {
                box.label_uuid = uuidv4()
            }

            const rect = this.objects.get(box.label_uuid)
            if (!rect) {
                // 新的 放到最后
                newRect.userData.zIndex = this.seqGener.useNext()
            } else {
                // 原有的
                newRect.userData.zIndex = rect.userData.zIndex
            }

            this.addFabricObj(newRect)
            last = newRect

            newFObj.push(newRect)
        })

        this.baseCanva.reRenderAll()
        // 选择最后一个
        // if (last) this.setSelectedObject(last)

        this.publicStates.objectsUpdated += 1

        return newFObj
    }

    private addFabricObj(newFabricObj: fabric.Object) {
        this.baseCanva.fabricObjects.set(newFabricObj.userData.zIndex, newFabricObj)
        this.objects.set(newFabricObj.userData.anno.label_uuid, newFabricObj)
    }

    public updateObject(uuid: string, props: {}) {
        const obj = this.objects.get(uuid)
        if (!obj) {
            return
        }
        obj.set({ ...props })
        this.canvasObj.requestRenderAll()
    }

    public onMessage(msg: any) {
        // 检查msg的类型，是否BBox
        if (typeof msg === "string") {
            ;
        } else if (msg instanceof Object) {

            const uuid = get(msg, 'label_uuid', undefined)
            let opType = 'create'
            let oldFabricObj = undefined
            if (uuid) {
                oldFabricObj = this.objects.get(uuid)
                if (oldFabricObj) {
                    opType = 'update'
                }
            } else {
                // 新的
                msg.label_uuid = uuidv4()
            }

            if (msg.ol_type_ === OlTypeEnum.BBox) {
                const box = msg as BBox
                const annotator = get(box, 'attributes.annotator', '')
                if (msg.reBuild || annotator.startsWith('auto:')) {
                    // rects from model
                    if (globalStates.imageObject) {
                        this.restoreBoxSizeByImage(box)
                        const t = this.calcScaleFromImage(globalStates.imageObject)
                        box.val = [
                            box.val[0] * t.scaleX + t.left,
                            box.val[1] * t.scaleY + t.top,
                            box.val[2] * t.scaleX,
                            box.val[3] * t.scaleY
                        ]
                    }
                }
                if (!box.object_type || box.object_type === '') {
                    box.object_type = bboxAnnotaterStates.defaultObjType // 设置类别
                }
                box.attributes.opType = opType
                const newFabricObjs = this.addBoxes([box])

                this.logOP(oldFabricObj, newFabricObjs[0], opType)

            } else if (msg.ol_type_ === OlTypeEnum.RBBox) {
                const box = msg as RBBox
                const annotator = get(box, 'attributes.annotator', '')
                if (msg.reBuild || annotator.startsWith('auto:')) {
                    // rects from model
                    if (globalStates.imageObject) {
                        const t = this.calcScaleFromImage(globalStates.imageObject)
                        box.val = [
                            box.val[0] * t.scaleX + t.left,
                            box.val[1] * t.scaleY + t.top,
                            box.val[2] * t.scaleX,
                            box.val[3] * t.scaleY,
                            box.val[4]
                        ]
                    }
                }
                box.attributes.opType = opType
                box.object_type = bboxAnnotaterStates.defaultObjType // 设置类别

                const newFabricObjs = this.addBoxes([box])
                this.logOP(oldFabricObj, newFabricObjs[0], opType)
            }
            // else if (msg.type === 'Openlabel') {
            //     const bboxes = parseBBoxes(msg)
            //     if (!bboxes || bboxes.length === 0) {
            //         return
            //     }
            //     bboxes.forEach((bbox) => {
            //         this.onMessage(bbox)
            //     })
            // }
        } else {
            // 抛出异常
            throw new Error('unknow message type')
        }
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            // 鼠标左键
            if (options.target) {
                if (!this.isFabricRect(options.target)) return
                this.setSelectedObject(options.target)
            } else {
                this.setSelectedObject(undefined)
            }
        }
    }

    private convertFabricObjectToObj(obj: UserFabricObject) {
        const userDataObj = get(obj, 'userData.anno', undefined)
        if (!userDataObj) {
            // 默认值
            set(obj, 'userData', {
                anno: {
                    geometryId: '',
                    label_uuid: '',
                    object_type: 'default',
                    ol_type_: bboxAnnotaterStates.setting.outGeometryType,
                }
            })
        }

        const bbox_data = get(obj, 'userData.anno')

        switch (bboxAnnotaterStates.setting.outGeometryType) {
            case OlTypeEnum.BBox: {
                const center = obj.getCenterPoint()
                const bbox = {
                    ...bbox_data,
                    val: [center.x, center.y,
                    obj.width * obj.scaleX, obj.height * obj.scaleY],
                } as BBox
                // if (!bbox.attributes.opType) {
                //     bbox.attributes.opType = 'update'
                // }
                return bbox
            }
            case OlTypeEnum.RBBox: {
                const alpha = angleToTheta(obj.angle!)
                const center = obj.getCenterPoint()
                const bbox = {
                    ...bbox_data,
                    val: [
                        center.x,
                        center.y,
                        obj.width * obj.scaleX, obj.height * obj.scaleY,
                        alpha
                    ],
                } as RBBox
                // if (!bbox.attributes.opType) {
                //     bbox.attributes.opType = 'update'
                // }
                return bbox
            }
            default:
                break
        }
    }

    private setDefaultType(type: string | undefined) {
        if (type && type !== 'default' && type !== '') {
            bboxAnnotaterStates.defaultObjType = type
        }
    }

    public selectObject(uuid: string) {
        this.setSelectedObject(this.objects.get(uuid))
    }

    private setSelectedObject(obj: UserFabricObject | undefined) {
        if (obj) {
            const bbox = this.convertFabricObjectToObj(obj)
            bboxAnnotaterStates.selectedBox = bbox
            bboxAnnotaterStates.selectedFabricObj = obj
            // bboxAnnotaterStates.selectedFabricObj.userData.anno.val = bbox.val
            this.setDefaultType(obj.userData.anno.object_type || 'default')

            this.selectedIndex = obj.userData.zIndex
            this.canvasObj.setActiveObject(bboxAnnotaterStates.selectedFabricObj)
            this.canvasObj.requestRenderAll()
        } else {
            this.selectedIndex = 0
            // 设置为默认值
            switch (bboxAnnotaterStates.setting.outGeometryType) {
                case OlTypeEnum.BBox: {
                    bboxAnnotaterStates.selectedFabricObj = defaultRectValue as UserFabricObject
                    bboxAnnotaterStates.selectedBox = defaultRectValue.userData.anno as BBox
                    break
                }
                case OlTypeEnum.RBBox: {
                    bboxAnnotaterStates.selectedFabricObj = defaultRRectValue as UserFabricObject
                    bboxAnnotaterStates.selectedBox = defaultRRectValue.userData.anno as RBBox
                    break
                }
            }
        }
    }

    isFabricRect(obj: fabric.Object) {
        return obj.type === 'labeledRect'
    }

    public onSelectionCleared(options: any) {
        this.hotPolyBarWithin(undefined)
    }
    public onSelectionCreated(options: any) {
        if (!this.isFabricRect(options.selected[0])) return
        // this.setSelectedObject(options.selected[0])
        // this.hotPolyBarWithin(options.selected[0])
    }
    public onSelectionUpdated(options: any) {
        if (!this.isFabricRect(options.selected[0])) return
        // this.setSelectedObject(options.selected[0])
        this.hotPolyBarWithin(options.selected[0])
    }
    public onObjectModified(options: any) {
        if (!this.isFabricRect(options.target)) return
        async.parallel(
            {
                o1: function (callback) {
                    options.target.clone((newObj: any) => {
                        // old object
                        newObj.set({ ...options.transform.original })
                        callback(null, newObj)
                    }, ['userData'])
                },
                o2: function (callback) {
                    options.target.clone((newObj: any) => {
                        // new object
                        callback(null, newObj)
                    }, ['userData'])
                }
            },
            (err, results) => {
                if (err) {
                    console.error(err)
                    return
                }
                // results.o1
                const OP = new UndoRedoOp()
                OP.o1 = results.o1
                OP.op = 'userEdit'
                OP.o2 = results.o2
                this.undoRedo.do(OP)
            }
        )
        options.target.userData.anno.attributes.opType = 'update'
        this.setSelectedObject(options.target)
        this.hotPolyBarWithin(options.target)
        this.canvasObj.requestRenderAll()
    }

    public onMouseMove(options: any) {
    }

    public import(format: string = 'default', frameLabels: any) {
        this.addBoxes(frameLabels)
    }

    public reBuildAllObj() {
        const arr = this.export()
        arr.forEach(item => {
            item.reBuild = true
            this.onMessage(item)
        })
    }

    public export(format: string = 'default') {
        const bboxes: Array<any> = new Array()
        this.objects?.forEach((obj) => {
            const bbox = this.convertFabricObjectToObj(obj)
            if (format === 'createOrUpdated') {
                if (bbox.attributes.opType) bboxes.push(bbox)
            } else {
                bboxes.push(bbox)
            }
        })

        return bboxes
    }

    public removeSelected() {
        if (bboxAnnotaterStates.selectedFabricObj) {
            this.doDeleteObj(bboxAnnotaterStates.selectedFabricObj)
        }
    }

    public removeObject(uuid: string) {
        const obj = this.objects?.get(uuid)
        this.doDeleteObj(obj)
    }

    private doDeleteObj(obj: UserFabricObject, op2:string='') {
        if (!obj) {
            return
        }
        this.objects?.delete(obj.userData.anno.label_uuid)
        this.deletedObjs.set(obj.userData.anno.label_uuid, obj) // 暂存
        this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
        this.seqGener.release(obj.userData.zIndex)
        obj?.dispose()

        this.baseCanva.reRenderAll()
        // this.doSelecteNextObject()
        // this.afterEdit(obj, 'remove')
        this.publicStates.objectsUpdated += 1

        const OP = new UndoRedoOp()
        OP.o1 = obj
        OP.op = 'remove'
        OP.op2 = op2
        this.undoRedo.do(OP)
    }

    public cleanData() {

        this.setSelectedObject(undefined)
        // 从canvas中删除所有bbox
        this.objects?.forEach((obj) => {
            this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
            obj?.dispose?.()
        })

        this.seqGener.reset()
        this.objects.clear()

        globalStates.afterClearCanvas += 1

        this.baseCanva.reRenderAll()

        this.readCopyedObjects()
        this.publicStates.objectsUpdated += 1

        this.undoRedo.reset()
    }

    private logOP(oldObj:fabric.Object, newObj:fabric.Object, opType: string) {
        const OP = new UndoRedoOp()
        if (oldObj && newObj) {
          // 是修改
          oldObj.clone(
            (obj: any) => {
              // if (obj instanceof fabric.Image) {
              //   obj.set({
              //     left: oldObj.left,
              //     top: oldObj.top,
              //     scaleX: oldObj.scaleX,
              //     scaleY: oldObj.scaleY,
              //     originX: oldObj.originX,
              //     originY: oldObj.originY,
              //   })
              // }
              OP.o1 = obj
              OP.op = opType
              OP.o2 = newObj
            },
            ['userData']
          )
        } else {
          // 是新增
          OP.o1 = null
          OP.op = opType
          OP.o2 = newObj
        }
        this.undoRedo.do(OP)
      }

    undoLastOp() {
        const oper = this.undoRedo.undo()
        if (!oper) return
        const { o1, op, o2 } = oper
        switch (op) {
            case 'create':
                this.doDeleteObj(o2, 'undo')
                this.baseCanva.reRenderAll()
                this.setSelectedObject(undefined)
                messages.lastInfo = '恢复创建操作'
                break
            case 'remove':
                {
                    const uuid = get(o1, 'userData.anno.label_uuid', undefined)
                    if (uuid) {
                        this.addFabricObj(o1)
                        this.baseCanva.reRenderAll()
                        this.setSelectedObject(o1)
                        messages.lastInfo = '恢复删除操作'
                    }
                }
                break
            default:
                {
                    const uuid = get(o1, 'userData.anno.label_uuid', undefined)
                    if (uuid) {
                        this.addFabricObj(o1)
                        this.baseCanva.reRenderAll()
                        this.setSelectedObject(o1)
                        messages.lastInfo = '恢复编辑操作'
                    }
                }
                break
        }
    }

    redoLastOp() {
        const oper = this.undoRedo.redo()
        if (!oper) return
        const { o1, op, o2 } = oper
        switch (op) {
            case 'remove':
                this.doDeleteObj(o1, 'undo')
                messages.lastInfo = '重做删除'
                break
            case 'create':
                {
                    const uuid = get(o2, 'userData.anno.label_uuid', undefined)
                    if (uuid) {
                        this.addFabricObj(o2)
                        this.baseCanva.reRenderAll()
                        this.setSelectedObject(o2)
                        messages.lastInfo = '重做创建'
                    }
                }
                break
            default:
                {
                    const uuid = get(o2, 'userData.anno.label_uuid', undefined)
                    if (uuid) {
                        this.addFabricObj(o2)
                        this.baseCanva.reRenderAll()
                        this.setSelectedObject(o2)
                        messages.lastInfo = '重做修改'
                    }
                }
                break
        }
    }
}

export { BBoxAnnotater, bboxAnnotaterStates }