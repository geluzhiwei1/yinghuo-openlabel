import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { onKeyUp, useMagicKeys, whenever } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import { MouseMoveHightlight } from './mouse-move-point'
import { Box3dSelector } from './box3d-selector'
import { Box3DSelectorRect } from './box3d-selector-rect'
import { ElMessage } from 'element-plus'
import { mainAnnoStates } from '../states'
import { HotkeysManager } from "@/libs/hotkeys-manager"


const TOOLID = 'box3dTool'
export const box3dToolStates = reactive({
    mode: undefined as string | undefined,
    activated: false,
    subTool: undefined as string | undefined,
    toolConf: {
        id: TOOLID,
        icon: 'fluent-mdl2:edit-create',
        name: '画线',
        shortcut: 'E',
        description: '<el-text>开启此功能，再选择要编辑的对象</el-text>',
    },
    pointMode: 'add',
    mousePointToolStates: {
        pointsChanged: 0,
        pointsCount: 0
    }
})


class Box3dTool {
    static Name = TOOLID
    private domContainerId

    public static instance: Box3dTool;
    public static getInstance(): Box3dTool {
        if (!this.instance) {
            this.instance = new Box3dTool('mainCanvaContainer', 'mainCanva');
        }
        return this.instance
    }
    public states = box3dToolStates

    private pointerStart = new THREE.Vector2()

    currentTool = undefined as Box3DSelectorRect | undefined

    private hotkeysManager

    private watchers: Array = []
    protected offWatch() {
        this.watchers.forEach((unwatch) => {
            unwatch()
        })
        this.watchers = []
    }

    public mousePointTool: MouseMoveHightlight
    private constructor(domContainerId: string, canvaId: string) {
        this.domContainerId = domContainerId
        this.hotkeysManager = new HotkeysManager()
        this.mousePointTool = MouseMoveHightlight.getInstance()

        onKeyUp(['Escape'], (e) => {
            box3dToolStates.subTool = undefined
        })

        this.hotkeysManager.registerHotkeys({
            toolId: Box3dTool.Name,
            keys: '2',
            cb: () => {
                if (box3dToolStates.subTool === 'point') {
                    box3dToolStates.subTool = undefined
                } else {
                    box3dToolStates.subTool = 'point'
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: Box3dTool.Name,
            keys: '1',
            cb: () => {
                if (box3dToolStates.subTool === 'rect') {
                    box3dToolStates.subTool = undefined
                } else {
                    box3dToolStates.subTool = 'rect'
                }
            }
        })
    }

    protected onWatch() {
        this.watchers.push(
            watch(() => box3dToolStates.subTool, (newVal, oldVal) => {
                switch (newVal) {
                    case 'rect':
                        Box3DSelectorRect.instance.toggle(true)
                        // this.mousePointTool.toggle(false)
                        this.mousePointTool.toggle(false)
                        this.currentTool = Box3DSelectorRect.instance

                        glGlobals.mainView.transformControl.detach()
                        Box3dSelector.getInstance().deactivate()
                        break;
                    case 'point':
                        Box3DSelectorRect.instance.toggle(false)
                        // this.mousePointTool.toggle(false)
                        this.mousePointTool.toggle(true)

                        glGlobals.mainView.transformControl.detach()
                        Box3dSelector.getInstance().deactivate()
                        break;
                    case 'mouse':
                        Box3DSelectorRect.instance.toggle(false)
                        // this.mousePointTool.toggle(true)
                        this.mousePointTool.toggle(false)

                        glGlobals.mainView.transformControl.detach()
                        Box3dSelector.getInstance().deactivate()
                        break;
                    case '':
                    default:
                        Box3DSelectorRect.instance.toggle(false)
                        // this.mousePointTool.toggle(false)
                        this.mousePointTool.toggle(false)

                        Box3dSelector.getInstance().activate()
                        break;
                }
            }, { immediate: true }),

            watch(
              () => this.mousePointTool.states.pointsChanged,
              (newVal) => {
                this.states.mousePointToolStates.pointsCount =
                this.mousePointTool.seletedPointsManager.pointsCount()
              }
            )
        )

        // 默认要选择的对象
        this.watchers.push(watch(() =>mainAnnoStates.selectingLabelUid, () => {
            eventBus.emit(eventBus.Box3d.Command, {
                source: 'anno-table',
                command: 'doSelect',
                uuid: mainAnnoStates.selectingLabelUid
            })
        }, { immediate: true }))
    }

    // private afterActivate() {
    //     this.onWatch()
    // }

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

    public async doBuildObject() {
        switch (box3dToolStates.subTool) {
            case 'rect':
                // this.box3dRectTool.toggle(true)
                // this.mouseMoveHighlight.toggle(false)
                // this.mousePointTool.toggle(false)
                break;
            case 'point':
                if (this.mousePointTool.seletedPointsManager.pointsCount() > 2) {

                    const points = this.mousePointTool.seletedPointsManager.getPoints()

                    let max_x = Number.NEGATIVE_INFINITY, max_y = Number.NEGATIVE_INFINITY, max_z = Number.NEGATIVE_INFINITY
                    let min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE, min_z = Number.MAX_VALUE
                    points.forEach(point => {
                        max_x = Math.max(point.x, max_x)
                        max_y = Math.max(point.y, max_y)
                        max_z = Math.max(point.z, max_z)
                        min_x = Math.min(point.x, min_x)
                        min_y = Math.min(point.y, min_y)
                        min_z = Math.min(point.z, min_z)
                    })

                    const scale = { x: Math.max(1, max_x - min_x), y: Math.max(1, max_y - min_y), z: Math.max(1, max_z - min_z) }
                    const position = { x: 0.5 * (max_x + min_x), y: 0.5 * (max_y + min_y), z: 0.5 * (max_z + min_z) }
                    const rotation = { x: 0, y: 0, z: 0 }

                    const label_uuid = uuidv4()
                    const attributes = {
                        meta: {
                            generated: 'box3d-point-tool',
                            timeMs: new Date().getTime()
                        },
                        opType: 'create',
                    }
                    const val = [position.x, position.y, position.z,
                    rotation.x, rotation.y, rotation.z,
                    scale.x, scale.y, scale.z]
                    eventBus.emit(eventBus.Box3d.RectToolAddingBox, { val, label_uuid, attributes })

                    this.mousePointTool.seletedPointsManager.destroy()

                    box3dToolStates.subTool = undefined
                } else {
                    ElMessage.error('请至少选择3个点')
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
        if (box3dToolStates.activated) {
            this.deactivate()
        }
    }

    public activate(): void {
        if (box3dToolStates.activated) {
            return
        }
        this.onWatch()
        this.hotkeysManager.onWatchHotKeys()
        box3dToolStates.activated = true
    }

    public deactivate(): void {
        if (!box3dToolStates.activated) {
            return
        }
        this.hotkeysManager.offWatchHotKeys()
        Box3DSelectorRect.instance.toggle(false)
        this.mousePointTool.toggle(false)
        Box3dSelector.getInstance().deactivate()
        box3dToolStates.activated = false

        this.offWatch()
    }
}

export { Box3dTool }