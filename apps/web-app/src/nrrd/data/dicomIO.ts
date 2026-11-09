/**
 * 浏览器端 DICOM 头/像素读取(本地模式)。
 *
 * dicom-parser(cornerstone) 只做字节级解析;本模块负责:
 * - 魔数嗅探(DICM@128,与后端 import_dicom.sniff_dicom 同规范,扩展名无关)
 * - 渐进切片读头(16KB→128KB→1MB→全文件),表单目录嗅探 6k 文件不至于整读
 * - 像素读取: 仅非压缩 TransferSyntax(本批 GE 数据 Explicit VR LE);
 *   压缩(1.2.840.10008.1.2.4.* / .5)显式报错带序列名
 * - rescale 策略: CT/MR 整数 slope/intercept 且值域塞得下 → 保 Int16/Uint16 原生,
 *   否则 Float32;PET 恒 Float32(SUV 换算在 dicomAssemble 做)
 */
import dicomParser from 'dicom-parser'

export interface DicomInfo {
    path: string                              // webkitRelativePath(机器相关,不落库)
    patientId: string
    patientName: string
    studyUid: string
    studyDate: string
    studyDesc: string
    seriesUid: string
    seriesNumber: number
    seriesDesc: string
    modality: string
    imageType: string[]
    iop: number[]                             // 6: 行方向 + 列方向
    ipp: number[]                             // 3
    pixelSpacing: number[]                    // 2: [行距, 列距]
    rows: number
    cols: number
    forUid: string                            // FrameOfReferenceUID
    units: string
    decayCorrection: string
    weightKg: number
    doseBq: number | null                     // RadionuclideTotalDose
    numberOfFrames: number
    transferSyntax: string
    sliceThickness: number
    rescaleSlope: number
    rescaleIntercept: number
    bitsAllocated: number
    pixelRepresentation: number               // 0=无符号 1=有符号
    samplesPerPixel: number
}

const T = {
    patientId: 'x00100020', patientName: 'x00100010',
    studyUid: 'x0020000d', studyDate: 'x00080020', studyDesc: 'x00081030',
    seriesUid: 'x0020000e', seriesNumber: 'x00200011', seriesDesc: 'x0008103e',
    modality: 'x00080060', imageType: 'x00080008',
    iop: 'x00200037', ipp: 'x00200032', pixelSpacing: 'x00280030',
    rows: 'x00280010', cols: 'x00280011', forUid: 'x00200052',
    units: 'x00541001', decayCorrection: 'x00541102', patientWeight: 'x00101030',
    radiopharmSeq: 'x00540016', radionuclideDose: 'x00181074',
    numberOfFrames: 'x00280008', transferSyntax: 'x00020010', sliceThickness: 'x00180050',
    rescaleSlope: 'x00281053', rescaleIntercept: 'x00281052',
    bitsAllocated: 'x00280100', pixelRepresentation: 'x00280103', samplesPerPixel: 'x00280002',
    pixelData: 'x7fe00010',
} as const

const num = (v: string | null | undefined, d = 0): number => {
    const n = parseFloat(v ?? '')
    return Number.isFinite(n) ? n : d
}

const multiNum = (ds: any, tag: string, count: number, dflt: number[]): number[] => {
    const out: number[] = []
    for (let i = 0; i < count; i++) {
        const s = ds.floatString?.(tag, i)
        out.push(s === undefined || s === null || !Number.isFinite(s) ? dflt[i] : s)
    }
    return out
}

export async function isDicomFile(blob: Blob): Promise<boolean> {
    try {
        const head = new Uint8Array(await blob.slice(128, 132).arrayBuffer())
        return head[0] === 0x44 && head[1] === 0x49 && head[2] === 0x43 && head[3] === 0x4d
    } catch {
        return false
    }
}

function infoFromDataSet(ds: any, path: string): DicomInfo {
    let doseBq: number | null = null
    const seq = ds.elements?.[T.radiopharmSeq]
    const itemDs = seq?.items?.[0]?.dataSet
    if (itemDs) {
        const d = itemDs.floatString?.(T.radionuclideDose)
        if (d !== undefined && d !== null && Number.isFinite(d)) doseBq = d
    }
    const imageType = ds.string(T.imageType) || ''
    return {
        path,
        patientId: (ds.string(T.patientId) || 'UNKNOWN').trim() || 'UNKNOWN',
        patientName: (ds.string(T.patientName) || '').trim(),
        studyUid: ds.string(T.studyUid) || '',
        studyDate: (ds.string(T.studyDate) || '').trim(),
        studyDesc: (ds.string(T.studyDesc) || '').trim(),
        seriesUid: ds.string(T.seriesUid) || '',
        seriesNumber: num(ds.string(T.seriesNumber)),
        seriesDesc: (ds.string(T.seriesDesc) || '').trim(),
        modality: (ds.string(T.modality) || '').trim().toUpperCase(),
        imageType: imageType ? imageType.split('\\') : [],
        iop: multiNum(ds, T.iop, 6, [1, 0, 0, 0, 1, 0]),
        ipp: multiNum(ds, T.ipp, 3, [0, 0, 0]),
        pixelSpacing: multiNum(ds, T.pixelSpacing, 2, [1, 1]),
        rows: ds.uint16?.(T.rows) || 0,
        cols: ds.uint16?.(T.cols) || 0,
        forUid: ds.string(T.forUid) || '',
        units: (ds.string(T.units) || '').trim(),
        decayCorrection: (ds.string(T.decayCorrection) || '').trim(),
        weightKg: num(ds.string(T.patientWeight)),
        doseBq,
        numberOfFrames: num(ds.string(T.numberOfFrames), 1),
        transferSyntax: ds.string(T.transferSyntax) || '',
        sliceThickness: num(ds.string(T.sliceThickness)),
        rescaleSlope: num(ds.string(T.rescaleSlope), 1) || 1,
        rescaleIntercept: num(ds.string(T.rescaleIntercept)),
        bitsAllocated: ds.uint16?.(T.bitsAllocated) || 16,
        pixelRepresentation: ds.uint16?.(T.pixelRepresentation) || 0,
        samplesPerPixel: ds.uint16?.(T.samplesPerPixel) || 1,
    }
}

