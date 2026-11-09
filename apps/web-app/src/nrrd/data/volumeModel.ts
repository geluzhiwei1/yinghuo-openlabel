/**
 * 医学体数据统一模型。
 *
 * 内部约定:
 * - 世界坐标 RAS(+x=Right, +y=Anterior, +z=Superior), 单位 mm
 * - 网格轴对齐: i≈R, j≈A, k≈S, 体素索引 idx = k*nx*ny + j*nx + i
 * - MedicalVolume 是重采样后的轴对齐体; RawVolume 是文件原始排列(affine 任意)
 */
import * as THREE from 'three'

export type Modality = 'ct' | 'pet' | 'mr' | 'other'

export type VolumeData = Int16Array | Uint16Array | Int32Array | Float32Array

export interface VolumeGrid {
    dims: [number, number, number]      // nx, ny, nz
    spacing: [number, number, number]   // mm
    origin: [number, number, number]    // voxel(0,0,0) 中心的 RAS 坐标
}

/** 文件解析产物: 数据仍按文件轴序, affine 为 4x4 行主序 ijk(file)→RAS */
export interface RawVolume {
    data: VolumeData
    dims: [number, number, number]
    affine: number[]                    // 长度16, 行主序
    modality: Modality
    meta?: Record<string, unknown>
}

/** 轴对齐体数据(渲染/标注直接使用) */
export interface MedicalVolume {
    data: VolumeData
    grid: VolumeGrid
    affine: number[]                    // 行主序 = diag(spacing)+origin
    modality: Modality
    intensity: { min: number; max: number }
    meta?: Record<string, unknown>
}

export const voxelIndex = (g: VolumeGrid, i: number, j: number, k: number) =>
    k * g.dims[0] * g.dims[1] + j * g.dims[0] + i

export const voxelCount = (g: VolumeGrid) => g.dims[0] * g.dims[1] * g.dims[2]

export const voxelToWorld = (g: VolumeGrid, i: number, j: number, k: number): [number, number, number] => [
    g.origin[0] + i * g.spacing[0],
    g.origin[1] + j * g.spacing[1],
    g.origin[2] + k * g.spacing[2],
]

export const worldToVoxel = (g: VolumeGrid, x: number, y: number, z: number): [number, number, number] => [
    (x - g.origin[0]) / g.spacing[0],
    (y - g.origin[1]) / g.spacing[1],
    (z - g.origin[2]) / g.spacing[2],
]

export function gridAffine(g: VolumeGrid): number[] {
    const [sx, sy, sz] = g.spacing
    const [ox, oy, oz] = g.origin
    return [
        sx, 0, 0, ox,
        0, sy, 0, oy,
        0, 0, sz, oz,
        0, 0, 0, 1,
    ]
}

export function intensityRange(data: VolumeData): { min: number; max: number } {
    // 抽样估计(全量扫描大体积太慢, 1/16 抽样足够稳)
    const step = Math.max(1, Math.floor(data.length / (1 << 21)))
    let min = Infinity
    let max = -Infinity
    for (let idx = 0; idx < data.length; idx += step) {
        const v = data[idx]
        if (v < min) min = v
        if (v > max) max = v
    }
    return { min, max }
}

/** 行主序 affine → three Matrix4(three 内部列主序) */
export function affineToMatrix4(affine: number[]): THREE.Matrix4 {
    return new THREE.Matrix4().set(
        affine[0], affine[1], affine[2], affine[3],
        affine[4], affine[5], affine[6], affine[7],
        affine[8], affine[9], affine[10], affine[11],
        affine[12], affine[13], affine[14], affine[15],
    )
}

export function invertAffine(affine: number[]): number[] {
    const m = affineToMatrix4(affine).invert()
    const e = m.elements // 列主序
    return [
        e[0], e[4], e[8], e[12],
        e[1], e[5], e[9], e[13],
        e[2], e[6], e[10], e[14],
        e[3], e[7], e[11], e[15],
    ]
}

/** 用目标网格采样源 affine 体数据的坐标计算(file/general 路径共用) */
export function applyAffine(affine: number[], i: number, j: number, k: number): [number, number, number] {
    return [
        affine[0] * i + affine[1] * j + affine[2] * k + affine[3],
        affine[4] * i + affine[5] * j + affine[6] * k + affine[7],
        affine[8] * i + affine[9] * j + affine[10] * k + affine[11],
    ]
}

export type Axis = 0 | 1 | 2   // 0=sagittal(i), 1=coronal(j), 2=axial(k)

export const axisName = (a: Axis) => (a === 0 ? 'sagittal' : a === 1 ? 'coronal' : 'axial')
