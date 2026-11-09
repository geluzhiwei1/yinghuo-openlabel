/**
 * 标注工具状态机: SliceView 指针事件 → labelmap 写入 → 通知视图局部重绘。
 * 笔刷类: 事件间沿直线按半径/2 步进补 stamp(快速拖动不断线)。
 * 轮廓工具: 拖动=自由手绘(抬笔闭合); 原地点击进入布点模式, 单击布点,
 *           点击起点/Enter/双击闭合 → DP 简化 → even-odd 栅格化。
 *           布点模式开"吸附边缘"时段与段走 Live Wire(Sobel 代价场 Dijkstra)。
 * 橡皮: eraserScope='active' 时只清空激活 segment 的体素(maskValue)。
 */
import type { Axis } from '../data/volumeModel'
import type { VoxelBBox, LabelmapVolume, PaintOpts } from './labelmap'
import { getLabelmap } from './labelmap'
import { undoStack } from './undoStack'
import { segState, refreshVoxelCounts, getSegment, bumpSegRender, markSegmentsInRuns, restoreRemovedSegment } from './segments'
import { volState, type ToolId } from '../store'
import { simplifyClosed, rasterizePolygon } from '../data/contours'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'
import { runMagicWand } from './segAlgoClient'
import { edgeCostField, liveWireTree, liveWirePath, planeGeometry, type LiveWireTree } from './algo'

export interface StampEvent {
  axis: Axis
  slice: number
  u: number            // 切片平面列坐标(浮点, 体素单位)
  v: number            // 切片平面行坐标
}

/** 每次脏区变化后的回调(视图挂局部重绘) */
type DirtyListener = (bbox: VoxelBBox) => void
const dirtyListeners = new Set<DirtyListener>()
export function onLabelDirty(fn: DirtyListener) {
  dirtyListeners.add(fn)
  return () => dirtyListeners.delete(fn)
}

/** 供插值等模块外触发视图局部重绘 */
export function notifyDirty(bbox: VoxelBBox | null) {
  if (!bbox) return
  for (const fn of dirtyListeners) fn(bbox)
}

interface StrokeCtx {
  tool: ToolId
  segId: number
  erasing: boolean
}

let stroking = false
let ctx: StrokeCtx | null = null
let last: StampEvent | null = null
let contourPts: [number, number][] = []
let contourAxis: Axis = 0
let contourSlice = 0
/** 轮廓模式: pending=按下未判定, free=自由手绘, click=点击布点 */
let contourMode: 'pending' | 'free' | 'click' = 'pending'
/** 布点模式: 光标位置(橡皮筋预览)与本轮待定的点击点 */
let contourCursor: [number, number] | null = null
let pendingClick: StampEvent | null = null
/** Live Wire: 已吸附路径(布点模式实际多边形) + 单源树 + 光标橡皮路径 */
let snapPath: [number, number][] = []
let snapTree: LiveWireTree | null = null
let livePath: [number, number][] = []
/** 代价场 LRU(8 张, 帧装载时清空) */
const edgeCache = new Map<string, Float32Array>()

export function resetLiveWireCache() {
  edgeCache.clear()
  snapTree = null
}

function snapCostField(): Float32Array | null {
  const b = volState.base
  if (!b) return null
  const key = `${contourAxis}|${contourSlice}`
  let c = edgeCache.get(key)
  if (c) {
    edgeCache.delete(key)
    edgeCache.set(key, c)
  } else {
    c = edgeCostField(b.data, b.grid.dims, contourAxis, contourSlice)
    if (edgeCache.size >= 8) edgeCache.delete(edgeCache.keys().next().value as string)
    edgeCache.set(key, c)
  }
  return c
}

function planeIdx(p: [number, number], planeW: number, planeH: number): number {
  const u = Math.max(0, Math.min(planeW - 1, Math.round(p[0])))
  const v = Math.max(0, Math.min(planeH - 1, Math.round(p[1])))
  return v * planeW + u
}

/** 单源树(源=最后顶点); 顶点/切片变化时重建, mousemove 只做 O(路径长) 回溯 */
function ensureTree(): LiveWireTree | null {
  const b = volState.base
  if (!b || !contourPts.length) return null
  const cost = snapCostField()
  if (!cost) return null
  const plane = planeGeometry(b.grid.dims, contourAxis)
  const src = planeIdx(contourPts[contourPts.length - 1], plane.planeW, plane.planeH)
  if (snapTree && snapTree.src === src) return snapTree
  snapTree = liveWireTree(cost, plane.planeW, plane.planeH, src)
  return snapTree
}

