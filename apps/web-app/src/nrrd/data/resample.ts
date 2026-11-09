/**
 * 重采样。
 *
 * - normalizeToAxisAlignedRAS(raw): 文件体 → 轴对齐 RAS 的 MedicalVolume。
 *   快速路径(旋转列单非零, 覆盖绝大多数 CT/PET): 纯置换+翻转, 无插值损失。
 *   通用路径(斜切): 三线性采样到轴对齐包围盒网格。
 * - resampleToGrid(src, targetGrid): 任意源(轴对齐或 raw)重采样到目标网格
 *   (PET→CT 网格用; interp='nn' 供 labelmap)。
 */
import type { RawVolume, MedicalVolume, VolumeGrid, VolumeData } from './volumeModel'
import { gridAffine, intensityRange, voxelCount } from './volumeModel'

const EPS = 1e-6

interface AxisMapping {
    fileAxis: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]  // 输出轴 r → 文件轴
    flip: [boolean, boolean, boolean]
    grid: VolumeGrid
}

/** 检测 affine 旋转部分是否每列单非零元素; 是则返回快速映射, 否则 null */
function detectPermutation(affine: number[], dims: [number, number, number]): AxisMapping | null {
    // col f = (affine[0+f*? ...) 行主序: A[r][c] = affine[r*4+c]
    const fileAxis: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] = [-1, -1, -1] as any
    const flip: [boolean, boolean, boolean] = [false, false, false]
    const spacing: [number, number, number] = [1, 1, 1]
    const origin: [number, number, number] = [affine[3], affine[7], affine[11]]

    for (let c = 0; c < 3; c++) {
        let nonzero = -1
        for (let r = 0; r < 3; r++) {
            const v = affine[r * 4 + c]
            if (Math.abs(v) > EPS) {
                if (nonzero >= 0) return null // 该列多个非零 → 斜切
                nonzero = r
            }
        }
        if (nonzero < 0) return null
        if (fileAxis[nonzero] !== -1) return null // 冲突
        fileAxis[nonzero] = c as 0 | 1 | 2
        const v = affine[nonzero * 4 + c]
        flip[nonzero] = v < 0
        spacing[nonzero] = Math.abs(v)
        // 输出原点: 文件轴 c 的 i=0 世界分量 + 翻转补偿
        const d = dims[c] - 1
        const corner = v < 0 ? v * d : 0
        origin[nonzero] = affine[nonzero * 4 + 3] + corner
    }
    const outDims: [number, number, number] = [0, 0, 0]
    for (let r = 0; r < 3; r++) outDims[r] = dims[fileAxis[r]]
    return { fileAxis, flip, grid: { dims: outDims, spacing, origin } }
}

/** 快速路径: 置换+翻转拷贝 */
function permuteCopy(src: { data: VolumeData; dims: [number, number, number] }, m: AxisMapping): VolumeData {
    const [fd0, fd1, fd2] = src.dims
    const [nx, ny, nz] = m.grid.dims
    const n = nx * ny * nz
    // 文件轴 stride(NRRD/NIfTI 约定 axis0 最快: i 最快)
    const strides = [1, fd0, fd0 * fd1]
    const inData = src.data
    const out = new (inData.constructor as any)(n)
    const [fa0, fa1, fa2] = m.fileAxis
    const [fl0, fl1, fl2] = m.flip
    const s0 = strides[fa0], s1 = strides[fa1], s2 = strides[fa2]
    const d0 = src.dims[fa0] - 1, d1 = src.dims[fa1] - 1, d2 = src.dims[fa2] - 1
    let outIdx = 0
    for (let k = 0; k < nz; k++) {
        const ik = (fl2 ? d2 - k : k) * s2
        for (let j = 0; j < ny; j++) {
            const ij = (fl1 ? d1 - j : j) * s1
            const base = ik + ij
            if (s0 === 1) {
                // 源方向连续: 正向/反向整行拷贝
                const start = base + (fl0 ? d0 : 0)
                if (fl0) {
                    for (let i = 0; i < nx; i++) out[outIdx + i] = inData[start - i]
                } else {
                    for (let i = 0; i < nx; i++) out[outIdx + i] = inData[start + i]
                }
            } else {
                for (let i = 0; i < nx; i++) {
                    out[outIdx + i] = inData[base + (fl0 ? d0 - i : i) * s0]
                }
            }
            outIdx += nx
        }
    }
    return out
}

