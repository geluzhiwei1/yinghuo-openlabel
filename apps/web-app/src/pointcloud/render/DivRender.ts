import * as THREE from 'three'
import _ from 'lodash'
// import { CSS2DRenderer, CSS2DObject } from '../libs/CSS2DRenderer'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { glObjectState } from '../states'

function transPosition(position, camera) {
    const vector = position.project(camera)
    const halfWidth = window.innerWidth / 2,
        halfHeight = window.innerHeight / 2
    return {
        x: Math.round(vector.x * halfWidth + halfWidth),
        y: Math.round(-vector.y * halfHeight + halfHeight)
    };
}

const renderDiv = (camera:THREE.Camera, position: THREE.Vector3, divId: string) => { 
    if (_.isEmpty(divId) || _.isEmpty(position)) {
        return
    }

    // var position = new THREE.Vector3(2, 2, 2);
    const windowPosition = transPosition(position, camera)
    const left = windowPosition.x
    const top = windowPosition.y
    const div = document.getElementById(divId)
    div.style.display = ""
    div.style.left = left + 'px'
    div.style.top = top + 'px'
    div.style.position = 'absolute'
}

const createGlTextObj = (position: THREE.Vector3 | [], text: string, cssText:string) => {
    const div = document.createElement('div')
    div.textContent = text
    // const button = document.createElement('button');
    // button.textContent = 'Click me';
    // button.addEventListener('click', () => {
    //     alert('按钮被点击了！');
    // })
    // div.appendChild(button);

    if (_.isEmpty(cssText)) {
        div.style.cssText = cssText
    }
    div.style.backgroundColor = 'transparent'

    if (_.isArray(position)) {
        position = new THREE.Vector3(position[0], position[1], position[2])
    }
    
    const labelObj = new CSS2DObject(div)
    labelObj.position.copy(position)
    labelObj.layers.set( glObjectState.layers.objLabel.id );

    return labelObj
}

export { renderDiv, createGlTextObj}