import { ViewPort } from "./Viewport";
import * as THREE from 'three'

import { fabric } from 'fabric'

import { XYZwidth, XYZheight } from './const'
// import { Vision } from "..";
import { e_bus } from './bus'



let prev_position: [number, number], prev_scale: [number, number], prev_rotate: number

export class XViewport extends ViewPort {



    positive = 1

    fab: fabric.Canvas;

    object: THREE.Object3D | null = null
    mask: fabric.Rect;
    v3_x_dir = new THREE.Vector3(1, 0, 0);
    v3_y_dir = new THREE.Vector3(0, 1, 0);
    v3_z_dir = new THREE.Vector3(0, 0, 1);
    negetiveDOM: HTMLSpanElement;
    zoom: number = 20;

    constructor(parentNode:HTMLDivElement, public bg: number = 0x4a044e) {
        const camera = new THREE.OrthographicCamera(-XYZwidth / 2, XYZwidth / 2, XYZheight / 2, -XYZheight / 2, 0.01, 2000)
        super(vision, camera, bg)

        this.updateCamera()
        
        const canvas = document.createElement('canvas')
        this.fab = new fabric.Canvas(canvas, { selection: false })

        this.fab.setWidth(XYZwidth)
        this.fab.setHeight(XYZheight)
        const dom = canvas.parentNode as HTMLDivElement
        dom.style.position = 'absolute'
        dom.style.top = '20px'
        dom.style.right = '20px'

        parentNode.appendChild(dom)

        const rect = this.mask = new fabric.Rect({ width: 1, height: 1, fill: '#ffff00', originX: 'center', opacity: 0.3, originY: 'center', centeredScaling: false})
        rect.visible = false
        this.fab.add(rect)
        rect.viewportCenter()

        dom.addEventListener('wheel', this._wheelHanlder)

        {
            const negetiveDOM = this.negetiveDOM = document.createElement('span')
            negetiveDOM.innerHTML = '左'
            negetiveDOM.style.display = 'inline-block'
            negetiveDOM.style.width = '24px'
            negetiveDOM.style.height = '24px'
            negetiveDOM.style.position = 'absolute'
            negetiveDOM.style.right = '10px'
            negetiveDOM.style.top = '10px'
            negetiveDOM.style.backgroundColor = '#000000'
            negetiveDOM.style.color = '#ffffff'
            negetiveDOM.style.fontSize = '14px'
            negetiveDOM.style.lineHeight = '24px'
            negetiveDOM.style.textAlign = 'center'
            negetiveDOM.style.cursor = 'pointer'

            negetiveDOM.addEventListener('click', this.toggleDir)

            this.fab.getElement().parentNode?.appendChild(negetiveDOM)
        }







        this.fab.on('before:transform', this._beforeTransform)
        this.fab.on('object:moving', this._movingHandler)
        this.fab.on('object:scaling', this._scalingHanler)
        this.fab.on('object:rotating', this._rotateHandler)


        this.vision.event.addEventListener('pick', this.viewUpdate.bind(this))

        e_bus.addEventListener('z-rotate', this.viewUpdate.bind(this))
        e_bus.addEventListener('y-rotate', this.viewUpdate.bind(this))

        e_bus.addEventListener('z-moving', this.viewUpdate.bind(this))
        e_bus.addEventListener('y-moving', this.viewUpdate.bind(this))

        e_bus.addEventListener('z-scaling', this.viewUpdate.bind(this))
        e_bus.addEventListener('y-scaling', this.viewUpdate.bind(this))






    }

    _wheelHanlder = (e: WheelEvent) => {

        this.zoom += e.wheelDelta * 0.01
        this.zoom = Math.max(0.1, Math.min(this.zoom, 100))

        this.updateCamera()
        this.updateControl()
    }

    _beforeTransform = (e: fabric.IEvent) => {
        prev_rotate = e.transform!.target!.angle!
        prev_scale = [e.transform!.target!.scaleX!, e.transform!.target!.scaleY!]
        prev_position = [e.transform!.target!.left!, e.transform!.target!.top!]
    }

