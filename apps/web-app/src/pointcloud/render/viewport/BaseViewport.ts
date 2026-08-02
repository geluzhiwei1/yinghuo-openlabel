import { Vision } from '..';
import { ViewPort } from "./Viewport";
import * as THREE from 'three'


import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'


export class MainViewPort extends ViewPort {
    control: OrbitControls;

    constructor(public vision: Vision, public bg: number = 0x4a044e ) {

        
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

        camera.position.set(100, 100, 100)
        super(vision, camera, bg)

        const observer = new ResizeObserver(this.resize.bind(this));

        observer.observe(this.vision.ele)

        this.control = new OrbitControls(camera, this.vision.renderer.domElement)

        this.resize()
    }

    resize () {
        const { width, height } = this.vision.ele.getBoundingClientRect();
        (this.camera as THREE.PerspectiveCamera).aspect = width / height
        this.setWindow(new THREE.Vector4(0, 0, width, height))
    }

    render () {
        this.control.update()
        super.render()
    }


    

}