/** 通用路径: 目标网格三线性/NN 采样 */
export function resampleToGrid(
    src: { data: VolumeData; dims: [number, number, number]; affine: number[] },
    target: VolumeGrid,
    interp: 'trilinear' | 'nn' = 'trilinear',
    onProgress?: (frac: number) => void,
): VolumeData {
    const inv = invertAffineRowMajor(src.affine)
    const [nx, ny, nz] = target.dims
    const [sx, sy, sz] = target.spacing
    const [ox, oy, oz] = target.origin
    const [fdx, fdy, fdz] = src.dims
    const inData = src.data
    const out = new (inData.constructor as any)(nx * ny * nz)
    const layer = nx * ny
    // 目标 → 源 ijk 的基向量(行主序 inv * [x,y,z,1])
    const bx = [inv[0], inv[4], inv[8]]
    const by = [inv[1], inv[5], inv[9]]
    const bz = [inv[2], inv[6], inv[10]]
    const tx = inv[3], ty = inv[7], tz = inv[11]

    let outIdx = 0
    for (let k = 0; k < nz; k++) {
        const wz = oz + k * sz
        for (let j = 0; j < ny; j++) {
            const wy = oy + j * sy
            for (let i = 0; i < nx; i++) {
                const wx = ox + i * sx
                const fx = tx + bx[0] * wx + by[0] * wy + bz[0] * wz
                const fy = ty + bx[1] * wx + by[1] * wy + bz[1] * wz
                const fz = tz + bx[2] * wx + by[2] * wy + bz[2] * wz
                out[outIdx++] = interp === 'nn' ? sampleNN(inData, fdx, fdy, fdz, fx, fy, fz)
                    : sampleTrilinear(inData, fdx, fdy, fdz, fx, fy, fz)
            }
        }
        if (onProgress && (k & 15) === 0) onProgress(k / nz)
    }
    return out
}

function sampleNN(d: VolumeData, nx: number, ny: number, nz: number, x: number, y: number, z: number): number {
    const i = Math.min(nx - 1, Math.max(0, Math.round(x)))
    const j = Math.min(ny - 1, Math.max(0, Math.round(y)))
    const k = Math.min(nz - 1, Math.max(0, Math.round(z)))
    return d[(k * ny + j) * nx + i]
}

function sampleTrilinear(d: VolumeData, nx: number, ny: number, nz: number, x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x > nx - 1 || y > ny - 1 || z > nz - 1) return 0
    const x0 = Math.min(nx - 2, Math.floor(x)), y0 = Math.min(ny - 2, Math.floor(y)), z0 = Math.min(nz - 2, Math.floor(z))
    const fx = x - x0, fy = y - y0, fz = z - z0
    const base = (z0 * ny + y0) * nx + x0
    const c000 = d[base], c100 = d[base + 1]
    const c010 = d[base + nx], c110 = d[base + nx + 1]
    const c001 = d[base + nx * ny], c101 = d[base + nx * ny + 1]
    const c011 = d[base + nx * ny + nx], c111 = d[base + nx * ny + nx + 1]
    const c00 = c000 + (c100 - c000) * fx
    const c10 = c010 + (c110 - c010) * fx
    const c01 = c001 + (c101 - c001) * fx
    const c11 = c011 + (c111 - c011) * fx
    const c0 = c00 + (c10 - c00) * fy
    const c1 = c01 + (c11 - c01) * fy
    return c0 + (c1 - c0) * fz
}

