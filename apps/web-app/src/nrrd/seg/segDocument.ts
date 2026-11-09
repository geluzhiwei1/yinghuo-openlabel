/**
 * 编辑器状态 ⇄ Mongo label 文档映射(volumeSegment3d)。
 *
 * 持久化双表示:
 * - frame_labels.{label_uuid}.val = 轮廓 manifest(yinghuo.volumeContours/1, Mongo 内联)
 * - frame_labels.{label_uuid}.val_ref = label_uuid → anno_masks/{label_uuid}.seg.nrrd.gz
 *   (整网格 uint16, 值=object_id; 经 /label/volume_mask/upload 上传)
 * 删除: attributes.opType='remove' → 后端 $unset
 */
import { labelApi, volumeMaskApi } from '@/api'
import { jobConfig } from '@/states/job-config'
import { messages } from '@/states'
import { getLabelmap } from './labelmap'
import {
  segState, addSegment, clearPersistState, refreshVoxelCounts,
} from './segments'
import { writeSegNrrd, parseNrrd } from '../data/nrrdIO'
import { gunzipSync } from 'fflate'
import {
  contoursFromSlice, simplifyClosed, contourToDoc, docToContour, rasterizePolygon,
  type ContourDoc,
} from '../data/contours'
import type { VolumeGrid } from '../data/volumeModel'
import { volState } from '../store'

/** 是否有未保存修改(保存按钮角标 / beforeunload 守卫共用) */
export function hasUnsavedChanges(): boolean {
  return volState.dirty || segState.segments.some(s => s.dirty) || segState.pendingRemoves.length > 0
}

export interface VolumeContoursVal {
  schema: 'yinghuo.volumeContours/1'
  grid: { dims: number[]; spacing: number[]; origin: number[] }
  contours: ContourDoc[]
}

/** 单个 segment 的 z 轴逐层轮廓(体素坐标, marching squares 半格点约定) */
export function segmentContours(segId: number, grid: VolumeGrid): ContourDoc[] {
  const lm = getLabelmap()
  if (!lm) return []
  const [nx, ny, nz] = grid.dims
  const data = lm.data
  const slice = new Uint8Array(nx * ny)
  const out: ContourDoc[] = []
  for (let k = 0; k < nz; k++) {
    let any = false
    const base = k * nx * ny
    for (let t = 0; t < nx * ny; t++) {
      const v = data[base + t] === segId ? 1 : 0
      slice[t] = v
      if (v) any = true
    }
    if (!any) continue
    for (const c of contoursFromSlice(slice, nx, ny, 1)) {
      const pts = simplifyClosed(c.points, 0.5)
      if (pts.length >= 3) out.push(contourToDoc({ closed: true, points: pts }, 2, k))
    }
  }
  return out
}

function gridDoc(grid: VolumeGrid) {
  return { dims: [...grid.dims], spacing: [...grid.spacing], origin: [...grid.origin] }
}

export interface SaveResult { saved: number; removed: number }

/** 保存当前帧全部脏 segment: mask 上传 → label/save(含 remove 墓碑) */
export async function saveVolumeLabels(): Promise<SaveResult> {
  const lm = getLabelmap()
  if (!lm) throw new Error('labelmap 未初始化')
  const grid = lm.grid
  const dirty = segState.segments.filter(s => s.dirty === 'create' || s.dirty === 'update')
  const removes = segState.pendingRemoves
  if (dirty.length === 0 && removes.length === 0) return { saved: 0, removed: 0 }

  const frame_labels: any[] = []
  for (const t of removes) {
    frame_labels.push({ label_uuid: t.labelUuid, attributes: { opType: 'remove' } })
  }
  for (const seg of dirty) {
    // mask: 整网格 uint16, 该段体素=object_id
    const mask = new Uint16Array(lm.data.length)
    for (let t = 0; t < mask.length; t++) if (lm.data[t] === seg.id) mask[t] = seg.id
    const bytes = writeSegNrrd(mask, grid, new Map([[seg.id, seg.name]]))
    await volumeMaskApi.upload(jobConfig.uuid, seg.labelUuid, bytes)
    const contours = seg.voxelCount > 0 ? segmentContours(seg.id, grid) : []
    const val: VolumeContoursVal = {
      schema: 'yinghuo.volumeContours/1',
      grid: gridDoc(grid),
      contours,
    }
    frame_labels.push({
      label_uuid: seg.labelUuid,
      object_type: seg.taxonomyKey || 'other',
      object_id: seg.id,
      ol_type_: 'SegmentVolume',
      attributes: {
        opType: seg.dirty,
        name: seg.name,
        color: seg.color,
        representations: ['labelmap', 'contour'],
        voxelCount: seg.voxelCount,
      },
      val,
      val_ref: seg.labelUuid,
    })
  }

  const res = await labelApi.save({
    frame_labels,
    jobConfig: {
      uuid: jobConfig.uuid, seq: jobConfig.seq, stream: jobConfig.stream,
      frame: String(jobConfig.frame), mission: jobConfig.mission,
    },
    current_mission: 'volumeSegment3d',
    frame_properties: {
      width: grid.dims[0], height: grid.dims[1], slices: grid.dims[2],
      spacing: [...grid.spacing],
    },
  })
  if (res?.status === 1) throw new Error(res.statusText || '保存失败')
  // removes 是 segState.pendingRemoves 的引用, clearPersistState 会原地清空, 先取计数
  const result: SaveResult = { saved: dirty.length, removed: removes.length }
  clearPersistState()
  volState.savedAt = Date.now()   // DataPanel 徽章刷新信号
  return result
}

