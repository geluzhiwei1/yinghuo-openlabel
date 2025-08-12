/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年6月25日 17:12:55
 * @date 甲辰 [龙] 年 五月二十
 */

import { reactive } from 'vue'
import { number } from 'vue-types'

export const messages = reactive({
  lastDebug: '',
  lastLog: '',
  lastFailed: '',
  lastSuccess: '',
  lastException: '',
  lastError: '',
  lastInfo: ''
})

export const copyCache = reactive({
  datas: [],
  fromFrame: number,
  toFrame: number
})

/**
 * 全局共享状态
 */
export const globalStates = reactive({
  lastWorking: 'free',
  working: 'free',
  /**
   * 当前主标注器
   */
  mainAnnoater: {} as any,
  mainTool: undefined as string | undefined, // rectTool
  toolsets: undefined as any, // Toolsets
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
  doClearCanvas: 0 as number,
  /**
   * 已经清除帧数据，可以加载新数据
   */
  afterClearCanvas: 1 as number,

  /**
   * 用户是否关注在本工具
   */
  listenHotkeys: 1,
  current_data: {
    image_uri: ''
  },
  /** 主工具初始化完成 */
  toolsInited: false,

  anno: {
    /**
     * 在加载标签数据之前，会触发这个事件
     */
    beforeLoadAnno: 0,
    /**
     * 在加载标签数据之后，会触发这个事件
     */
    afterLoadAnno: 0,

    /**
     * 标签数据已经成功加载
     */
    annoDataLoaded: 0
  },
  image: {
    /**
     * 在加载图片之前，会触发这个事件
     */
    beforeLoadImage: 0,
    /**
     * 在成功加载图片之后，会触发这个事件
     */
    imageDataLoaded: 0,
    /**
     * 加载异常
     */
    imageDataError: 0,
    /**
     * 在加载图片，会触发这个事件
     */
    afterLoadImage: 0
  },
  /**
   * 标签数据已经成功加载
   */
  annoDataLoaded: 0
})
