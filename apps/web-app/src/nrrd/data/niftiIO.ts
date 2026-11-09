/**
 * NIfTI 读写(.nii / .nii.gz)。
 * 读: nifti-reader-js + fflate 自解压;affine 优先 sform, 缺失回退 qform。
 * 写: NIfTI-1 头(348B) + 4B 填充 + uint16 数据, 可选 gzip。
 */
import * as nifti from 'nifti-reader-js'
import { gunzipSync, gzipSync } from 'fflate'
import type { RawVolume, VolumeData, VolumeGrid, Modality } from './volumeModel'
import { gridAffine } from './volumeModel'

const DATATYPE_MAP: Record<number, VolumeData> = {
    2: Uint8Array as unknown as VolumeData,     // uint8
    4: Int16Array,                              // int16 (CT 常见)
    8: Int32Array,                              // int32
    16: Float32Array,                           // float32 (PET 常见)
    256: Int8Array as unknown as VolumeData,    // int8
    512: Uint16Array,                           // uint16
}

export function parseNifti(buf: ArrayBuffer, modality: Modality = 'ct'): RawVolume {
    let bytes = new Uint8Array(buf)
    if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        bytes = gunzipSync(bytes)
    }
    const ab = bytes.buffer.byteOffset === 0 && bytes.buffer.byteLength === bytes.byteLength
        ? bytes.buffer
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

    if (!nifti.isNIFTI(ab)) throw new Error('不是有效的 NIfTI 文件')
    const header = nifti.readHeader(ab) as any
    const dims: [number, number, number] = [header.dims[1], header.dims[2], header.dims[3]]
    if (dims.some(d => !d || d < 1)) throw new Error('NIfTI dims 无效')

    const Ctor = DATATYPE_MAP[header.datatypeCode]
    if (!Ctor) {
        throw new Error(`不支持的 NIfTI datatype code ${header.datatypeCode}(${header.numBitsPerVoxel}bit; 支持 int16/uint16/int32/float32/uint8)`)
    }

    const raw = new Uint8Array(nifti.readImage(header, ab))
    const n = dims[0] * dims[1] * dims[2]
    let data: VolumeData
    if (Ctor === Float32Array) {
        data = new Float32Array(raw.buffer, raw.byteOffset, n)
    } else if (Ctor === Int16Array) {
        data = new Int16Array(raw.buffer, raw.byteOffset, n)
    } else if (Ctor === Uint16Array) {
        data = new Uint16Array(raw.buffer, raw.byteOffset, n)
    } else if (Ctor === Int32Array) {
        data = new Int32Array(raw.buffer, raw.byteOffset, n)
    } else {
        data = new Uint8Array(raw.buffer, raw.byteOffset, n) as unknown as VolumeData
    }

    // scl_slope/inter 应用(slope=0 视为 1; 应用后统一 float32)
    const slope = header.scl_slope === 0 ? 1 : header.scl_slope
    const inter = header.scl_inter || 0
    if (slope !== 1 || inter !== 0) {
        const tmp = new (Ctor as any)(raw.buffer, raw.byteOffset, n)
        const src = new Float32Array(n)
        for (let i = 0; i < n; i++) src[i] = tmp[i] * slope + inter
        data = src
    }

    const affine = niftiAffine(header)
    const meta: Record<string, unknown> = { format: 'nifti', description: header.description }
    return { data, dims, affine, modality, meta }
}

