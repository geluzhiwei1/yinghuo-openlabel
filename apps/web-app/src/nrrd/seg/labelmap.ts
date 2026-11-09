/**
 * 体素 labelmap(Uint16, 值=segment id)与绘制操作。
 * 每笔画期间增量记录 (体素 → 旧值), 笔画结束压缩成 runs 命令供 undo/redo。
 * 笔刷半径按"世界毫米"解释(radius 体素 × 最小间距), 各向异性下保持圆形/球形。
 */
import type { VolumeGrid, VolumeData } from '../data/volumeModel'

export interface VoxelBBox {
  i0: number; j0: number; k0: number
  i1: number; j1: number; k1: number
}

export interface StrokeRuns {
  indices: Uint32Array
  before: Uint16Array
  after: Uint16Array
}

export interface PaintOpts {
  threshold?: { data: VolumeData; lo: number; hi: number } | null
  /** 只改写当前值等于 maskValue 的体素(橡皮"仅当前段"用) */
  maskValue?: number
}

const bboxUnion = (a: VoxelBBox | null, i: number, j: number, k: number): VoxelBBox =>
  !a ? { i0: i, j0: j, k0: k, i1: i, j1: j, k1: k } : {
    i0: Math.min(a.i0, i), j0: Math.min(a.j0, j), k0: Math.min(a.k0, k),
    i1: Math.max(a.i1, i), j1: Math.max(a.j1, j), k1: Math.max(a.k1, k),
  }

export class LabelmapVolume {
  data: Uint16Array
  grid: VolumeGrid
  /** 本次笔画累计脏 bbox(体素) */
  strokeBBox: VoxelBBox | null = null
  private recorder = new Map<number, number>()
  private stroking = false

  constructor(grid: VolumeGrid) {
    this.grid = grid
    this.data = new Uint16Array(grid.dims[0] * grid.dims[1] * grid.dims[2])
  }

  get dims(): [number, number, number] { return this.grid.dims }

  idx(i: number, j: number, k: number): number {
    const [nx, ny] = this.grid.dims
    return k * nx * ny + j * nx + i
  }

  beginStroke() {
    this.stroking = true
    this.recorder.clear()
    this.strokeBBox = null
  }

  /** 单体素写(笔画外调用直接生效且不入栈) */
  setVoxel(i: number, j: number, k: number, val: number) {
    if (i < 0 || j < 0 || k < 0) return
    const [nx, ny, nz] = this.grid.dims
    if (i >= nx || j >= ny || k >= nz) return
    this.setVoxelIdx(this.idx(i, j, k), val)
  }

  /** 按线性索引写(算法结果批量应用), 笔画中自动记录 undo */
  setVoxelIdx(idx: number, val: number) {
    if (idx < 0 || idx >= this.data.length) return
    const cur = this.data[idx]
    if (cur === val) return
    if (this.stroking) {
      if (!this.recorder.has(idx)) this.recorder.set(idx, cur)
      const [nx, ny] = this.grid.dims
      const k = (idx / (nx * ny)) | 0
      const j = ((idx - k * nx * ny) / nx) | 0
      const i = idx - k * nx * ny - j * nx
      this.strokeBBox = bboxUnion(this.strokeBBox, i, j, k)
    }
    this.data[idx] = val
  }

  /** 取消笔画: 回滚 recorder 中的旧值, 返回回滚区域 bbox */
  revertStroke(): VoxelBBox | null {
    const bbox = this.strokeBBox
    for (const [idx, before] of this.recorder) this.data[idx] = before
    this.recorder.clear()
    this.stroking = false
    this.strokeBBox = null
    return bbox
  }

  /** 结束笔画: 返回 runs(空笔画返回 null) */
  endStroke(): StrokeRuns | null {
    this.stroking = false
    if (this.recorder.size === 0) { this.strokeBBox = null; return null }
    const indices = new Uint32Array(this.recorder.size)
    let p = 0
    for (const idx of this.recorder.keys()) indices[p++] = idx
    indices.sort()
    const before = new Uint16Array(indices.length)
    const after = new Uint16Array(indices.length)
    for (let t = 0; t < indices.length; t++) {
      before[t] = this.recorder.get(indices[t])!
      after[t] = this.data[indices[t]]
    }
    this.recorder.clear()
    this.strokeBBox = null
    return { indices, before, after }
  }

  /** 应用 runs 的一侧(undo=before, redo=after) */
  applyRuns(runs: StrokeRuns, side: 'before' | 'after') {
    const vals = side === 'before' ? runs.before : runs.after
    for (let t = 0; t < runs.indices.length; t++) this.data[runs.indices[t]] = vals[t]
  }

