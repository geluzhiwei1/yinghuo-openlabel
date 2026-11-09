/**
 * 本地 DICOM 任务运行时状态(工作台)。
 * 独立于 pathBlobMap: 创建任务时的 dicomFrames 只存 seriesUid(机器相关路径不落库),
 * 打开工作台后用户重选目录,这里重建 seriesUid → 实例 映射,api.ts 按 uri=dicom://<uid> 装配。
 */
import { reactive } from 'vue'
import { isDicomFile, readDicomInfo } from '@/nrrd/data/dicomIO'
import type { DicomInfo } from '@/nrrd/data/dicomIO'

export const dicomFileMap = reactive(new Map<string, Blob>())       // webkitRelativePath → Blob(仅 DICOM)
export const seriesByUid = reactive(new Map<string, DicomInfo[]>()) // seriesUid → 实例列表

export const dicomLocalState = reactive({
    framesResolved: false,
    total: 0,
    read: 0,
})

/** 嗅探目录中全部 DICOM 并读头分组。返回 series 数;0 = 无 DICOM(可能选错目录)。 */
export async function resolveDicomDir(blobs: any[]): Promise<number> {
    dicomFileMap.clear()
    seriesByUid.clear()
    dicomLocalState.framesResolved = false
    dicomLocalState.total = blobs.length
    dicomLocalState.read = 0

    const dicomIdx: number[] = []
    let sniffNext = 0
    const sniffWorker = async () => {
        while (true) {
            const i = sniffNext++
            if (i >= blobs.length) return
            if (await isDicomFile(blobs[i])) dicomIdx.push(i)
            dicomLocalState.read++
        }
    }
    await Promise.all(Array.from({ length: Math.min(16, blobs.length) }, sniffWorker))

    dicomLocalState.total = dicomIdx.length
    dicomLocalState.read = 0
    const infos: DicomInfo[] = []
    let readNext = 0
    const readWorker = async () => {
        while (true) {
            const i = readNext++
            if (i >= dicomIdx.length) return
            const blob = blobs[dicomIdx[i]]
            const path = blob.webkitRelativePath || String(dicomIdx[i])
            try {
                infos.push(await readDicomInfo(blob, path))
                dicomFileMap.set(path, blob)
            } catch {
                // 单文件头损坏跳过;缺实例在装配时按投影间距警告
            }
            dicomLocalState.read++
        }
    }
    await Promise.all(Array.from({ length: Math.min(8, dicomIdx.length) }, readWorker))

    for (const inst of infos) {
        let arr = seriesByUid.get(inst.seriesUid)
        if (!arr) {
            arr = []
            seriesByUid.set(inst.seriesUid, arr)
        }
        arr.push(inst)
    }
    dicomLocalState.framesResolved = true
    return seriesByUid.size
}

export const instancesFor = (seriesUid: string): DicomInfo[] | undefined =>
    seriesUid ? seriesByUid.get(seriesUid) : undefined

export const blobFor = (info: DicomInfo): Blob | undefined => dicomFileMap.get(info.path)