/** 拉取并恢复当前帧已存标注(mask 优先, 缺失时回退轮廓栅格化)。返回恢复的 segment 数 */
export async function loadVolumeLabels(): Promise<number> {
  const lm = getLabelmap()
  if (!lm) return 0
  const res = await labelApi.load({
    seq: jobConfig.seq, stream: jobConfig.stream, frame: String(jobConfig.frame),
    current_mission: 'volumeSegment3d', uuid: jobConfig.uuid,
  })
  const rows = res?.data
  if (!Array.isArray(rows) || rows.length === 0) return 0

  let loaded = 0
  for (const row of rows) {
    const fl = row?.frame_labels
    if (!fl) continue
    for (const labelUuid of Object.keys(fl)) {
      const entry = fl[labelUuid]
      if (!entry || entry.is_removed) continue
      const segId = entry.object_id as number
      if (!segId) continue
      const attrs = entry.attributes || {}
      addSegment(attrs.name || `Segment ${segId}`, entry.object_type || '', {
        id: segId, labelUuid, color: attrs.color, visible: attrs.visible ?? true,
        origin: attrs.origin === 'model' ? 'model' : undefined,
      })
      try {
        await restoreSegmentVoxels(entry, segId, labelUuid)
      } catch (e: any) {
        messages.lastInfo = `segment ${attrs.name || segId} mask 恢复失败: ${e?.message ?? e}`
      }
      loaded++
    }
  }
  if (loaded > 0) {
    refreshVoxelCounts()
  }
  return loaded
}

async function restoreSegmentVoxels(entry: any, segId: number, labelUuid: string) {
  const lm = getLabelmap()!
  let restored = false
  if (entry.val_ref) {
    try {
      const bytes = await volumeMaskApi.get(jobConfig.uuid, labelUuid)
      // .seg.nrrd.gz 整文件 gzip, 先解压再交给 NRRD 解析
      const plain = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? gunzipSync(bytes) : bytes
      const raw = parseNrrd(plain.buffer as ArrayBuffer, 'ct')
      const md = raw.data as Uint16Array
      if (md.length === lm.data.length &&
          raw.dims[0] === lm.dims[0] && raw.dims[1] === lm.dims[1] && raw.dims[2] === lm.dims[2]) {
        for (let t = 0; t < md.length; t++) if (md[t]) lm.data[t] = segId
        restored = true
      }
    } catch { /* mask 缺失/损坏 → 回退轮廓 */ }
  }
  if (!restored && entry.val?.schema === 'yinghuo.volumeContours/1') {
    for (const cd of entry.val.contours || []) {
      const c = docToContour(cd)
      if (cd.axis !== 'z') continue
      rasterizePolygon(c.points, lm.dims[0], lm.dims[1], (u, v) => {
        const i = Math.round(u), j = Math.round(v)
        if (i >= 0 && i < lm.dims[0] && j >= 0 && j < lm.dims[1] && cd.slice >= 0 && cd.slice < lm.dims[2]) {
          lm.data[cd.slice * lm.dims[0] * lm.dims[1] + j * lm.dims[0] + i] = segId
        }
      })
    }
  }
}