/** 两顶点间的路径段(吸附=Live Wire, 未吸附=直线), 不含起点 */
function wireSegment(from: [number, number], to: [number, number]): [number, number][] {
  if (!volState.contourSnap) return [to]
  const tree = ensureTree()
  if (!tree) return [to]
  const path = liveWirePath(tree, planeIdx(to, tree.w, tree.h))
  return path.length > 1 ? path.slice(1) : [to]
}

export function isStroking() { return stroking }

/** 无 segment 落笔提示(节流避免连点刷屏) */
let noSegWarnAt = 0
function warnNoSegment() {
  const now = Date.now()
  if (now - noSegWarnAt < 2500) return
  noSegWarnAt = now
  ElMessage.warning(i18n.global.t('nrrd.seg.needActive'))
}

/** 轮廓工具预览(自由手绘折线 / 布点顶点+吸附路径+橡皮筋) */
export function getContourPreview(): {
  axis: Axis; slice: number
  /** 渲染路径: 布点模式=已吸附路径+光标活路径; 手绘=顶点折线 */
  path: [number, number][]
  /** 布点顶点(方块渲染) */
  vertices: [number, number][]
  live: [number, number][]
  mode: 'pending' | 'free' | 'click'; cursor: [number, number] | null
} | null {
  if (!stroking || !ctx || ctx.tool !== 'contour' || contourPts.length < 1) return null
  const useSnapPath = contourMode === 'click' && snapPath.length >= 2
  const path = useSnapPath ? snapPath.concat(livePath) : contourPts
  return { axis: contourAxis, slice: contourSlice, path, vertices: contourPts, live: livePath, mode: contourMode, cursor: contourCursor }
}

function thresholdOpts() {
  const { lo, hi } = volState.thresholdRange
  if (volState.activeTool !== 'thresholdPaint' || !volState.base) return null
  return { data: volState.base.data, lo, hi }
}

function stampAt(ev: StampEvent): VoxelBBox | null {
  const lm = getLabelmap()
  if (!lm || !ctx) return null
  const val = ctx.erasing ? 0 : ctx.segId
  const r = volState.brushRadius
  const opts: PaintOpts = { threshold: thresholdOpts() }
  if (ctx.erasing && volState.eraserScope === 'active') opts.maskValue = ctx.segId
  if (ctx.tool === 'sphereBrush') {
    const [i, j, k] = lm.planeToVoxel(ev.axis, ev.slice, Math.round(ev.u), Math.round(ev.v))
    return lm.paintSphere(i, j, k, r, val, opts)
  }
  return lm.paintDisk(ev.axis, ev.slice, ev.u, ev.v, r, val, opts)
}

export function beginStroke(ev: StampEvent) {
  const tool = volState.activeTool
  if (tool === 'none') return
  const lm = getLabelmap()
  if (!lm || !getSegment(segState.activeId)) { warnNoSegment(); return }
  // 布点模式进行中再次点击: 续笔不重置, 点击点在 endStroke 落定
  if (stroking && ctx?.tool === 'contour' && contourMode === 'click') {
    pendingClick = ev
    return
  }
  stroking = true
  ctx = { tool, segId: segState.activeId, erasing: tool === 'eraser' }
  last = ev
  if (tool === 'contour') {
    contourPts = [[ev.u, ev.v]]
    contourAxis = ev.axis
    contourSlice = ev.slice
    contourMode = 'pending'
    contourCursor = [ev.u, ev.v]
    pendingClick = null
    snapPath = [[ev.u, ev.v]]
    snapTree = null
    livePath = []
    return
  }
  lm.beginStroke()
  notifyDirty(stampAt(ev))
}