    _movingHandler = (e: fabric.IEvent) => {
        if (e.target) {
            if (!prev_position) {
                prev_position = [e.target.left!, e.target.top!]
            }
            const deltaX = (e.target.left! - prev_position[0]) / this.fab.viewportTransform![0]
            const deltaY = (e.target.top! - prev_position[1]) / this.fab.viewportTransform![0]


            const camera = this.camera as THREE.OrthographicCamera

            const offsetX = deltaX * (camera.right - camera.left) / camera.zoom / XYZwidth
            const offsetY = deltaY * (camera.top - camera.bottom) / camera.zoom / XYZheight
            


            const v3 = new THREE.Vector3(0, offsetY * -1, offsetX * -1 * this.positive)

            const mt4 = new THREE.Matrix4()
            mt4.makeRotationX(e.target.angle! / -180 * Math.PI * this.positive)

            v3.applyMatrix4(mt4.invert())

            const qu = new THREE.Quaternion()

            this.vision.active?.matrix.decompose(new THREE.Vector3(), qu, new THREE.Vector3())
            qu.normalize()

            v3.applyQuaternion(qu)

            // this.vision.active!.position.z += offsetX * -1 * this.positive
            // this.vision.active!.position.y += offsetY * -1
            this.vision.active?.position.add(v3)

            prev_position = [e.target.left!, e.target.top!]

            e_bus.dispatchEvent({ type: 'x-moving' })
        }
    }

    _rotateHandler = (e: fabric.IEvent) => {
        const qu = new THREE.Quaternion()
        const dt = e.target!.angle! - prev_rotate

        qu.setFromAxisAngle(this.v3_x_dir.clone().normalize().multiplyScalar(this.positive), THREE.MathUtils.degToRad(-dt))
        this.vision.active?.applyQuaternion(qu)
        prev_rotate = e.target!.angle!
        e_bus.dispatchEvent({ type: 'x-rotate' })
    }

    _scalingHanler = (e: fabric.IEvent) => {
        if (e.target) {
            if (!prev_scale) {
                prev_scale = [e.target.scaleX!, e.target.scaleY!]
            }
            const deltaX = (e.target.scaleX! - prev_scale[0]) * (e.target.width!) / this.fab.viewportTransform![0]
            const deltaY = (e.target.scaleY! - prev_scale[1]) * (e.target.height!) / this.fab.viewportTransform![0]


            const camera = this.camera as THREE.OrthographicCamera

            const offsetX = deltaX * (camera.right - camera.left) / camera.zoom / XYZwidth
            const offsetY = deltaY * (camera.top - camera.bottom) / camera.zoom / XYZheight



            const cube = this.vision.active!.geometry
            const parameters = (cube as any).parameters as any;

            const { depth, height } = parameters;


            const { z: v3_scaleX, y: v3_scaleY } = this.vision.active!.scale;

            const scalex = (depth * v3_scaleX + offsetX) / depth
            const scaley = (height * v3_scaleY + offsetY) / height


            const v3 = new THREE.Vector3(0, -(e.target.top! - prev_position[1]) * (camera.right - camera.left) / camera.zoom / XYZwidth , -(e.target.left! - prev_position[0]) * this.positive * (camera.top - camera.bottom) / camera.zoom / XYZheight)


            const mt4 = new THREE.Matrix4()
            mt4.makeRotationX(e.target.angle! / -180 * Math.PI * this.positive)

            v3.applyMatrix4(mt4.invert())
            // const m3 = new THREE.Matrix3()
            // m3.setFromMatrix4(this.vision.active!.matrix)

            const quaternion = new THREE.Quaternion()

            this.vision.active!.matrix.decompose(new THREE.Vector3(), quaternion, new THREE.Vector3());

            quaternion.normalize()
            v3.applyQuaternion(quaternion)


            this.vision.active?.position.add(v3)
            // this.vision.active!.position.z += offsetX / -2
            // this.vision.active!.position.y += offsetY / -2




            this.vision.active!.scale.setZ(scalex)
            this.vision.active!.scale.setY(scaley)
            // this.updateCamera()

            // const depth = 



            prev_scale = [e.target.scaleX!, e.target.scaleY!]
            prev_position = [e.target.left!, e.target.top!]
 
            e_bus.dispatchEvent({ type: 'x-scaling' })
        }
    }

    toggleDir = () => {
        this.positive = this.positive * -1
        this.viewUpdate()
        this.negetiveDOM.innerHTML = this.positive > 0 ? '左' : '右'
    }

