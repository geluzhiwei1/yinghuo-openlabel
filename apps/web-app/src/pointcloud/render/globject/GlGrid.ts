import { eventBus } from '../../event/EventBus'
import * as THREE from 'three'
import { glGlobals } from '../GlObjectsHolder'
import { watch } from 'vue'
import { pcUserSettings } from '@/pointcloud/states'

class GlGridHelper extends THREE.LineSegments {

	constructor( size = 10, divisions = 10, color1 = 0x444444, color2 = 0x888888 ) {

		color1 = new THREE.Color( color1 );
		color2 = new THREE.Color( color2 );

		const center = divisions / 2;
		const step = size / divisions;
		const halfSize = size / 2;

		const vertices = [], colors = [];

		for ( let i = 0, j = 0, k = - halfSize; i <= divisions; i ++, k += step ) {

			vertices.push( - halfSize, 0, k, halfSize, 0, k );
			vertices.push( k, 0, - halfSize, k, 0, halfSize );

			const color = i === center ? color1 : color2;

			color.toArray( colors, j ); j += 3;
			color.toArray( colors, j ); j += 3;
			color.toArray( colors, j ); j += 3;
			color.toArray( colors, j ); j += 3;

		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

        // const material = new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false });
        const material = new THREE.LineDashedMaterial( {vertexColors: true, toneMapped: false ,dashSize: 0.3, gapSize: 0.5, linewidth:1} )

		super( geometry, material );
	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}

const moveGrid = (grid) => {
	const currentFrameGroup: THREE.Group = glGlobals.getCurrentEgoGroup()
	const t = new THREE.Vector3()
	const q = new THREE.Quaternion()
	const s = new THREE.Vector3()
	currentFrameGroup.matrix.decompose(t, q, s)

	grid.position.x = t.x
	grid.position.y = t.y
	grid.position.z = t.z - 2
	
	grid.matrixWorldNeedsUpdate = true

	eventBus.emit(eventBus.pcEditor.Gl.Updated)
}

eventBus.on(eventBus.pcEditor.Inited, () => {
	const scene = glGlobals.scene
	
	const objName = "groundGrid"
	scene.getObjectByName(objName)?.remove().dispose()

	const grid = new GlGridHelper(200, 20, new THREE.Color("rgb(0, 155, 0)"), 0x808080)
    grid.name = objName
    grid.computeLineDistances()
	grid.rotateX(90 * Math.PI / 180)
	
	scene.add(grid)
	eventBus.emit(eventBus.pcEditor.Gl.Updated)
    
	eventBus.on(eventBus.SeqData.FrameChanged, (params) => {
		moveGrid(grid)
	})

	watch(() => pcUserSettings.value.setting.grid.visible,
		(newValue, oldValue) => {
		  if (newValue !== oldValue) {
			grid.visible = pcUserSettings.value.setting.grid.visible
		  }
		}, { immediate: true }
	  )
})
