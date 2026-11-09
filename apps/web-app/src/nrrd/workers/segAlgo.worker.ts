/// <reference lib="webworker" />
/**
 * 半自动分割算法 worker: 魔法棒洪泛 / 跨层距离场插值 / GrowCut 种子竞争。
 * 体数据副本一次传入(volume 消息), 结果索引 transferable 返回。
 */
import { magicWandIndices, interpolateIndices, growCutIndices } from '../seg/algo'
import type { VolumeData } from '../data/volumeModel'

type Msg =
    | { type: 'volume'; data: VolumeData; dims: [number, number, number] }
    | {
        type: 'magicWand'
        id: number
        seed: [number, number, number]
        lo: number; hi: number
        scope: 'slice' | 'volume'
        axis: 0 | 1 | 2
    }
    | {
        type: 'interpolate'
        id: number
        mask: Uint8Array
        dims: [number, number, number]
        axis: 0 | 1 | 2
    }
    | { type: 'growCut'; id: number; fg: Uint8Array; bg: Uint8Array; sigma: number }
    | { type: 'growCancel'; id: number }

let volData: VolumeData | null = null
let volDims: [number, number, number] = [0, 0, 0]
/** 进行中 growCut 的取消标记(growCancel 消息置位, 每轮扫掠检查) */
const growCancelled = new Set<number>()

self.onmessage = (e: MessageEvent<Msg>) => {
    const msg = e.data
    try {
        if (msg.type === 'volume') {
            volData = msg.data
            volDims = msg.dims
            return
        }
        if (msg.type === 'magicWand') {
            if (!volData) throw new Error('worker 无体数据副本')
            const indices = magicWandIndices(volData, volDims, msg.seed, msg.lo, msg.hi, msg.scope, msg.axis)
            ;(self as any).postMessage({ type: 'done', id: msg.id, indices }, [indices.buffer])
        } else if (msg.type === 'interpolate') {
            const indices = interpolateIndices(msg.mask, msg.dims, msg.axis)
            ;(self as any).postMessage({ type: 'done', id: msg.id, indices }, [indices.buffer])
        } else if (msg.type === 'growCut') {
            if (!volData) throw new Error('worker 无体数据副本')
            growCancelled.delete(msg.id)
            const indices = growCutIndices(
                volData, volDims, msg.fg, msg.bg, msg.sigma,
                frac => (self as any).postMessage({ type: 'progress', id: msg.id, frac }),
                () => growCancelled.has(msg.id),
            )
            ;(self as any).postMessage({ type: 'done', id: msg.id, indices }, [indices.buffer])
        } else if (msg.type === 'growCancel') {
            growCancelled.add(msg.id)
        }
    } catch (err: any) {
        ;(self as any).postMessage({ type: 'error', id: (msg as any).id, message: String(err?.message ?? err) })
    }
}
