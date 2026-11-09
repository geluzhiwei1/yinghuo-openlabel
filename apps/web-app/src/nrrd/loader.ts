/**
 * 帧体数据装载编排: 流发现 → loadFrameVolumes → initVolumeState。
 * 帧切换保留一份 LRU(上一帧), 避免来回切换重复下载解析。
 */
import { dataSeqApi } from '@/api'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'
import { jobConfig } from '@/states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import type { MedicalVolume } from './data/volumeModel'
import { loadFrameVolumes } from './api'
import { volState, initVolumeState } from './store'
import { initLabelmap, disposeLabelmap } from './seg/labelmap'
import { resetSegments, bumpSegRender } from './seg/segments'
import { resetLiveWireCache } from './seg/tools'
import { clearGrowCutSeeds } from './seg/growCut'
import { loadVolumeLabels } from './seg/segDocument'
import { initSegAlgo, disposeSegAlgo } from './seg/segAlgoClient'

const VOLUME_STREAM_HINTS = ['ct', 'pet', 'mr']

interface FrameCacheEntry {
    key: string
    base: MedicalVolume
    overlay: MedicalVolume | null
}
let lastFrame: FrameCacheEntry | null = null

/** 探测任务的体数据流: 优先 job 声明的 streams, ct/pet 命中优先, 否则目录扫描兜底 */
export async function discoverVolumeStreams(): Promise<string[]> {
    let streams: string[] = [...jobConfig.streams]
    if (!streams.length) {
        try {
            const res = await dataSeqApi.queryDataSeqStreams({ seq: jobConfig.seq })
            streams = (res?.data ?? res ?? []).filter((s: any) => typeof s === 'string')
        } catch {
            streams = []
        }
    }
    if (!streams.length && dataSeqState.streamMeta?.openlabel?.streams) {
        streams = Object.keys(dataSeqState.streamMeta.openlabel.streams)
    }
    if (!streams.length && jobConfig.stream) streams = [jobConfig.stream]

    const hinted = streams.filter(s => VOLUME_STREAM_HINTS.includes(s.toLowerCase()))
    if (hinted.length) return hinted
    return streams.slice(0, 1)
}

/** 加载指定帧(带缓存与 volState 状态驱动) */
let loadSeq = 0
export async function loadFrame(frame: number | string = jobConfig.frame): Promise<void> {
    const key = `${jobConfig.uuid}|${frame}`
    if (lastFrame?.key === key && volState.base) return

    // 慢加载(如浏览器 DICOM 装配 15-25s)期间连切帧:旧请求结果晚到会覆盖新帧,按序号丢弃过期结果
    const seq = ++loadSeq
    const stale = () => seq !== loadSeq

    volState.loading = true
    volState.loadProgress = 0
    volState.loadStage = '准备'
    try {
        const streams = await discoverVolumeStreams()
        const { base, overlay } = await loadFrameVolumes(
            frame, streams,
            (stage, frac) => {
                if (stale()) return
                volState.loadStage = stage
                volState.loadProgress = frac
            },
        )
        if (stale()) return
        // 融合任务切到未配对帧(PET 流无该帧数据)时明确告知,避免误以为 PET 丢失
        if (streams.includes('pet') && !overlay) {
            ElMessage.info(i18n.global.t('nrrd.loader.unpairedPet'))
        }
        lastFrame = { key, base, overlay }
        initVolumeState(base, overlay)
        // 标注网格 = 基(CT)网格; 帧切换丢弃旧 labelmap 后恢复已存标注
        disposeLabelmap()
        disposeSegAlgo()   // 丢弃旧帧在途的半自动请求(结果对新网格无意义)
        resetSegments()
        resetLiveWireCache()    // 代价场缓存/树随帧失效
        clearGrowCutSeeds()     // 种子层随帧丢弃
        initLabelmap(base.grid)
        initSegAlgo(base)
        volState.loadStage = '载入标注'
        try {
            const n = await loadVolumeLabels()
            if (n > 0) bumpSegRender()
        } catch (e: any) {
            volState.loadStage = ''
            console.warn('载入已存标注失败(不阻塞查看):', e?.message ?? e)
        }
    } catch (e: any) {
        if (stale()) return
        volState.loadStage = ''
        throw e
    } finally {
        if (!stale()) volState.loading = false
    }
}
