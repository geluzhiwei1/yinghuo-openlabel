import { detectFormat, type SplatArray } from './splat-types'
import { parsePly, isPointCloudPly } from './ply-loader'
import { parseSplat } from './splat-loader'
import { parseSpz } from './spz-loader'

export interface LoadResult {
  data: SplatArray
  format: 'ply' | 'splat' | 'spz'
  fileName: string
  /** Only set for PLY — true when the file went through the point-cloud fallback. */
  isPointCloud: boolean
}

export const loadSplatFile = async (file: File | Blob, fileName: string): Promise<LoadResult> => {
  const buffer = await file.arrayBuffer()
  const fmt = detectFormat(fileName, buffer)
  let result: LoadResult
  switch (fmt) {
    case 'ply':
      result = {
        data: parsePly(buffer),
        format: 'ply',
        fileName,
        isPointCloud: isPointCloudPly(buffer),
      }
      break
    case 'splat':
      result = { data: parseSplat(buffer), format: 'splat', fileName, isPointCloud: false }
      break
    case 'spz':
      result = { data: await parseSpz(buffer), format: 'spz', fileName, isPointCloud: false }
      break
    default:
      throw new Error(`不支持的文件格式: ${fileName || '(unknown)'} —— 请使用 .ply / .splat / .spz`)
  }

  // Surface parse summary to the dev console — useful when a file loads
  // silently but the canvas shows nothing. Bounds let the user verify the
  // data landed in a sane region of world space.
  const d = result.data
  if (d.count > 0) {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    let nanCount = 0
    for (let i = 0; i < d.count; i++) {
      const x = d.positions[i * 3]
      const y = d.positions[i * 3 + 1]
      const z = d.positions[i * 3 + 2]
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        nanCount++
        continue
      }
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
    console.info(
      `[gaussian] loaded ${fileName} (${result.format}${result.isPointCloud ? ' · 点云' : ''}):`,
      `\n  count: ${d.count.toLocaleString()}`,
      `\n  bounds: [${minX.toFixed(3)}, ${minY.toFixed(3)}, ${minZ.toFixed(3)}] → [${maxX.toFixed(3)}, ${maxY.toFixed(3)}, ${maxZ.toFixed(3)}]`,
      `\n  non-finite positions: ${nanCount.toLocaleString()}`,
    )
  }

  return result
}

export { parsePly, parseSplat, parseSpz }
export type { SplatArray }
