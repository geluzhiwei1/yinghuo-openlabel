import * as fabric from 'fabric'
import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { jobConfig } from '@/states/job-config'


class PointTool{
    private toolName = 'pointTool'

    private domContainer
    private raycaster
    private pointer = new THREE.Vector2()
    
    private threshold = 0.1
    private activated = false
    constructor(domContainerId: string, canvaId: string) {
        this.domContainer = document.getElementById(domContainerId)
        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = this.threshold
 
        this.mouseup = this.mouseup.bind(this)
        this.mousemove = this.mousemove.bind(this)
    }

    private bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)
    }

    private unBindAutoOffEvents() {
        this.domContainer?.removeEventListener('mouseup', this.mouseup)
        this.domContainer?.removeEventListener('mousemove', this.mousemove)
    }

    // public getMousePosition(event) {
    //     return {
    //         x: event.clientX  / this.canvas.clientWidth * 2 - 1,
    //         y: - event.clientY  / this.canvas.clientHeight * 2 + 1
    //     }
    // }

    public activate() {
        if (this.activated) {
            return
        }
        this.bindAutoOffEvents()
        this.activated = true
        eventBus.emit(eventBus.ToolBar.Command, {toolName:this.toolName, command:'activate'})
    }

    public deactivate() {
        if (!this.activated) {
            return
        }
        this.unBindAutoOffEvents()
        this.activated = false
        eventBus.emit(eventBus.ToolBar.Command, {toolName:this.toolName, command:'deactivate'})
    }

    public mouseup(event) {
        // seletectd
        eventBus.emit(eventBus.PointAnnotation.Command, {command:'Selecting'})
    }

    public mousemove(event) {
        const {top, left, width, height} = this.domContainer.getBoundingClientRect();

        this.pointer.x = -1 + 2 * (event.clientX - left) / width
        this.pointer.y = 1 - 2 * (event.clientY - top) / height
        const rtn = this.intersect()
        if (rtn) {
            eventBus.emit(eventBus.PointAnnotation.Highlight,
                { command: 'mousemove', glObj: rtn })
            this.domContainer.style.cursor = 'crosshair'
        } else {
            this.domContainer.style.cursor = ''
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

export { PointTool }