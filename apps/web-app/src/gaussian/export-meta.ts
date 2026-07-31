import { gaussianState } from './state'

/**
 * Build the exportable metadata object describing the current edit session.
 *
 * Single source of truth — used by both the DataPanel and TopBar export
 * buttons. The JSON layout matches what a downstream training pipeline can
 * consume to mask / label the original splat file by index.
 */
export interface SplatMetaJSON {
  schema: 'yinghuo-gaussian-meta/v1'
  fileName: string
  format: 'ply' | 'splat' | 'spz'
  /** True when a .ply was parsed via the point-cloud fallback (no f_dc_* properties). */
  isPointCloud: boolean
  count: number
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
  /** indices hidden (effectively deleted) in this session */
  hidden: number[]
  /** label assignment — each splat belongs to at most one label */
  labels: Array<{
    id: string
    name: string
    color: string
    indices: number[]
  }>
}

export const buildMeta = (): SplatMetaJSON => ({
  schema: 'yinghuo-gaussian-meta/v1',
  fileName: gaussianState.fileName,
  format: (gaussianState.format || 'ply') as 'ply' | 'splat' | 'spz',
  isPointCloud: gaussianState.isPointCloud,
  count: gaussianState.count,
  bounds: gaussianState.bounds,
  hidden: Array.from(gaussianState.hidden).sort((a, b) => a - b),
  labels: gaussianState.labels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    indices: [...l.indices].sort((a, b) => a - b),
  })),
})

export const exportMeta = () => {
  if (!gaussianState.splats) return
  const meta = buildMeta()
  const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${gaussianState.fileName}.meta.json`
  a.click()
  URL.revokeObjectURL(url)
}