export function moveStroke(ev: StampEvent) {
  if (!stroking || !ctx || !last) return
  if (ctx.tool === 'contour') {
    contourCursor = [ev.u, ev.v]
    if (contourMode === 'pending') {
      const d0 = Math.hypot(ev.u - contourPts[0][0], ev.v - contourPts[0][1])
      if (d0 > 2.5) contourMode = 'free'
      else return
    }
    if (contourMode === 'click') {
      // 吸附开: 橡皮筋=树回溯路径(树源=最后顶点, 顶点落定后已重建)
      if (volState.contourSnap) {
        const tree = ensureTree()
        livePath = tree
          ? liveWirePath(tree, planeIdx([ev.u, ev.v], tree.w, tree.h))
          : []
      } else livePath = []
      return
    }
    const [pu, pv] = contourPts[contourPts.length - 1]
    if (Math.hypot(ev.u - pu, ev.v - pv) > 1) contourPts.push([ev.u, ev.v])
    return
  }
  const du = ev.u - last.u, dv = ev.v - last.v
  const dist = Math.hypot(du, dv)
  const step = Math.max(1, volState.brushRadius / 2)
  const n = Math.floor(dist / step)
  let bbox: VoxelBBox | null = null
  if (n > 0) {
    for (let t = 1; t <= n; t++) {
      const f = (t * step) / dist
      bbox = mergeBBox(bbox, stampAt({ axis: ev.axis, slice: ev.slice, u: last.u + du * f, v: last.v + dv * f }))
    }
    last = ev
  } else if (dist > 0.5) {
    bbox = stampAt(ev)
    last = ev
  }
  notifyDirty(bbox)
}

const mergeBBox = (a: VoxelBBox | null, b: VoxelBBox | null): VoxelBBox | null => {
  if (!a) return b
  if (!b) return a
  return {
    i0: Math.min(a.i0, b.i0), j0: Math.min(a.j0, b.j0), k0: Math.min(a.k0, b.k0),
    i1: Math.max(a.i1, b.i1), j1: Math.max(a.j1, b.j1), k1: Math.max(a.k1, b.k1),
  }
}

export function endStroke(ev?: StampEvent) {
  const lm = getLabelmap()
  if (!stroking || !ctx || !lm) { stroking = false; ctx = null; return }
  if (ctx.tool === 'contour') {
    // pending=原地点击(与拖动区分), click=布点模式落一个顶点; 布点模式保持进行中
    if (contourMode === 'pending') {
      contourMode = 'click'
      appendContourVertex(pendingClick ?? ev ?? last)
    } else if (contourMode === 'click' && (pendingClick || ev)) {
      appendContourVertex(pendingClick ?? ev)
    } else if (contourMode === 'free') {
      applyContour(lm)
    }
    pendingClick = null
    if (contourMode !== 'click') resetStrokeState()
    return
  }
  const runs = lm.endStroke()
  if (runs) {
    undoStack.push(runs, ctx.tool)
    markSegmentsInRuns(runs)
  }
  refreshVoxelCounts()
  resetStrokeState()
}

function resetStrokeState() {
  stroking = false
  ctx = null
  last = null
  contourPts = []
  contourCursor = null
  pendingClick = null
  contourMode = 'pending'
  snapPath = []
  snapTree = null
  livePath = []
}

/** 布点: 距上一顶点足够远才收录; 落在起点附近视为闭合。
 *  吸附开时段与段之间走 Live Wire, 关时段=直线; snapPath 始终累积实际路径。 */
function appendContourVertex(ev: StampEvent | null) {
  if (!ev) return
  const p: [number, number] = [ev.u, ev.v]
  const closeDist = 6
  if (contourPts.length >= 3 && Math.hypot(p[0] - contourPts[0][0], p[1] - contourPts[0][1]) < closeDist) {
    finishContour()
    return
  }
  const [lu, lv] = contourPts[contourPts.length - 1]
  if (Math.hypot(p[0] - lu, p[1] - lv) < 1.5) return
  const seg = wireSegment([lu, lv], p)
  snapPath.push(...seg)
  contourPts.push(p)
  // 新顶点成为下一段的树源
  if (volState.contourSnap) {
    ensureTree()
    livePath = []
  }
}

/** 显式闭合(Enter/双击/点击起点) */
export function finishContour() {
  const lm = getLabelmap()
  if (!stroking || !ctx || ctx.tool !== 'contour' || !lm) return
  // 布点模式: 补上最后顶点→起点的闭合段
  if (contourMode === 'click' && snapPath.length >= 2) {
    const first = contourPts[0]
    const lastV = contourPts[contourPts.length - 1]
    const seg = wireSegment(lastV, first)
    snapPath.push(...seg.slice(0, -1))   // 去掉与起点重复的末点(多边形隐式闭合)
  }
  applyContour(lm)
  refreshVoxelCounts()
  resetStrokeState()
}

