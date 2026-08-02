import { fabric } from 'fabric'
import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { onKeyUp } from '@vueuse/core'
import { pySeqData } from '../api'
import { v4 as uuidv4 } from 'uuid'
import {reactive, watch } from 'vue'
import { uiState, topBar, attrPanel, mainPanel, appContainer, canvaPanel, dataPanel, threeView } from '@/states/UiState'
import { jobConfig } from '@/states/job-config'

class Box3dRectTool {
    static Name = 'box3dRectTool'
    public static states = reactive({
        activated: false,
    })
    static instance: Box3dRectTool

    private rect_x1y1 = new THREE.Vector2()
    private canvas
    private raycaster
    private pointer = new THREE.Vector2()
    private pointerStart = new THREE.Vector2()
    private threshold = 0.5
    private canvaId
    private boxing = false
    private clock
    private spheres = []
    private spheresIndex = 0
    private lineVertical
    private lineHorizontal
    private rectObject: fabric.Rect
    private domContainerId
    
    constructor(domContainerId: string, canvaId: string) {
        this.domContainerId = domContainerId
        this.canvas = new fabric.Canvas(canvaId)
        this.rectObject = new fabric.Rect({ fill: 'rgba(0,0,255,0.5)', opacity: 0.7, stroke: 'green' })
        this.canvas.add(this.rectObject)
        this.canvaId = canvaId
        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = this.threshold

        const sphereGeometry = new THREE.SphereGeometry( 0.1, 32, 32 );
        const sphereMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
        // const spheres = [];
        for ( let i = 0; i < 40; i ++ ) {

            const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
            glGlobals.scene.add( sphere );
            this.spheres.push( sphere );

        }
        this.clock = new THREE.Clock();

        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onDeactivate = this.onDeactivate.bind(this)

        // draw line
        this.lineVertical = new fabric.Line([0,0,0,canvaPanel.width_px - threeView.topView.width], {
            strokeWidth: 1,
            strokeDashArray:[2,1],
            selectable: false,
            stroke: "red"
          })
        this.lineHorizontal = new fabric.Line([0,0,canvaPanel.height_px,0], {
            strokeWidth: 1,
            strokeDashArray: [2,1],
            selectable: false,
            stroke: "red"
          })
        this.canvas.add(this.lineVertical)
        this.canvas.add(this.lineHorizontal)

        // onKeyUp(['Escape'], (e) => {
        //     this.onDeactivate()
        // })

        watch(() => uiState.id, () => {
            this.canvas.setDimensions({ width:canvaPanel.width_px - threeView.topView.width, 
                height:canvaPanel.height_px })
            // this.lineVertical.set({
            //     x1: 0,
            //     y1: y,
            //     x2: appLayout.editor.width,
            //     y2: y
            // })
        }, { immediate: true })
    }

    public onMouseDown(options:any) {
    }

    public getMousePosition(event) {

        const xy = [ event.offsetX, event.offsetY ]
        const x = 2 * xy[0] / event.target.clientWidth - 1
        const y = -2 * xy[1] / event.target.clientHeight + 1
        return {x, y}
    }

    public getRect(options: any) {
        const end = this.getMousePosition(options.e)
        const x = Math.min(end.x, this.pointerStart.x)
        const y = Math.min(end.y, this.pointerStart.y)
        const width = Math.abs(end.x - this.pointerStart.x)
        const height = Math.abs(end.y - this.pointerStart.y)
        const rect = {
            x, y, width, height
        }

        return rect
    }

    public async getSelectedPoints(rect, pcdMesh) {
        // 找到点云的点
        // const pointer = new THREE.Vector2()
        const position_arr = pcdMesh.geometry.getAttribute('position').array
        const res = await pySeqData.annotation.select_by_rect({
            // position_arr_in_liar:position_arr,
            ...jobConfig,
            rect,
            camera_conf: {
                'matrixWorld': glGlobals.mainView.camera.matrixWorldInverse.elements,
                'projectionMatrix': glGlobals.mainView.camera.projectionMatrix.elements
            },
            ts: jobConfig.ts,
            to_cs: jobConfig.stream,
            stream: jobConfig.stream}
        )
        return res.data
    }

    public screenToWorld(rect, targetZ) {
        const points = [
            [rect.x, rect.y],
            [rect.x + rect.width, rect.y],
            [rect.x + rect.width, rect.y + rect.height],
            [rect.x, rect.y + rect.height]
        ]
        
        const vec = new THREE.Vector3()
        const poses = []
        points.forEach(p => {
            vec.set(
                p[0],
                p[1],
                0.5,
            )
            vec.unproject(glGlobals.mainView.camera)
            vec.sub( glGlobals.mainView.camera.position ).normalize()
            const distance = (targetZ - glGlobals.mainView.camera.position.z) / vec.z
            const pos = new THREE.Vector3()
            pos.copy(glGlobals.mainView.camera.position).add(vec.multiplyScalar(distance))
            
            poses.push(pos)
        })

        return poses
    }

