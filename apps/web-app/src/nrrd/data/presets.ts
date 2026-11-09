/**
 * 窗宽窗位预设、PET colormap LUT、传输函数预设。
 * LUT 打包为 Uint32Array(ABGR little-endian, 直接写 ImageData 的 Uint32 视图)。
 */
import colormap from 'colormap'
import type { Modality } from './volumeModel'

export interface WlPreset {
    key: string
    name: string
    width: number
    level: number
}

export const CT_WL_PRESETS: WlPreset[] = [
    { key: 'soft', name: '软组织', width: 400, level: 40 },
    { key: 'lung', name: '肺窗', width: 1500, level: -600 },
    { key: 'bone', name: '骨窗', width: 1500, level: 300 },
    { key: 'brain', name: '脑窗', width: 80, level: 40 },
    { key: 'full', name: '全范围', width: 4000, level: 1000 },
]

export const PET_LUT_NAMES = [
    { key: 'hot', name: 'Hot Iron' },
    { key: 'inferno', name: 'Inferno' },
    { key: 'jet', name: 'Jet' },
    { key: 'viridis', name: 'Viridis' },
]

export function buildLut(name: string, steps = 256, gamma = 1.0): Uint32Array {
    const colors = colormap({ colormap: name, nshades: steps, format: 'rgba' })
    const lut = new Uint32Array(steps)
    for (let i = 0; i < steps; i++) {
        let t = i / (steps - 1)
        t = Math.pow(t, gamma)
        const ci = Math.min(steps - 1, Math.round(t * (steps - 1)))
        const [r, g, b, a] = colors[ci]
        // little-endian ABGR
        lut[i] = ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)
    }
    return lut
}

const lutCache = new Map<string, Uint32Array>()

export function getCachedLut(name: string): Uint32Array {
    let lut = lutCache.get(name)
    if (!lut) {
        lut = buildLut(name)
        lutCache.set(name, lut)
    }
    return lut
}

export function defaultWl(modality: Modality, min: number, max: number): { width: number; level: number } {
    if (modality === 'ct') return { width: 400, level: 40 }
    // PET/MR: 全范围起步
    const pad = (max - min) * 0.02
    return { width: (max - min) + pad, level: (max + min) / 2 }
}

/** VRT 传输函数控制点 → 256×1 RGBA LUT(Float 数组, r,g,b,a 0-1) */
export interface TfControlPoint {
    value: number      // 原始强度
    color: [number, number, number]
    alpha: number
}

export function bakeTfLut(points: TfControlPoint[], vmin: number, vmax: number, out?: Uint8Array): Uint8Array {
    const lut = out ?? new Uint8Array(256 * 4)
    const sorted = [...points].sort((a, b) => a.value - b.value)
    for (let i = 0; i < 256; i++) {
        const v = vmin + (vmax - vmin) * (i / 255)
        // 找相邻两个控制点线性插值
        let lo = sorted[0], hi = sorted[sorted.length - 1]
        for (let p = 0; p < sorted.length - 1; p++) {
            if (v >= sorted[p].value && v <= sorted[p + 1].value) {
                lo = sorted[p]
                hi = sorted[p + 1]
                break
            }
        }
        const span = hi.value - lo.value
        const t = span > 0 ? (v - lo.value) / span : 0
        const off = i * 4
        for (let c = 0; c < 3; c++) {
            lut[off + c] = Math.round(255 * (lo.color[c] + (hi.color[c] - lo.color[c]) * t))
        }
        lut[off + 3] = Math.round(255 * (lo.alpha + (hi.alpha - lo.alpha) * t))
    }
    return lut
}
