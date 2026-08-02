import { createGlobalState, useStorage  } from '@vueuse/core'
import { ref, reactive, computed } from 'vue'
import _ from 'lodash'

export const useDataState = createGlobalState(() => {
    const current_seq = reactive({
      seq: '',
      stream: '',
      frame: -1,
      ts: .0,
      coordinate_system: '',
      mission: ''
    })
    const seq_meta = ref(new Map())
    const stream_meta = ref(new Map())
  
    // actions
    function update_seq_meta(id: string, meta: {}) {
      seq_meta.value.set(id, meta)
    }
    function update_stream_meta(id: string, meta: {}) {
      stream_meta.value.set(id, meta)
    }
  
    async function getCurrentSeqMetaAsync() {
      const seq_id = current_seq.seq
      if (!seq_meta.value.has(seq_id)) {
        // 加载数据
        const params = { seq: seq_id }
        const res = await getDataSeqMeta(params)
        if (res) {
          update_seq_meta(seq_id, res)
        }
      }
      return seq_meta.value.get(seq_id)
    }
  
  function getCurrentSeqMeta() {
    const seq_id = current_seq.seq
    if (!seq_meta.value.has(seq_id)) {
      return null
    }
    return seq_meta.value.get(seq_id)
  }
  
    async function getStreamMetaAsync(seq: string, stream: string) {
      const stream_key = `${seq}_${stream}`
      if (!stream_meta.value.has(stream_key)) {
        // 加载数据
        const params = { seq, stream }
        const res = await getStreamMeta(params)
        if (res) {
          update_stream_meta(stream_key, res)
        }
      }
      return stream_meta.value.get(stream_key)
    }
  
    function getStreamMetaSync(seq: string, stream: string) {
      const stream_key = `${seq}_${stream}`
      return stream_meta.value.get(stream_key)
    }
  
  function getCameras(seq_id:string | null = null):Array<any> {
    if (_.isEmpty(seq_id)) {
      seq_id = current_seq.seq
    }
    const seqMeta = seq_meta.value.get(seq_id)
      const cams: any[] = []
      _.forIn(seqMeta.openlabel.streams, (streamObj, key) => {
        if (streamObj.type === 'camera') {
          cams.push({
            camera_id: key,
            camera_type: streamObj.type,
            group_name: _.get(streamObj, 'stream_properties.group.name', ''),
            group_value: _.get(streamObj, 'stream_properties.group.value', ''),
            camera_resolution: `${_.get(
              streamObj,
              'stream_properties.intrinsics_pinhole.width_px',
              ''
            )} x ${_.get(streamObj, 'stream_properties.intrinsics_pinhole.height_px', '')}`,
            checked: false
          })
        }
      })
    
    return cams
    }
  
    async function getCurrentStreamMeta() {
      // const stream_key = `${current_seq.seq}_${current_seq.stream}`
      return getStreamMetaAsync(current_seq.seq, current_seq.stream)
    }
  
    // 确保数据已经加载
    const currentStreamMeta = computed(() => {
      const stream_key = `${current_seq.seq}_${current_seq.stream}`
      console.assert(stream_meta.value.has(stream_key), 'data is null')
      return stream_meta.value.get(stream_key)
    })
    const currentMeta = computed(() => {
      return getCurrentSeqMeta()
    })
  

  
    return {
      current_seq,
      getCameras,
      getCurrentSeqMeta,
      getCurrentSeqMetaAsync,
      getStreamMetaSync,
      getStreamMetaAsync,
      currentMeta,
      currentStreamMeta,
      getCurrentStreamMeta,
      seq_meta
    }
})
  
export const useGlobalStore = createGlobalState(
  () => { 
    const appState = useStorage(
      'app-liadr-3d',
      {
        gui: {
          currentSize: 'default',
          theme: 'light'
        },
        autoSave: false,
        currentSize: 'default'
      },
      localStorage,
      { mergeDefaults: true }, 
    )
    return {appState}
  }
)

