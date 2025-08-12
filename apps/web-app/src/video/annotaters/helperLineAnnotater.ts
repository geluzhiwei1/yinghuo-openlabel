/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月12日14:26:02
 * @date 甲辰 [龙] 年 三月初四
 */
import { watch, reactive } from 'vue'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { Vector2, AnnoWorkEnum } from "./common"
import { commonAnnotaterSetting } from './common-annotater-settings'
import { globalStates } from '@/states'
import type { RenderHelper } from '../RenderHelper'


/**
 * 辅助线
 */
class HelperLineAnnotater extends Annotater {
    static name = "helperLineAnnotater"
    private pointer = new Vector2()
    private lineVertical
    private lineHorizontal

    private zindex: number = 20

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)
        // draw line
        this.lineVertical = new fabric.Line([0, 0, 0, this.canvasObj.getWidth()], {
            left: 0,
            top: 0,
            strokeWidth: 1,
            visible: false,
            strokeUniform: true,
            strokeDashArray: [2, 1],
            selectable: false,
            stroke: "red"
        })
        this.lineHorizontal = new fabric.Line([0, 0, this.canvasObj.getHeight(), 0], {
            left: 0,
            top: 0,
            strokeWidth: 1,
            visible: false,
            strokeUniform: true,
            strokeDashArray: [2, 1],
            selectable: false,
            stroke: "red"
        })
        this.baseCanva.fabricObjects.set(this.zindex + 1, this.lineVertical)
        this.baseCanva.fabricObjects.set(this.zindex + 2, this.lineHorizontal)
        this.onMouseMove = this.onMouseMove.bind(this)

        watch([() => commonAnnotaterSetting.value.settingFormData.settings.hideHelperLines,
        () => globalStates.subTool
        ], (newValue, oldValue) => {
            const [working, subtool] = newValue
            if (subtool === "") {
                // this.statesCore.showObjets = false
                this.setVisible(false)
                this.statesCore.listeningMouseEvents = false
            } else {
                // this.statesCore.showObjets = true
                if (commonAnnotaterSetting.value.settingFormData.settings.hideHelperLines) {
                    this.statesCore.listeningMouseEvents = false
                    this.setVisible(false)
                } else {
                    this.statesCore.listeningMouseEvents = true
                    this.setVisible(true)
                }
            }

            this.baseCanva.canvasObj.requestRenderAll()
        }, {immediate: true})
    }

    public setVisible(visible: boolean) {
        this.lineVertical?.set({ visible })
        this.lineHorizontal?.set({ visible })
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:move', this.onMouseMove)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:move', this.onMouseMove)
    }

    public onMouseMove(options: any) {
        this.pointer = this.canvasObj.getPointer(options.e)

        const { tl, br } = this.canvasObj.calcViewportBoundaries()

        const x = this.pointer.x
        const y = this.pointer.y
        this.lineVertical.set({
            x1: x,
            y1: tl.y,
            x2: x,
            y2: br.y
        })
        this.lineHorizontal.set({
            x1: tl.x,
            y1: y,
            x2: br.x,
            y2: y
        })
        this.canvasObj.renderAll()
    }

    // public doActivate(): void {
    //     this.bindAutoOffEvents()
    //     this.canvasObj.renderAll()
    // }
    // public doDeactivate(): void {
    //     this.unBindAutoOffEvents()
    //     // this.baseCanva.fabricObjects.delete(this.zindex + 1)
    //     // this.baseCanva.fabricObjects.delete(this.zindex + 2)
    //     this.canvasObj.renderAll()
    // }
}

export { HelperLineAnnotater }