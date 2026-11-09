import { reactive, watch } from 'vue'
import { metaApi } from '@/api'
import { jobConfig } from './job-config'
import { globalStates } from '@/states'
import _ from 'lodash'
import { fileTypes, openFilesFromDir, pathBlobMap } from './LocalFiles'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Action } from 'element-plus'
import { Mission } from '@/constants'
import { resolveDicomDir, dicomLocalState } from './DicomLocal'

export const dataSeqState = reactive({
    seqMeta: null,
    streamMeta: null,
    tsToFrame: new Map<number, number>(),
    loaded: false
})

watch(() => jobConfig.seq, (newVal, oldVal) => {
    if (newVal === oldVal) {
        return
    }
    metaApi.getCurrentSeqMeta().then((res) => {
        dataSeqState.seqMeta = res.data
    })
})

watch(() => jobConfig.inited, async (newVal, oldVal) => {
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
        const isDicom = jobConfig.dicom_local
        ElMessageBox.alert(
            isDicom
                ? '本任务数据是本地 DICOM 目录，请重新选择创建任务时的数据文件夹（本操作不会上传数据文件）。'
                : `本任务数据在您的计算机上，请选择文件夹：${jobConfig.stream}。本操作不会上传数据文件。`,
            '提示', {
            confirmButtonText: '选择数据文件夹',
            callback: (action: Action) => {
                let fileExts = fileTypes.images
                if (isDicom) {
                    fileExts = []                  // DICOM 靠魔数嗅探,不过滤扩展名
                } else {
                    switch (jobConfig.mission) {
                        case Mission.ObjectBBox3d:
                        case Mission.PcSemantic3d:
                        case Mission.PcPolyline3d:
                            fileExts = fileTypes.pointcloud
                            break
                        case Mission.VideoEvents:
                            fileExts = fileTypes.videos
                            break
                        case Mission.VolumeSegment3d:
                            fileExts = fileTypes.volumes
                            break
                        default:
                            fileExts = fileTypes.images
                            break
                    }
                }
                openFilesFromDir({ fileExts })
                    .then(async (data) => {
                        const { filePaths, blobs } = data
                        if (blobs.length === 0) {
                            ElMessage.warning('找不到文件, 请重新选择')
                            return
                        }
                        if (isDicom) {
                            const loading = ElMessage({
                                message: `正在解析 DICOM 头 0/${blobs.length} …`,
                                type: 'info',
                                duration: 0,
                            })
                            const tick = setInterval(() => {
                                loading.message = `正在解析 DICOM 头 ${dicomLocalState.read}/${dicomLocalState.total} …`
                            }, 300)
                            try {
                                const n = await resolveDicomDir(blobs)
                                if (!n) {
                                    ElMessage.warning('所选目录中没有 DICOM 文件, 请选择创建任务时的同一数据目录')
                                    return
                                }
                                ElMessage.success(`已解析 ${n} 个 DICOM 序列`)
                            } finally {
                                clearInterval(tick)
                                loading.close()
                            }
                            dataSeqState.loaded = true
                            return
                        }
                        if (filePaths.length === 0) {
                            ElMessage.warning('找不到文件: ' + fileExts.join(', ') + ', 请重新选择')
                            return
                        }
                        for (let i = 0; i < filePaths.length; i++) {
                            pathBlobMap.set(filePaths[i], blobs[i]);
                        }

                        dataSeqState.loaded = true
                    })
                    .catch((err) => {
                        ElMessage.error('异常：' + err)
                    })
            },
        })
    } else {
        dataSeqState.loaded = true
    }
})

watch(
    () => dataSeqState.streamMeta,
    (newVal) => {
        const uri = _.get(
            newVal,
            `openlabel.frames.${jobConfig.frame}.frame_properties.uri`,
            ''
        )
        if ('' !== uri) {
            globalStates.current_data.image_uri = uri
        }
    }
)
