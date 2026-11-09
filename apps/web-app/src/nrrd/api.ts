/**
 * 体数据获取与解析入口。
 * 数据链路: stream meta → /api/v1/b/file2/get(带 token) → 按扩展名解析 → worker 归一化。
 */
import { userAuth } from '@/states/UserState'
import { jobConfig } from '@/states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import { reqJson } from '@/api/req'
import { fileAPi } from '@/api'
import type { RawVolume, MedicalVolume, Modality } from './data/volumeModel'
import { gridAffine, intensityRange } from './data/volumeModel'
import { parseNrrd } from './data/nrrdIO'
import { parseNifti } from './data/niftiIO'
import { normalizeToAxisAlignedRAS, resampleMedicalVolume } from './data/resample'
import { pathBlobMap } from '@/states/LocalFiles'
import { instancesFor, blobFor } from '@/states/DicomLocal'
import { assembleDicomSeries } from './data/dicomAssemble'

export const VOLUME_EXTS = ['nrrd', 'nii', 'gz']

export function volumeExtOf(uri: string): string {
    const path = uri.split('?')[0].split('#')[0]
    const parts = path.split('.').map(s => s.toLowerCase())
    if (parts.length >= 3 && parts[parts.length - 2] === 'nii' && parts[parts.length - 1] === 'gz') return 'nii.gz'
    return parts[parts.length - 1] || ''
}

export function parseVolumeBytes(buf: ArrayBuffer, ext: string, modality: Modality): RawVolume {
    const sniffed = sniffVolumeExt(buf)
    if (sniffed) ext = sniffed
    if (ext === 'nrrd') return parseNrrd(buf, modality)
    if (ext === 'nii' || ext === 'nii.gz') return parseNifti(buf, modality)
    throw new Error(`不支持的体数据格式: .${ext}(支持 nrrd / nii / nii.gz)`)
}

/** 魔数嗅探, 文件名扩展名缺失/不可靠时兜底 */
export function sniffVolumeExt(buf: ArrayBuffer): string {
    if (buf.byteLength < 4) return ''
    const u8 = new Uint8Array(buf, 0, 4)
    if (u8[0] === 0x4e && u8[1] === 0x52 && u8[2] === 0x52 && u8[3] === 0x44) return 'nrrd'
    if (u8[0] === 0x1f && u8[1] === 0x8b) return 'nii.gz'
    if (buf.byteLength >= 352 && new DataView(buf).getInt32(0, true) === 348) return 'nii'
    return ''
}

/** 本地数据任务: 按 meta uri(webkitRelativePath)取 blob; 前缀不一致时按文件名兜底 */
function localBlobFor(uri: string): Blob | undefined {
    if (pathBlobMap.has(uri)) return pathBlobMap.get(uri)
    const base = uri.split('/').pop() || ''
    if (!base) return undefined
    for (const [k, b] of pathBlobMap) {
        if (k === base || k.endsWith('/' + base)) return b
    }
    return undefined
}

