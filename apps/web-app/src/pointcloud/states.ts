import { reactive, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import type { BBox3d, Point3d, Polyline3d } from "@/openlabel";

const pcUserSettings = useStorage(
  'yh-pc-setting-anno',
  {
    setting: {
      pointSize: 2,
      pointBrightness: 0.6,
      colorPoints: 'mono',
      colorPointsSetting: {
        field: 'intensity',
        range: [0.01, 0.3],
        colorMap: 'jet'
      },
      enableCircleRanges: true,
      circleRanges: [
        {
          enabled: true,
          radius: 50,
          color: [0, 1, 0],
          lineWidth: 2
        },
        {
          enabled: true,
          radius: 100,
          color: [0, 1, 0],
          lineWidth: 2
        },
        {
          enabled: true,
          radius: 150,
          color: [0, 1, 0],
          lineWidth: 20
        }
      ],
      enableRectRanges: true,
      rectRanges: [
        {
          enabled: true,
          dims: [200, 160, 2],
          color: [0, 0, 1],
          lineWidth: 1
        },
      ],
      // grid 设置
      grid: {
        visible: true,
      }
    },
    tools: {
      highlightColor: 'rgb(100%,0%,0%)',
      selectedColor: 'rgb(70%,0%,0%)',
      polyline: {
        handle: {
          color: 'rgb(0%,80%,0%)',
          scale: 0.2
        },
        highlight:{
          color: 'rgb(100%,0%,0%)',
          scale: 1.5
        }
      }
    }
  }, sessionStorage
)

const mainAnnoStates = reactive({
  setting: {
    /**
     * 标注规范中的类别信息
     */
    objectTypes: ['default'] as string[], // 类别名
    /**
     * 标注规范中的类别的样式信息：颜色等
     */
    objStyles: new Map<string, any>(), // 类别样式
  },
  triger: {
    /**
     * 对象更新了，可能需要重新渲染
     */
    objectsUpdated: 0,
    /**
     * 样式更新了，可能需要重新渲染
     */
    objStylesUpdated: 0,
    /**
     * 对象tag更新了，可能需要重新渲染
     */
    objectsTagsUpdated: 0
  },
  selected: {} as BBox3d | Polyline3d | Point3d,
  defaultObjType: 'default' as string,
  rebuildByUUID: '',
  auxiliaryFrames: [], // 要显示的辅助帧
  /**
   * 将要选择的label的uid
   */
  selectingLabelUid: null as string | null 
})

export const glObjectState = reactive({
  boxAnnoInited: false,
  pointAnnoInited: false,
  lineAnnoInited: false,
  viewsInited: false,
  layers: {
      box3d: {
        id: 2,
        visible: false // 是否可见
      },
      point: 3,
      line: 4,
      objLabel: {
          id: 5,
          visible: false // 是否可见
      },
      map: {
        id: 6,
        visible: false
      },
      pc: {
        id: 7,
        visible: true
      }
  }
})

export const appLayoutStatus = reactive({
  editor: {
    height: 800,
    width: 1024,
    toolBar: { width: -1, height: -1, left: 100, top: 100 },
    toolBarSetting: { width: 0, height:0, left: -99999, top:0 },
    rightPanel: { width: 350,left: 1024 + 350, top: 64},
    imageView: { width: 250, left: 100, top: 800 },
    boxImageView: { width: 250,left: 100, top:0, height:350 },
    threeView: {
      width: 350,
      topView: { left: 1024, top: 64, height:500},
      leftView: { left: 1024, top: 500, height:400},
      backView: { left: 1024, top: 900, height:300 },
    },
    mainVis: { width: 500, left: 0, top: 0, },
  },
  imageViews: {'auto': true}
})

export { pcUserSettings, mainAnnoStates }