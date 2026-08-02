import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { onKeyUp, useMagicKeys, whenever } from '@vueuse/core'
import { pySeqData } from '../api'
import { v4 as uuidv4 } from 'uuid'
import { reactive, toRef, watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import { Points3DSelectorCircle } from './point3d-selctor-circle'
import { Points3DSelectorPolyline } from './point3d-selctor-polyline'
import { Points3DSelectorRect } from './point3d-selctor-rect'
import PointInPoly from 'point-in-polygon-extended'
import { HotkeysManager } from "@/libs/hotkeys-manager"
import { globalStates } from '@/states'
import {mainAnnoStates} from '../states'
import { OlTypeEnum } from '@/openlabel'


const TOOLID = 'point3dTool'
export const states = reactive({
    mode: undefined as string | undefined, // 
    pointMode: 'add' as string | undefined, // 增加点或者删除点
    activated: false,
    subTool: 'polyline' as string | undefined,
    toolConf: {
        id: TOOLID,
        icon: 'fluent-mdl2:edit-create',
        name: '画线',
        shortcut: 'E',
        description: '<el-text>开启此功能，再选择要编辑的对象</el-text>',
    },
    // 已经选择的点集的索引集合，用于后续的点选择高亮等操作
    selectedPointIndexes: new Set()
})


const { current } = useMagicKeys()
const currentKeyboard = current


class Point3dTool {
    static Name = TOOLID
    public static instance: Point3dTool;
    public static getInstance(): Point3dTool {
        if (!this.instance) {
            this.instance = new Point3dTool('m-view-manipulator', 'mainCanva');
        }
        return this.instance
    }
    public states = states

    private pointer = new THREE.Vector2()
    private pointerStart = new THREE.Vector2()

    private domContainerId
    private domContainer: HTMLElement
    hotkeysManager = new HotkeysManager()

    private watchers: Array = []
    protected offWatch() {
        this.watchers.forEach((unwatch) => {
            unwatch()
        })
        this.watchers = []
    }
    private keyDownCtrl = false
    private keyDownShift = false
    private keyDownAlt = false

    // tool
    canvasMouse
    contextMouse
    viewWidth
    viewHeight
    viewWidth2
    viewHeight2
    cloudData = []
    pixelProjection = new Map()
    highlightedIndex = undefined

    hiddenIndices = new Set()
    visibleIndices = new Set()
    grayIndices = new Set()
    frustrumIndices = new Set()
    frustum = new THREE.Frustum()
    pixelProjectionRequestTime = 0
    canvasMouseIsDirty = true
    currentTool = undefined as Points3DSelectorCircle | Points3DSelectorPolyline | Points3DSelectorRect | undefined
    mouse = new THREE.Vector2()
    mouse_dragged = 0
    raycaster

    private constructor(domContainerId: string, canvaId: string) {
        this.domContainerId = domContainerId
        this.domContainer = document.getElementById(this.domContainerId)!
        this.canvasMouse = document.getElementById(canvaId) as HTMLCanvasElement

        this.resize()

        this.onMouseMove = this.onMouseMove.bind(this)

        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = 0.1
        // this.raycaster.linePrecision = 0.1

        // onKeyUp(['Escape'], (e) => {
        //     this.onDeactivate()
        // })

        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: '1',
            cb: () => {
              states.subTool = 'circle'
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: '2',
            cb: () => {
                states.subTool = 'rect'
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: '3',
            cb: () => {
                states.subTool = 'polyline'
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: 'n',
            cb: () => {
                this.onCommand('createNew')
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: 'e',
            cb: () => {
                if (states.mode === 'selected'){
                    this.onCommand('selected-edit')
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: 'x',
            cb: () => {
                if (states.mode === 'selected'){
                    this.onCommand('selected-del')
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: ' ',
            cb: () => {
                switch (states.mode) {
                    case 'createNew':
                        this.onCommand('createNew-finish')
                        break
                    case 'editingSelected':
                        this.onCommand('editing-finish')
                        break
                    default:
                        this.onCommand('createNew')
                        break
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Point3dTool.Name,
            keys: 'q',
            cb: () => {
                switch (states.mode) {
                    case 'createNew':
                        this.onCommand('createNew-cancel')
                        break
                    case 'editingSelected':
                        this.onCommand('editing-finish')
                        break
                    case 'selected':
                        this.onCommand('cancel')
                        break
                    default:
                        break
                }
            }
        })
    }

    resize() {
        const divBox = this.domContainer.getBoundingClientRect()
        this.canvasMouse.width = divBox.width
        this.canvasMouse.height = divBox.height

        const box = this.canvasMouse.getBoundingClientRect()
        this.viewWidth = box.width
        this.viewHeight = box.height
        this.viewWidth2 = box.width / 2
        this.viewHeight2 = box.height / 2

        this.contextMouse = this.canvasMouse.getContext('2d')
    }

    toSelect() {
        if (this.currentTool && this.currentTool.polygon.length > 2) {
          eventBus.emit(eventBus.Points3DAnnotation.ToSelectPoints, {
            data: this.currentTool.polygon, command: 'ToSelectPoints',
          })
          this.currentTool.polygon.length = 0
        }
    }

    public onMouseMove(event) {
        // const event = options.e

        const xy = [ event.offsetX, event.offsetY ]
        this.pointer.x = 2 * xy[0] / event.target.clientWidth - 1
        this.pointer.y = -2 * xy[1] / event.target.clientHeight + 1

        this.drawCanvasMouse(event)
    }

    selectByPolygon(polygon) {
        const inside = new Set()
        const outside = new Set()

        const pcdMesh = this.getCurrentPcd()
        if (!pcdMesh) return

        // 遍历pcdMesh的顶点
        for (let i = 0; i < pcdMesh.geometry.attributes.position.count; i++) {
            const pt = new THREE.Vector3().fromBufferAttribute(pcdMesh.geometry.attributes.position, i)
            pt.applyMatrix4(pcdMesh.matrixWorld)
            // const local = pcdMesh.worldToLocal(pt)
            const pixel = this.projectPixel(pt)

            const inPolygon = PointInPoly.pointInPolyWindingNumber(
                [pixel.pixelX, pixel.pixelY],
                polygon
            )

            if (inPolygon) {
                inside.add(i)
            } else {
                outside.add(i)
            }
        }

        // 根据当前的选择模式，决定是添加到选中集合还是从选中集合中移除
        switch(states.pointMode) {
            case 'add':
                inside.forEach((idx) => states.selectedPointIndexes.add(idx))
                break
            case 'remove':
                inside.forEach((idx) => states.selectedPointIndexes.delete(idx))
                break
            default:
                break
        }

        eventBus.emit(eventBus.PointCloud.SelectedChanged, {selected: states.selectedPointIndexes})
    }

    public clearSeltecedPoints() {
        states.selectedPointIndexes.clear()
        eventBus.emit(eventBus.PointCloud.SelectedChanged, {selected: states.selectedPointIndexes})
    }

    projectPixel(vector: THREE.Vector3) {
        const camera = glGlobals.mainView.camera
        const box = glGlobals.mainView.container.getBoundingClientRect()
        const viewWidth = box.width
        const viewHeight = box.height
        const viewWidth2 = box.width / 2
        const viewHeight2 = box.height / 2
        const clippingBox = [-2, -2, viewWidth + 4, viewHeight + 4]

        this.frustum.setFromProjectionMatrix(
            new THREE.Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            )
        )

        let pixelX = NaN
        let pixelY = NaN
        const inFrustrum = this.frustum.containsPoint(vector)
        if (inFrustrum) {
            vector.project(camera)
            pixelX = Math.round(vector.x * viewWidth2 + viewWidth2)
            pixelY = Math.round(-vector.y * viewHeight2 + viewHeight2)
        }

        return {
            pixelX,
            pixelY
        }
    }

    getPixel(o) {
        return this.pixelProjection.get(o)
    }
    clearCanvasMouse() {
        this.contextMouse!.clearRect(0, 0, this.viewWidth, this.viewHeight)
    }

    getCurrentPcd() {
        return glGlobals.getCurrentSensorGroup()!.getObjectByName(
            glGlobals.buildPcdMeshName(jobConfig)
        ) as THREE.Points
    }

    drawPolyLine(context, pts, color, xField = 0, yField = 1, close) {
        if (!pts || !pts.length) return
        context.beginPath()
        context.lineWidth = 1
        context.strokeStyle = color
        context.moveTo(pts[0][xField], pts[0][yField])

        for (let i = 1; i < pts.length; i++) {
            context.lineTo(pts[i][xField], pts[i][yField])
        }

        if (close) context.lineTo(pts[0][xField], pts[0][yField])
        context.stroke()
    }

    _raycasting() {
        this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)

        const pcdMesh = this.getCurrentPcd()
        const intersects = this.raycaster.intersectObjects([pcdMesh], false)
  
        if (intersects.length > 0) {
          intersects.sort((a, b) => (a.distanceToRay < b.distanceToRay ? -1 : 1))
          return intersects
        } else {
          return null
        }
    }

    drawCanvasMouse(event) {

        this.clearCanvasMouse()
        const ctx = this.contextMouse!

        if (this.keyDownCtrl || this.keyDownShift) {
            // 按下了快捷键，绘制
            if (this.currentTool && this.currentTool.polygon && this.currentTool.polygon.length) {
                this.drawPolyLine(ctx, this.currentTool.polygon, '#0000FF', 0, 1, false)
                return
            }
        }

        // 绘制鼠标位置点，高亮显示
        const intersectObjects = this._raycasting()
        if (!intersectObjects) return
        eventBus.emit(eventBus.Points3DAnnotation.Highlight, {command:'mousemove', glObj: intersectObjects})
        const obj = intersectObjects[0]
        // const localPos = obj.object.worldToLocal(obj.point)
        const pj = this.projectPixel(obj.point)
        if (pj) {
            ctx.beginPath()
            ctx.strokeStyle = '#0000FF'
            ctx.lineWidth = 1
            ctx.arc(pj.pixelX, pj.pixelY, 5, 0, Math.PI * 2.0)
            ctx.stroke()
        }
    }

    protected onWatch() {
        this.watchers.push(
            watch(() => states.subTool, (newVal, oldVal) => {
                switch (newVal) {
                    case 'circle':
                        Points3DSelectorCircle.instance.toggle(true)
                        Points3DSelectorPolyline.instance.toggle(false)
                        Points3DSelectorRect.instance.toggle(false)
                        this.currentTool = Points3DSelectorCircle.instance
                        break;
                    case 'polyline':
                        Points3DSelectorPolyline.instance.toggle(true)
                        Points3DSelectorCircle.instance.toggle(false)
                        Points3DSelectorRect.instance.toggle(false)
                        this.currentTool = Points3DSelectorPolyline.instance
                        break;
                    case 'rect':
                        Points3DSelectorRect.instance.toggle(true)
                        Points3DSelectorCircle.instance.toggle(false)
                        Points3DSelectorPolyline.instance.toggle(false)
                        this.currentTool = Points3DSelectorRect.instance
                        break;
                    default:
                        Points3DSelectorCircle.instance.toggle(false)
                        Points3DSelectorPolyline.instance.toggle(false)
                        Points3DSelectorRect.instance.toggle(false)
                        this.currentTool = undefined
                        break;
                }
            }, { immediate: true })
        )

        this.watchers.push(
            whenever(() => currentKeyboard.has('control'), () => {
                this.keyDownCtrl = true
                states.pointMode = 'add'
            }),
            whenever(() => !currentKeyboard.has('control'), () => {
                this.keyDownCtrl = false
                // states.pointMode = undefined
                this.toSelect()
            })
        )
        this.watchers.push(
            whenever(() => currentKeyboard.has('shift'), () => {
                this.keyDownShift = true
                states.pointMode = 'remove'
            }),
            whenever(() => !currentKeyboard.has('shift'), () => {
                this.keyDownShift = false
                // states.pointMode = undefined
                this.toSelect()
            })
        )

        this.watchers.push(
            watch(() => mainAnnoStates.selected, (newVal) => {
                if (newVal.ol_type_ === OlTypeEnum.Point3d){
                    this.setMode('selected')
                }
            }, { immediate: false })
        )

        // 默认要选择的对象
        this.watchers.push(watch(() =>mainAnnoStates.selectingLabelUid, () => {
            eventBus.emit(eventBus.Points3DAnnotation.Command, {
                source: 'anno-table',
                command: 'doSelect',
                uuid: mainAnnoStates.selectingLabelUid
            })
            // this.setMode('selected')
        }, { immediate: true }))
    }
    private setMode(mode: string | undefined) {
        switch (mode) {
            case 'createNew':
                this.domContainer.style.cursor = 'pointer'
                break
            case 'editingSelected':
                this.domContainer.style.cursor = ''
                // this.bindListeners()
                break
            default:
                this.domContainer.style.cursor = 'default'
        }
        states.mode = mode
    }

    private setSubTool(subTool: string | undefined) {
        states.subTool = subTool
    }
    public onCommand(cmd: string) {
        switch (cmd) {
            case 'createNew':
                this.setMode('createNew')
                break
            case 'set-tool-circle':
                this.setSubTool('circle')
                break
            case 'set-tool-polyline':
                this.setSubTool('polyline')
                break
            case 'set-tool-rect':
                this.setSubTool('rect')
                break
            case 'createNew-finish':
                eventBus.emit(eventBus.Points3DAnnotation.Command, {
                    source: Point3dTool.Name,
                    command: 'create',
                    data: states.selectedPointIndexes
                })
                states.selectedPointIndexes.clear()
                this.setMode(undefined)
                break
            case 'createNew-cancel':
                states.selectedPointIndexes.clear()
                eventBus.emit(eventBus.PointCloud.SelectedChanged, {selected: states.selectedPointIndexes})
                this.setMode(undefined)
                break
            case 'editing-finish':
                eventBus.emit(eventBus.Points3DAnnotation.Command, {
                    source: Point3dTool.Name,
                    command: 'update',
                    data: states.selectedPointIndexes,
                    uuid: mainAnnoStates.selected.label_uuid
                })
                states.selectedPointIndexes.clear()
                this.setMode(undefined)
                break
            case 'editing-cancel':
                states.selectedPointIndexes.clear()
                this.setMode(undefined)
                break
            case 'selected-edit':
                states.selectedPointIndexes.clear()
                states.selectedPointIndexes = new Set(mainAnnoStates.selected.val)
                eventBus.emit(eventBus.PointCloud.SelectedChanged, {selected: states.selectedPointIndexes})
                this.setMode('editingSelected')
                break
            case 'selected-del':
                globalStates.mainAnnoater.removeSelected()
                this.setMode(undefined)
                break
            case 'cancel':
                mainAnnoStates.selected = {}
                this.setMode(undefined)
                break
            default:
                break
        }
    }

    public onMouseDown(options: any) {
    }

    public getMousePosition(event) {
        const xy = [event.offsetX, event.offsetY]
        const x = 2 * xy[0] / event.target.clientWidth - 1
        const y = -2 * xy[1] / event.target.clientHeight + 1
        return { x, y }
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
            stream: jobConfig.stream
        }
        )
        return res.data
    }

    public async doBuildObject() {
        switch (states.subTool) {
            case 'rect':
                // this.point3dRectTool.toggle(true)
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

                    const scale = { x: Math.max(1, max_x - min_x), y: Math.max(1, max_y - min_y), z: Math.max(1, max_z - min_z) }
                    const position = { x: 0.5 * (max_x + min_x), y: 0.5 * (max_y - min_y), z: 0.5 * (max_z + min_z) }
                    const rotation = { x: 0, y: 0, z: 0 }

                    const label_uuid = uuidv4()
                    const attributes = {
                        meta: {
                            generated: 'point3d-point-tool',
                            timeMs: new Date().getTime()
                        },
                        opType: 'create',
                    }
                    const val = [position.x, position.y, position.z,
                    rotation.x, rotation.y, rotation.z,
                    scale.x, scale.y, scale.z]
                    eventBus.emit(eventBus.Box3d.RectToolAddingBox, { val, label_uuid, attributes })

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
            vec.sub(glGlobals.mainView.camera.position).normalize()
            const distance = (targetZ - glGlobals.mainView.camera.position.z) / vec.z
            const pos = new THREE.Vector3()
            pos.copy(glGlobals.mainView.camera.position).add(vec.multiplyScalar(distance))

            poses.push(pos)
        })

        return poses
    }

    private onDeactivate() {
        if (states.activated) {
            this.deactivate()
        }
    }

    public activate(): void {
        if (states.activated) {
            return
        }
        this.resize()
        this.onWatch()
        this.hotkeysManager.onWatchHotKeys()
        this.domContainer.addEventListener('mousemove', this.onMouseMove)

        states.activated = true
    }

    public deactivate(): void {
        if (!states.activated) {
            return
        }

        this.hotkeysManager.offWatchHotKeys()
        this.domContainer.removeEventListener('mousemove', this.onMouseMove)
        this.currentTool?.deactivate()
        states.activated = false

        this.offWatch()
    }
}

eventBus.on(eventBus.Points3DAnnotation.ToSelectPoints, (params) => {
    const {data, command} = params
    Point3dTool.getInstance().selectByPolygon(data)
})

export { Point3dTool }