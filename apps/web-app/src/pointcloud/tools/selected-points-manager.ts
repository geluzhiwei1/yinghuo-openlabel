import * as THREE from 'three'
import { eventBus } from '../event/EventBus'
import _ from 'lodash'
import { OlTypeEnum } from '@/openlabel'


class SeletedPointsManager {
    private keyGlObjMap = new Map<string, THREE.Object3D>()
    private _glGroup:THREE.Group

    private highlightColor:string //

    constructor(glGroup: THREE.Group, options = {}) {
        this._glGroup = glGroup
        this.highlightColor = options?.highlightColor || '#ff0000'
    }

    get glGroup() {
        return this._glGroup
    }

    public pointsCount() {
        return this._glGroup.children.length
    }

    private pointToStringKey(point: any) {
        const {x,y,z} = point
        return _.toString(_.round(x, 3)) + _.toString(_.round(y, 3)) + _.toString(_.round(z, 3))
    }
    public update(point: THREE.Vector3) {
        const key = this.pointToStringKey(point)
        if (this.keyGlObjMap.has(key)) {
            // 删除点
            this.doRemovePoint(key, point)
        } else {
            // 增加点
            this.doAddPoint(key, point)
        }
    }

    private doAddPoint(key, point) {
        const glObj = this.createObject()
        // const worldPos = new THREE.Vector3().copy(obj.point)
        // const localPos = obj.object.worldToLocal(worldPos)
        glObj.position.copy(point)
        this.keyGlObjMap.set(key, point)

        this._glGroup.add(glObj)
        this.rend()
    }

    public addPoint(point) {
        this.doAddPoint(this.pointToStringKey(point), point)
    }

    private doRemovePoint(key, point) {
        const t = this.keyGlObjMap.get(key)
        this.keyGlObjMap.delete(key)
        this.destroyObject(t)
        this.rend()
    }

    public removePoint(point) {
        const key = this.pointToStringKey(point)
        this.doRemovePoint(key, point)
    }

    private createObject(): THREE.Object3D {
        const sphereGeometry = new THREE.SphereGeometry(0.1)
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.highlightColor).getHex()})
        const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
        mesh.userData= {
            anno: {
                // 线的控制点
                ol_type_: OlTypeEnum.Point3d
            }
        }
        return mesh
    }

    private rend() {
        eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }

    public getPoints(): THREE.Vector3[] {
        return this._glGroup.children.map(t => t.position)
    }

    public destroy(): void {
        this._glGroup.children.forEach(t => this.destroyObject(t))
        this._glGroup.clear()
    }

    private destroyObject(object: THREE.Object3D): void {
        if (!object) return
        object.material?.dispose()
        object.geometry?.dispose()
        object = null
    }

    public removeLastPoint() {
        if (this._glGroup.children.length > 0) {
            const last = this._glGroup.children[this._glGroup.children.length - 1]
            this._glGroup.remove(last)
        }
    }
}

export { SeletedPointsManager }