/**
 * 分割命令栈(undo/redo)。
 * 命令 = runs(indices + before/after); 容量: 深度 ≤50 且字节 ≤256MB, 超限丢最旧。
 * 单命令 >64MB 时 gzip 压缩存取(整命令仍是 runs, 不是快照 — 压缩前就是稀疏差分)。
 */
import { gzipSync, gunzipSync } from 'fflate'
import { ref } from 'vue'
import type { LabelmapVolume } from './labelmap'
import type { StrokeRuns } from './labelmap'

/** 栈结构变化后自增(UI 按钮态刷新用) */
export const undoTick = ref(0)

const MAX_DEPTH = 50
const MAX_TOTAL_BYTES = 256 << 20
const COMPRESS_THRESHOLD = 64 << 20

interface StoredCommand {
  label: string
  runs: StrokeRuns | null        // null = 已压缩
  packed?: Uint8Array            // gzip([indices|before|after])
  n: number
  bytes: number
}

export class UndoStack {
  private stack: StoredCommand[] = []
  private top = 0                // 可 undo 数; stack.length - top = 可 redo 数
  totalBytes = 0

  get canUndo() { return this.top > 0 }
  get canRedo() { return this.top < this.stack.length }

  push(runs: StrokeRuns, label = 'edit') {
    // 丢弃 redo 尾
    while (this.stack.length > this.top) {
      const c = this.stack.pop()!
      this.totalBytes -= c.bytes
    }
    const bytes = runs.indices.length * 8
    const cmd: StoredCommand = { label, runs, n: runs.indices.length, bytes }
    if (bytes > COMPRESS_THRESHOLD) cmd.packed = packRuns(runs)
    this.stack.push(cmd)
    this.totalBytes += bytes
    // 容量淘汰: 丢最旧(可 undo 的也从队头丢 → 最早命令不可再回退)
    while (this.stack.length > MAX_DEPTH || this.totalBytes > MAX_TOTAL_BYTES) {
      const dropped = this.stack.shift()!
      this.totalBytes -= dropped.bytes
      this.top--
    }
    // 新命令入栈后 top 指向栈顶(可直接 undo)
    this.top = this.stack.length
    undoTick.value++
  }

  private runsOf(c: StoredCommand): StrokeRuns {
    if (c.runs) return c.runs
    c.runs = unpackRuns(c.packed!, c.n)
    c.packed = undefined
    return c.runs
  }

  undo(lm: LabelmapVolume): { label: string; runs: StrokeRuns } | null {
    if (!this.canUndo) return null
    const c = this.stack[--this.top]
    const runs = this.runsOf(c)
    lm.applyRuns(runs, 'before')
    undoTick.value++
    return { label: c.label, runs }
  }

  redo(lm: LabelmapVolume): { label: string; runs: StrokeRuns } | null {
    if (!this.canRedo) return null
    const c = this.stack[this.top++]
    const runs = this.runsOf(c)
    lm.applyRuns(runs, 'after')
    undoTick.value++
    return { label: c.label, runs }
  }

  clear() {
    this.stack = []
    this.top = 0
    this.totalBytes = 0
    undoTick.value++
  }
}

function packRuns(runs: StrokeRuns): Uint8Array {
  const head = new Uint32Array([runs.indices.length])
  const parts = [new Uint8Array(head.buffer), new Uint8Array(runs.indices.buffer, runs.indices.byteOffset, runs.indices.byteLength),
    new Uint8Array(runs.before.buffer, runs.before.byteOffset, runs.before.byteLength),
    new Uint8Array(runs.after.buffer, runs.after.byteOffset, runs.after.byteLength)]
  let total = 0
  for (const p of parts) total += p.length
  const buf = new Uint8Array(total)
  let off = 0
  for (const p of parts) { buf.set(p, off); off += p.length }
  return gzipSync(buf)
}

function unpackRuns(packed: Uint8Array, n: number): StrokeRuns {
  const raw = gunzipSync(packed)
  const indices = new Uint32Array(n)
  const before = new Uint16Array(n)
  const after = new Uint16Array(n)
  let off = 4
  indices.set(new Uint32Array(raw.slice(off, off + indices.byteLength).buffer))
  off += indices.byteLength
  before.set(new Uint16Array(raw.slice(off, off + before.byteLength).buffer))
  off += before.byteLength
  after.set(new Uint16Array(raw.slice(off, off + after.byteLength).buffer))
  return { indices, before, after }
}

/** 模块级单例 */
export const undoStack = new UndoStack()
