/**
 * GrowCut 种子层: FG/BG 独立 Uint8 体积(同位互斥), 笔刷涂种子,
 * Enter/运行按钮触发 worker 元胞自动机 → fg 胜出体素写激活 segment(一条 runs undo)。
 */
import { reactive, ref } from 'vue'
import { volState } from '../store'
import { getLabelmap } from './labelmap'
import { segState, getSegment, refreshVoxelCounts, markSegmentsInRuns } from './segments'
import { undoStack } from './undoStack'
import { notifyDirty } from './tools'
import { runGrowCut, cancelGrowCut } from './segAlgoClient'
import type { VoxelBBox } from './labelmap'
import type { StampEvent } from './tools'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

let fg: Uint8Array | null = null
let bg: Uint8Array | null = null

export const growState = reactive({ busy: false, progress: 0, hasSeeds: false })
/** 种子变化 → 视图 overlay 重绘 */
export const seedTick = ref(0)

export function getSeedLayers() { return { fg, bg } }

export function clearGrowCutSeeds() {
  fg = null
  bg = null
  growState.hasSeeds = false
  seedTick.value++
}

/** 圆盘种子涂写(与 labelmap.paintDisk 同几何: 世界毫米半径); fg/bg 同位互斥 */
export function paintSeedDisk(ev: StampEvent, radiusVox: number) {
  const lm = getLabelmap()
  if (!lm || !fg) return
  const s = lm.grid.spacing
  const [su, sv] = ev.axis === 2 ? [s[0], s[1]] : ev.axis === 1 ? [s[0], s[2]] : [s[1], s[2]]
  const rWorld = radiusVox * Math.min(s[0], s[1], s[2])
  const ru = rWorld / su, rv = rWorld / sv
  const layer = volState.growSeed === 'fg' ? fg! : bg!
  const other = volState.growSeed === 'fg' ? bg! : fg!
  const u0 = Math.max(0, Math.floor(ev.u - ru))
  const u1 = Math.min((ev.axis === 0 ? lm.dims[1] : lm.dims[0]) - 1, Math.ceil(ev.u + ru))
  const planeV = ev.axis === 2 ? lm.dims[1] : lm.dims[2]
  const v0 = Math.max(0, Math.floor(ev.v - rv))
  const v1 = Math.min(planeV - 1, Math.ceil(ev.v + rv))
  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      const du = (u - ev.u) * su, dv = (v - ev.v) * sv
      if (du * du + dv * dv > rWorld * rWorld) continue
      const [i, j, k] = lm.planeToVoxel(ev.axis, ev.slice, u, v)
      const t = lm.idx(i, j, k)
      layer[t] = 1
      other[t] = 0
    }
  }
  growState.hasSeeds = true
  seedTick.value++
}

/** 首次落笔时惰性分配种子层 */
export function beginSeedStroke() {
  const lm = getLabelmap()
  if (!lm) return
  if (!fg || fg.length !== lm.data.length) {
    fg = new Uint8Array(lm.data.length)
    bg = new Uint8Array(lm.data.length)
    growState.hasSeeds = false
  }
}

export function cancelGrowCutApply() {
  cancelGrowCut()
}

export async function runGrowCutApply(): Promise<void> {
  const lm = getLabelmap()
  const seg = getSegment(segState.activeId)
  if (!lm || !seg) return
  if (!fg || !growState.hasSeeds) {
    ElMessage.warning(i18n.global.t('nrrd.seg.growEmpty'))
    return
  }
  if (growState.busy) return
  growState.busy = true
  growState.progress = 0
  try {
    const indices = await runGrowCut(fg, bg!, 100, frac => { growState.progress = frac })
    if (!indices.length) {
      ElMessage.warning(i18n.global.t('nrrd.seg.growNoResult'))
      return
    }
    const [nx, ny] = lm.dims
    lm.beginStroke()
    let bbox: VoxelBBox = { i0: Infinity, j0: Infinity, k0: Infinity, i1: -1, j1: -1, k1: -1 }
    for (let t = 0; t < indices.length; t++) {
      const idx = indices[t]
      const cur = lm.data[idx]
      if (cur === 0 || cur === seg.id) lm.setVoxelIdx(idx, seg.id)
      const k = (idx / (nx * ny)) | 0
      const j = ((idx - k * nx * ny) / nx) | 0
      const i = idx - k * nx * ny - j * nx
      bbox = {
        i0: Math.min(bbox.i0, i), j0: Math.min(bbox.j0, j), k0: Math.min(bbox.k0, k),
        i1: Math.max(bbox.i1, i), j1: Math.max(bbox.j1, j), k1: Math.max(bbox.k1, k),
      }
    }
    const runs = lm.endStroke()
    if (runs) {
      undoStack.push(runs, 'growCut')
      markSegmentsInRuns(runs)
      refreshVoxelCounts()
      notifyDirty(bbox)
      ElMessage.success(i18n.global.t('nrrd.seg.growRan', { n: runs.indices.length }))
    }
    clearGrowCutSeeds()
  } catch (e: any) {
    if (String(e?.message) !== 'cancelled') ElMessage.error(String(e?.message ?? e))
  } finally {
    growState.busy = false
  }
}
