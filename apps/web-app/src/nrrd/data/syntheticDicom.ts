/**
 * 测试专用: 合成 DICOM 文件字节(Explicit VR LE)。
 * 仅覆盖契约二标签集 + 16/8 位灰度像素,dicom-parser 可直接解析;
 * 与真实 GE 文件同构(数值标签用 DS/IS 字符串,与实机一致)。
 */

export interface SynthDicomOpts {
    rows: number
    cols: number
    pixel: (i: number, j: number) => number      // i=列, j=行 → 存储值
    patientId?: string
    patientName?: string
    studyUid?: string
    studyDate?: string
    studyDesc?: string
    seriesUid?: string
    seriesNumber?: number
    seriesDesc?: string
    modality?: string
    imageType?: string[]
    iop?: number[]
    ipp?: number[]
    pixelSpacing?: [number, number]              // DICOM 序: [行距, 列距]
    forUid?: string
    units?: string
    decayCorrection?: string
    weightKg?: number
    doseBq?: number | null
    numberOfFrames?: number
    sliceThickness?: number
    rescaleSlope?: number
    rescaleIntercept?: number
    bitsAllocated?: 8 | 16
    signed?: boolean
    transferSyntax?: string
}

const EXPLICIT_LE = '1.2.840.10008.1.2.1'
const LONG_VR = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'])

class Writer {
    private chunks: number[] = []
    u8(v: number) { this.chunks.push(v & 0xff) }
    u16(v: number) { this.chunks.push(v & 0xff, (v >> 8) & 0xff) }
    u32(v: number) { this.chunks.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff) }
    str(s: string) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)) }
    bytes(a: Uint8Array) { for (const b of a) this.u8(b) }
    get length() { return this.chunks.length }
    build(): Uint8Array { return new Uint8Array(this.chunks) }

    element(group: number, elem: number, vr: string, value: number[] | Uint8Array | string) {
        this.u16(group)
        this.u16(elem)
        this.str(vr)
        let payload: number[] | Uint8Array
        if (typeof value === 'string') {
            const tmp: number[] = []
            for (let i = 0; i < value.length; i++) tmp.push(value.charCodeAt(i) & 0xff)
            if (tmp.length % 2) tmp.push(vr === 'UI' ? 0 : 0x20)
            payload = tmp
        } else {
            payload = value
        }
        if (LONG_VR.has(vr)) {
            this.u16(0)
            this.u32(payload.length)
        } else {
            this.u16(payload.length)
        }
        if (payload instanceof Uint8Array) this.bytes(payload)
        else for (const b of payload) this.u8(b)
    }
}

const ds = (v: number) => String(v)
const joinBackslash = (arr: string[]) => arr.join('\\')

export function synthDicom(opts: SynthDicomOpts): Uint8Array {
    const rows = opts.rows
    const cols = opts.cols
    const bits = opts.bitsAllocated ?? 16
    const signed = opts.signed ?? false
    const pixel = opts.pixel ?? (() => 0)

    // 像素: 行主序,行内列连续(与 DICOM 一致)
    const n = rows * cols
    const pix = new Uint8Array(n * (bits === 8 ? 1 : 2))
    const view = new DataView(pix.buffer)
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const v = pixel(i, j)
            const idx = j * cols + i
            if (bits === 8) pix[idx] = v & 0xff
            else view.setInt16(idx * 2, v, true)
        }
    }

    // File Meta(group 0002, 显式 VR)
    const meta = new Writer()
    meta.element(0x0002, 0x0010, 'UI', opts.transferSyntax ?? EXPLICIT_LE)
    const metaBytes = meta.build()

    const w = new Writer()
    for (let i = 0; i < 128; i++) w.u8(0)
    w.str('DICM')
    w.element(0x0002, 0x0000, 'UL', [(metaBytes.length) & 0xff, (metaBytes.length >> 8) & 0xff, (metaBytes.length >> 16) & 0xff, (metaBytes.length >> 24) & 0xff])
    w.bytes(metaBytes)

    w.element(0x0008, 0x0008, 'CS', joinBackslash(opts.imageType ?? ['ORIGINAL', 'PRIMARY']))
    w.element(0x0008, 0x0020, 'DA', opts.studyDate ?? '20260101')
    w.element(0x0008, 0x0060, 'CS', opts.modality ?? 'CT')
    w.element(0x0008, 0x1030, 'LO', opts.studyDesc ?? '')
    w.element(0x0008, 0x103e, 'LO', opts.seriesDesc ?? '')
    w.element(0x0010, 0x0010, 'PN', opts.patientName ?? 'ANON')
    w.element(0x0010, 0x0020, 'LO', opts.patientId ?? 'P1')
    w.element(0x0010, 0x1030, 'DS', ds(opts.weightKg ?? 0))
    w.element(0x0018, 0x0050, 'DS', ds(opts.sliceThickness ?? 1))
    if (opts.doseBq != null) {
        // RadiopharmaceuticalInformationSequence(1 项)
        const item = new Writer()
        item.element(0x0018, 0x1074, 'DS', ds(opts.doseBq))
        const itemBytes = item.build()
        // SQ undefined-length 简化为显式长度: tag+VR'SQ'+reserved+uint32(总长) + (FFFE,E000)+uint32(itemBytes) + itemBytes
        w.u16(0x0054); w.u16(0x0016); w.str('SQ'); w.u16(0)
        const seqLen = 8 + itemBytes.length
        w.u32(seqLen)
        w.u16(0xfffe); w.u16(0xe000); w.u32(itemBytes.length)
        w.bytes(itemBytes)
    }
    w.element(0x0020, 0x000d, 'UI', opts.studyUid ?? '1.2.826.0.1.3680043.8.498.1')
    w.element(0x0020, 0x000e, 'UI', opts.seriesUid ?? '1.2.826.0.1.3680043.8.498.2')
    w.element(0x0020, 0x0011, 'IS', String(opts.seriesNumber ?? 1))
    w.element(0x0020, 0x0032, 'DS', (opts.ipp ?? [0, 0, 0]).map(ds).join('\\'))
    w.element(0x0020, 0x0037, 'DS', (opts.iop ?? [1, 0, 0, 0, 1, 0]).map(ds).join('\\'))
    w.element(0x0020, 0x0052, 'UI', opts.forUid ?? '1.2.826.0.1.3680043.8.498.3')
    w.element(0x0028, 0x0002, 'US', [1, 0])                     // SamplesPerPixel
    w.element(0x0028, 0x0008, 'IS', String(opts.numberOfFrames ?? 1))
    w.element(0x0028, 0x0010, 'US', [(rows) & 0xff, (rows >> 8) & 0xff])
    w.element(0x0028, 0x0011, 'US', [(cols) & 0xff, (cols >> 8) & 0xff])
    w.element(0x0028, 0x0030, 'DS', (opts.pixelSpacing ?? [1, 1]).map(ds).join('\\'))
    w.element(0x0028, 0x0100, 'US', [(bits) & 0xff, (bits >> 8) & 0xff])
    w.element(0x0028, 0x0103, 'US', [signed ? 1 : 0, 0])
    w.element(0x0028, 0x1052, 'DS', ds(opts.rescaleIntercept ?? 0))
    w.element(0x0028, 0x1053, 'DS', ds(opts.rescaleSlope ?? 1))
    w.element(0x0054, 0x1001, 'UN', opts.units ?? '')
    w.element(0x0054, 0x1102, 'CS', opts.decayCorrection ?? '')
    w.element(0x7fe0, 0x0010, bits === 8 ? 'OB' : 'OW', pix)
    return w.build()
}
