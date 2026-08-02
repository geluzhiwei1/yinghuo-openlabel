import * as THREE from 'three'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import _ from 'lodash'
import { eventBus } from '../event/EventBus'
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { glPolylineAnnotationManager } from '@/pointcloud/render/annotation/polyline3d-annotation'
import { reactive, watch } from 'vue'
import { SeletedPointsManager } from './selected-points-manager'
import { AnnoTool } from '@/core/anno-tool'
import { mainAnnoStates } from '../states'
import { HotkeysManager } from "@/libs/hotkeys-manager"
import { globalStates } from '@/states'
import { jobConfig } from '@/states/job-config'


export const polylineToolstates = reactive({
    mode: undefined as string | undefined,
    activated: false,
})

const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);

const ARC_SEGMENTS = 200

class PolylineTool extends AnnoTool {
    static Name = 'polylineTool'

    private canvas
    private domContainer
    private raycaster
    private pointer = new THREE.Vector2()
    
    private threshold = 0.1

    // line
    private splines = {};
    private point = new THREE.Vector3()
    private positions = [];
    private splineHelperObjects = [];
    private splinePointsLength = 4;
    private onUpPosition = new THREE.Vector2();
    private onDownPosition = new THREE.Vector2();

    public seletedPointsManager:SeletedPointsManager = undefined
    private transformControl: TransformControls

    hotkeysManager = new HotkeysManager()

    // 单例
    public static instance: PolylineTool;
    public states = polylineToolstates

