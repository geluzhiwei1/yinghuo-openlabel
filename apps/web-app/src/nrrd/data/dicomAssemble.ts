/**
 * DICOM 序列 → RawVolume 装配(本地模式)。
 *
 * affine(契约二规范):
 *   列0 = IOP行方向 × PixelSpacing[1](列距,i 步进沿行方向走一列)
 *   列1 = IOP列方向 × PixelSpacing[0](行距 —— PixelSpacing=[行距,列距],倒置是经典坑)
 *   列2 = 切片法向 × spacingZ(相邻投影差均值)
 *   原点 = 排序后首实例 IPP;整体 LPS→RAS 翻转 diag(-1,-1,1)
 * dims = [cols, rows, slices];DICOM 像素行主序(行内列连续)恰与 RawVolume i-最快一致。
 * PET 的 SUVbw 换算与后端 suv_scale 同式: BQML+START(GE) → 体重g/剂量Bq。
 */
import type { DicomInfo } from './dicomIO'
import { readDicomPixels } from './dicomIO'
import { sliceNormal, sortInstances, zSpacing } from './dicomGroup'
import type { Modality, RawVolume, VolumeData } from './volumeModel'

/** PET SUV 因子;null=直通。warning 为不支持组合的提示(由调用方呈现)。 */
export function suvFactor(
    instances: DicomInfo[],
): { factor: number | null; warning: string | null } {
    const f0 = instances[0]
    if (f0.units.toUpperCase().startsWith('SUV')) return { factor: null, warning: null }
    if (!(f0.units.toUpperCase() === 'BQML' && f0.decayCorrection.toUpperCase() === 'START')) {
        return { factor: null, warning: `Units=${f0.units} DecayCorrection=${f0.decayCorrection} 不支持 SUV 换算,原样直通` }
    }
    if (!(f0.weightKg > 0 && f0.doseBq)) return { factor: null, warning: '缺体重/注射剂量,原样直通' }
    return { factor: (f0.weightKg * 1000) / f0.doseBq, warning: null }
}

/** LPS→RAS: x,y 取反。affine 为 4x4 行主序。 */
function lpsToRas(a: number[]): number[] {
    const out = a.slice()
    for (const row of [0, 1]) {
        out[row * 4 + 0] = -out[row * 4 + 0]
        out[row * 4 + 1] = -out[row * 4 + 1]
        out[row * 4 + 2] = -out[row * 4 + 2]
        out[row * 4 + 3] = -out[row * 4 + 3]
    }
    return out
}

export interface AssembleOptions {
    modality: Modality                  // 'ct' | 'pet' | 'mr'
    seriesLabel?: string                // 报错/警告用显示名
    concurrency?: number                // 像素读取并发(默认 4)
}

/**
 * 装配一个序列。instances 顺序任意(内部按投影排序);
 * fetchBlob 按实例惰性取文件字节(工作台来自 pathBlobMap,表单来自 File 对象)。
 */
export async function assembleDicomSeries(
    instances: DicomInfo[],
    fetchBlob: (info: DicomInfo) => Promise<Blob>,
    opts: AssembleOptions,
    onProgress?: (read: number, total: number) => void,
): Promise<RawVolume> {
    const { modality } = opts
    const seriesLabel = opts.seriesLabel ?? instances[0]?.seriesDesc ?? ''
    const sorted = sortInstances(instances)[0]
    if (!sorted.length) throw new Error(`序列 ${seriesLabel} 无实例`)
    const warnings: string[] = []

    const [spacingZ, uniform] = zSpacing(sorted)
    if (!uniform) warnings.push(`z 间距不均匀(均值 ${spacingZ.toPrecision(4)}mm)`)
    const f0 = sorted[0]
    const dot = f0.iop.slice(0, 3).reduce((s, v, i) => s + v * f0.iop[3 + i], 0)
    if (Math.abs(dot) > 1e-6) warnings.push('斜切序列(gantry tilt/oblique)')

    const n = f0.rows * f0.cols
    const ns = sorted.length
    const streamModality = modality === 'pet' ? 'pet' : (modality as 'ct' | 'mr')

    // SUV 因子(仅 PET)
    let suv = 1
    if (modality === 'pet') {
        const { factor, warning } = suvFactor(sorted)
        if (warning) warnings.push(warning)
        if (factor != null) suv = factor
    }

    // 输出缓冲: 从首切片推断元素类型(同序列内一致,契约二过滤已保证)
    const first = await readDicomPixels(await fetchBlob(sorted[0]), sorted[0], streamModality, seriesLabel)
    let data: VolumeData
    if (modality === 'pet') {
        const f = new Float32Array(n * ns)
        if (suv !== 1) for (let i = 0; i < first.data.length; i++) f[i] = (first.data as Float32Array)[i] * suv
        else f.set(first.data as Float32Array)
        data = f
    } else {
        data = first.data
        if (first.kind === 'int16') data = new Int16Array(n * ns)
        else if (first.kind === 'uint16') data = new Uint16Array(n * ns)
        else data = new Float32Array(n * ns)
        ;(data as any).set(first.data, 0)
    }

    const rest = sorted.slice(1)
    const concurrency = Math.min(opts.concurrency ?? 4, Math.max(1, rest.length))
    let next = 0, done = 1
    onProgress?.(done, ns)
    const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
            const idx = next++
            if (idx >= rest.length) return
            const inst = rest[idx]
            const buf = await readDicomPixels(await fetchBlob(inst), inst, streamModality, seriesLabel)
            onProgress?.(++done, ns)
            const slice = (idx + 1) * n
            if (modality === 'pet') {
                const dst = data as Float32Array
                if (suv !== 1) for (let i = 0; i < n; i++) dst[slice + i] = (buf.data as Float32Array)[i] * suv
                else dst.set(buf.data as Float32Array, slice)
            } else {
                ;(data as any).set(buf.data, slice)
            }
        }
    })
    await Promise.all(workers)

    // affine: i 列=行方向×列距, j 列=列方向×行距, k 列=法向×spacingZ, 原点=首 IPP;LPS→RAS
    const [r0, r1, r2, c0, c1, c2] = f0.iop
    const [rowSp, colSp] = f0.pixelSpacing
    const [n0, n1, n2] = sliceNormal(f0.iop)
    const affine = lpsToRas([
        r0 * colSp, c0 * rowSp, n0 * spacingZ, f0.ipp[0],
        r1 * colSp, c1 * rowSp, n1 * spacingZ, f0.ipp[1],
        r2 * colSp, c2 * rowSp, n2 * spacingZ, f0.ipp[2],
        0, 0, 0, 1,
    ])

    return {
        data,
        dims: [f0.cols, f0.rows, ns],
        affine,
        modality,
        meta: {
            format: 'dicom',
            seriesUid: f0.seriesUid,
            seriesDesc: f0.seriesDesc,
            spacingZ: Math.abs(spacingZ),
            suv,
            warnings,
        },
    }
}
