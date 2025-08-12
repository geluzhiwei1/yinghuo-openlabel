/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024-05-30
 * @date 甲辰 [龙] 年 四月廿三
 */
import { computed, watch, reactive } from 'vue'
import { useActiveElement, useMagicKeys, whenever } from '@vueuse/core'
import { RenderHelper } from '../RenderHelper'
import { globalStates } from '@/states'
import { HotkeysManager } from '@/libs/hotkeys-manager'

const { current } = useMagicKeys()
const activeElement = useActiveElement()
const notUsingInput = computed(() =>
    activeElement.value?.tagName !== 'INPUT'
    && activeElement.value?.tagName !== 'TEXTAREA',)

export abstract class Annotater {
    protected name = ""
    public canvasObj
    public baseCanva: RenderHelper
    public activated = false

    protected initconf: any
    protected keyboard = current
    protected notUsingInputs = notUsingInput

    /**
     * 一直监听
     */
    protected hotkeysManager = new HotkeysManager(false)
    protected hotkeysManagerAutoOff = new HotkeysManager(true)

    protected statesCore = reactive({
        /**
         * watch state or not
         */
        watching: false,
        /**
         * 是否监听鼠标事件
         */
        listeningMouseEvents: false,
        /**
         * 是否显示对象
         */
        showObjets: false,

        /** 是否监听快捷键
         * 
         **/
        listenHotkeys: false,
    })

    /**
     * 状态，外部监听
     */
    public publicStates = reactive({
        /**
         * 对象更新了，可能需要重新渲染
         */
        objectsUpdated: 0,
        /**
         * 样式更新了，可能需要重新渲染
         */
        objStylesUpdated: 0,
        /**
         * 对象tag更新了，可能需要重新渲染
         */
        objectsTagsUpdated: 0,
    })

    /**
     * 设置配置信息
     *
     * @param conf 配置对象
     */
    protected setConf(conf: any) {
        this.initconf = conf || {}
    }

    // // 父工具，最多有一个
    // protected mainAnnoater: Annotater | undefined = undefined

    protected initSub(conf:any) {
        watch(() => globalStates.subTool, (newValue, oldValue) => {
            switch (newValue) {
                case conf.toolId: {
                    this.activate()
                    break
                }
                default: {
                    this.deactivate()
                    break
                }
            }
        })
    }

    protected initMain(conf:any) {
        watch(() => globalStates.mainTool, (newValue, oldValue) => {
            switch (newValue) {
                case conf.toolId: {
                    this.statesCore.watching = true
                    this.statesCore.showObjets = true
                    this.statesCore.listeningMouseEvents = true
                    this.statesCore.listenHotkeys = true
                    break
                }
                default: {
                    this.statesCore.watching = false
                    this.statesCore.showObjets = false
                    this.statesCore.listeningMouseEvents = false
                    this.statesCore.listenHotkeys = false
                    break
                }
            }
        }, { immediate: true })
    }

    constructor(baseCanva: RenderHelper) {
        this.baseCanva = baseCanva
        this.canvasObj = baseCanva.canvasObj
        watch(() => this.statesCore.listenHotkeys, (newVal, oldVal) => {
            if (newVal === oldVal) return
            if (newVal) {
                this.hotkeysManagerAutoOff.onWatchHotKeys()
            } else {
                this.hotkeysManagerAutoOff.offWatchHotKeys()
            }
        })

        watch(() => globalStates.doClearCanvas, (newVal, oldVal) => {
            this.cleanData()
        }, { deep: true })

        watch(() => this.statesCore.watching, (newVal, oldVal) => {
            if (newVal === oldVal) return
            if (newVal) {
                this.onWatch()
            } else {
                this.offWatch()
            }
        })

        watch(() => this.statesCore.listeningMouseEvents, (newValue, oldValue) => {
            if (newValue === oldValue) return
            if (newValue) {
                this.bindAutoOffEvents()
            } else {
                this.unBindAutoOffEvents()
            }
        }, { immediate: true })

        // watch(() => this.statesCore.showObjets, (newValue, oldValue) => {
        //     if (newValue === oldValue) return
        //     this.setVisible(newValue)
        //     this.canvasObj.renderAll()
        // }, { immediate: true })

        // 记录上次工具
        watch(() => globalStates.subTool, (newValue, oldValue) => {
            if (newValue !== "") {
                globalStates.lastSubTool = newValue
            }
        }, { immediate: true })
        this.hotkeysManager.registerHotkeys({
            keys:' ', // space
            cb: () => {
                if (globalStates.subTool === "") {
                    globalStates.subTool = globalStates.lastSubTool
                }
            },
            toolId: 'annotater'
        })
    }

    protected setVisible(newValue: boolean) { }
    protected bindAutoOffEvents() { }
    protected unBindAutoOffEvents() { }

    protected watchers: any[] = []
    protected onWatch() { }
    protected offWatch() {
        this.watchers.forEach((unwatch) => {
            unwatch()
        })
        this.watchers = []
    }
    // protected watchersHotkeys:any[] = []
    // protected onWatchHotKeys() { }
    // protected offWatchHotKeys() {
    //     this.watchersHotkeys.forEach((unwatch) => {
    //         unwatch()
    //     })
    //     this.watchersHotkeys = []
    // }
    protected checkKeyCombination(keys: string[]): boolean {
        if (this.keyboard.size !== keys.length) {
            return false
        }
        for (const key of keys) {
            if (!this.keyboard.has(key)) {
                return false
            }
        }
        return true
    }

    protected doActivate() { }
    private activate() {
        if (this.activated) {
            return
        }
        // 被激活
        this.statesCore.watching = true
        this.statesCore.showObjets = true
        this.statesCore.listeningMouseEvents = true
        this.statesCore.listenHotkeys = true
        // globalStates.working = AnnoWorkEnum.SUBTOOL_WAITING
        this.doActivate()
        this.activated = true
    }

    protected doDeactivate() { }
    private deactivate() {
        if (!this.activated) {
            return
        }
        // 被取消
        this.statesCore.watching = false
        this.statesCore.showObjets = false
        this.statesCore.listeningMouseEvents = false
        this.statesCore.listenHotkeys = false
        this.doDeactivate()
        this.activated = false
    }

    public render() {
        this.baseCanva.render()
    }

    public resize() {
    }

    public export(format: string = 'default') {
    }

    protected cleanData() {
    }

    protected calcScaleFromImage(obj: fabric.Image) {
        const { width, height } = obj.getOriginalSize()
        const { tl, br } = obj.aCoords

        const scaleX = (br.x - tl.x) / width
        const scaleY = (br.y - tl.y) / height

        const pos = obj.getPointByOrigin('left', 'top')

        return { scaleX, scaleY, top: pos.y, left: pos.x , width, height}
    }
}