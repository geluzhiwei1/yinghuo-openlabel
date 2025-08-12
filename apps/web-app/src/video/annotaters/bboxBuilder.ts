/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月11日16:55:36
 * @date 甲辰 [龙] 年 三月初三 上巳节
 */
import { computed, watch, reactive } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import { BaseBoxBuilder } from './baseboxBuilder'
import { AnnoWorkEnum } from './common'
import { globalStates } from '@/states'
import { OlTypeEnum, type BBox } from '@/openlabel'
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import type { RenderHelper } from '../RenderHelper'


const defaultSettingFormData = {
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.2)',
    },
    rect: {
        minWidth: 3,
        maxWidth: 9999,
        minHeight: 3,
        maxHeight: 9999,
    }
}

export const bboxBuilderOptions = reactive({
    zIndex: 30,
    settingFormData: {
        ...defaultSettingFormData,
    }
})

export const settingUI = {
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

const TOOL_ID = 'bboxBuilder'
export const toolBarConf = {
    id: TOOL_ID,
    icon: 'lucide:pen-line',
    name: '拉框',
    shortcut: 'B',
    description: '<el-text>单击鼠标左键开始，再次左键或者敲Enter/Space完成。</el-text>',
    shortcutCallback: () => {
        if (globalStates.subTool === TOOL_ID) {
            globalStates.subTool = ''
        } else {
            globalStates.subTool = TOOL_ID
        }
    }
}

export class BBoxBuilder extends BaseBoxBuilder {
    static name = TOOL_ID

    constructor(baseCanva: RenderHelper) {
        super(baseCanva, bboxBuilderOptions.settingFormData.options, bboxBuilderOptions.zIndex)

        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: toolBarConf.shortcut, cb: toolBarConf.shortcutCallback })
    }

    doOnWatch() {
        this.watchers.push(
            watch(() => bboxBuilderOptions.settingFormData.options, (newValue, oldValue) => {
                if (this.curRect) {
                    this.curRect.set(newValue)
                }
                this.canvasObj.renderAll()
            }, { deep: true })
        )
    }

    doFinishDrawing() {
        this.drawing = false
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING

        // check box
        if (this.curRect.width! < bboxBuilderOptions.settingFormData.rect.minWidth
            || this.curRect.height! < bboxBuilderOptions.settingFormData.rect.minHeight) {
            return
        }
        if (globalStates.mainAnnoater) {
            const obj = {
                geometryId: '',
                label_uuid: uuidv4(),
                ol_type_: OlTypeEnum.BBox,
                
                object_id: undefined,
                object_type: 'default',
                object_uuid: uuidv4(),
                objectAttributes: {},

                val: [this.curRect.left! + 0.5 * this.curRect.width!,
                this.curRect.top! + 0.5 * this.curRect.height!,
                this.curRect.width,
                this.curRect.height
                ],
                attributes: {}
            } as BBox
            globalStates.mainAnnoater.onMessage(obj)
        }
    }
}