export async function fetchFrameBytes(frame: number | string, stream: string, uriHint = ''): Promise<{ buf: ArrayBuffer; uri: string }> {
    const frameMeta = dataSeqState.streamMeta?.openlabel?.frames?.[frame as any]
    const uri = uriHint || frameMeta?.frame_properties?.name || frameMeta?.frame_properties?.uri || ''
    if (jobConfig.data_source === 'localImage') {
        const blob = localBlobFor(uri)
        if (!blob) throw new Error(`未找到本地体数据文件: ${uri}(请刷新页面重新选择数据文件夹)`)
        return { buf: await blob.arrayBuffer(), uri }
    }
    const params = new URLSearchParams({
        token: userAuth.value.access_token,
        uuid: jobConfig.uuid,
        frame: String(frame),
        stream,
    })
    const url = dataSeqState.streamMeta?.openlabel
        ? `${fileAPi.uri2}?${params.toString()}`
        : `${uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
    if (!dataSeqState.streamMeta?.openlabel && !uri) {
        throw new Error('stream meta 未就绪, 无法定位体数据文件')
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error(`体数据下载失败: HTTP ${res.status}`)
    return { buf: await res.arrayBuffer(), uri }
}

/** worker 包装: 主线程快速路径回退(小体积直接算, 避免 worker 往返) */
export function normalizeInWorker(raw: RawVolume, onProgress?: (frac: number) => void): Promise<MedicalVolume> {
    const voxels = raw.data.length
    if (voxels <= 4 << 20) {
        // 小体积(~4M 体素)主线程直接算
        return Promise.resolve(normalizeToAxisAlignedRAS(raw, onProgress))
    }
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/resample.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (e) => {
            const msg = e.data
            if (msg.type === 'progress') onProgress?.(msg.frac)
            else if (msg.type === 'done') {
                worker.terminate()
                resolve(msg.volume as MedicalVolume)
            } else if (msg.type === 'error') {
                worker.terminate()
                reject(new Error(msg.message))
            }
        }
        worker.onerror = (err) => {
            worker.terminate()
            reject(err)
        }
        worker.postMessage({ type: 'normalize', raw }, [raw.data.buffer])
    })
}

export function resampleInWorker(
    src: MedicalVolume, target: MedicalVolume['grid'], interp: 'trilinear' | 'nn' = 'trilinear',
    onProgress?: (frac: number) => void,
): Promise<MedicalVolume> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/resample.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (e) => {
            const msg = e.data
            if (msg.type === 'progress') onProgress?.(msg.frac)
            else if (msg.type === 'done') {
                worker.terminate()
                resolve({
                    data: msg.data,
                    grid: msg.grid,
                    affine: gridAffine(msg.grid),
                    modality: src.modality,
                    intensity: intensityRange(msg.data),
                    meta: src.meta,
                })
            } else if (msg.type === 'error') {
                worker.terminate()
                reject(new Error(msg.message))
            }
        }
        worker.onerror = (err) => { worker.terminate(); reject(err) }
        worker.postMessage({ type: 'resample', src: { data: src.data, dims: src.grid.dims, affine: src.affine }, target, interp }, [src.data.buffer])
    })
}

/**
 * 加载当前帧的体数据。
 * fusion: 双流任务(ct + pet)同时加载, PET 重采样到 CT 网格。
 */
export async function loadFrameVolumes(
    frame: number | string,
    streams: string[],
    onStage?: (stage: string, frac: number) => void,
): Promise<{ base: MedicalVolume; overlay: MedicalVolume | null }> {
    const pickModality = (s: string, fallback: Modality): Modality =>
        s === 'ct' ? 'ct' : s === 'pet' ? 'pet' : fallback

    const loadOne = async (stream: string): Promise<MedicalVolume | null> => {
        onStage?.(`下载 ${stream}`, 0)
        // URL stream 用全局 streamMeta; 其余流(如 pet)现拉一份 meta 拿文件名/扩展名
        let uriHint = ''
        let hintMeta: any = null
        if (stream !== jobConfig.stream) {
            try {
                const meta = await fetchStreamMeta(stream)
                hintMeta = meta
                uriHint = meta?.openlabel?.frames?.[frame as any]?.frame_properties?.name
                    || meta?.openlabel?.frames?.[frame as any]?.frame_properties?.uri || ''
            } catch {
                // meta 拉取失败不阻断: file2/get 服务端仍可按 stream 解析, 扩展名走魔数嗅探
            }
        }
        if (jobConfig.dicom_local) {
            // dicomLocal 的 name 是显示名不能当 uri;hintMeta 是本流(如 pet)的 meta。
            // 全局 streamMeta 只对应 jobConfig.stream,跨流回退会把 ct 的序列装配成 pet(未配对帧)
            const uidOf = (u: unknown) => (typeof u === 'string' ? /^dicom:\/\/(.+)$/.exec(u)?.[1] || '' : '')
            const seriesUid = uidOf(uriHint)
                || uidOf(hintMeta?.openlabel?.frames?.[frame as any]?.frame_properties?.uri)
                || (stream === jobConfig.stream
                    ? uidOf(dataSeqState.streamMeta?.openlabel?.frames?.[frame as any]?.frame_properties?.uri)
                    : '')
            if (!seriesUid) return null   // 未配对帧没有该流(如 pet),调用方跳过 overlay
            const instances = instancesFor(seriesUid)
            if (!instances) {
                throw new Error(`未找到 DICOM 序列 dicom://${seriesUid} 的文件,请确认选择了创建任务时的同一数据目录`)
            }
            onStage?.(`装配 DICOM ${stream}`, 0.05)
            const raw = await assembleDicomSeries(
                instances,
                async info => {
                    const b = blobFor(info)
                    if (!b) throw new Error(`DICOM 文件缺失: ${info.path}`)
                    return b
                },
                { modality: pickModality(stream, 'ct'), seriesLabel: `${instances[0].seriesDesc || ''} ${seriesUid.slice(-8)}`.trim() },
                (read, total) => onStage?.(`装配 DICOM ${stream} ${read}/${total}`, 0.05 + 0.2 * read / Math.max(1, total)),
            )
            const vol = await normalizeInWorker(raw, f => onStage?.(`重采样 ${stream}`, 0.3 + f * 0.6))
            return vol
        }
        const { buf, uri } = await fetchFrameBytes(frame, stream, uriHint)
        const ext = volumeExtOf(uri || `x.${stream === 'pet' ? 'nii' : 'nrrd'}`)
        const raw = parseVolumeBytes(buf, ext, pickModality(stream, 'ct'))
        onStage?.(`解析 ${stream}`, 0.3)
        const vol = await normalizeInWorker(raw, f => onStage?.(`重采样 ${stream}`, 0.3 + f * 0.6))
        return vol
    }

    const ctStream = streams.find(s => s === 'ct') || streams[0]
    const petStream = streams.find(s => s === 'pet')

    const base = await loadOne(ctStream)
    if (!base) throw new Error(`帧 ${frame} 没有 ${ctStream} 数据`)
    let overlay: MedicalVolume | null = null
    if (petStream && petStream !== ctStream) {
        const pet = await loadOne(petStream)
        if (pet) {
            onStage?.('PET 配准到 CT 网格', 0.9)
            overlay = resampleMedicalVolume(pet, base.grid, 'trilinear')
        }
    }
    onStage?.('完成', 1)
    return { base, overlay }
}

/** 拉取 stream meta(frames 列表) — 复用平台 seq/stream/meta(整包 jobConfig + stream 覆盖) */
export async function fetchStreamMeta(stream: string): Promise<any> {
    const res = await reqJson({
        uri: '/api/v1/b/seq/stream/meta',
        method: 'POST',
        data: { ...jobConfig, stream },
    })
    return res?.data ?? res
}
