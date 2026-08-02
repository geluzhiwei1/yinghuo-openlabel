import * as THREE from 'three'
import { Vision } from '..'

export class ViewPort  {


    window = new THREE.Vector4()
    constructor (public vision: Vision, public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, public bg: number = 0x4a044e) {}

    setWindow (viewPort: THREE.Vector4) {
        this.window.copy(viewPort)
    }
    render () {
        this.vision.renderer.setClearColor(this.bg, 1)
        this.vision.renderer.setScissor(this.window.x, this.window.y, this.window.z, this.window.w)
        this.vision.renderer.setViewport(this.window.x, this.window.y, this.window.z, this.window.w)
        this.vision.renderer.render(this.vision.scene, this.camera)
    }
}