/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月12日14:22:50
 * @date 甲辰 [龙] 年 三月初四
 */
import { watch } from 'vue'
import { fabric } from 'fabric'
import _ from 'lodash'
import { Annotater } from './annotater'
import { globalStates } from '@/states'
import type { RenderHelper } from '../RenderHelper'


class PointAnnotater extends Annotater {
    static name = "pointAnnotater"

    public radius = 3.0

    private curPoint
    private zindex: number = 40

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)
        this.curPoint = new fabric.Circle({
            fill: 'rgba(255,0,0,0.5)',
            opacity: 0.7,
            strokeWidth: 1,
            strokeUniform: true,
            noScaleCache: false,
            stroke: 'red',
        })
        this.onMouseUp = this.onMouseUp.bind(this)

        watch(() => globalStates.working, (newValue, oldValue) => {
            switch (newValue) {
                default: {
                    this.statesCore.watching = false
                    this.statesCore.showObjets = false
                    this.statesCore.listeningMouseEvents = false
                    break
                }
            }
        })
    }

    public onMouseUp(options: any) {
        if (options.e.button === 0) {
            const p = this.canvasObj.getPointer(options.e, false)
            const circleOpt = {
                left: p.x - this.radius,
                top: p.y - this.radius,
                radius: this.radius,
            }
            this.curPoint.set(circleOpt)
            this.canvasObj.renderAll()
        }
    }

    public bindAutoOffEvents() {
        this.canvasObj.on('mouse:up', this.onMouseUp)
    }

    public unBindAutoOffEvents() {
        this.canvasObj.off('mouse:up', this.onMouseUp)
    }

    // public doActivate(): void {
    //     this.baseCanva.fabricObjects.set(this.zindex + 1, this.curPoint)
    //     this.bindAutoOffEvents()
    // }
    // public doDeactivate(): void {
    //     this.baseCanva.fabricObjects.delete(this.zindex + 1)
    //     this.unBindAutoOffEvents()
    // }
}

export { PointAnnotater }