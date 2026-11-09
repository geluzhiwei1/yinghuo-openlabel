/**
 * 分割文件导入(3D Slicer 兼容): .seg.nrrd(.gz) / 多标签 .nrrd(.gz) / labelmap .nii(.gz)。
 * 解析(含 Slicer Segment{N}_* 头) → 轴对齐 RAS → 网格对齐(几何一致零拷贝, 否则 NN 重采样)
 * → 按非零标签值拆 segment。4D "list" 格式(每段一卷)不支持, 明确报错。
 */
import { gunzipSync } from 'fflate'
import { parseNrrd, parseHeaderText } from './nrrdIO'
import { parseNifti } from './niftiIO'
import { normalizeToAxisAlignedRAS, resampleToGrid, gridsEqual } from './resample'
import type { VolumeData, VolumeGrid } from './volumeModel'

export interface ImportedSegmentInit {
    value: number
    name: string
    voxelCount: number
}

export interface ParsedSegmentation {
    /** 基网格上的原始标签值(0=背景), 索引 = k*nx*ny + j*nx + i */
    labels: ArrayLike<number>
    segments: ImportedSegmentInit[]
    /** 几何与基网格不一致, 已做 NN 重采样 */
    resampled: boolean
    format: 'nrrd' | 'nifti'
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.byteOffset === 0 && bytes.buffer.byteLength === bytes.byteLength
        ? bytes.buffer
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** `labels: "1=Liver, 2=Tumor"`(我方 writeSegNrrd 与 Slicer labelmap 卷的约定) */
function parseLabelsField(s: string): Map<number, string> {
    const m = new Map<number, string>()
    for (const part of s.split(',')) {
        const eq = part.indexOf('=')
        if (eq <= 0) continue
        const v = Number(part.slice(0, eq).trim())
        const name = part.slice(eq + 1).trim()
        if (Number.isFinite(v) && v > 0 && name) m.set(v, name)
    }
    return m
}

/** Slicer .seg.nrrd 头: Segment0_LabelValue := 1 / Segment0_Name := Liver */
function parseSegmentFields(fields: Map<string, string>): Map<number, string> {
    const m = new Map<number, string>()
    for (const [key, val] of fields) {
        const mm = key.match(/^Segment(\d+)_LabelValue$/)
        if (!mm) continue
        const v = Number(val)
        if (!Number.isFinite(v) || v <= 0) continue
        const name = (fields.get(`Segment${mm[1]}_Name`) || '').replace(/^"|"$/g, '').trim()
        m.set(v, name || `Segment ${mm[1]}`)
    }
    return m
}

export function parseSegmentationBytes(buf: ArrayBuffer, baseGrid: VolumeGrid): ParsedSegmentation {
    let bytes = new Uint8Array(buf)
    if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes)
    const ab = asArrayBuffer(bytes)
    const nrrd = bytes.length > 8 &&
        bytes[0] === 0x4e && bytes[1] === 0x52 && bytes[2] === 0x52 && bytes[3] === 0x44 && bytes[4] === 0x30

    let data: VolumeData
    let names: Map<number, string>
    let format: 'nrrd' | 'nifti'
    let grid: VolumeGrid
    let affine: number[]

    if (nrrd) {
        const fields = parseHeaderText(ab)
        const sizes = (fields.get('sizes') || '').trim().split(/[\s,]+/).filter(x => x !== '')
        if (fields.get('dimension') === '4' || sizes.length > 3) {
            throw new Error('4D 分割文件(Slicer "list" 格式, 每段一卷)暂不支持: 请在 3D Slicer 的 Segmentations 模块先导出/合并为 3D 多标签 labelmap')
        }
        const norm = normalizeToAxisAlignedRAS(parseNrrd(ab, 'other'))
        data = norm.data; grid = norm.grid; affine = norm.affine
        names = parseSegmentFields(fields)
        if (!names.size) {
            const lf = fields.get('labels')
            if (lf) names = parseLabelsField(lf.replace(/^"|"$/g, ''))
        }
        format = 'nrrd'
    } else {
        const dim0 = ab.byteLength > 42 ? new DataView(ab).getInt16(40, true) : 0
        if (dim0 > 3) {
            throw new Error('4D NIfTI 分割文件暂不支持: 请在 3D Slicer 导出 3D 多标签 labelmap 后再导入')
        }
        const norm = normalizeToAxisAlignedRAS(parseNifti(ab, 'other'))
        data = norm.data; grid = norm.grid; affine = norm.affine
        names = new Map()
        format = 'nifti'
    }

    let resampled = false
    if (!gridsEqual(grid, baseGrid)) {
        data = resampleToGrid({ data, dims: grid.dims, affine }, baseGrid, 'nn')
        resampled = true
    }

    const counts = new Map<number, number>()
    for (let t = 0; t < data.length; t++) {
        const v = data[t]
        if (v) counts.set(v, (counts.get(v) || 0) + 1)
    }
    if (!counts.size) {
        throw new Error(resampled
            ? '分割与当前体数据几何无重叠(重采样后无非零标签), 请确认分割文件与当前帧配套'
            : '分割文件不含任何非零标签')
    }
    const segments = [...counts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([value, voxelCount]) => ({ value, voxelCount, name: names.get(value) || `Label ${value}` }))
    return { labels: data, segments, resampled, format }
}
