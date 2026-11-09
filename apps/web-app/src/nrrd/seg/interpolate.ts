/**
 * 跨层插值应用层: 激活 segment 的二值 mask → worker 距离场插值 → 仅写空体素,
 * 一条 runs undo。插值轴向取自当前布局(单视图=该轴, 网格/VRT=轴位 z)。
 */
import { volState } from '../store'
import { getLabelmap } from './labelmap'
import { segState, getSegment, refreshVoxelCounts, markSegmentsInRuns } from './segments'
import { undoStack } from './undoStack'
import { notifyDirty } from './tools'
import { runInterpolate } from './segAlgoClient'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

let busy = false

export function isInterpolating() { return busy }

export async function runSliceInterpolation(): Promise<void> {
    const lm = getLabelmap()
    const seg = getSegment(segState.activeId)
    if (!lm || !seg || busy) return
    const dims = lm.dims
    const mask = new Uint8Array(lm.data.length)
    for (let t = 0; t < mask.length; t++) mask[t] = lm.data[t] === seg.id ? 1 : 0
    const axis: 0 | 1 | 2 = volState.layoutMode === 'sagittal' ? 0
        : volState.layoutMode === 'coronal' ? 1 : 2
    busy = true
    try {
        const indices = await runInterpolate(mask, dims, axis)
        if (!indices.length) {
            ElMessage.warning(i18n.global.t('nrrd.seg.interpEmpty'))
            return
        }
        const [nx, ny] = dims
        lm.beginStroke()
        let bbox = { i0: Infinity, j0: Infinity, k0: Infinity, i1: -1, j1: -1, k1: -1 }
        for (let t = 0; t < indices.length; t++) {
            const idx = indices[t]
            if (lm.data[idx] === 0) lm.setVoxelIdx(idx, seg.id)
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
            undoStack.push(runs, 'interpolate')
            markSegmentsInRuns(runs)
            refreshVoxelCounts()
            notifyDirty(bbox)
            ElMessage.success(i18n.global.t('nrrd.seg.interpolated', { n: runs.indices.length }))
        }
    } catch (e: any) {
        ElMessage.error(String(e?.message ?? e))
    } finally {
        busy = false
    }
}
