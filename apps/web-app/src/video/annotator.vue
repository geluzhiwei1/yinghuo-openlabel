<template>
  <div id="mainPanelContainer" @contextmenu.prevent.capture :style="{ height: canvaPanel.height_px + 'px' }">
    <el-row>
      <el-col :span="24">
        <div id="imageAnnoContainer" style="position:absolute;">
          <VideoPlayer v-if="jobConfig.mission === Mission.VideoEvents"></VideoPlayer>
        </div>
      </el-col>
    </el-row>
  </div>
  <ImageWaterfallDlg></ImageWaterfallDlg>
</template>

<script lang="tsx" setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElRow, ElCol, ElMessage, ElMessageBox } from 'element-plus'
import { ElLoading } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { globalStates } from '@/states'
import { commonChannel } from '@/video/channel'
import ImageWaterfallDlg from './panels/datas/ImageWaterfallDlg.vue'
import { messages } from '@/states'
import { userAuth } from '@/states/UserState'
import { fileTypes, openFilesFromDir, pathBlobMap } from '@/states/LocalFiles'
import { jobConfig } from '@/states/job-config'
import { canvaPanel } from '@/states/UiState'
import { dataSeqState } from '@/states/DataSeqState'
import _ from 'lodash'
import { Mission } from '@/constants'
import VideoPlayer from './video-player.vue'
import { VideoAnnotator, toolStates as videoAnnotatorStates } from './tools/video-annotator'
import { Toolsets } from './Toolsets'

const { t } = useI18n()

const doVideo = (img_uri: string) => {
  videoAnnotatorStates.player.src = img_uri
  videoAnnotatorStates.player.title = img_uri

  commonChannel.pub(commonChannel.Events.VideoLoaded, { state: true })
}

const doImage = (img_uri: string) => {
  const imgNode = new Image()
  const loadingInstance = ElLoading.service({
    lock: true,
    text: t('video.loading', { uri: img_uri }),
    background: 'rgba(0, 0, 0, 0.7)',
  })
  imgNode.addEventListener("load", () => {
    globalStates.toolsets!.get('imageCanvas').setImage(imgNode)
    globalStates.toolsets!.render()
    loadingInstance.close()
    // statusBar.info = `Width: ${imgNode.width} height: ${imgNode.height}`
    // statusBar.log = `Loaded ${img_uri}`
    commonChannel.pub(commonChannel.Events.ImageLoaded, { state: true })
    globalStates.image.imageDataLoaded += 1
  })

  imgNode.addEventListener("error", () => {
    commonChannel.pub(commonChannel.Events.ImageLoaded, { state: false })
    loadingInstance.close()
    messages.lastError = t('video.loadingError', { uri: img_uri })
    globalStates.image.imageDataError += 1
  })

  imgNode.crossOrigin = 'anonymous'
  if (jobConfig.data_source === 'localImage') {
    imgNode.src = URL.createObjectURL(pathBlobMap.get(img_uri))
  } else {
    imgNode.src = `${img_uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
  }
  // statusBar.log = `Loading ${img_uri}`
}

const doChangeImage = (img_uri: string) => {
  globalStates.image.beforeLoadImage += 1
  switch (jobConfig.mission) {
    case Mission.VideoEvents:
      // 本地数据
      if (jobConfig.data_source === 'localImage') {
        img_uri = URL.createObjectURL(pathBlobMap.get(img_uri))
      } else {
        img_uri = `${img_uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
      }
      doVideo(img_uri)
      break
    default:
      doImage(img_uri)
      break
  }
  globalStates.image.afterLoadImage += 1
}

watch(
  [() => jobConfig.frame, ()=>dataSeqState.streamMeta],
  (newVal, oldVal) => {
    const img_uri = _.get(
      dataSeqState.streamMeta,
      `openlabel.frames.${newVal[0]}.frame_properties.uri`,
      ''
    )
    if ('' !== img_uri) {
      globalStates.current_data.image_uri = img_uri
    }
  }
)

watch([() => dataSeqState.loaded,
() => globalStates.current_data.image_uri], (newVal, oldVal) => {
  // 都初始化了，再加载数据
  if (newVal[0] && newVal[1]) {
    globalStates.doClearCanvas += 1
    // 加载图像
    doChangeImage(newVal[1])
    // 加载标注
    commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'load-annotation' })
  }
})

onUnmounted(() => {
})

onMounted(async () => {

  if (!document.getElementById('imageAnnoContainer')) {
    // throw new Error('container element not found')
    await nextTick()
  }

  // 初始化工具管理器
  globalStates.toolsets = new Toolsets()

  watch([() => globalStates.mainTool,
  () => globalStates.subTools,
  () => globalStates.toolsSettings
  ], (newValue, oldValue) => {
    if (newValue[0] && newValue[1] && newValue[2]) {

      // 初始化工具
      globalStates.toolsets!.init('imageAnnoContainer',
        newValue[0], newValue[1], newValue[2])

      // resize
      watch([() => canvaPanel.height_px, () => canvaPanel.width_px],
        () => {
          globalStates.toolsets!.resize(canvaPanel.width_px, canvaPanel.height_px)
        },
        { immediate: true }
      )
    }
  })

  watch(
    () => jobConfig.mission,
    (newVal, oldVal) => {
      if (!newVal || newVal === oldVal) return
      switch (newVal) {
        case Mission.ObjectBBox2d:
          globalStates.mainTool = 'bboxAnnotater'
          globalStates.subTool = ''
          break
        case Mission.ObjectRBBox2d:
          globalStates.mainTool = 'bboxAnnotater'
          globalStates.subTool = ''
          break
        case Mission.Semantic2d:
          globalStates.mainTool = 'polylineAnnotater'
          globalStates.subTool = ''
          break
        case Mission.TrafficLine2d:
          globalStates.mainTool = 'polylineAnnotater'
          globalStates.subTool = ''
          break
        case Mission.TrafficSignal2d:
          globalStates.mainTool = 'rectTool'
          globalStates.subTool = 'rectTool'
          // labelerState.labelyTools = ['rectTool']
          break
        case Mission.TrafficSign2d:
          globalStates.mainTool = 'rectTool'
          globalStates.subTool = 'rectTool'
          // labelerState.labelyTools = ['rectTool']
          break
        case Mission.ParkingSlot2d:
          globalStates.mainTool = 'lineTool'
          globalStates.subTool = 'lineTool'
          // labelerState.labelyTools = ['polygonTool', 'lineTool']
          break
        case Mission.VideoEvents:
          globalStates.mainTool = 'videoAnnotator'
          globalStates.mainAnnoater = VideoAnnotator.getInstance()
          break
        default:
          break
      }
    },
    { deep: true, immediate: true }
  )
})

</script>
