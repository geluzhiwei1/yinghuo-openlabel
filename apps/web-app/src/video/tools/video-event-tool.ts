import _ from 'lodash'
import { useMagicKeys } from '@vueuse/core'
import { reactive, watch } from 'vue'
import { AnnoTool } from '@/core/anno-tool'
import VideoEventToolUi from './video-event-tool-ui.vue'
export { VideoEventToolUi }
import type { Event, Action, Context } from '@/openlabel'
import { globalStates } from '@/states'
import { v4 as uuidv4 } from 'uuid'

const Name = 'videoEventTool'
const { escape } = useMagicKeys({
    passive: false,
    onEventFired(e) {
        if (e.key === 'escape' && e.type === 'keyup')
            e.preventDefault()
    }
})

export const toolStates = reactive({
    mode: undefined as string | undefined,
    activated: false,
    subTool: 'action' as string | undefined,
    toolConf: {
        id: Name,
        icon: 'fluent-mdl2:edit-create',
        name: '事件',
        shortcut: 'E',
        description: '<el-text>事件、行动、描述</el-text>',
    },
})


class VideoEventTool extends AnnoTool {
    static Name = Name

    private domContainer
    // 单例
    public static instance: VideoEventTool;
    public static getInstance(): VideoEventTool {
        if (!this.instance) {
            this.instance = new VideoEventTool('m-view-manipulator', 'glMainViewCanvas');
        }
        return this.instance
    }
    private constructor(domContainerId: string, canvaId: string) {
        super()
        this.domContainer = document.getElementById(domContainerId)
 
        // this.mouseup = this.mouseup.bind(this)
        // this.mousemove = this.mousemove.bind(this)
        // this.pointerdown = this.pointerdown.bind(this)
        this.onEscUp = this.onEscUp.bind(this)

        // this.ontransformControlDraggingChanged = this.ontransformControlDraggingChanged.bind(this)
    }

    reset(): void {
        
    }

    private onEscUp() {
        this.deactivate()
    }

    private watchers:Array = []
    private bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)
        this.domContainer?.addEventListener('pointerdown', this.pointerdown)
        this.watchers.push(
            watch(escape, (v) => {
                this.onEscUp()
            })
        )
    }

    private unBindAutoOffEvents() {
        this.domContainer?.removeEventListener('mouseup', this.mouseup)
        this.domContainer?.removeEventListener('mousemove', this.mousemove)
        this.domContainer?.removeEventListener('pointerdown', this.pointerdown)
        this.watchers.forEach(unwatch => unwatch())
    }

    public onCommand(cmd:string) {
        switch (cmd) {
            case 'createNew':
                this.setMode('createNew')
                break
            case 'createNew-finish':
                if (this.seletedPointsManager.pointsCount() > 1) {
                    eventBus.emit(eventBus.PolylineAnnotation.Commmand, {
                        Name: this.Name,
                        command: 'addLine',
                        glObj: this.seletedPointsManager.glGroup
                    })
                    this.seletedPointsManager.destroy()
                    // eventBus.emit(eventBus.PolylineAnnotation.LinePointsUpdated,
                    //     { command: '', pointList: this.seletedPointsManager.getPoints() })
                    this.setMode(undefined)
                }
                
                break
            case 'createNew-cancel':
                this.seletedPointsManager.removeLastPoint()
                break
            case 'editing-finish':
                this.unBindListerners()
                this.setMode(undefined)
                break
            case 'editing-cancel':
                this.unBindListerners()
                this.setMode(undefined)
                break
            default:
                break
        }
    }

    public toggle() {
        if (toolStates.activated) {
            this.deactivate()
        } else {
            this.activate()
        }
    }

    public activate() {
        if (toolStates.activated) {
            return
        }
        // this.init()
        // this.bindListeners()
        this.bindAutoOffEvents()
        toolStates.activated = true
    }


    public deactivate() {
        if (!toolStates.activated) {
            return
        }
        // this.unBindListerners()
        this.unBindAutoOffEvents()
        toolStates.activated = false
    }

    public doBuildObject(frameInternal) {
        let newObj = {}
        switch(toolStates.subTool) {
            case 'action':
                newObj = {
                    ol_type_: 'Action',
                    label_uuid: uuidv4(),
                    frame_intervals: [
                        {
                            ...frameInternal
                        }
                    ],
                    attributes: {
                        opType: 'create'
                    }
                } as Action;
                break;
            case 'context':
                newObj = {
                    ol_type_: 'Context',
                    label_uuid: uuidv4(),
                    frame_intervals: [
                        {
                            ...frameInternal
                        }
                    ],
                    attributes: {
                        opType: 'create'
                    }
                } as Context;
                break
            case 'event':
                newObj = {
                    ol_type_: 'Event',
                    label_uuid: uuidv4(),
                    frame_intervals: [
                        {
                            ...frameInternal
                        }
                    ],
                    attributes: {
                        opType: 'create'
                    }
                } as Event;
                break;
            default:
                break;
        }

        globalStates.mainAnnoater.onMessage(newObj)
    }
}

export { VideoEventTool }