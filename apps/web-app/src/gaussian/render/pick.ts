import * as THREE from 'three'
import type { GaussianRendererHandle } from './gaussian-renderer'

/**
 * Picking + selection helpers for the gaussian viewer.
 *
 * Two modes:
 *   - clickPick: raycast against THREE.Points, return nearest non-hidden index
 *   - boxPick:   screen-space rectangle → for each splat, project to screen
 *                and return those whose projected xy falls inside the rect.
 *                O(N) but trivially vectorized; fine up to ~5M splats.
 */

export interface ScreenRect {
  /** top-left in CSS pixels (canvas-relative) */
  x0: number
  y0: number
  x1: number
  y1: number
}

export const normalizeRect = (r: ScreenRect): ScreenRect => ({
  x0: Math.min(r.x0, r.x1),
  y0: Math.min(r.y0, r.y1),
  x1: Math.max(r.x0, r.x1),
  y1: Math.max(r.y0, r.y1),
})

export const rectIsEmpty = (r: ScreenRect): boolean =>
  Math.abs(r.x1 - r.x0) < 2 || Math.abs(r.y1 - r.y0) < 2

/**
 * Pick the closest non-hidden splat under the cursor.
 * `ndc` is the cursor position in normalized device coords (-1..1).
 */
export const clickPick = (
  handle: GaussianRendererHandle,
  camera: THREE.PerspectiveCamera,
  ndc: THREE.Vector2,
): number | null => {
  const raycaster = new THREE.Raycaster()
  // Threshold scales with scene bounds — too small and the user can't hit
  // anything, too big and clicks grab unrelated splats. 1% of the bounding
  // sphere radius is a reasonable default for 3DGS-sized scenes.
  const positions = handle.positions()
  const threshold = estimatePickThreshold(positions)
  raycaster.params.Points.threshold = threshold
  raycaster.setFromCamera(ndc, camera)
  return handle.pickAt(raycaster)
}

/**
 * Box-select all splats whose screen projection falls inside `rect`.
 * Hidden splats are excluded.
 */
export const boxPick = (
  handle: GaussianRendererHandle,
  camera: THREE.PerspectiveCamera,
  rect: ScreenRect,
  canvasWidth: number,
  canvasHeight: number,
): number[] => {
  const norm = normalizeRect(rect)
  if (rectIsEmpty(norm)) return []

  const positions = handle.positions()
  const count = positions.length / 3
  const out: number[] = []

  // Hidden splats — read once, skip during iteration.
  // We rely on the renderer's aHidden attribute being authoritative here.
  const hiddenAttr = (handle.object.geometry as THREE.BufferGeometry).getAttribute(
    'aHidden',
  ) as THREE.BufferAttribute
  const hidden = hiddenAttr ? (hiddenAttr.array as Float32Array) : null

  const v = new THREE.Vector3()
  const proj = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    if (hidden && hidden[i] > 0.5) continue
    v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    proj.copy(v).project(camera)
    // Behind camera? skip — would project to mirrored screen position.
    if (proj.z > 1) continue
    const sx = (proj.x * 0.5 + 0.5) * canvasWidth
    const sy = (-proj.y * 0.5 + 0.5) * canvasHeight
    if (sx >= norm.x0 && sx <= norm.x1 && sy >= norm.y0 && sy <= norm.y1) {
      out.push(i)
    }
  }
  return out
}

/**
 * Brush-select splats whose screen projection falls within a disk of
 * `radiusPx` around `centerPx`. Used by the brush tool for splat-level
 * painting — same O(N) projection pass as boxPick, just a different
 * containment test.
 *
 * Returns indices in arbitrary order.
 */
export const brushPick = (
  handle: GaussianRendererHandle,
  camera: THREE.PerspectiveCamera,
  centerPx: { x: number; y: number },
  radiusPx: number,
  canvasWidth: number,
  canvasHeight: number,
): number[] => {
  const r2 = radiusPx * radiusPx
  if (r2 <= 0) return []

  const positions = handle.positions()
  const count = positions.length / 3
  const out: number[] = []

  const hiddenAttr = (handle.object.geometry as THREE.BufferGeometry).getAttribute(
    'aHidden',
  ) as THREE.BufferAttribute
  const hidden = hiddenAttr ? (hiddenAttr.array as Float32Array) : null

  const v = new THREE.Vector3()
  const proj = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    if (hidden && hidden[i] > 0.5) continue
    v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    proj.copy(v).project(camera)
    if (proj.z > 1) continue
    const sx = (proj.x * 0.5 + 0.5) * canvasWidth
    const sy = (-proj.y * 0.5 + 0.5) * canvasHeight
    const dx = sx - centerPx.x
    const dy = sy - centerPx.y
    if (dx * dx + dy * dy <= r2) out.push(i)
  }
  return out
}

/** Pick threshold = 1.5% of the bounding-box diagonal — works across ply/splat/spz scales. */
const estimatePickThreshold = (positions: Float32Array): number => {
  if (positions.length < 6) return 0.05
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return Math.max(0.005, diag * 0.015)
}