    public async onMouseUp(options: any) {
        
        if (!this.boxing) {
            const start = this.getMousePosition(options.e)
            this.pointerStart.x = start.x
            this.pointerStart.y = start.y
            this.rect_x1y1.x = options.e.offsetX
            this.rect_x1y1.y = options.e.offsetY
            this.boxing = true
            return
        } else {
            this.boxing = false
        }

        // drawing box
        const rect = this.getRect(options)
        
        const pcdMeshName = glGlobals.buildPcdMeshName(jobConfig)
        const pcdMesh = glGlobals.getCurrentSensorGroup().getObjectByName(pcdMeshName)

        const ret = await this.getSelectedPoints(rect, pcdMesh)
        const pointIndexes = ret[0]//.toJs()
        const min_z = ret[1]
        const max_z = ret[2]

        const rotationZ = glGlobals.mainView.camera.rotation.z + Math.PI / 2

        const position_arr = pcdMesh.geometry.getAttribute('position').array
        const res = await pySeqData.annotation.calc_psr_box_from_Points({
            ...jobConfig,
            ts: jobConfig.ts,
            to_cs: jobConfig.stream,
            stream: jobConfig.stream,
            // position_arr,
            points_indexes:pointIndexes,
            rotation_z:rotationZ}
        )
        const ret2 = res.data
        const position = ret2[0]//.toJs({dict_converter : Object.fromEntries})
        const scale = ret2[1]//.toJs({dict_converter : Object.fromEntries})
        const rotation = ret2[2]//.toJs({dict_converter : Object.fromEntries})

        const label_uuid = uuidv4()
        const attributes = {
            meta: {
                generated: 'rectTool',
                timeMs: new Date().getTime()
            },
            opType: 'create',
        }

        const val = [position.x, position.y, position.z, 
            rotation.x,rotation.y,rotation.z, 
            scale.x, scale.y, scale.z]
        eventBus.emit(eventBus.Box3d.RectToolAddingBox, {val, label_uuid, attributes})

        const poses = this.screenToWorld(rect, min_z)
        console.log(poses)

        // const colors = pcdMesh.geometry.getAttribute('color').array
        const redColor = new THREE.Color('rgb(255, 0, 0)')
        const colors = pcdMesh.geometry.attributes.color
        pointIndexes.forEach((i:number) => {
            colors.setXYZ( i, redColor.r, redColor.g, redColor.b )
        })
        pcdMesh.geometry.getAttribute('color').needsUpdate = true

        eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }

    public onMouseMove(options:any) {
        this.onPointerMove(options)
    }

    public toggle(activated:boolean = false) {
        if (activated) {
            this.activate()
        } else {
            this.deactivate()
        }
    }

    public onPointerMove(options) {
        const event = options.e

        const xy = [ event.offsetX, event.offsetY ]
        this.pointer.x = 2 * xy[0] / event.target.clientWidth - 1
        this.pointer.y = -2 * xy[1] / event.target.clientHeight + 1

        const x = options.pointer.x - 5
        const y = options.pointer.y - 5
        this.lineVertical.set({
            x1: x,
            y1: 0,
            x2: x,
            y2: canvaPanel.height_px
        })
        this.lineHorizontal.set({
            x1: 0,
            y1: y,
            x2: canvaPanel.width_px - threeView.topView.width,
            y2: y
        })
        if (this.boxing) {
            const left = 
                Math.min(options.pointer.x, this.rect_x1y1.x)
            const top =
                Math.min(options.pointer.y, this.rect_x1y1.y)
            const width =
                Math.abs(options.pointer.x - this.rect_x1y1.x)
            const height =
                Math.abs(options.pointer.y - this.rect_x1y1.y)
            this.rectObject.set({left, top, width, height})
        }
        this.canvas.renderAll()
    }

    private onDeactivate() {
        if (Box3dRectTool.states.activated) {
            this.deactivate()
        }
    }

    private watchers:Array = []
    public activate(): void {
        if (Box3dRectTool.states.activated) {
            return
        }
        this.activateSubTool()
        Box3dRectTool.states.activated = true
    }

    private activateSubTool() {
        const c = document.getElementById(this.domContainerId)
        if (c) {
            c.style.pointerEvents = 'auto'
            c.style.zIndex = '10'
        }
        this.canvas.on('mouse:down', this.onMouseDown)
        this.canvas.on('mouse:up', this.onMouseUp)
        this.canvas.on('mouse:move', this.onMouseMove)

        this.lineVertical.set({visible: true})
        this.lineHorizontal.set({visible: true})

        this.boxing = false
    }

    private deactivateSubTool() {
        const c = document.getElementById('mainCanvaContainer')
        if (c) {
            c.style.pointerEvents = 'none'
            c.style.zIndex = '-10'
        }
        this.canvas.off('mouse:down', this.onMouseDown)
        this.canvas.off('mouse:up', this.onMouseUp)
        this.canvas.off('mouse:move', this.onMouseMove)

        this.lineVertical.set({visible: false})
        this.lineHorizontal.set({visible: false})

        this.watchers.forEach(unwatch => unwatch())
    }

    public deactivate(): void {
        if (!Box3dRectTool.states.activated) {
            return
        }
        this.deactivateSubTool()
        Box3dRectTool.states.activated = false
    }
}

eventBus.on(eventBus.pcEditor.Inited, () => {
    Box3dRectTool.instance = new Box3dRectTool('mainCanvaContainer', 'mainCanva')
})

export { Box3dRectTool }