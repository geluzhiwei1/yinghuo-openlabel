import * as THREE from 'three'
import { useDataState } from '../store'
import _ from 'lodash'
import { eventBus } from '../event-bus'
import { onKeyUp } from '@vueuse/core'
import { pySeqData } from '../api'
import { v4 as uuidv4 } from 'uuid'
import {reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import { Box3dRectTool } from './box3d-rect-tool'
// import { MouseMovePoint, MouseMoveHightlight } from './mouse-move-point'

const { current_seq } = useDataState()


const TOOLID = 'box3dTool'
export const box3dToolStates = reactive({
    mode: undefined as string | undefined,
    activated: false,
    subTool: 'mouse' as string | undefined,
    toolConf: {
        id: TOOLID,
        icon: 'fluent-mdl2:edit-create',
        name: '画线',
        shortcut: 'E',
        description: '<el-text>开启此功能，再选择要编辑的对象</el-text>',
    },
})

class Box3dTool {
    static Name = TOOLID
    public static instance: Box3dTool;
    public static getInstance(): Box3dTool {
        if (!this.instance) {
            this.instance = new Box3dTool('mainCanvaContainer', 'mainCanva');
        }
        return this.instance
    }

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
    private domContainerId

    private watchers:Array = []
    protected offWatch() {
        this.watchers.forEach((unwatch) => {
            unwatch()
        })
        this.watchers = []
    }

    // 子工具
    // private box3dRectTool: Box3dRectTool
    // private mouseMoveHighlight: MouseMovePoint
    // private mousePointTool: MouseMovePoint
    
    private constructor(domContainerId: string, canvaId: string) {
        this.domContainerId = domContainerId

        // this.box3dRectTool = new Box3dRectTool(domContainerId, canvaId)
        // this.mouseMoveHighlight = new MouseMovePoint('m-view-manipulator', {})
        // this.mousePointTool = new MouseMovePoint('m-view-manipulator', {enableSelectPoints: true})

        this.clock = new THREE.Clock();

        onKeyUp(['Escape'], (e) => {
            this.onDeactivate()
        })
    }

    protected onWatch() {
        this.watchers.push(
            watch(() => box3dToolStates.subTool, (newVal, oldVal) => {
                switch(newVal) {
                    case 'rect':
                        Box3dRectTool.instance.toggle(true)
                        // MouseMovePoint.getInstance().toggle(false)
                        // MouseMoveHightlight.getInstance().toggle(false)
                        break;
                    case 'point':
                        Box3dRectTool.instance.toggle(false)
                        // MouseMovePoint.getInstance().toggle(false)
                        // MouseMoveHightlight.getInstance().toggle(true)
                        break;
                    case 'mouse':
                        Box3dRectTool.instance.toggle(false)
                        // MouseMovePoint.getInstance().toggle(true)
                        // MouseMoveHightlight.getInstance().toggle(false)
                        break;
                    default:
                        break;
                }
            })
        )
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
            ts: current_seq.ts,
            to_cs: current_seq.stream,
            stream: current_seq.stream}
        )
        return res.data
    }

    public async doBuildObject() {
        switch(box3dToolStates.subTool) {
            case 'rect':
                // this.box3dRectTool.toggle(true)
                // this.mouseMoveHighlight.toggle(false)
                // this.mousePointTool.toggle(false)
                break;
            case 'point':
                if (this.mousePointTool.seletedPointsManager.pointsCount() > 1) {

                    const points = this.mousePointTool.seletedPointsManager.getPoints()
                    
                    let max_x = Number.MIN_SAFE_INTEGER, max_y = Number.MIN_SAFE_INTEGER, max_z = Number.MIN_SAFE_INTEGER
                    let min_x = Number.MAX_SAFE_INTEGER, min_y = Number.MAX_SAFE_INTEGER, min_z = Number.MAX_SAFE_INTEGER
                    points.forEach(point => {
                        max_x = Math.max(point.x, max_x)
                        max_y = Math.max(point.y, max_y)
                        max_z = Math.max(point.z, max_z)
                        min_x = Math.min(point.x, min_x)
                        min_y = Math.min(point.y, min_y)
                        min_z = Math.min(point.z, min_z)
                    })

                    const scale = {x: Math.max(1, max_x - min_x), y: Math.max(1, max_y - min_y), z: Math.max(1, max_z - min_z)}
                    const position = {x: 0.5 * (max_x + min_x), y: 0.5 * (max_y - min_y), z: 0.5 * (max_z + min_z)}
                    const rotation = {x: 0, y:0, z:0}

                    const uuid = uuidv4()
                    const attributes = {
                        meta: {
                            generated: 'box3d-point-tool',
                            timeMs: new Date().getTime()
                        },
                        op_type: 'create',
                    }
                    eventBus.emit(eventBus.Box3d.RectToolAddingBox, {position, scale, rotation, uuid, attributes})
            
                    this.mousePointTool.seletedPointsManager.destroy()
                }
                break;
            case 'mouse':
                break;
            default:
                break;
        }
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

    private onDeactivate() {
        if (box3dToolStates.activated) {
            this.deactivate()
        }
    }
    
    public activate(): void {
        if (box3dToolStates.activated) {
            return
        }
        this.onWatch()
        box3dToolStates.activated = true
    }

    public deactivate(): void {
        if (!box3dToolStates.activated) {
            return
        }
        Box3dRectTool.instance.toggle(false)
        MouseMoveHightlight.getInstance().toggle(false)
        MouseMovePoint.getInstance().toggle(false)
        box3dToolStates.activated = false

        this.offWatch()
    }
}

export { Box3dTool }