  /** 收集某 segment 全部体素变化为 runs(删除段用) */
  collectSegment(segId: number): StrokeRuns | null {
    const idxs: number[] = []
    for (let t = 0; t < this.data.length; t++) if (this.data[t] === segId) idxs.push(t)
    if (!idxs.length) return null
    const indices = new Uint32Array(idxs)
    const before = new Uint16Array(indices.length)
    const after = new Uint16Array(indices.length)
    for (let t = 0; t < indices.length; t++) before[t] = segId
    return { indices, before, after }
  }

  count(segId: number): number {
    let n = 0
    for (let t = 0; t < this.data.length; t++) if (this.data[t] === segId) n++
    return n
  }

  /** 切片平面 (u,v) → 体素, 轴独立 */
  planeToVoxel(axis: 0 | 1 | 2, slice: number, u: number, v: number): [number, number, number] {
    return axis === 2 ? [u, v, slice] : axis === 1 ? [u, slice, v] : [slice, u, v]
  }

  /**
   * 2D 圆盘笔刷: 在切片平面上以 (cu,cv) 为心画半径 r 世界毫米的圆。
   * 返回本 stamp 的 bbox(null=没写到任何体素)。
   */
  paintDisk(
    axis: 0 | 1 | 2, slice: number, cu: number, cv: number,
    radiusVox: number, val: number, opts?: PaintOpts,
  ): VoxelBBox | null {
    const s = this.grid.spacing
    const [su, sv] = axis === 2 ? [s[0], s[1]]
      : axis === 1 ? [s[0], s[2]] : [s[1], s[2]]
    const rWorld = radiusVox * Math.min(s[0], s[1], s[2])
    const ru = rWorld / su, rv = rWorld / sv
    let bbox: VoxelBBox | null = null
    const u0 = Math.max(0, Math.floor(cu - ru)), u1 = Math.min(this.dims[axis === 0 ? 1 : 0] - 1, Math.ceil(cu + ru))
    const planeV = axis === 2 ? this.dims[1] : this.dims[2]
    const v0 = Math.max(0, Math.floor(cv - rv)), v1 = Math.min(planeV - 1, Math.ceil(cv + rv))
    for (let v = v0; v <= v1; v++) {
      for (let u = u0; u <= u1; u++) {
        const du = (u - cu) * su, dv = (v - cv) * sv
        if (du * du + dv * dv > rWorld * rWorld) continue
        const [i, j, k] = this.planeToVoxel(axis, slice, u, v)
        const t = this.idx(i, j, k)
        if (opts?.maskValue !== undefined && this.data[t] !== opts.maskValue) continue
        if (opts?.threshold) {
          const { data, lo, hi } = opts.threshold
          const hu = data[t]
          if (hu < lo || hu > hi) continue
        }
        this.setVoxel(i, j, k, val)
        bbox = bboxUnion(bbox, i, j, k)
      }
    }
    return bbox
  }

  /** 3D 球刷: 以 (ci,cj,ck) 体素坐标为心, 世界球 */
  paintSphere(
    ci: number, cj: number, ck: number,
    radiusVox: number, val: number, opts?: PaintOpts,
  ): VoxelBBox | null {
    const [nx, ny, nz] = this.dims
    const s = this.grid.spacing
    const rWorld = radiusVox * Math.min(s[0], s[1], s[2])
    const ri = rWorld / s[0], rj = rWorld / s[1], rk = rWorld / s[2]
    let bbox: VoxelBBox | null = null
    const i0 = Math.max(0, Math.floor(ci - ri)), i1 = Math.min(nx - 1, Math.ceil(ci + ri))
    const j0 = Math.max(0, Math.floor(cj - rj)), j1 = Math.min(ny - 1, Math.ceil(cj + rj))
    const k0 = Math.max(0, Math.floor(ck - rk)), k1 = Math.min(nz - 1, Math.ceil(ck + rk))
    for (let k = k0; k <= k1; k++) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = (i - ci) * s[0], dy = (j - cj) * s[1], dz = (k - ck) * s[2]
          if (dx * dx + dy * dy + dz * dz > rWorld * rWorld) continue
          const t = this.idx(i, j, k)
          if (opts?.maskValue !== undefined && this.data[t] !== opts.maskValue) continue
          if (opts?.threshold) {
            const { data, lo, hi } = opts.threshold
            const hu = data[t]
            if (hu < lo || hu > hi) continue
          }
          this.setVoxel(i, j, k, val)
          bbox = bboxUnion(bbox, i, j, k)
        }
      }
    }
    return bbox
  }

  /** 整体积填充某值(初始化/载入用, 不入 undo) */
  fillAll(src: Uint16Array) {
    this.data.set(src)
    this.recorder.clear()
    this.stroking = false
  }
}

// ── 模块级单例(随帧切换重建) ──────────────────────────────
let labelVol: LabelmapVolume | null = null

export function initLabelmap(grid: VolumeGrid): LabelmapVolume {
  labelVol = new LabelmapVolume(grid)
  return labelVol
}

export function getLabelmap(): LabelmapVolume | null {
  return labelVol
}

export function disposeLabelmap() {
  labelVol = null
}