export const useAppState = createGlobalState(() => {
  const labelAppStatus = reactive({
    currentMission: '', // aabb2d
    currentTool: '', // rectTool
    currentSubTool: '',
    pre_seq: {
      seq: '',
      stream: '',
      frame: -1,
      coordinate_system: '',
      mission: '',
      ts: .0
    },
    windowResized: false,
    // current_data: {
    //   image_uri: '',
    //   pcd_uri: '',
    //   image_blob: null,
    // },
    auxiliaryFrames: [0,1,2,3,4],
    // editor: {
    //   pointSetting:{
    //     pointSize: 3.0,
    //     pointBrightness: 0.5
    //   }
    // }
  })

  const editorSetting = reactive({
    setting: {
      baseUrl: '',
      enablePyAPI:false,
      enableRadar: false,
      enableAuxLidar: false,
      enableDynamicGroundLevel: true,
      coordinateSystem: 'utm',
      pointSize: 2,
      pointBrightness: 0.6,
      box_opacity: 1,
      show_background: true,
      colorObject: 'category',
      theme: 'light',
      enableFilterPoints: false,
      filterPointsZ: 2.0,
      batchModeInstNumber: 20,
      batchModeSubviewSize: { width: 130, height: 450 },
      preloadNumber: 5,
      maxEmptyBoxPoints: 10,
      // edit on one box, apply to all selected boxes.
      linkEditorsInBatchMode: false,
  
      // only rotate z in 'auto/interpolate' algs
      enableAutoRotateXY: false,
      autoSave: true,
  
      autoUpdateInterpolatedBoxes: true,
  
      hideId: false,
      hideCategory: false,
  
      moveStep: 0.01, // ratio, percentage,
      rotateStep: Math.PI / 360,
  
      speedUpForRepeatedOp: 2,
  
      ignoreDistantObject: true,
      cameraGroupForContext: 'camera',
  
      /// editorCfg
  
      // disableSceneSelector: true;
      // disableFrameSelector: true;
      // disableCameraSelector: true;
      // disableFastToolbox= true;
      // disableMainView= true;
      // disableMainImageContext: true;
      // disableGrid: true;
      // disableAxis: true;
      // disableMainViewKeyDown: true;
      // projectRadarToImage: true;
      projectLidarToImage: false,
      projectBoxesToImage: true,
      autoCheckScene: false,
      enableImageAnnotation: false,
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
      ]
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
          scale: 5
        }
      }
    }
  })

  const shortcuts = reactive({
    entityCommonOp: {
      items: [{
        id:'',
        icon: '',
        name: '选中',
        shortcut: '左击',
        description: '<el-text>左键单击选中</el-text>',
        showButton: false,
        handler: () => { },
      },
      {
        id:'',
        icon: '',
        name: '切换',
        shortcut: '切换',
        description: '<el-text>按Tab键切换</el-text>',
        showButton: false,
        handler: () => { },
      },
      {
        id:'',
        icon: '',
        name: '删除',
        shortcut: '右双击',
        description: '<el-text>选中件，再右键双击</el-text>',
        showButton: false,
        handler: () => { },
      },
      {
        id:'delete',
        icon: 'ep:delete',
        name: '删除',
        shortcut: 'X',
        description: '<el-text>选中件，再按键盘X</el-text>',
        showButton: true,
        handler: () => { },
      },
      {
        id:'delete-all',
        icon: 'ep:delete-filled',
        name: '清除',
        shortcut: 'Ctrl+Shift+X',
        description: '<el-text>选中后，同时按键盘Ctrl + Shift + X</el-text>',
        showButton: true,
        handler: () => { },
      },
    ]
    },
    entityOp: {
      items: []
    }
  })

  const appLayout = reactive({
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

  const taxonomyStatus = reactive({
    currentDomain: "av2-sensor-dataset-taxonomy-30-classes_1.0.1",
    currentDomainLang: "zh-CN",
    currentClassName: "",
    defaultClassName: "",
    classSchemaMap: new Map()
  })

  return { labelAppStatus, editorSetting, shortcuts, appLayout, taxonomyStatus }
})


export const useOntologyState = createGlobalState(() => {
  const ontologyStatus = reactive({
    defaultClass: 'Un',
  })
  return { ontologyStatus }
})