    // 获取实例
    public static getInstance(): PolylineTool {
        if (!this.instance) {
            this.instance = new PolylineTool('m-view-manipulator', 'glMainViewCanvas');
        }
        return this.instance
    }
    private constructor(domContainerId: string, canvaId: string) {
        super()
        this.domContainer = document.getElementById(domContainerId)
        this.canvas = document.getElementById(canvaId)
        this.raycaster = new THREE.Raycaster()
        this.raycaster.params.Points.threshold = this.threshold
        this.raycaster.params.Line.threshold = 0.5
 
        this.mouseup = this.mouseup.bind(this)
        this.mousemove = this.mousemove.bind(this)
        this.pointerdown = this.pointerdown.bind(this)
        this.onEscUp = this.onEscUp.bind(this)

        this.ontransformControlDraggingChanged = this.ontransformControlDraggingChanged.bind(this)

        this.hotkeysManager.registerHotkeys({
            toolId: PolylineTool.Name,
            keys: 'z',
            cb: () => {
                this.seletedPointsManager?.removeLastPoint()
            }
        })

        // this.hotkeysManager.registerHotkeys({
        //     toolId: PolylineTool.Name,
        //     keys: 'escape',
        //     cb: () => {
        //         this.onEscUp()
        //     }
        // })

        this.hotkeysManager.registerHotkeys({
            toolId: PolylineTool.Name,
            keys: 'n',
            cb: () => {
                this.onCommand('createNew')
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: PolylineTool.Name,
            keys: 'e',
            cb: () => {
                if (polylineToolstates.mode === 'selected'){
                    this.onCommand('selected-edit')
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: PolylineTool.Name,
            keys: 'x',
            cb: () => {
                if (polylineToolstates.mode === 'selected'){
                    this.onCommand('selected-del')
                }
            }
        })
        this.hotkeysManager.registerHotkeys({
            toolId: PolylineTool.Name,
            keys: ' ',
            cb: () => {
                switch (polylineToolstates.mode) {
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
            toolId: PolylineTool.Name,
            keys: 'q',
            cb: () => {
                switch (polylineToolstates.mode) {
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

    reset(): void {
        if (this.seletedPointsManager) {
            this.seletedPointsManager?.destroy()
            this.seletedPointsManager = undefined
        }
    }

    private pointerdown(event) {
        const { onDownPosition } = this
        onDownPosition.x = event.clientX
        onDownPosition.y = event.clientY
    }

    private ontransformControlDraggingChanged() {
        eventBus.emit(eventBus.PolylineAnnotation.ControlPointsChanged)
    }

    private bindListeners() {
        this.transformControl = glGlobals.mainView.transformControl
        this.transformControl.addEventListener('dragging-changed', this.ontransformControlDraggingChanged)
    }

    private unBindListerners() {
        this.detachTransformControl()
        // 取消选择
        eventBus.emit(eventBus.PolylineAnnotation.SelectedChanged, {
            intersections:[], command: 'cancel',
        })
    }

    private updateSplineOutline() {
        
        const { point, splines } = this
        for ( const k in splines ) {
            const spline = splines[ k ];
            const splineMesh = spline.mesh;
            const position = splineMesh.geometry.attributes.position;

            for ( let i = 0; i < ARC_SEGMENTS; i ++ ) {
                const t = i / ( ARC_SEGMENTS - 1 );
                spline.getPoint( t, point );
                position.setXYZ( i, point.x, point.y, point.z );

            }

            position.needsUpdate = true;

        }

    }

    public buildSpline(new_positions) {
        const {positions} = this
        while ( new_positions.length > positions.length ) {
            this.addPoint();
        }

        while ( new_positions.length < positions.length ) {
            this.removePoint();
        }

        for ( let i = 0; i < positions.length; i ++ ) {
            positions[ i ].copy( new_positions[ i ] );
        }

        this.updateSplineOutline();
    }


    private addPoint() {
        let {positions, splinePointsLength} = this
        splinePointsLength ++;
        positions.push( this.addSplineObject().position );
        this.updateSplineOutline();
    }

    private removePoint() {
        let {positions, splinePointsLength, splineHelperObjects} = this
        if ( splinePointsLength <= 4 ) {
            return;
        }

        const point = splineHelperObjects.pop();
        splinePointsLength --;
        positions.pop();

        if ( transformControl.object === point ) transformControl.detach();
        glPolylineAnnotationManager.getCurrent().polyline_controlPointsGroup.remove(point);

        this.updateSplineOutline();
    }

    private addSplineObject(position) {
        const {splineHelperObjects} = this
        const material = new THREE.MeshLambertMaterial( { color: new THREE.Color("rgb(0, 155, 0)").getHex() } );
        const object = new THREE.Mesh( boxGeometry, material );

        if ( position ) {
            object.position.copy( position );
        } else {
            object.position.x = Math.random()
            object.position.y = Math.random()
            object.position.z = Math.random()
        }

        // object.castShadow = true
        // object.receiveShadow = true
        // TODO glPolylineAnnotationManager.getCurrent().polylineObjectGroup.add(object);
        splineHelperObjects.push( object )
        return object;
    }

    private onEscUp() {
        if (this.isEditingLine()) {
            // 取消选择
            eventBus.emit(eventBus.PolylineAnnotation.SelectedChanged, {
                intersections:[], command: 'cancel',
            })
        }
        this.seletedPointsManager?.destroy()
        this.setMode(undefined)
    }

    private watchers:Array = []
    private bindAutoOffEvents() {
        this.domContainer?.addEventListener('mouseup', this.mouseup)
        this.domContainer?.addEventListener('mousemove', this.mousemove)
        this.domContainer?.addEventListener('pointerdown', this.pointerdown)
        this.watchers.push(
            watch(() => jobConfig.frame, (v) => {
                this.detachTransformControl()
                // 取消选择
                eventBus.emit(eventBus.PolylineAnnotation.SelectedChanged, {
                    intersections:[], command: 'cancel',
                })
            })
        )

        // 选择对象
        this.watchers.push(watch(() =>mainAnnoStates.selectingLabelUid, (newVal, oldVal) => {
            eventBus.emit(eventBus.PolylineAnnotation.Command, {
                source: 'anno-table',
                command: 'doSelect',
                uuid: mainAnnoStates.selectingLabelUid
            })
            if (newVal) {
                this.setMode('selected')
            }
        }, { immediate: true }))
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
                    eventBus.emit(eventBus.PolylineAnnotation.Command, {
                        Name: this.Name,
                        command: 'addLine',
                        glObj: this.seletedPointsManager.glGroup
                    })
                    this.seletedPointsManager.destroy()
                    this.setMode(undefined)
                }
                break
            case 'createNew-cancel':
                this.seletedPointsManager.destroy()
                this.setMode(undefined)
                break
            case 'editing-finish':
                this.unBindListerners() 
                this.setMode(undefined)
                break
            case 'editing-cancel':
                this.unBindListerners()
                this.setMode(undefined)
                break
            case 'selected-edit':
                this.setMode('editingSelected')
                break
            case 'selected-del':
                globalStates.mainAnnoater.removeSelected()
                this.setMode(undefined)
                break
            default:
                this.setMode(undefined)
                break
        }
    }

    public activate() {
        if (polylineToolstates.activated) {
            return
        }
        this.seletedPointsManager = new SeletedPointsManager(
            glPolylineAnnotationManager.getCurrent().selectedPointsGroup
        )
        // this.init()
        // this.bindListeners()
        this.bindAutoOffEvents()
        this.hotkeysManager.onWatchHotKeys()
        polylineToolstates.activated = true
        // this.setMode(undefined)
        // eventBus.emit(eventBus.ToolBar.Command, {Name:this.Name, command:'activate'})
    }

    private setMode(mode:string|undefined) {
        switch (mode) {
            case 'createNew':
                this.seletedPointsManager = new SeletedPointsManager(
                    glPolylineAnnotationManager.getCurrent().selectedPointsGroup
                )
                break
            case 'editingSelected':
                this.bindListeners()
                break
            default:
                break
        }
        polylineToolstates.mode = mode
    }

    public deactivate() {
        if (!polylineToolstates.activated) {
            return
        }
        this.hotkeysManager.offWatchHotKeys()
        this.seletedPointsManager.destroy()
        this.unBindListerners()
        this.unBindAutoOffEvents()
        polylineToolstates.activated = false
        this.setMode(undefined)
        // eventBus.emit(eventBus.ToolBar.Command, {Name:this.Name, command:'deactivate'})
    }

    // private currentSelectedLine = undefined
    private currentSelectedPoint = undefined
    public tryToSelectLineOrPoints(event) {
        this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
        const targets = [
            ...glPolylineAnnotationManager.getCurrent().polylineObjectGroup.children
        ]
        const lineIntersections = this.raycaster.intersectObjects(targets, true)
        if (lineIntersections.length > 0) {
            // TODO sort ？
            // pointsIntersections.sort((a, b) => (a.distanceToRay < b.distanceToRay ? -1 : 1))
            // this.attachTransformControl(lineIntersections)
            eventBus.emit(eventBus.PolylineAnnotation.SelectedChanged, {
                intersections:lineIntersections, command: 'mouseup'
            })
            return lineIntersections
        }
        return undefined
    }

    public getMousePosition(event) {
        const xy = [ event.offsetX, event.offsetY ]
        const x = 2 * xy[0] / event.target.clientWidth - 1
        const y = -2 * xy[1] / event.target.clientHeight + 1
        return {x, y}
    }

    public mouseup(event) {
        if (event.button !== 0) {
            return
        }
        if (polylineToolstates.mode === 'createNew') {
            if (!event.ctrlKey) return
            const glObj = glPolylineAnnotationManager.getCurrent().highlightPointsGroup.children[0]
            if (glObj) {
                this.seletedPointsManager.addPoint(glObj.position)
            }
        } 
        // else if (polylineToolstates.mode === 'editingSelected') {
        //     // const glObj = glPolylineAnnotationManager.getCurrent().highlightPointsGroup.children[0]
        //     // if (glObj) {
        //     //     this.seletedPointsManager.addPoint(glObj.position)
        //     //     if (polylineToolstates.mode === 'editingSelected') {
        //     //         eventBus.emit(eventBus.PolylineAnnotation.Command, {
        //     //             Name: this.Name,
        //     //             command: 'addPoint',
        //     //             glObj,
        //     //         })
        //     //         this.seletedPointsManager.destroy()
        //     //     } 
        //     // }
        // }
        else {
            const rtn = this.tryToSelectLineOrPoints(event)
            if (rtn) {
                // this.setMode('editingSelected')
                this.setMode('selected')
                // this.attachTransformControl(rtn)
            }
        }
    }

    private isEditingLine() {
        return glPolylineAnnotationManager.getCurrent().getSelectedGlLines().length > 0
    }

    private attachTransformControl(glObject) {
        if ( glObject !== this.transformControl.object ) {
            this.transformControl.enabled = true
            this.transformControl.attach(glObject)
            eventBus.emit(eventBus.pcEditor.TransformControls.ObjectChange, glObject)
            eventBus.emit(eventBus.pcEditor.Gl.Updated)
        }
    }

    private detachTransformControl() {
        if (this.transformControl) {
            this.transformControl?.detach()
            this.transformControl?.removeEventListener('dragging-changed', this.ontransformControlDraggingChanged)
            eventBus.emit(eventBus.pcEditor.Gl.Updated)
        }
    }

    public mousemove(event) {
        if (!event.ctrlKey) {
            return
        }
        // this.pointer.x = ( event.clientX / appLayout.editor.width ) * 2 - 1
        // this.pointer.y = - (event.clientY / appLayout.editor.height) * 2 + 1
        const {x, y} = this.getMousePosition(event)
        this.pointer.x = x
        this.pointer.y = y
        // this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
        // this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1
        if (polylineToolstates.mode === 'createNew') {
            // if (!event.ctrlKey) return
            // 正在选点，高亮鼠标下的点
            const pcdMeshName = glGlobals.buildPcdMeshName(jobConfig)
            const pcdMesh = glGlobals.getCurrentSensorGroup().getObjectByName(pcdMeshName)

            this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
            const pointsIntersections = this.raycaster.intersectObjects([pcdMesh], false)
            if (pointsIntersections.length > 0) {
                eventBus.emit(eventBus.PolylineAnnotation.Highlight,
                    { command: 'mousemove', glObj: pointsIntersections })
            }
        } else if (polylineToolstates.mode === 'editingSelected') {
            // 当前正在编辑选中的线
            // ...this.seletedPointsManager.glGroup.children,
            const targets = [
                ...glPolylineAnnotationManager.getCurrent().getControlPoints()]
            this.raycaster.setFromCamera(this.pointer, glGlobals.mainView.camera)
            const pointsIntersections = this.raycaster.intersectObjects(targets, false)
            if (pointsIntersections.length > 0) {
                this.attachTransformControl(pointsIntersections[0].object)
                eventBus.emit(eventBus.Common.FocusPoint, {point:pointsIntersections[0].object, source: 'line-editing-control-point'})

                eventBus.emit(eventBus.PolylineAnnotation.Highlight,
                    { command: 'mousemove', glObj: pointsIntersections })
            }
        }
    }
}

// eventBus.on(eventBus.PolylineAnnotation.LinePointsUpdated, (params) => {
eventBus.on(eventBus.PolylineAnnotation.LinePointsUpdated, (params) => {
    const { command, pointList } = params

    // if (pointList.length < 4) {
    //     return
    // }
    const vecs = new Array<THREE.Vector3>()
    pointList.forEach((point) => {
        const { x, y, z } = point
        vecs.push(new THREE.Vector3(x, y, z))
    })
    PolylineTool.getInstance().buildSpline(vecs)
    PolylineTool.getInstance().seletedPointsManager.destroy()
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
})

// eventBus.on(eventBus.pcEditor.Created, () => {
//     PolylineTool.createInstance('m-view-manipulator', 'glMainViewCanvas')
// })

export { PolylineTool }