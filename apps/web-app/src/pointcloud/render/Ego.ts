import { eventBus } from '../event/EventBus'
import { watch } from 'vue'
import * as THREE from 'three'
import _ from 'lodash'
import { glGlobals } from './GlObjectsHolder'
import { mainAnnoStates } from '../states'
import { jobConfig } from '@/states/job-config'


class Ego {

    private checkGlGroup() {
        const framesToRender = [
            ...mainAnnoStates.auxiliaryFrames,
        ]

        const glObj: THREE.Group = glGlobals.framesGroup

        glObj.children.forEach((obj: THREE.Object3D) => {
            if (_.startsWith(obj.name, 'ego-')) {
                obj.visible = framesToRender.includes(obj.userData.frame)
            }
        })

        eventBus.emit(eventBus.pcEditor.Gl.Updated)
    }

    private init() {
        eventBus.on(eventBus.SeqData.FrameChanged, () => {
            this.checkGlGroup()
        })

        watch(
            () => mainAnnoStates.auxiliaryFrames,
            (val) => {
                this.checkGlGroup()
            },{ deep: true }
        )
    }
    
    constructor() {
        this.init()
    }
}

eventBus.on(eventBus.pcEditor.Inited, () => {
    new Ego()
})
