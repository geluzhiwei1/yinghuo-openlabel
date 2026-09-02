import type { PCDFormat } from '@/types/data-format'

type SanitizablePointcloud = PCDFormat & {
  color?: number[]
  normal?: number[]
}

export type SanitizeResult = {
  pc: PCDFormat
  dropped: number
}

const badCoord = (v: number) => v !== v || v === Infinity || v === -Infinity

/**
 * 剔除坐标含 NaN/±Inf 的点。
 *
 * 深度相机/第三方工具导出的点云常把无效像素写成 NaN(demo 的 five_people.pcd
 * 约 1/5 的点是 NaN),THREE 的 computeBoundingSphere 遇 NaN 会算出 NaN 半径,
 * 相机取景与视锥剔除全部失效。position 之外的并行数组(color/rgb/normal/
 * intensity/label)按点同步压缩,保持下标对齐。
 */
export const sanitizePointcloud = (pc: SanitizablePointcloud): SanitizeResult => {
  const src = pc.position
  if (src.length === 0) return { pc, dropped: 0 }

  const total = Math.floor(src.length / 3)
  const isKept = (i: number) =>
    !badCoord(src[i]) && !badCoord(src[i + 1]) && !badCoord(src[i + 2])

  let invalid = 0
  for (let i = 0; i + 2 < src.length; i += 3) {
    if (!isKept(i)) invalid++
  }
  if (invalid === 0) return { pc, dropped: 0 }

  const kept = total - invalid
  if (kept === 0) {
    return { pc: { ...pc, position: [] }, dropped: invalid }
  }

  const compact3 = (arr: number[] | undefined): number[] | undefined => {
    if (!arr || arr.length !== total * 3) return arr
    const out = new Array<number>(kept * 3)
    let w = 0
    for (let i = 0; i + 2 < src.length; i += 3) {
      if (isKept(i)) {
        out[w++] = arr[i]; out[w++] = arr[i + 1]; out[w++] = arr[i + 2]
      }
    }
    return out
  }
  const compact1 = (arr: number[] | undefined): number[] | undefined => {
    if (!arr || arr.length !== total) return arr
    const out = new Array<number>(kept)
    let w = 0
    for (let i = 0; i + 2 < src.length; i += 3) {
      if (isKept(i)) out[w++] = arr[i / 3]
    }
    return out
  }

  const position = new Array<number>(kept * 3)
  let w = 0
  for (let i = 0; i + 2 < src.length; i += 3) {
    if (isKept(i)) {
      position[w++] = src[i]; position[w++] = src[i + 1]; position[w++] = src[i + 2]
    }
  }

  const compacted: SanitizablePointcloud = {
    ...pc,
    position,
    color: compact3(pc.color),
    rgb: compact3(pc.rgb),
    normal: compact3(pc.normal),
    intensity: compact1(pc.intensity),
    label: compact1(pc.label),
  }
  return { pc: compacted, dropped: invalid }
}
