/**
 * segAlgo worker 的主线程封装: 体数据副本随帧装载建立, 帧切换销毁。
 * 单飞行请求(魔法棒点击频率远低于往返耗时, 排队无意义)。
 */
import type { MedicalVolume } from '../data/volumeModel'

interface Pending {
    resolve: (v: Uint32Array) => void
    reject: (e: Error) => void
    onProgress?: (frac: number) => void
}

let worker: Worker | null = null
let volKey = ''
let seq = 0
const pending = new Map<number, Pending>()

function ensureWorker(): Worker {
    if (worker) return worker
    worker = new Worker(new URL('../workers/segAlgo.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<any>) => {
        const msg = e.data
        const p = pending.get(msg.id)
        if (!p) return
        if (msg.type === 'progress') { p.onProgress?.(msg.frac); return }
        pending.delete(msg.id)
        if (msg.type === 'done') p.resolve(msg.indices as Uint32Array)
        else p.reject(new Error(msg.message))
    }
    worker.onerror = (err) => {
        for (const [, p] of pending) p.reject(new Error(err.message || 'segAlgo worker 异常'))
        pending.clear()
    }
    return worker
}

/** 帧装载后调用: 传体数据副本给 worker(transferable, 主线程原数据不动) */
export function initSegAlgo(volume: MedicalVolume): void {
    const w = ensureWorker()
    const key = `${volume.grid.dims.join(',')}@${volume.data.length}`
    if (key === volKey) return
    // slice() 复制一份再 transfer, 不动 volState 里的原数组
    const copy = volume.data.slice()
    w.postMessage({ type: 'volume', data: copy, dims: volume.grid.dims }, [(copy as any).buffer])
    volKey = key
}

export function disposeSegAlgo(): void {
    worker?.terminate()
    worker = null
    volKey = ''
    for (const [, p] of pending) p.reject(new Error('worker 已销毁'))
    pending.clear()
}

export function runMagicWand(req: {
    seed: [number, number, number]
    lo: number; hi: number
    scope: 'slice' | 'volume'
    axis: 0 | 1 | 2
}): Promise<Uint32Array> {
    const w = ensureWorker()
    const id = ++seq
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        w.postMessage({ type: 'magicWand', id, ...req })
    })
}

export function runInterpolate(
    mask: Uint8Array, dims: [number, number, number], axis: 0 | 1 | 2,
): Promise<Uint32Array> {
    const w = ensureWorker()
    const id = ++seq
    const copy = mask.slice()
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        w.postMessage({ type: 'interpolate', id, mask: copy, dims, axis }, [copy.buffer])
    })
}

/** GrowCut: fg/bg 种子层副本 transfer, progress 逐轮回调 */
export function runGrowCut(
    fg: Uint8Array, bg: Uint8Array, sigma: number,
    onProgress?: (frac: number) => void,
): Promise<Uint32Array> {
    const w = ensureWorker()
    const id = ++seq
    const fgCopy = fg.slice()
    const bgCopy = bg.slice()
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress })
        w.postMessage({ type: 'growCut', id, fg: fgCopy, bg: bgCopy, sigma }, [fgCopy.buffer, bgCopy.buffer])
    })
}

/** 取消进行中的 growCut(worker 抛 cancelled → promise reject) */
export function cancelGrowCut(): void {
    if (!worker) return
    for (const id of pending.keys()) worker.postMessage({ type: 'growCancel', id })
}