function invertAffineRowMajor(a: number[]): number[] {
    // 仿射的旋转部分求逆 + 平移(通用 4x4 高斯消去也行, 这里轴对齐/斜切都通用)
    const m = [
        [a[0], a[1], a[2], a[3]],
        [a[4], a[5], a[6], a[7]],
        [a[8], a[9], a[10], a[11]],
        [0, 0, 0, 1],
    ]
    const inv = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for (let col = 0; col < 4; col++) {
        let piv = col
        for (let r = col + 1; r < 4; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r
        ;[m[col], m[piv]] = [m[piv], m[col]]
        ;[inv[col], inv[piv]] = [inv[piv], inv[col]]
        const p = m[col][col]
        if (Math.abs(p) < 1e-12) throw new Error('affine 不可逆')
        for (let c = 0; c < 4; c++) { m[col][c] /= p; inv[col][c] /= p }
        for (let r = 0; r < 4; r++) {
            if (r === col) continue
            const f = m[r][col]
            for (let c = 0; c < 4; c++) { m[r][c] -= f * m[col][c]; inv[r][c] -= f * inv[col][c] }
        }
    }
    return [
        inv[0][0], inv[0][1], inv[0][2], inv[0][3],
        inv[1][0], inv[1][1], inv[1][2], inv[1][3],
        inv[2][0], inv[2][1], inv[2][2], inv[2][3],
        0, 0, 0, 1,
    ]
}

/** raw → 轴对齐 RAS MedicalVolume */
export function normalizeToAxisAlignedRAS(raw: RawVolume, onProgress?: (frac: number) => void): MedicalVolume {
    const perm = detectPermutation(raw.affine, raw.dims)
    let data: VolumeData
    let grid: VolumeGrid
    if (perm) {
        data = permuteCopy(raw, perm)
        grid = perm.grid
        onProgress?.(1)
    } else {
        // 斜切: 目标网格 = 8 角落投影的 AABB, spacing 取列向量长度均值
        grid = aabbGrid(raw.affine, raw.dims)
        data = resampleToGrid(raw, grid, 'trilinear', onProgress)
    }
    return {
        data,
        grid,
        affine: gridAffine(grid),
        modality: raw.modality,
        intensity: intensityRange(data),
        meta: { ...raw.meta, originalAffine: raw.affine },
    }
}

function aabbGrid(affine: number[], dims: [number, number, number]): VolumeGrid {
    const corners: [number, number, number][] = []
    for (const i of [0, dims[0] - 1]) {
        for (const j of [0, dims[1] - 1]) {
            for (const k of [0, dims[2] - 1]) {
                corners.push([
                    affine[0] * i + affine[1] * j + affine[2] * k + affine[3],
                    affine[4] * i + affine[5] * j + affine[6] * k + affine[7],
                    affine[8] * i + affine[9] * j + affine[10] * k + affine[11],
                ])
            }
        }
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const c of corners) {
        for (let r = 0; r < 3; r++) {
            if (c[r] < min[r]) min[r] = c[r]
            if (c[r] > max[r]) max[r] = c[r]
        }
    }
    const spacing: [number, number, number] = [0, 0, 0]
    for (let c = 0; c < 3; c++) {
        spacing[c] = Math.hypot(affine[0 * 4 + c], affine[1 * 4 + c], affine[2 * 4 + c])
        if (!(spacing[c] > EPS)) spacing[c] = 1
    }
    const dimsOut: [number, number, number] = [
        Math.max(1, Math.round((max[0] - min[0]) / spacing[0]) + 1),
        Math.max(1, Math.round((max[1] - min[1]) / spacing[1]) + 1),
        Math.max(1, Math.round((max[2] - min[2]) / spacing[2]) + 1),
    ]
    return { dims: dimsOut, spacing, origin: min }
}

/** 已有 MedicalVolume 重采样到另一网格(PET→CT) */
export function resampleMedicalVolume(
    src: MedicalVolume, target: VolumeGrid, interp: 'trilinear' | 'nn' = 'trilinear',
): MedicalVolume {
    if (gridsEqual(src.grid, target)) return src
    const data = resampleToGrid({ data: src.data, dims: src.grid.dims, affine: src.affine }, target, interp)
    return {
        data,
        grid: target,
        affine: gridAffine(target),
        modality: src.modality,
        intensity: intensityRange(data),
        meta: src.meta,
    }
}

export const gridsEqual = (a: VolumeGrid, b: VolumeGrid) =>
    a.dims.every((v, i) => v === b.dims[i]) &&
    a.spacing.every((v, i) => Math.abs(v - b.spacing[i]) < 1e-4) &&
    a.origin.every((v, i) => Math.abs(v - b.origin[i]) < 1e-4)

export { voxelCount }
