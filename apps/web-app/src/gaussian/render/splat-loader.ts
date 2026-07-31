import type { SplatArray } from './splat-types'

/**
 * Parse the simple raw `.splat` format used by antimatter15's splat viewer
 * and others — no header, just a stream of 32-byte records:
 *
 *   x, y, z           : float32 (12 bytes)
 *   sx, sy, sz        : float32 (12 bytes)
 *   rgba              : uint8 × 4 (4 bytes)
 *   rotw, rotx, roty, rotz : uint8 × 4, smallest-three encoding (4 bytes)
 *
 * Quaternion reconstruction (smallest-three):
 *   a = (rotw - 128) / 128
 *   b = (rotx - 128) / 128
 *   c = (roty - 128) / 128
 *   d = rotz / 128  (this byte selects which component was dropped: 0..3)
 *
 * The dropped component is recovered so the result is a unit quaternion.
 */
export const parseSplat = (buffer: ArrayBuffer): SplatArray => {
  const bytesPerSplat = 32
  const count = Math.floor(buffer.byteLength / bytesPerSplat)
  if (count === 0) throw new Error('.splat: empty payload')

  const out: SplatArray = {
    count,
    positions: new Float32Array(count * 3),
    scales: new Float32Array(count * 3),
    rotations: new Float32Array(count * 4),
    colors: new Uint8ClampedArray(count * 3),
    opacities: new Uint8ClampedArray(count),
  }

  const dv = new DataView(buffer)
  for (let i = 0; i < count; i++) {
    const off = i * bytesPerSplat
    const v3 = i * 3
    const v4 = i * 4

    out.positions[v3] = dv.getFloat32(off + 0, true)
    out.positions[v3 + 1] = dv.getFloat32(off + 4, true)
    out.positions[v3 + 2] = dv.getFloat32(off + 8, true)

    out.scales[v3] = dv.getFloat32(off + 12, true)
    out.scales[v3 + 1] = dv.getFloat32(off + 16, true)
    out.scales[v3 + 2] = dv.getFloat32(off + 20, true)

    out.colors[v3] = dv.getUint8(off + 24)
    out.colors[v3 + 1] = dv.getUint8(off + 25)
    out.colors[v3 + 2] = dv.getUint8(off + 26)
    out.opacities[i] = dv.getUint8(off + 27)

    const rot0 = dv.getUint8(off + 28)
    const rot1 = dv.getUint8(off + 29)
    const rot2 = dv.getUint8(off + 30)
    const rot3 = dv.getUint8(off + 31) // index of largest component (0..3)

    // Decode smallest-three
    const a = (rot0 - 128) / 128
    const b = (rot1 - 128) / 128
    const c = (rot2 - 128) / 128
    const d = Math.sqrt(Math.max(0, 1 - a * a - b * b - c * c))
    const q = [0, 0, 0, 0]
    q[rot3 % 4] = d
    q[(rot3 + 1) % 4] = a
    q[(rot3 + 2) % 4] = b
    q[(rot3 + 3) % 4] = c
    out.rotations[v4] = q[0]
    out.rotations[v4 + 1] = q[1]
    out.rotations[v4 + 2] = q[2]
    out.rotations[v4 + 3] = q[3]
  }
  return out
}
