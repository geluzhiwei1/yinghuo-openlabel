/**
 * 导入分割 → segment 注册 + labelmap 体素写入(合并为一条 undo 命令)。
 * 语义: 文件背景(0)不覆盖现有标注, 非零标签覆盖。
 * undo 只回滚体素; 新建 segment 留在列表(与手动新建一致, 空段可再删除)。
 */
import { getLabelmap, type StrokeRuns } from './labelmap'
import { addSegment, markSegmentsInRuns, refreshVoxelCounts, bumpSegRender } from './segments'
import { undoStack } from './undoStack'
import { volState } from '../store'
import type { ImportedSegmentInit } from '../data/segImport'

export function applyImportedSegmentation(labels: ArrayLike<number>, segments: ImportedSegmentInit[]): number {
    const lm = getLabelmap()
    if (!lm) throw new Error('labelmap 未初始化')
    const n = lm.data.length
    if (labels.length !== n) throw new Error(`分割体积(${labels.length})与当前网格(${n})不一致`)

    const idMap = new Map<number, number>()
    for (const s of segments) idMap.set(s.value, addSegment(s.name).id)

    const idxs: number[] = []
    const before: number[] = []
    const after: number[] = []
    const data = lm.data
    for (let t = 0; t < n; t++) {
        const v = labels[t]
        if (v === 0) continue
        const nv = idMap.get(v)
        if (nv === undefined) continue   // 结构选择: 未勾选的标签值跳过
        if (data[t] === nv) continue
        idxs.push(t)
        before.push(data[t])
        after.push(nv)
    }
    if (idxs.length) {
        const runs: StrokeRuns = {
            indices: new Uint32Array(idxs),
            before: new Uint16Array(before),
            after: new Uint16Array(after),
        }
        lm.applyRuns(runs, 'after')
        undoStack.push(runs, 'import-segmentation')
        markSegmentsInRuns(runs)
    }
    refreshVoxelCounts()
    bumpSegRender()
    volState.dirty = true
    return idxs.length
}