function applyContour(lm: LabelmapVolume) {
  const useSnap = contourMode === 'click' && snapPath.length >= 3
  const raw = useSnap ? snapPath : contourPts
  if (raw.length < 3) { contourPts = []; snapPath = []; return }
  const poly = simplifyClosed(raw, useSnap ? 0.25 : 0.5)
  contourPts = []
  snapPath = []
  const segId = ctx!.segId
  const [nx, ny, nz] = lm.dims
  const w = contourAxis === 0 ? ny : nx
  const h = contourAxis === 2 ? ny : nz
  lm.beginStroke()
  rasterizePolygon(poly, w, h, (u, v) => {
    const [i, j, k] = lm.planeToVoxel(contourAxis, contourSlice, u, v)
    lm.setVoxel(i, j, k, segId)
  })
  const runs = lm.endStroke()
  if (runs) {
    undoStack.push(runs, 'contour')
    markSegmentsInRuns(runs)
    notifyDirty({ i0: 0, j0: 0, k0: 0, i1: nx - 1, j1: ny - 1, k1: nz - 1 })
  }
}

/** 取消进行中的笔画(ESC): 回滚 recorder 记录的体素 */
export function cancelStroke() {
  const lm = getLabelmap()
  if (stroking && lm && ctx && ctx.tool !== 'contour') {
    const bbox = lm.revertStroke()
    notifyDirty(bbox)
  }
  resetStrokeState()
}

/** 魔法棒: 点击即种子, worker 洪泛 → 激活 segment 一条 runs undo */
let wandBusy = false
export async function applyMagicWand(ev: StampEvent) {
  const lm = getLabelmap()
  const b = volState.base
  if (!lm || !b) return
  if (!getSegment(segState.activeId)) { warnNoSegment(); return }
  if (wandBusy) return
  const seg = getSegment(segState.activeId)!
  const seed = lm.planeToVoxel(ev.axis, ev.slice, Math.round(ev.u), Math.round(ev.v))
  const seedIdx = lm.idx(seed[0], seed[1], seed[2])
  const hu = b.data[seedIdx]
  const lo = volState.wandCriterion === 'threshold'
    ? volState.thresholdRange.lo
    : Math.round(hu - volState.wandTolerance)
  const hi = volState.wandCriterion === 'threshold'
    ? volState.thresholdRange.hi
    : Math.round(hu + volState.wandTolerance)
  wandBusy = true
  try {
    const indices = await runMagicWand({ seed, lo, hi, scope: volState.wandScope, axis: ev.axis })
    if (!indices.length) {
      ElMessage.warning(i18n.global.t('nrrd.seg.wandEmpty'))
      return
    }
    const [nx, ny, nz] = lm.dims
    lm.beginStroke()
    let bbox: VoxelBBox | null = null
    for (let t = 0; t < indices.length; t++) {
      const idx = indices[t]
      if (lm.data[idx] === 0) lm.setVoxelIdx(idx, seg.id)
      const k = (idx / (nx * ny)) | 0
      const j = ((idx - k * nx * ny) / nx) | 0
      const i = idx - k * nx * ny - j * nx
      bbox = mergeBBox(bbox, { i0: i, j0: j, k0: k, i1: i, j1: j, k1: k })
    }
    const runs = lm.endStroke()
    if (runs) {
      undoStack.push(runs, 'magicWand')
      markSegmentsInRuns(runs)
      refreshVoxelCounts()
      notifyDirty(bbox)
    }
  } catch (e: any) {
    ElMessage.error(String(e?.message ?? e))
  } finally {
    wandBusy = false
  }
}

export function undoOne() {
  const lm = getLabelmap()
  const cmd = lm ? undoStack.undo(lm) : null
  if (cmd) {
    markSegmentsInRuns(cmd.runs)
    if (cmd.label === 'remove-segment') restoreRemovedSegment(cmd.runs.before.find(v => v) || 0)
    refreshVoxelCounts()
    bumpSegRender()
  }
}

export function redoOne() {
  const lm = getLabelmap()
  const cmd = lm ? undoStack.redo(lm) : null
  if (cmd) {
    markSegmentsInRuns(cmd.runs)
    refreshVoxelCounts()
    bumpSegRender()
  }
}