const HEADER_STEPS = [16 * 1024, 128 * 1024, 1024 * 1024]

/** 渐进读头: 小文件全读, 大文件只切前 16KB(dicom-parser 对截断缓冲在像素数据处停)。 */
export async function readDicomInfo(blob: Blob, path = ''): Promise<DicomInfo> {
    let lastErr: unknown = null
    for (const size of [...HEADER_STEPS, blob.size]) {
        try {
            const bytes = new Uint8Array(await blob.slice(0, Math.min(size, blob.size)).arrayBuffer())
            const ds = dicomParser.parseDicom(bytes)
            const info = infoFromDataSet(ds, path)
            if (info.rows > 0 && info.cols > 0 && info.seriesUid) return info
            lastErr = new Error('缺少核心标签(Rows/Columns/SeriesInstanceUID)')
        } catch (e) {
            lastErr = e
        }
    }
    throw new Error(`DICOM 头解析失败 ${path}: ${(lastErr as Error)?.message ?? lastErr}`)
}

const UNCOMPRESSED_TS = new Set([
    '1.2.840.10008.1.2',       // implicit VR LE
    '1.2.840.10008.1.2.1',     // explicit VR LE
    '1.2.840.10008.1.2.2',     // explicit VR BE
])

export type PixelBuffer =
    | { kind: 'int16'; data: Int16Array }
    | { kind: 'uint16'; data: Uint16Array }
    | { kind: 'float32'; data: Float32Array }

/**
 * 读单切片像素并按策略 rescale。
 * modality: 'ct'|'mr' 整数 rescale 保原生整型(渲染管线吃 Int16/Uint16);
 * 'pet' 恒 Float32(SUV 换算需要小数)。
 */
export async function readDicomPixels(
    blob: Blob, info: DicomInfo, modality: 'ct' | 'mr' | 'pet', seriesLabel = '',
): Promise<PixelBuffer> {
    const ts = info.transferSyntax
    if (ts && !UNCOMPRESSED_TS.has(ts)) {
        throw new Error(`序列 ${seriesLabel || info.seriesDesc || info.seriesUid} 使用压缩传输语法 ${ts},浏览器直读仅支持非压缩 DICOM`)
    }
    if (info.samplesPerPixel > 1) {
        throw new Error(`序列 ${seriesLabel || info.seriesUid} SamplesPerPixel=${info.samplesPerPixel},非灰度体数据`)
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const ds = dicomParser.parseDicom(bytes)
    const elem = ds.elements[T.pixelData]
    if (!elem || elem.length === 0) throw new Error(`序列 ${seriesLabel || info.seriesUid} 无像素数据`)
    const n = info.rows * info.cols
    const ba = ds.byteArray
    // dataOffset 指向值起始;旧属性名 byteOffset 指向元素头(长式 VR 头 12 字节)
    const off = (elem as any).dataOffset ?? elem.byteOffset + ((elem.vr === 'OB' || elem.vr === 'OW' || elem.vr === 'OF') ? 12 : 8)
    const slope = info.rescaleSlope
    const intercept = info.rescaleIntercept
    const needRescale = slope !== 1 || intercept !== 0
    const intRescaleOk = (modality === 'ct' || modality === 'mr')
        && Number.isInteger(slope) && Number.isInteger(intercept)
    const bits8 = info.bitsAllocated === 8

    // 原始存储值读取(按位深/字节序/符号)
    const readVal: (i: number) => number = bits8
        ? i => new Uint8Array(ba.buffer, ba.byteOffset + off, n)[i]
        : (() => {
            const littleEndian = ts !== '1.2.840.10008.1.2.2'
            const view = new DataView(ba.buffer, ba.byteOffset + off, n * (bits8 ? 1 : 2))
            return info.pixelRepresentation === 1
                ? i => view.getInt16(i * 2, littleEndian)
                : i => view.getUint16(i * 2, littleEndian)
        })()

    if (modality === 'pet') {
        // PET 恒 Float32(SUV 换算需要小数,渲染管线按浮点强度处理)
        const f = new Float32Array(n)
        for (let i = 0; i < n; i++) f[i] = readVal(i) * slope + intercept
        return { kind: 'float32', data: f }
    }
    if (!needRescale) {
        if (bits8) {
            const out = new Uint16Array(n)
            for (let i = 0; i < n; i++) out[i] = readVal(i)
            return { kind: 'uint16', data: out }
        }
        const out = info.pixelRepresentation === 1 ? new Int16Array(n) : new Uint16Array(n)
        for (let i = 0; i < n; i++) out[i] = readVal(i)
        return { kind: info.pixelRepresentation === 1 ? 'int16' : 'uint16', data: out }
    }
    if (intRescaleOk) {
        const out = new Int16Array(n)
        let overflow = false
        for (let i = 0; i < n; i++) {
            const v = readVal(i) * slope + intercept
            if (v < -32768 || v > 32767) { overflow = true; break }
            out[i] = v
        }
        if (!overflow) return { kind: 'int16', data: out }
    }
    const f = new Float32Array(n)
    for (let i = 0; i < n; i++) f[i] = readVal(i) * slope + intercept
    return { kind: 'float32', data: f }
}