/** sform 优先, qform 回退, 都没有 → diag(pixdim) */
export function niftiAffine(header: any): number[] {
    if ((header.sform_code as number) > 0 && header.affine) {
        const a = header.affine
        return [
            a[0][0], a[0][1], a[0][2], a[0][3],
            a[1][0], a[1][1], a[1][2], a[1][3],
            a[2][0], a[2][1], a[2][2], a[2][3],
            0, 0, 0, 1,
        ]
    }
    if ((header.qform_code as number) > 0) {
        // qform: R = diag(qfac) * quat_rotation * diag(pixdim) * ijk + qoffset
        const b = header.quatern_b, c = header.quatern_c, d = header.quatern_d
        const a = Math.sqrt(Math.max(0, 1 - b * b - c * c - d * d))
        const pd = header.pixDims
        const qfac = pd[0] < 0 ? -1 : 1
        const rot = [
            [a * a + b * b - c * c - d * d, 2 * b * c - 2 * a * d, 2 * b * d + 2 * a * c],
            [2 * b * c + 2 * a * d, a * a + c * c - b * b - d * d, 2 * c * d - 2 * a * b],
            [2 * b * d - 2 * a * c, 2 * c * d + 2 * a * b, a * a + d * d - c * c - b * b],
        ]
        for (let r = 0; r < 3; r++) {
            for (let col = 0; col < 3; col++) {
                rot[r][col] *= pd[col + 1]
            }
            rot[r][2] *= qfac
        }
        return [
            rot[0][0], rot[0][1], rot[0][2], header.qoffset_x,
            rot[1][0], rot[1][1], rot[1][2], header.qoffset_y,
            rot[2][0], rot[2][1], rot[2][2], header.qoffset_z,
            0, 0, 0, 1,
        ]
    }
    const pd = header.pixDims
    return [pd[1] || 1, 0, 0, 0, 0, pd[2] || 1, 0, 0, 0, 0, pd[3] || 1, 0, 0, 0, 0, 1]
}

/** labelmap → NIfTI-1 uint16 字节 */
export function writeSegNifti(labelmap: Uint16Array, grid: VolumeGrid, gz = false): Uint8Array {
    const [nx, ny, nz] = grid.dims
    const [sx, sy, sz] = grid.spacing
    const [ox, oy, oz] = grid.origin
    const header = new ArrayBuffer(352)
    const dv = new DataView(header)
    const i16 = (off: number, v: number) => dv.setInt16(off, v, true)
    const f32 = (off: number, v: number) => dv.setFloat32(off, v, true)

    dv.setInt32(0, 348, true)                       // sizeof_hdr
    i16(40, 3)                                      // dim[0]=3
    i16(42, nx); i16(44, ny); i16(46, nz)
    i16(48, 1); i16(50, 1); i16(52, 1); i16(54, 1)  // dim[4..7]
    i16(70, 512)                                    // datatype=uint16
    i16(72, 16)                                     // bitpix
    f32(76, 1)                                      // pixdim[0]
    f32(80, sx); f32(84, sy); f32(88, sz)
    f32(108, 352)                                   // vox_offset
    f32(112, 1); f32(116, 0)                        // scl_slope=1, inter=0
    i16(123, 2)                                     // xyzt_units: mm+sec(惯例无影响)
    i16(252, 0)                                     // qform_code
    i16(254, 1)                                     // sform_code=1 (scanner)
    f32(280, sx); f32(284, 0); f32(288, 0); f32(292, ox)   // srow_x
    f32(296, 0); f32(300, sy); f32(304, 0); f32(308, oy)   // srow_y
    f32(312, 0); f32(316, 0); f32(320, sz); f32(324, oz)   // srow_z
    dv.setInt32(328, 0, true)                       // intent_name 前半 + 清零(填充足矣)
    const magic = new Uint8Array(header, 344, 4)
    magic.set([0x6e, 0x2b, 0x31, 0x00])             // "n+1\0"
    dv.setInt32(348, 0, true)                       // 4B extension 标记(无扩展)

    const dataBytes = new Uint8Array(labelmap.buffer, labelmap.byteOffset, labelmap.byteLength)
    const plain = new Uint8Array(352 + dataBytes.length)
    plain.set(new Uint8Array(header), 0)
    plain.set(dataBytes, 352)
    return gz ? gzipSync(plain) : plain
}

export { gridAffine }
