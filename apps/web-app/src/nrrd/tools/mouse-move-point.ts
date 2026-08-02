import * as THREE from 'three'
import { useDataState } from '../store'
import _ from 'lodash'
import { eventBus } from '../event-bus'
import { SeletedPointsManager } from './selected-points-manager'
import { glPointAnnotationManager } from '../render/GlPointAnnotation'
import { hotkeysManager } from '../hotkeysManager'

const { current_seq } = useDataState()


class _MouseMovePoint{
    protected domContainer
    protected raycaster
    protected pointer = new THREE.Vector2()
    protected enableSelectPoints = false

    public seletedPointsManager 

    protected threshold = 0.1
    protected activated = false
    constructor(domContainerId: string, options: any) {
        this.domContainer = document.getElementById(domContainerId)
        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = this.threshold
        this.seletedPointsManager = new SeletedPointsManager(
            glPointAnnotationManager.getCurrent()!.selectedGroup, {
                highlightColor: 'green',
        })
        this.enableSelectPoints = options.enableSelectPoints || false
 
        this.mouseup = this.mouseup.bind(this)
        this.mousemove = this.mousemove.bind(this)

        hotkeysManager.registerHotkeys({ toolId: this.toolName, 
            keys: 'z', 
            cb: () => { this.onKeyboardZ() }})
    }

    protected bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)

        hotkeysManager.onWatchHotKeys()
    }

    protected unBindAutoOffEvents() {
        this.domContainer?.removeEventListener('mouseup', this.mouseup)
        this.domContainer?.removeEventListener('mousemove', this.mousemove)

        hotkeysManager.offWatchHotKeys()
    }

    onKeyboardZ() {
        this.seletedPointsManager.removeLastPoint()
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
        if (event.button !== 0) {
            // 不是左键
            return
        }
        // eventBus.emit(eventBus.PointAnnotation.Commmand, {command:'Selecting'})
        // if (this.enableSelectPoints) {
        //     eventBus.emit(eventBus.PointAnnotation.Commmand, {command:'Selecting', 
        //         tool:this.toolName})
        // }
        if (!this.enableSelectPoints) {
            return
        }
        const glObj = glPointAnnotationManager.getCurrent()!.highlightGroup.children[0]
        if (glObj) {
            this.seletedPointsManager.addPoint({...glObj.position})
        }
    }

    public mousemove(event) {

        const {top, left, width, height} = this.domContainer.getBoundingClientRect();

        this.pointer.x = -1 + 2 * (event.clientX - left) / width
        this.pointer.y = 1 - 2 * (event.clientY - top) / height
        const rtn = this.intersect()
        if (rtn) {
            eventBus.emit(eventBus.PointAnnotation.Highlight,
                { command: 'mousemove', glObj: rtn })
            // eventBus.emit(eventBus.PolylineAnnotation.Highlight,
            //     { command: 'mousemove', glObj: rtn })
            this.domContainer.style.cursor = 'crosshair'
        } else {
            this.domContainer.style.cursor = ''
        }
    }

    private intersect() {
        this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
        const pcdMeshName = 'pcd-' + _.toString(current_seq.ts)
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
    public static getInstance(): MouseMoveHightlight {
        if (!this.instance) {
            this.instance = new MouseMoveHightlight('m-view-manipulator', {enableSelectPoints: true});
        }
        return this.instance
    }
}
