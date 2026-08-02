import { reactive } from "vue";

export const glObjectState = reactive({
    boxAnnoInited: false,
    pointAnnoInited: false,
    lineAnnoInited: false,
    viewsInited: false,
    layers: {
        box: 2,
        point: 3,
        line: 4,
        objLabel: {
            id: 5,
            visible: false // 是否可见
        }
    }
})