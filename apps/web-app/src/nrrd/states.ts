import { reactive, watch } from 'vue'
import { metaApi } from '@/api'
import _ from 'lodash'
import { jobConfig } from '../states/job-config'
import { Mission } from '@/constants'
// import { globalStates } from '@/states'
import { useStorage } from '@vueuse/core'

const labelerState = reactive({
    currentMission: '', // aabb2d
    // currentTool: '', // rectTool
    // currentSubTool: '',
    lastSubTool: '',
    labelyTools: ['polygonTool', 'segmentByRectTool', 'segmentByPoints', 'lineTool', 'rectTool'],
    labelyMissions: ['object2d', 'semantic2d'],
    annotationEngine: null,
    defaultClassName: '', // 标注工具默认类别
    pre_seq: {
      seq: '',
      stream: '',
      frame: -1,
      coordinate_system: ''
    },
    windowResized: false,
  })

  const globalStates = reactive({
    mainAnnoater: {} as any,
    mainTool: '', // rectTool
    /**
     * 当前正在使用的子工具
     */
    subTool: '',
    /**
     * 最后使用的子工具 
     */
    lastSubTool: '',
    /**
     * 可选子工具
     */
    subTools: [] as string[],
    /**
     * 工具初始设置
     */
    toolsSettings: {} as any,
    /**
     * 可选子工具：模型工具
     */
    subToolsAuto: [] as string[],
    /**
     * 当前正在标注的图片
     */
    imageObject: undefined as fabric.Image | undefined,
    /**
     * 清除帧数据 
     */
    doClearCanvas: 0,
    /**
     * 用户是否关注在本工具
     */
    listenHotkeys: 1,
    current_data: {
        image_uri: '',
    },
    toolsInited: false,
    /**
     * 标签数据已经加载 
     */
    annoDataLoaded: 0,
    /**
     * 图像数据已经加载 
     */
    imageDataLoaded: 0,
})


const pcSettings = useStorage(
  'yh-pc-setting-anno',
  {
    setting: {
      pointSize: 2,
      pointBrightness: 0.6,
      colorPoints: 'mono',
      colorPointsSetting: {
        field: 'intensity',
        range: [0.01, 0.3],
        colorMap: 'rainbow'
      },
      enableCircleRanges: true,
      circleRanges:[
        {
          enabled: true,
          radius: 50,
          color: [0,1,0],
          lineWidth: 2
        },
        {
          enabled: true,
          radius: 100,
          color: [0,1,0],
          lineWidth: 2
        },
        {
          enabled: true,
          radius: 150,
          color: [0,1,0],
          lineWidth: 20
        }
      ],
      enableRectRanges: true,
      rectRanges: [
        {
          enabled: true,
          dims: [200, 160, 2],
          color: [0,0,1],
          lineWidth: 1
        },
      ],
      // grid 设置
      grid: {
        visible: true,
      }
    }
  }, sessionStorage
)

export { labelerState, globalStates, pcSettings}