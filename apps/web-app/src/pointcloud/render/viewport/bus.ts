import * as THREE from 'three'



interface EventMap {
    'x-rotate': {object?: any}
    'x-moving': {object?: any}
    'x-scaling': {object?: any}

    'y-rotate': {object?: any}
    'y-moving': {object?: any}
    'y-scaling': {object?: any}

    'z-rotate': {object?: any}
    'z-moving': {object?: any}
    'z-scaling': {object?: any}
}


export const e_bus = new THREE.EventDispatcher<EventMap>()