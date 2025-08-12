/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月21日01:08:57
 * @date 甲辰 [龙] 年 三月十三
 */
import { computed, watch, reactive } from 'vue'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from './common'
import { dnnModelApi } from '@/api'
import { globalStates } from '@/states'
import { parseBBoxes } from '@/openlabel/utils'
import { OlTypeEnum, type RBBox } from '@/openlabel'
import { ElLoading } from 'element-plus'

export const textPromptBBoxOptions = reactive({
    text_prompt: 'Car.',
    doAction: 0,
    options: {
        outGeometryType: '',
        calling: false
    }
})

const TOOL_ID = 'textPromptBBoxTool'
export const textPromoteBBoxToolConf = {
    id: TOOL_ID,
    icon: 'fluent:text-whole-word-20-filled',
    name: '提示词标注',
    shortcut: 'T',
    description: '选中一个框后，按键盘T，自动框选同类别',
    showButton: true,
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
class TextPromptBBoxTool extends Annotater {
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
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: textPromoteBBoxToolConf.shortcut, cb: textPromoteBBoxToolConf.shortcutCallback })
    }

    callModel() {
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
          text_prompt:textPromptBBoxOptions.text_prompt,
          params: {
            tool: globalStates.mainTool,
            sub_tool: globalStates.subTool,
          }
        }
        textPromptBBoxOptions.options.calling = true
        dnnModelApi.funcapi2(
          'detection.monocular.2d', 'groundingdino.GroundingDINO_SwinT_OGC', data, imgBlob).then((res) => {
            const openlabel = res.data
            const bboxes = parseBBoxes(openlabel, undefined)
            if (!bboxes || bboxes.length === 0) {
              return
            }
            switch(textPromptBBoxOptions.options.outGeometryType) {
                case OlTypeEnum.RBBox:
                    bboxes.forEach((bbox) => {
                        const t = {
                            ...bbox,
                            ol_type_: OlTypeEnum.RBBox,
                            val: [...bbox.val, .0],
                        } as RBBox
                        globalStates.mainAnnoater?.onMessage(t)
                    })
                    break;
                case OlTypeEnum.BBox:
                default:
                    bboxes.forEach((bbox) => {
                        globalStates.mainAnnoater?.onMessage(bbox)
                    })
                    break
            }
            // globalStates.mainAnnoater?.onMessage(openlabel)
        }).finally(() => {
            textPromptBBoxOptions.options.calling = false
            loading.close()
        })
    }

    public onWatch() {
        this.watchers.push(
            watch(() => textPromptBBoxOptions.doAction, (newValue, oldValue) => {
                if (newValue === oldValue) return
                this.callModel()
            }
        ))
    }

    protected onEnter() {
        textPromptBBoxOptions.doAction += 1
    }

    protected onEsc() {
        globalStates.subTool = ''
    }
}

export { TextPromptBBoxTool }