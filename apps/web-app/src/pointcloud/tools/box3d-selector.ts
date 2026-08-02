import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { glBoxAnnotationManager, FrameAnnotation } from '@/pointcloud/render/annotation/box3d-annotation'


import { hotkeysManager } from '../hotkeysManager'
import { reactive } from 'vue'
import { jobConfig } from '@/states/job-config'

const TOOLID = 'Box3dSelector'
const Box3dSelectorStates = reactive({
    activated: false,
})
class Box3dSelector {
    static Name = TOOLID
    private static instance: Box3dSelector;
    public static getInstance(): Box3dSelector {
        if (!this.instance) {
            this.instance = new Box3dSelector('m-view-manipulator', 'glMainViewCanvas');
        }
        return this.instance
    }

    private domContainer
    private raycaster
    private pointer = new THREE.Vector2()

    private threshold = 0.1
    private enabled = true
    constructor(domContainerId: string, canvaId: string) {
        this.domContainer = document.getElementById(domContainerId)
        this.raycaster = new THREE.Raycaster()
        // this.raycaster.params.Points.threshold = this.threshold

        this.mouseup = this.mouseup.bind(this)
        this.mousemove = this.mousemove.bind(this)
    }

    public mouseup(e) {
        if (this.enabled && Box3dSelectorStates.activated && e.button === 0) {
            this.onClick(e)
        }
    }

    public mousemove(event) {
        if (this.enabled && Box3dSelectorStates.activated) {
            this.onMouseMove(event)
        }
    }

    private bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)

        hotkeysManager.onWatchHotKeys()
    }

    private unBindAutoOffEvents() {
        this.domContainer?.removeEventListener('mouseup', this.mouseup)
        this.domContainer?.removeEventListener('mousemove', this.mousemove)

        hotkeysManager.offWatchHotKeys()
    }

    public activate() {
        if (Box3dSelectorStates.activated) {
            return
        }
        this.bindAutoOffEvents()
        Box3dSelectorStates.activated = true
    }

    public deactivate() {
        if (!Box3dSelectorStates.activated) {
            return
        }
        this.unBindAutoOffEvents()
        Box3dSelectorStates.activated = false
    }
    private trySelectBox() {
        const frameAnno: FrameAnnotation = glBoxAnnotationManager.getCurrent()
        if (!frameAnno) {
            return
        }
        const boxes = frameAnno.getGlObj()
        const intersections = this.raycaster.intersectObjects(boxes, false)
        if (intersections.length > 0) {
            eventBus.emitAsync(eventBus.Box3d.SelectedChanged, { glBox: intersections[0].object })
        } else {
            eventBus.emitAsync(eventBus.Box3d.SelectedChanged, { glBox: null })

            const pcdMeshName = glGlobals.buildPcdMeshName(jobConfig)
            const pcdMesh = glGlobals.getCurrentSensorGroup()!.getObjectByName(pcdMeshName)
            const pointsIntersections = this.raycaster.intersectObjects([pcdMesh])
            if (pointsIntersections.length > 0) {
                eventBus.emit(eventBus.Common.PointClicked, { point: pointsIntersections[0].point })
            } else {
                eventBus.emit(eventBus.Common.PointClicked, { point: null })
            }
        }
    }

    public onClick(event) {
        this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
        this.trySelectBox()
        // this.trySelectLine()
    }

    public onMouseMove(event) {
        // this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
        // this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1
        const xy = [event.offsetX, event.offsetY]
        this.pointer.x = 2 * xy[0] / event.target.clientWidth - 1
        this.pointer.y = -2 * xy[1] / event.target.clientHeight + 1
    }
}

export { Box3dSelector }