import { reactive, watch } from 'vue'
import { cloneDeep, get, set } from '@/utils/lodash'

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
  windowResized: false
})

export { labelerState }
