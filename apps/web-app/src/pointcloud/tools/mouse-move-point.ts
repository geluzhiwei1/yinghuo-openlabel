import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { SeletedPointsManager } from './selected-points-manager'
import { glPointAnnotationManager } from '../render/point3d-highlight'
import { jobConfig } from '@/states/job-config'
import { reactive } from 'vue'
import { HotkeysManager } from '@/libs/hotkeys-manager'

class _MouseMovePoint{
    protected domContainer
    protected raycaster
    protected pointer = new THREE.Vector2()
    protected canSelectByMouse = false

    public seletedPointsManager 

    protected threshold = 0.1
    protected activated = false

    public states = reactive({
        pointsChanged: 0,
    })

    hotkeysManager = new HotkeysManager(false)

    constructor(domContainerId: string, options: any) {
        this.domContainer = document.getElementById(domContainerId)
        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = this.threshold
        this.seletedPointsManager = new SeletedPointsManager(
            glPointAnnotationManager.getCurrent()!.selectedGroup, {
                highlightColor: 'green',
        })
        this.canSelectByMouse = options.canSelectByMouse || false
 
        this.mouseup = this.mouseup.bind(this)
        this.mousemove = this.mousemove.bind(this)

        this.hotkeysManager.registerHotkeys({ toolId: '_MouseMovePoint', 
            keys: 'z', 
            cb: () => { this.onKeyboardZ() }})
    }

    protected bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)

        this.hotkeysManager.onWatchHotKeys()
    }

    protected unBindAutoOffEvents() {
        this.domContainer?.removeEventListener('mouseup', this.mouseup)
        this.domContainer?.removeEventListener('mousemove', this.mousemove)

        this.hotkeysManager.offWatchHotKeys()
    }

    onKeyboardZ() {
        this.seletedPointsManager.removeLastPoint()
        if (this.states)
            this.states.pointsChanged++
    }

    public clearPoints() {
        this.seletedPointsManager.destroy()
        if (this.states)
            this.states.pointsChanged++
    }

    public toggle(activated: boolean) {
        if (activated) {
            this.activate()
        } else {
            this.deactivate()
        }
    }

    public activate() {
        if (this.activated) {
            return
        }
        this.bindAutoOffEvents()
        this.activated = true
    }

    public deactivate() {
        if (!this.activated) {
            return
        }
        this.unBindAutoOffEvents()
        this.activated = false
    }

    public mouseup(event) {
        if (event.button !== 0 || !event.ctrlKey) {
            // 不是左键
            return
        }
        // eventBus.emit(eventBus.PointAnnotation.Command, {command:'Selecting'})
        // if (this.canSelectByMouse) {
        //     eventBus.emit(eventBus.PointAnnotation.Command, {command:'Selecting', 
        //         tool:this.toolName})
        // }
        if (!this.canSelectByMouse) {
            return
        }
        const glObj = glPointAnnotationManager.getCurrent()!.highlightGroup.children[0]
        if (glObj) {
            this.seletedPointsManager.addPoint({...glObj.position})
            if (this.states) {
                this.states.pointsChanged++
            }
        }
    }

    public mousemove(event) {

        if (!this.activated) {
            return
        }
        if (!event.ctrlKey) {
            this.domContainer.style.cursor = ''
            return
        }

        this.domContainer.style.cursor = 'crosshair'

        const {top, left, width, height} = this.domContainer.getBoundingClientRect();

        this.pointer.x = -1 + 2 * (event.clientX - left) / width
        this.pointer.y = 1 - 2 * (event.clientY - top) / height
        const rtn = this.intersect()
        if (rtn) {
            eventBus.emit(eventBus.PointAnnotation.Highlight,
                { command: 'mousemove', glObj: rtn })
            // eventBus.emit(eventBus.PolylineAnnotation.Highlight,
            //     { command: 'mousemove', glObj: rtn })
        }
    }

    private intersect() {
        this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
        const pcdMeshName = glGlobals.buildPcdMeshName(jobConfig)
        const pcdMesh = glGlobals.getCurrentSensorGroup().getObjectByName(pcdMeshName)
        const pointsIntersections = this.raycaster.intersectObjects([pcdMesh], false)
        if (pointsIntersections.length > 0) {
            return pointsIntersections
        }
        return null
    }
}


export class MouseMovePoint extends _MouseMovePoint {
    static toolName = 'mouseMovePoint'
    public static instance: MouseMovePoint;

    constructor(domContainerId: string, options: any) {
        super(domContainerId, options)
    }
    
    public static getInstance(): MouseMovePoint {
        if (!this.instance) {
            this.instance = new MouseMovePoint('m-view-manipulator', {});
        }
        return this.instance
    }
}

export class MouseMoveHightlight extends _MouseMovePoint {
    static toolName = 'mouseMoveHighlight'
    public static instance: MouseMoveHightlight;

    private constructor(domContainerId: string, options: any) {
        super(domContainerId, options)
    }

    public static getInstance(): MouseMoveHightlight {
        if (!this.instance) {
            this.instance = new MouseMoveHightlight('m-view-manipulator', {canSelectByMouse: true});
        }
        return this.instance
    }
}
