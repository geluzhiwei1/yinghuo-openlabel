/// <reference lib="webworker" />
/**
 * 重采样 worker: 大体积的 normalize/PET→CT 网格重采样移出主线程。
 * 输入输出 TypedArray 走 transferable。
 */
import { normalizeToAxisAlignedRAS, resampleToGrid } from '../data/resample'
import type { RawVolume, VolumeData, VolumeGrid } from '../data/volumeModel'

interface NormalizeMsg {
    type: 'normalize'
    raw: {
        data: VolumeData
        dims: [number, number, number]
        affine: number[]
        modality: RawVolume['modality']
        meta?: Record<string, unknown>
    }
}

interface ResampleMsg {
    type: 'resample'
    src: { data: VolumeData; dims: [number, number, number]; affine: number[] }
    target: VolumeGrid
    interp: 'trilinear' | 'nn'
}

type Msg = NormalizeMsg | ResampleMsg

self.onmessage = (e: MessageEvent<Msg>) => {
    const msg = e.data
    try {
        if (msg.type === 'normalize') {
            const vol = normalizeToAxisAlignedRAS(msg.raw as RawVolume, (frac) => {
                ;(self as any).postMessage({ type: 'progress', frac })
            })
            ;(self as any).postMessage(
                { type: 'done', volume: { ...vol, data: vol.data } },
                [vol.data.buffer],
            )
        } else if (msg.type === 'resample') {
            const data = resampleToGrid(msg.src, msg.target, msg.interp, (frac) => {
                ;(self as any).postMessage({ type: 'progress', frac })
            })
            ;(self as any).postMessage({ type: 'done', data, grid: msg.target }, [data.buffer])
        }
    } catch (err) {
        ;(self as any).postMessage({ type: 'error', message: String(err) })
    }
}
