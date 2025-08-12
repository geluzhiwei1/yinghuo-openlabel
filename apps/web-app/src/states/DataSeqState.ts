import { reactive, watch } from 'vue'
import { metaApi } from '@/api'
import { jobConfig } from './job-config'
import { globalStates } from '@/states'
import _ from 'lodash'
import { fileTypes, openFilesFromDir, pathBlobMap } from './LocalFiles'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Mission } from '@/constants'
import { i18n } from '@/locales'

export const dataSeqState = reactive({
  seqMeta: null,
  streamMeta: null,
  tsToFrame: new Map<number, number>(),
  loaded: false
})

watch(
  () => jobConfig.seq,
  (newVal, oldVal) => {
    if (newVal === oldVal) {
      return
    }
    metaApi.getCurrentSeqMeta().then((res) => {
      dataSeqState.seqMeta = res.data
    })
  }
)

watch(
  () => jobConfig.inited,
  async (newVal, oldVal) => {
    if (newVal === oldVal) {
      return
    }
    // metaApi.getCurrentStreamMeta().then((res) => {
    //     dataSeqState.streamMeta = res.data
    //     // TO 0
    //     // jobConfig.frame = 0
    //     dataSeqState.tsToFrame.clear()
    //     _.forEach(res.data.openlabel.frames, (value, key) => {
    //         dataSeqState.tsToFrame.set(value.frame_properties.timestamp, parseInt(key))
    //     })
    // })

    const res = await metaApi.getCurrentStreamMeta()
    dataSeqState.streamMeta = res.data
    dataSeqState.tsToFrame.clear()
    if (res.data.openlabel) {
      _.forEach(res.data.openlabel.frames, (value, key) => {
        dataSeqState.tsToFrame.set(parseInt(key), value.frame_properties.timestamp)
      })
    }

    if (jobConfig.data_source === 'localImage') {
      ElMessageBox.alert(
        i18n.global.t('states.dataSeqState.alert.message', { stream: jobConfig.stream }),
        i18n.global.t('states.dataSeqState.alert.title'),
        {
          confirmButtonText: i18n.global.t('states.dataSeqState.alert.confirmButtonText'),
          callback: (action: Action) => {
            let fileExts = fileTypes.images
            switch (jobConfig.mission) {
              case Mission.ObjectBBox3d:
              case Mission.PcSemantic3d:
              case Mission.PcPolyline3d:
                fileExts = fileTypes.pointcloud
                break
              case Mission.VideoEvents:
                fileExts = fileTypes.videos
                break
              default:
                fileExts = fileTypes.images
                break
            }
            openFilesFromDir({ fileExts })
              .then((data) => {
                const { filePaths, blobs } = data
                if (filePaths.length === 0) {
                  ElMessage.warning(i18n.global.t('states.dataSeqState.messages.fileNotFound', { fileExts: fileExts.join(', ') }))
                  return
                }
                for (let i = 0; i < filePaths.length; i++) {
                  pathBlobMap.set(filePaths[i], blobs[i])
                }

                dataSeqState.loaded = true
              })
              .catch((err) => {
                ElMessage.error(i18n.global.t('states.dataSeqState.messages.exception', { err: err }))
              })
          }
        }
      )
    } else {
      dataSeqState.loaded = true
    }
  }
)

watch(
  () => dataSeqState.streamMeta,
  (newVal) => {
    const uri = _.get(newVal, `openlabel.frames.${jobConfig.frame}.frame_properties.uri`, '')
    if ('' !== uri) {
      globalStates.current_data.image_uri = uri
    }
  }
)
