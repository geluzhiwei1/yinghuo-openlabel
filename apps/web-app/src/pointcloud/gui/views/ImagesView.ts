import * as fabric from 'fabric'
import * as THREE from 'three'
import _ from 'lodash'
import { eventBus } from '../../event/EventBus'
import { v4 as uuidv4 } from 'uuid'
import { jobConfig } from '@/states/job-config'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'

class ImagesView{
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
    private toggle = 0.0
    private spheresIndex = 0
    private lineVertical
    private lineHorizontal
    private rectObject: fabric.Rect
    constructor(canvaId: string) {
        this.canvas = new fabric.Canvas(canvaId, {
            width: appLayout.editor.width,
            height: appLayout.editor.height,
        })
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

        // 事件
        this.canvas.on('mouse:down', (options) => {
            this.onMouseDown(options)
        })
        this.canvas.on('mouse:up', async (options) => {
            await this.onMouseUp(options)
        })
        this.canvas.on('mouse:move', (options) => {
            this.onMouseMove(options)
        })

        // draw line
        this.lineVertical = new fabric.Line([0,0,0,appLayout.editor.width], {
            strokeWidth: 1,
            strokeDashArray:[2,1],
            selectable: false,
            stroke: "red"
          })
        this.lineHorizontal = new fabric.Line([0,0,appLayout.editor.height,0], {
            strokeWidth: 1,
            strokeDashArray: [2,1],
            selectable: false,
            stroke: "red"
          })
        this.canvas.add(this.lineVertical)
        this.canvas.add(this.lineHorizontal)
    }

    public onMouseDown(options:any) {

        // const {x, y} = this.getMousePosition(options.e)
        // this.pointerStart.x = x
        // this.pointerStart.y = y
    }

    public getMousePosition(event) {
        const domEle = document.getElementById(this.canvaId)
        return {
            x: event.offsetX / domEle.clientWidth * 2 - 1,
            y: - event.offsetY / domEle.clientHeight * 2 + 1
        }
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
        const ret = await window.pySeqData.annotation.select_by_rect(
            position_arr,
            rect,
            {
                'matrixWorld': glGlobals.mainView.camera.matrixWorldInverse.elements,
                'projectionMatrix': glGlobals.mainView.camera.projectionMatrix.elements
            },
            jobConfig.ts,
            jobConfig.stream_id
        )
        return ret
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
        const pointIndexes = ret[0].toJs()
        const min_z = ret[1]
        const max_z = ret[2]

        const rotationZ = glGlobals.mainView.camera.rotation.z + Math.PI / 2

        const position_arr = pcdMesh.geometry.getAttribute('position').array
        const ret2 = await window.pySeqData.annotation.calc_psr_box_from_Points(
            position_arr,
            pointIndexes,
            rotationZ
        )
        const position = ret2[0].toJs({dict_converter : Object.fromEntries})
        const scale = ret2[1].toJs({dict_converter : Object.fromEntries})
        const rotation = ret2[2].toJs({dict_converter : Object.fromEntries})

        const label_uuid = uuidv4()
        const attributes = {
            meta: {
                generated: 'rectTool',
                timeMs: new Date().getTime()
            },
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
        // console.log(options.e.clientX, options.e.clientY);
        this.onPointerMove(options)
    }

    public onPointerMove(options) {
        const event = options.e
        // this.pointer.x = ( event.clientX / appLayout.editor.width ) * 2 - 1
        // this.pointer.y = - (event.clientY / appLayout.editor.height) * 2 + 1
        
        this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
        this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1

        const x = options.pointer.x - 5
        const y = options.pointer.y - 5
        this.lineVertical.set({
            x1: x,
            y1: 0,
            x2: x,
            y2: appLayout.editor.height
        })
        this.lineHorizontal.set({
            x1: 0,
            y1: y,
            x2: appLayout.editor.width,
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

    public activate(): void {
        const c = document.getElementById('mainCanvaContainer')
        if (c) {
            c.style.zIndex = '10'
        }
        // this.canvas.on('mouse:down', (options) => {
        //     this.onMouseDown(options)
        // })
        // this.canvas.on('mouse:up', (options) => {
        //     this.onMouseUp(options)
        // })
        // this.canvas.on('mouse:move', (options) => {
        //     this.onMouseMove(options)
        // })
    }
    public deactivate(): void {
        const c = document.getElementById('mainCanvaContainer')
        if (c) {
            c.style.zIndex = '-10'
        }
        this.canvas.dispose()
        // this.canvas.off('mouse:down', (options) => {
        //     this.onMouseDown(options)
        // })
        // this.canvas.off('mouse:up', (options) => {
        //     this.onMouseUp(options)
        // })
        // this.canvas.off('mouse:move', (options) => {
        //     this.onMouseMove(options)
        // })
    }
}

export { ImagesView }