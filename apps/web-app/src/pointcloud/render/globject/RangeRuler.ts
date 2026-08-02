import { eventBus } from '../../event/EventBus'
import { watch } from 'vue'
import * as THREE from 'three'
import { glGlobals } from '../GlObjectsHolder'
import { pcUserSettings } from '@/pointcloud/states'
import { jobConfig } from '@/states/job-config'

const createCircle = (radius:number, color:number[], lineWidth:number) => {
    const points = []
    for(let i = 0; i <= 360; i++){
        points.push(Math.sin(i*(Math.PI/180))*radius, Math.cos(i*(Math.PI/180))*radius, -1.0);
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    
    const c = new THREE.Color()
    const [r,g,b] = color
    c.setRGB(r,g,b)
    const material = new THREE.LineBasicMaterial({
        color: c.getHex(),
        linewidth: lineWidth
    })
    // const material = new THREE.LineDashedMaterial( { color: 0xffaa00, dashSize: 3, gapSize: 1 } ) 
    const lineSegments = new THREE.LineSegments( geometry, material);
    lineSegments.computeLineDistances();
    return lineSegments;
}

const createBox = (dims:number[], color:number[], lineWidth:number) => {
    let [width,height,depth] = dims
    width = width * 0.5,
    height = height * 0.5,
    depth = depth * 0.5;
    const geometry = new THREE.BufferGeometry();
    const position = [];

    position.push(
        - width, - height, - depth,
        - width, height, - depth,

        - width, height, - depth,
        width, height, - depth,

        width, height, - depth,
        width, - height, - depth,

        width, - height, - depth,
        - width, - height, - depth,

        - width, - height, depth,
        - width, height, depth,

        - width, height, depth,
        width, height, depth,

        width, height, depth,
        width, - height, depth,

        width, - height, depth,
        - width, - height, depth,

        - width, - height, - depth,
        - width, - height, depth,

        - width, height, - depth,
        - width, height, depth,

        width, height, - depth,
        width, height, depth,

        width, - height, - depth,
        width, - height, depth
     );

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    const c = new THREE.Color()
    const [r,g,b] = color
    c.setRGB(r, g, b)
    
    const lineSegments = new THREE.LineSegments( geometry, new THREE.LineDashedMaterial( { color: c.getHex(), dashSize: 3, gapSize: 1 ,linewidth: lineWidth} ) );
    lineSegments.computeLineDistances();
    return lineSegments;
}

const moveObj = (objGroup:THREE.Group) => {
    const t = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    glGlobals.getCurrentEgoGroup().matrix.decompose(t, q, s)

    objGroup.position.x = t.x
    objGroup.position.y = t.y
    objGroup.position.z = t.z
    objGroup.matrixWorldNeedsUpdate = true

    eventBus.emit(eventBus.pcEditor.Gl.Updated)
}

const updateVisible = (rangeGroup:THREE.Group) => {
    let i = 0
    for (; i < pcUserSettings.value.setting.circleRanges.length; i++) {
        rangeGroup.children[i].visible = pcUserSettings.value.setting.circleRanges[i].enabled
    }
    for (let j = i; j < i + pcUserSettings.value.setting.rectRanges.length; j++) {
        rangeGroup.children[j].visible = pcUserSettings.value.setting.rectRanges[j - i].enabled
    }
}

eventBus.on(eventBus.pcEditor.Inited, () => {
    const scene = glGlobals.scene
    const objName = "rangeRefer"

    // 如果有，移除
    let rangeGroup = scene.getObjectByName(objName)
    if (rangeGroup) {
        scene.remove(rangeGroup)
        rangeGroup.dispose()
        rangeGroup = null
    }

    rangeGroup = new THREE.Group()
    rangeGroup.name = objName
    rangeGroup.userData = { 'frame': jobConfig.frame }
    pcUserSettings.value.setting.circleRanges.forEach((item) => {
        rangeGroup.add(createCircle(item.radius, item.color, item.lineWidth))
        rangeGroup.children[rangeGroup.children.length - 1].visible = item.enabled
    })
    pcUserSettings.value.setting.rectRanges.forEach((item) => {
        // if (item.enabled) {
            rangeGroup.add(createBox(item.dims, item.color, item.lineWidth))
        // }
    })
    scene.add(rangeGroup)

    updateVisible(rangeGroup)

    eventBus.emit(eventBus.pcEditor.Gl.Updated)

    eventBus.on(eventBus.SeqData.FrameChanged, () => {
        moveObj(rangeGroup)
    })
    watch([
            () => pcUserSettings.value.setting.circleRanges,
            () => pcUserSettings.value.setting.rectRanges
        ],
        () => { 
            moveObj(rangeGroup)
            updateVisible(rangeGroup)
        },
        { deep: true }
    )
})
