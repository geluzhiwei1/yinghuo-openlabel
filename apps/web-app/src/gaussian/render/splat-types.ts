/**
 * Unified in-memory representation of a gaussian splat.
 * - position / scale in world space
 * - rotation as unit quaternion (xyzw, three.js convention)
 * - color as packed uint32 used by the renderer: RGBA (8 bits each, R highest)
 */
export interface SplatArray {
  count: number
  /** x,y,z interleaved, length = count*3 */
  positions: Float32Array
  /** x,y,z interleaved, log-space half-extents, length = count*3 */
  scales: Float32Array
  /** x,y,z,w interleaved unit quaternions, length = count*4 */
  rotations: Float32Array
  /** r,g,b (0..255) interleaved, length = count*3 */
  colors: Uint8ClampedArray
  /** per-splat opacity 0..255 */
  opacities: Uint8ClampedArray
}

export const emptySplat = (): SplatArray => ({
  count: 0,
  positions: new Float32Array(0),
  scales: new Float32Array(0),
  rotations: new Float32Array(0),
  colors: new Uint8ClampedArray(0),
  opacities: new Uint8ClampedArray(0),
})

/** SH C0 decode factor — 3DGS PLY stores DC SH coefficients that map to color via 0.28209479177387814 + 0.5. */
export const SH_C0 = 0.28209479177387814

export const detectFormat = (fileName: string, buffer: ArrayBuffer): 'ply' | 'splat' | 'spz' | 'unknown' => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.spz')) return 'spz'
  if (lower.endsWith('.splat')) return 'splat'
  if (lower.endsWith('.ply')) return 'ply'
  // Fallback: magic bytes
  const head = new Uint8Array(buffer.slice(0, 4))
  const asAscii = String.fromCharCode(...head)
  if (asAscii === 'ply\n' || asAscii.startsWith('ply')) return 'ply'
  // .spz is gzip — starts with 0x1f 0x8b
  if (head[0] === 0x1f && head[1] === 0x8b) return 'spz'
  return 'unknown'
}