    disconnect() {


        this.fab.getElement().parentElement?.removeEventListener('wheel', this._wheelHanlder)

        this.negetiveDOM.removeEventListener('click', this.toggleDir)


        this.vision.event.addEventListener('pick', this.viewUpdate.bind(this))

        e_bus.removeEventListener('z-rotate', this.viewUpdate.bind(this))
        e_bus.removeEventListener('y-rotate', this.viewUpdate.bind(this))

        e_bus.removeEventListener('z-moving', this.viewUpdate.bind(this))
        e_bus.removeEventListener('y-moving', this.viewUpdate.bind(this))

        e_bus.removeEventListener('z-scaling', this.viewUpdate.bind(this))
        e_bus.removeEventListener('y-scaling', this.viewUpdate.bind(this))


        this.fab.off('before:transform', this._beforeTransform)
        this.fab.off('object:moving', this._movingHandler)
        this.fab.off('object:scaling', this._scalingHanler)
        this.fab.off('object:rotating', this._rotateHandler)
    }


    resize() {
        const { width, height } = this.vision.ele.getBoundingClientRect();
        this.setWindow(new THREE.Vector4(width - (XYZwidth + 20), height - (XYZheight + 20), XYZwidth, XYZheight))
    }


    viewUpdate () {
        this.updateBaseVector()
        this.updateCamera()
        this.updateControl()
    }


    updateBaseVector() {
        if (this.vision.active) {
            const v3_x = this.v3_x_dir = new THREE.Vector3()
            const v3_y = this.v3_y_dir = new THREE.Vector3()
            const v3_z = this.v3_z_dir = new THREE.Vector3()
            this.vision.active.matrix.extractBasis(v3_x, v3_y, v3_z)
        }
    }

    updateControl() {
        if (this.vision.active) {


            this.vision.active.updateMatrixWorld()


            const geometry = this.vision.active.geometry as THREE.BufferGeometry

            const position = geometry.getAttribute('position')

            /**
             *      -----a
             *    /     /|
             *  c-----o  |
             *  |     | /
             *  ------b
             */


            const o = new THREE.Vector3()
            o.fromBufferAttribute(position, 0)

            const a = new THREE.Vector3()
            a.fromBufferAttribute(position, 1)

            const b = new THREE.Vector3()
            b.fromBufferAttribute(position, 2)

            // const c = new THREE.Vector3()
            // c.fromBufferAttribute(geometry.attributes.position, 5)





            o.applyMatrix4(this.vision.active.matrixWorld).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix)
            a.applyMatrix4(this.vision.active.matrixWorld).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix)
            b.applyMatrix4(this.vision.active.matrixWorld).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix)




            console.log(new THREE.Vector3().subVectors(this.camera.position, this.vision.active.position))


            const maskWidth = new THREE.Vector3().subVectors(o, a).length() * (XYZwidth / 2)
            const maskHeight = new THREE.Vector3().subVectors(o, b).length() * (XYZheight / 2)


            const base = new THREE.Vector3()

            this.camera.matrixWorld.extractBasis(new THREE.Vector3(), base, new THREE.Vector3())

            const angle = this.v3_y_dir.angleTo(base)

            const v3_sign = this.v3_y_dir.clone().cross(base);

            const sign = v3_sign.dot(this.v3_x_dir.clone().multiplyScalar(this.positive)) > 0 ? 1 : -1

    

            this.mask.setOptions({
                width: maskWidth, height: maskHeight, visible: true, angle: THREE.MathUtils.radToDeg(sign * angle ),
                scaleX: 1,
                scaleY: 1,
            })
            this.mask.viewportCenter()
            this.fab.setActiveObject(this.mask)
            this.fab.requestRenderAll()

        } else {

            this.mask.setOptions({ visible: false })
            this.fab.discardActiveObject()
            this.fab.requestRenderAll()
        }
    }


    updateCamera() {
        const cameraPosition = new THREE.Vector3()

        const position = this.vision.active?.position || new THREE.Vector3()

        cameraPosition.addVectors(position, this.v3_x_dir.clone().multiplyScalar(this.positive))

        this.camera.position.copy(cameraPosition)
        // this.camera.up.copy(this.v3_y_dir)
        this.camera.lookAt(position)
        this.camera.zoom = this.zoom
        this.camera.updateProjectionMatrix()
        this.camera.updateMatrixWorld()
    }



    render() {
        super.render()

    }

}

