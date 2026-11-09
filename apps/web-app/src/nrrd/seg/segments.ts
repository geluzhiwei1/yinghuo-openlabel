/**
 * Segment 注册表(reactive): id/名称/颜色/可见性/taxonomy 类别。
 * labelmap 体素值 = segment.id(从 1 起)。
 */
import { reactive, computed, ref } from 'vue'
import type { SegmentStyle } from '../render/sliceCompositor'
import { getLabelmap, type StrokeRuns } from './labelmap'
import { undoStack } from './undoStack'
import { sliceCompositor } from '../render/sliceCompositor'
import { volState } from '../store'

/** 服务端要求 label_uuid 是合法 Mongo ObjectId(24 hex), mask 文件名也用它 */
function newLabelUuid(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** 结构性 label 变化(undo/删段/可见性/颜色)后自增 — 视图 watch 它全量重合成 */
export const segTick = ref(0)
export function bumpSegRender() {
  sliceCompositor.bumpLabelVersion()
  segTick.value++
}

export const PALETTE = [
  '#e64a19', '#fdd835', '#7cb342', '#26a69a', '#42a5f5',
  '#7e57c2', '#ec407a', '#ff7043', '#9ccc65', '#8d6e63',
]

export interface Segment {
  id: number
  labelUuid: string       // 服务端 label_uuid(mask 文件名也用它)
  name: string
  color: string
  visible: boolean
  taxonomyKey: string     // '' = 未分类
  voxelCount: number
  /** 待保存状态: null=与服务端一致, create/update=待保存 */
  dirty: null | 'create' | 'update'
  /** 模型预标注来源(审核态): 保存(采纳/修改)后消失 */
  origin?: 'model'
}

/** 删除段墓碑: 保存时发 opType=remove, undo 删段时可还原注册表 */
export interface RemovedSegment {
  id: number
  labelUuid: string
  name: string
  color: string
  taxonomyKey: string
}

export const segState = reactive({
  segments: [] as Segment[],
  activeId: 0,
  nextId: 1,
  pendingRemoves: [] as RemovedSegment[],
})

export function addSegment(name = '', taxonomyKey = '', restore?: Partial<Segment>): Segment {
  const id = restore?.id ?? segState.nextId
  if (id >= segState.nextId) segState.nextId = id + 1
  const seg: Segment = {
    id,
    labelUuid: restore?.labelUuid ?? newLabelUuid(),
    name: name || restore?.name || `Segment ${segState.segments.length + 1}`,
    color: restore?.color || PALETTE[(id - 1) % PALETTE.length],
    visible: restore?.visible ?? true,
    taxonomyKey: restore?.taxonomyKey ?? taxonomyKey,
    voxelCount: restore?.voxelCount ?? 0,
    dirty: restore ? null : 'create',
    origin: restore?.origin,
  }
  segState.segments.push(seg)
  segState.activeId = seg.id
  bumpSegRender()
  return seg
}

/** 删除 segment: 体素清零(可 undo) + 注册表移入墓碑(保存时发 remove) */
export function removeSegment(id: number) {
  const lm = getLabelmap()
  const idx = segState.segments.findIndex(s => s.id === id)
  if (idx < 0) return
  const seg = segState.segments[idx]
  if (lm) {
    const runs = lm.collectSegment(id)
    if (runs) {
      // 直接把 after 侧全部置 0
      runs.after.fill(0)
      undoStack.push(runs, 'remove-segment')
      lm.applyRuns(runs, 'after')
    }
  }
  // dirty='create' 的段从未上过服务端, 直接丢弃无需发 remove
  if (seg.dirty !== 'create') {
    segState.pendingRemoves.push({
      id: seg.id, labelUuid: seg.labelUuid, name: seg.name,
      color: seg.color, taxonomyKey: seg.taxonomyKey,
    })
  }
  segState.segments.splice(idx, 1)
  if (segState.activeId === id) segState.activeId = segState.segments[0]?.id ?? 0
  bumpSegRender()
  volState.dirty = true
}

/** undo 删段: 从墓碑还原注册表(体素已由 undo 命令恢复) */
export function restoreRemovedSegment(id: number) {
  const idx = segState.pendingRemoves.findIndex(s => s.id === id)
  if (idx < 0) return
  const t = segState.pendingRemoves[idx]
  segState.pendingRemoves.splice(idx, 1)
  addSegment(t.name, t.taxonomyKey, {
    id: t.id, labelUuid: t.labelUuid, color: t.color, dirty: 'update',
  })
  volState.dirty = true
}

export function markSegmentDirty(id: number) {
  const seg = segState.segments.find(s => s.id === id)
  if (seg && seg.dirty === null) seg.dirty = 'update'
  volState.dirty = true
}

/** 审核采纳模型预标注段: 去掉 origin 标记并标脏(保存后服务端 origin 字段消失) */
export function acceptSegment(id: number) {
  const seg = segState.segments.find(s => s.id === id)
  if (!seg?.origin) return
  seg.origin = undefined
  markSegmentDirty(id)
}

/** runs 里出现过的所有 segment id 标脏(笔画/undo/redo 后调用) */
export function markSegmentsInRuns(runs: StrokeRuns) {
  const seen = new Set<number>()
  const scan = (arr: Uint16Array) => {
    for (let t = 0; t < arr.length; t++) {
      const v = arr[t]
      if (v && !seen.has(v)) { seen.add(v); markSegmentDirty(v) }
    }
  }
  scan(runs.before)
  scan(runs.after)
}

/** 保存成功后清空待保存状态 */
export function clearPersistState() {
  for (const s of segState.segments) s.dirty = null
  segState.pendingRemoves.length = 0
  volState.dirty = false
}

export function getSegment(id: number): Segment | undefined {
  return segState.segments.find(s => s.id === id)
}

/** compositor 用样式表(id → ABGR packed color + visible) */
export const segmentStyles = computed<Map<number, SegmentStyle>>(() => {
  const m = new Map<number, SegmentStyle>()
  for (const s of segState.segments) m.set(s.id, { color: packColor(s.color), visible: s.visible })
  return m
})

export function packColor(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  return 0xff000000 | (b << 16) | (g << 8) | r
}

/** 刷新各 segment 体素计数(笔画/undo/redo/载入后调用) */
export function refreshVoxelCounts() {
  const lm = getLabelmap()
  if (!lm) return
  for (const s of segState.segments) s.voxelCount = lm.count(s.id)
}

export function resetSegments() {
  segState.segments.length = 0
  segState.activeId = 0
  segState.nextId = 1
  segState.pendingRemoves.length = 0
  undoStack.clear()
  bumpSegRender()
}
