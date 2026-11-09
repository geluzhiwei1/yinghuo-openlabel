/**
 * NRRD 读写。
 *
 * 读: 数据段解码/类型转换复用 three 的 NRRDLoader.parse();header 里 three 丢掉
 * space origin 且矩阵合成有歧义,affine 由我们自己从明文 header 解析
 * (NRRD 的 gzip/zlib 只压缩数据段, header 永远是明文)。
 * 写: labelmap → .seg.nrrd(gzip), 3D Slicer 可直接读。
 */
import { NRRDLoader } from 'three/examples/jsm/loaders/NRRDLoader.js'
import { gzipSync } from 'fflate'
import type { RawVolume, VolumeGrid, Modality } from './volumeModel'
import { gridAffine } from './volumeModel'

const SPACE_FLIPS: Record<string, [number, number, number]> = {
    'right-anterior-superior': [1, 1, 1],
    'left-anterior-superior': [-1, 1, 1],
    'left-posterior-superior': [-1, -1, 1],
    'right-posterior-superior': [1, -1, 1],
    'right-anterior-inferior': [1, 1, -1],
    'left-anterior-inferior': [-1, 1, -1],
    'left-posterior-inferior': [-1, -1, -1],
    'right-posterior-inferior': [1, -1, -1],
}

export function parseHeaderText(buf: ArrayBuffer): Map<string, string> {
    const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 1 << 16))
    let text = ''
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i])
    const fields = new Map<string, string>()
    for (const line of text.split(/\r?\n/)) {
        if (line === '') break // header 结束于空行
        const idx = line.indexOf(':')
        if (idx < 0) continue
        // 首个 ':' 后可能是 ':=' 分隔的 '='(Slicer Segment{N}_* 等字段)
        fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).replace(/^\s*=?/, '').trim())
    }
    return fields
}

function parseVec3(s: string): [number, number, number] | null {
    const m = s.replace(/[()]/g, '').split(/[\s,]+/).filter(x => x !== '')
    if (m.length !== 3) return null
    const v = m.map(Number)
    if (v.some(isNaN)) return null
    return [v[0], v[1], v[2]]
}

export function parseNrrd(buf: ArrayBuffer, modality: Modality = 'ct'): RawVolume {
    const fields = parseHeaderText(buf)
    if (!fields.has('sizes')) throw new Error('NRRD header 无 sizes 字段')

    const loader = new NRRDLoader()
    const vol = loader.parse(buf) as any
    const dims: [number, number, number] = [vol.xLength, vol.yLength, vol.zLength]
    const data = vol.data
    if (!data) throw new Error('NRRD 数据段解析失败')

    // affine: ijk(file) → RAS
    let affine: number[]
    const dirsRaw = fields.get('space directions')
    if (dirsRaw && dirsRaw !== 'none') {
        const parts = dirsRaw.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(x => x !== '')
        const vectors: [number, number, number][] = []
        for (let i = 0; i < 3; i++) {
            const v = parseVec3(parts.slice(i * 3, i * 3 + 3).join(','))
            if (!v) throw new Error('NRRD space directions 解析失败')
            vectors.push(v)
        }
        const space = fields.get('space') || 'right-anterior-superior'
        const flips = SPACE_FLIPS[space]
        if (!flips) throw new Error(`不支持的 NRRD space: ${space}`)
        const origin = parseVec3(fields.get('space origin') || '(0,0,0)') || [0, 0, 0]
        // 列 = 文件轴方向(含 spacing), 空间翻转作用于各分量
        const c = vectors.map(v => [v[0] * flips[0], v[1] * flips[1], v[2] * flips[2]] as [number, number, number])
        const o: [number, number, number] = [origin[0] * flips[0], origin[1] * flips[1], origin[2] * flips[2]]
        affine = [
            c[0][0], c[1][0], c[2][0], o[0],
            c[0][1], c[1][1], c[2][1], o[1],
            c[0][2], c[1][2], c[2][2], o[2],
            0, 0, 0, 1,
        ]
    } else {
        // 无空间信息: 用 spacings, 视为 RAS
        const sp = (fields.get('spacings') || '1,1,1').split(/[\s,]+/).map(Number)
        affine = [sp[0] || 1, 0, 0, 0, 0, sp[1] || 1, 0, 0, 0, 0, sp[2] || 1, 0, 0, 0, 0, 1]
    }

    return { data, dims, affine, modality, meta: { format: 'nrrd', space: fields.get('space') } }
}

/** labelmap → .seg.nrrd.gz 字节(整个文件 gzip, 数据段 raw) */
export function writeSegNrrd(labelmap: Uint16Array, grid: VolumeGrid, segmentNames: Map<number, string> = new Map()): Uint8Array {
    const [nx, ny, nz] = grid.dims
    const [sx, sy, sz] = grid.spacing
    const [ox, oy, oz] = grid.origin
    const lines = [
        'NRRD0005',
        'type: uint16',
        'dimension: 3',
        'space: right-anterior-superior',
        `sizes: ${nx} ${ny} ${nz}`,
        `space directions: (${sx},0,0) (0,${sy},0) (0,0,${sz})`,
        'kinds: domain domain domain',
        `space origin: (${ox},${oy},${oz})`,
        'endian: little',
        'encoding: raw',
    ]
    if (segmentNames.size > 0) {
        const segLine = [...segmentNames.entries()].map(([v, n]) => `${v}=${n}`).join(', ')
        lines.push(`labels: "${segLine}"`)
    }
    // three NRRDLoader 切分头/数据时丢最后一个字符(i-2 off-by-one): 'encoding: raw'→'ra'
    // 导致 raw 分支不命中。结尾补一行 '#' 注释, 被裁掉的只是注释符。
    lines.push('#')
    const header = new TextEncoder().encode(lines.join('\n') + '\n\n')
    const raw = new Uint8Array(labelmap.buffer, labelmap.byteOffset, labelmap.byteLength)
    const plain = new Uint8Array(header.length + raw.length)
    plain.set(header, 0)
    plain.set(raw, header.length)
    return gzipSync(plain)
}

/** seg.nrrd 的 grid 回读(用于加载已保存 mask) */
export function segNrrdGridAffine(): (raw: RawVolume) => { grid: VolumeGrid; data: Uint16Array } {
    return (raw: RawVolume) => {
        const [a, , , ox, , b, , oy, , , c, oz] = raw.affine
        return {
            grid: {
                dims: raw.dims,
                spacing: [a, b, c],
                origin: [ox, oy, oz],
            },
            data: raw.data as Uint16Array,
        }
    }
}

export { gridAffine }
