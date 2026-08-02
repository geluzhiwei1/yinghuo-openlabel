import { useDataState } from '../data-seq'
import { eventBus } from '../event/EventBus'
import * as THREE from 'three'
import * as MetaDataUtil from '../utils/MetaData'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { uiState } from '@/states/UiState'
import { useDark } from '@vueuse/core'
import { toRef, watch } from 'vue';
import { jobConfig } from '@/states/job-config'
import {  } from '@/pointcloud/data-seq'

const isDark = useDark()
const currentMeta = useDataState()

class GlGlobals {
    public scene: THREE.Scene
    public framesGroup: THREE.Group
    public renderer: THREE.WebGLRenderer
    // public renderer: WebGPURenderer
    public mainView: any
    public threeViews: any

    public domContainer: HTMLElement | null = null

    // public mainCamera: THREE.PerspectiveCamera

    public glCameraManager: GlCameraManager | null = null


    public getCurrentEgoGroup() {
        return this.getEgoGroup(jobConfig.frame)
    }
    public getEgoGroup(frame: number) {
        if (!this.egoFrameGroups.has(frame)) {
            this.egoFrameGroups
                .set(frame, this.buildEgoGroup(frame))
        }
        return this.egoFrameGroups.get(frame)
    }
    
    public buildPcdMeshName(options: { frame: number; ts: number } = { frame: 0, ts: 0 }) {
        const { frame, ts } = options
        return `pcd-${frame}-${ts}`
    }

    constructor() {
    }

    public labelRenderer = new CSS2DRenderer()
    public init() {
        const canvas = document.getElementById('glMainViewCanvas')!
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true })
        // this.renderer = new WebGPURenderer({ canvas, antialias: true });
        // this.renderer.setClearColor( 0x000000, 0.0 )

        this.renderer.setPixelRatio(window.devicePixelRatio)

        this.labelRenderer.domElement.style.position = 'absolute'
        this.labelRenderer.domElement.style.top = '0px'
        document.getElementById('gl-css2d-container')?.appendChild(this.labelRenderer.domElement)
        // document.body.appendChild( this.labelRenderer.domElement );
        this.onResize()

        this.scene = new THREE.Scene()
        this.framesGroup = new THREE.Group() // 持有所有的frame数据
        this.framesGroup.name = 'frames'
        this.scene.add(this.framesGroup)

        glGlobals.domContainer = document.querySelector('#gl-scene-container')
        eventBus.emit(eventBus.pcEditor.Inited)
    }

    onResize() {
        const { width_px, height_px } = uiState.appDiv
        const w = width_px - 10
        const h = height_px - 10
        this.renderer.setSize(w, h)
        this.labelRenderer.setSize(w, h)
    }

    private egoFrameGroups = new Map<number, THREE.Group>()
    private buildEgoGroup(frame: number) {
        const group = new THREE.Group()
        group.name = `ego-${frame}`
        let egoPose = MetaDataUtil.getFramePosition(currentMeta.value, frame)
        if (!egoPose) {
            egoPose = new THREE.Matrix4().identity()
        }
        group.matrix.copy(egoPose)
        group.matrixAutoUpdate = false
        group.userData.ts = frame
        group.userData.frame = frame

        // ego-xx 添加到 frames
        this.framesGroup.add(group)
        return group
    }

    // sensor group
    public getCurrentSensorGroup() {
        return this.getSensorGroup(jobConfig)
    }
    public getSensorGroup(options:any) {
        const { stream, ts, frame } = options
        const key = `sensor-${stream}-${frame}-${ts}`
        if (!this.sensorFrameGroups.has(key)) {
            this.sensorFrameGroups
                .set(key, this.buildSensorGroup({stream, ts, frame}))
        }
        return this.sensorFrameGroups.get(key)
    }
    private sensorFrameGroups = new Map<string, THREE.Group>()
    private buildSensorGroup(options:any) {
        const { stream, ts, frame } = options
        const group = new THREE.Group()
        group.name = `${stream}-${frame}-${ts}`
        const ex = MetaDataUtil.getExtrinsics(stream)

        const T = new THREE.Matrix4().identity()
        if (ex) {
            T.set(...ex)
        }
        group.matrix.premultiply(T)
        group.matrixAutoUpdate = false
        group.userData.ts = ts
        group.userData.frame = frame

        return group
    }
}

const glGlobals = new GlGlobals()
eventBus.on(eventBus.Common.WindowResized, () => {
    glGlobals.onResize()
})

eventBus.on(eventBus.pcEditor.Inited, () => {
    watch(isDark, (newVal, oldVal) => {
        if (isDark.value) {
            glGlobals.scene.background = new THREE.Color(0.01, 0.01, 0.01)
        } else {
            glGlobals.scene.background = new THREE.Color(0.95, 0.9, 0.9)
        }
        glGlobals.renderer.setClearColor(glGlobals.scene.background)
        eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }, { immediate: true })
})

export { glGlobals }