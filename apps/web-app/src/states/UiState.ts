/**
 * UI状态: 包括UI的属性，状态等
 */
import { reactive } from 'vue'
import { cloneDeep, get, set } from '@/utils/lodash'
import { useStorage } from '@vueuse/core'

const uiState = reactive({
  ui: '',
  id: 0,
  menuBar: {
    height_px: 20,
    width_px: 1000
  },
  appDiv: {
    height_px: 800,
    width_px: 1000
  },
  mounted: false
})

const topBar = reactive({
  height_px: 0,
  width_px: 0,
  created: false,
  rectTool: {
    active: true
  },
  // currentTool: 'rectTool',
  polygonTool: {
    active: false
  },
  segmentByRectTool: {
    active: false
  }
  // labelyTools: ['polygonTool', 'segmentByRectTool', 'rectTool']
})

const appContainer = reactive({
  height_px: 0,
  width_px: 0
})

/**
 * 左侧栏
 */
export const dataPanel = useStorage(
  'yh-ui-attr-dp',
  {
    /**
     * 数据面板高度
     */
    panelHeight: 700,
    /**
     * 数据面板宽度
     */
    panelWidth: 300,
    /**
     * 标签栏1高度
     */
    panelBarHeight: 32,
    /**
     * 标签栏2高度
     */
    panelBar2Height: 24,
    panelTableHeight: 500,

    /**
     * 记录当前选择tab
     */
    tabs: {
      active: 'images'
    }
  },
  sessionStorage
)

/**
 * 右侧栏
 */
const attrPanel = useStorage(
  'yh-ui-attr-pn',
  {
    layer_index: 0,
    height_px: 0,
    width_px: 300,
    focused: false,
    zIndex: 23
  },
  sessionStorage
)
/**
 * 中间栏
 */
const mainPanel = reactive({
  layer_index: 0,
  height_px: 0,
  width_px: 0,
  focused: false,
  visible: false,
  zIndex: 23
})

/**
 * 中间栏的画布
 */
const canvaPanel = reactive({
  top_px: 0,
  left_px: 0,
  height_px: 0,
  width_px: 0
})

/**
 * 工具设置弹出窗口
 */
const toolSettingLayer = reactive({
  width_px: 350
})

const userViewLayout = reactive({
  window: {
    width_px: 0,
    height_px: 0
  },
  menuBar: {
    width_px: 0,
    height_px: 35
  },
  sidePanel: {
    width_px: 200,
    height_px: 0
  },
  contentPanel: {
    width_px: 0,
    height_px: 0
  }
})

const threeView = reactive({
  topView: { left: 1024, top: 64, height: 500, width: 280 },
  leftView: { left: 1024, top: 500, height: 400, width: 280 },
  backView: { left: 1024, top: 900, height: 300, width: 280 }
})

const statusBar = reactive({
  info: '欢迎使用',
  log: ''
})

export {
  toolSettingLayer,
  statusBar,
  topBar,
  threeView,
  canvaPanel,
  mainPanel,
  attrPanel,
  appContainer,
  uiState,
  userViewLayout
}
