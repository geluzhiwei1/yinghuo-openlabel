import { eventBus } from '../../event/EventBus'
import * as THREE from 'three'
import _ from 'lodash'
import { glGlobals } from '../GlObjectsHolder'
import { createGlTextObj, renderDiv } from '../DivRender'
import { pySeqData } from '../../api'
import { jobConfig } from '@/states/job-config'
import { watch } from 'vue'
import { dataSeqState } from '@/states/DataSeqState'

class SensorAxes extends THREE.LineSegments {

	constructor(size:number[]) {
		const vertices = [
			0, 0, 0,	size[0], 0, 0,
			0, 0, 0,	0, size[1], 0,
			0, 0, 0,	0, 0, size[2]
		];
		const colors = [
			1, 0, 0,	1, 0, 0,
			0, 1, 0,	0, 1, 0,
			0, 0, 1,	0, 0, 1
        ]

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute(vertices, 3 ) )
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

        // vertexColors 线条材质是否使用顶点颜色
		const material = new THREE.LineBasicMaterial( { vertexColors: true, toneMapped: false } );
		super( geometry, material );
	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}

const moveObj = (objGroup:THREE.Group) => {
    const currentFrameGroup = glGlobals.getCurrentEgoGroup()
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    currentFrameGroup.matrix.decompose(t, q, s)

    objGroup.position.x = t.x
    objGroup.position.y = t.y
    objGroup.position.z = t.z

    eventBus.emit(eventBus.pcEditor.Gl.Updated)
}

// commonChannel.sub(commonChannel.Events.DataLoaded, () => {
// eventBus.on(eventBus.SeqData.Loaded, async () => {
watch(() => dataSeqState.seqMeta, async () => {


	const scene = glGlobals.scene
	
    const currentMeta = dataSeqState.seqMeta
    // await pySeqData.get_seq_meta({
    //     ...jobConfig,
    // })//.toJs({dict_converter : Object.fromEntries})
    // const currentMeta = res.data

	const objName = "SensorAxes"
    scene.getObjectByName(objName)?.remove().dispose()
    
    const objGroup = new THREE.Group()
    objGroup.name = objName
    _.forIn(currentMeta.openlabel.coordinate_systems, (obj, key) => {
        // coos.push({
        //   id: key,
        //   type: obj.type,
        //   parent: obj.parent,
        //   pose_wrt_parent: obj.pose_wrt_parent?.matrix4x4,
        // })
        if ('base' === obj.parent) {
            const pose_wrt_parent = obj.pose_wrt_parent.matrix4x4
            const T = new THREE.Matrix4().set(...pose_wrt_parent)
            const sensorAxis = new SensorAxes([0.3, 0.3, 0.3])
            sensorAxis.computeLineDistances()
            sensorAxis.matrix.copy(T)
            sensorAxis.matrixAutoUpdate = false

            // text
            const t = createGlTextObj(new THREE.Vector3().setFromMatrixPosition(T), key,
                "background-color:transparent;")
            objGroup.add(t)
            objGroup.add(sensorAxis)
        }
    })
    const sensorAxis = new SensorAxes([1, 1, 1])
    const t = createGlTextObj(new THREE.Vector3().set(0,0,0), 'ego', "background-color:transparent;")
    objGroup.add(t)
    objGroup.add(sensorAxis)
    scene.add(objGroup)
    eventBus.emit(eventBus.pcEditor.Gl.Updated)

    eventBus.on(eventBus.SeqData.FrameChanged, () => {
        moveObj(objGroup)
    })
})
