/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月19日15:33:11
 * @date 甲辰 [龙] 年 三月十一 谷雨
 */
import { watch, reactive, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { BaseBoxBuilder } from './baseboxBuilder'

import { AnnoWorkEnum } from './common'
import { OlTypeEnum, type RBBox } from '@/openlabel'
import { angleToTheta } from './utils'
import { globalStates } from '@/states'

export const rbboxBuilderOptions = reactive({
    zIndex: 30,
    options: {
        stroke: 'red',
        strokeWidth: 1,
        fill: 'rgba(255,0,0,0.5)',
    },
    rect: {
        minWidth: 3,
        maxWidth: 9999,
        minHeight: 3,
        maxHeight: 9999,
    }
})

const TOOL_ID = 'rbboxBuilder'
export const rbboxBuilderTool = {
    id: TOOL_ID,
    icon: 'lucide:pen-line',
    name: '旋转框',
    shortcut: 'N',
    description: '<el-text>单击鼠标左键开始</el-text>',
    handler: () => { },
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

class RBBoxBuilder extends BaseBoxBuilder {
    static name = TOOL_ID

    private editing = false

    constructor(baseCanva: RenderHelper) {
        super(baseCanva, rbboxBuilderOptions.options, rbboxBuilderOptions.zIndex)
        this.curRect.set({
            selectable: true
        })

        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: rbboxBuilderTool.shortcut, cb: rbboxBuilderTool.shortcutCallback })
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            if (this.editing) {
                return
            }
            // 鼠标左键
            if (!this.drawing) {
                this.pointerStart = this.canvasObj.getPointer(options.e, false)
                this.drawing = true
                globalStates.working = AnnoWorkEnum.SUBTOOL_DRAWING
            } else {
                this.drawing = false
                this.canvasObj.setActiveObject(this.curRect)
                this.editing = true
            }
        }
    }

    public doOnWatch() {
        this.watchers.push(
            watch(() => rbboxBuilderOptions.options, (newValue, oldValue) => {
                if (this.curRect) {
                    this.curRect.set(newValue)
                }
                this.canvasObj.renderAll()
            }, { deep: true })
        )
    }

    cleanState(): void {
        this.drawing = false
        this.editing = false
        globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
        this.canvasObj.discardActiveObject()
    }

    cleanData(): void {
        this.curRect.set({ left: 0, top: 0, width: 0, height: 0 })
    }

    onEsc() {
        if (this.drawing || this.editing) {
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
    }

    doFinishDrawing() {
        // check box
        if (this.curRect.width! < rbboxBuilderOptions.rect.minWidth
            || this.curRect.height! < rbboxBuilderOptions.rect.minHeight) {
            return
        }
        if (globalStates.mainAnnoater) {
            const center = this.curRect.getCenterPoint()
            const obj = {
                geometryId: '',
                label_uuid: uuidv4(),
                ol_type_: OlTypeEnum.RBBox,

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
            globalStates.mainAnnoater.onMessage(obj)
        }
    }
}


export { RBBoxBuilder }