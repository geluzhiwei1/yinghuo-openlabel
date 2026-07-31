import type { SplatArray } from './splat-types'

/**
 * Parse the `.spz` format (Niantic's compressed gaussian splat container).
 *
 * Spec reference: https://github.com/nianticlabs/spz
 * Layout (little-endian):
 *   magic           : 4 bytes  = "NGSP" (0x4e 0x47 0x53 0x50)
 *   version         : uint32
 *   numPoints       : uint32
 *   shDim           : uint8
 *   fractionalBits  : uint8
 *   flags           : uint8
 *   reserved        : uint8
 *   -- gzip-compressed body follows --
 *   positions       : int24 × numPoints × 3  (24-bit fixed point)
 *   alphas          : uint8 × numPoints
 *   colors          : uint8 × numPoints × 3
 *   scales          : uint8 × numPoints × 3
 *   rotations       : uint8 × numPoints × 3  (smallest-three, 3 of 4)
 *   shParams        : int8  × numPoints × shDim × 3 (optional)
 *
 * Antimatter15 / other variants skip the gzip layer. We sniff the first two
 * bytes — if 0x1f 0x8b, the body is gzip-compressed.
 */

const HEADER_SIZE = 16

export const parseSpz = async (buffer: ArrayBuffer): Promise<SplatArray> => {
  if (buffer.byteLength < HEADER_SIZE) throw new Error('.spz: truncated header')

  const dv = new DataView(buffer)
  const magic = String.fromCharCode(
    dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3),
  )
  if (magic !== 'NGSP') throw new Error(`.spz: bad magic "${magic}"`)

  const version = dv.getUint32(4, true)
  const numPoints = dv.getUint32(8, true)
  const shDim = dv.getUint8(12)
  const fractionalBits = dv.getUint8(13)
  const flags = dv.getUint8(14)
  void version; void flags

  if (numPoints === 0) throw new Error('.spz: zero points')

  let body = new Uint8Array(buffer, HEADER_SIZE)
  // Check gzip magic
  if (body[0] === 0x1f && body[1] === 0x8b) {
    body = await gunzip(body)
  }

  const out: SplatArray = {
    count: numPoints,
    positions: new Float32Array(numPoints * 3),
    scales: new Float32Array(numPoints * 3),
    rotations: new Float32Array(numPoints * 4),
    colors: new Uint8ClampedArray(numPoints * 3),
    opacities: new Uint8ClampedArray(numPoints),
  }

  const posBytes = numPoints * 3 * 3 // int24 = 3 bytes
  const alphaBytes = numPoints
  const colorBytes = numPoints * 3
  const scaleBytes = numPoints * 3
  const rotBytes = numPoints * 3
  const shBytes = numPoints * shDim * 3

  let off = 0
  const positions = body.subarray(off, off + posBytes); off += posBytes
  const alphas = body.subarray(off, off + alphaBytes); off += alphaBytes
  const colors = body.subarray(off, off + colorBytes); off += colorBytes
  const scales = body.subarray(off, off + scaleBytes); off += scaleBytes
  const rotations = body.subarray(off, off + rotBytes); off += rotBytes
  void body.subarray(off, off + shBytes) // shParams — unused

  const invScale = 1 / (1 << fractionalBits)

  for (let i = 0; i < numPoints; i++) {
    const v3 = i * 3
    const v4 = i * 4

    // Positions: 3 × int24 little-endian
    out.positions[v3] = readInt24LE(positions, v3 * 3) * invScale
    out.positions[v3 + 1] = readInt24LE(positions, v3 * 3 + 3) * invScale
    out.positions[v3 + 2] = readInt24LE(positions, v3 * 3 + 6) * invScale

    out.opacities[i] = alphas[i]

    out.colors[v3] = colors[v3]
    out.colors[v3 + 1] = colors[v3 + 1]
    out.colors[v3 + 2] = colors[v3 + 2]

    // Scales: stored as fixed-point uint8; spz stores log2-scale → exp2 here
    out.scales[v3] = Math.pow(2, scales[v3] / 16.0 - 10.0)
    out.scales[v3 + 1] = Math.pow(2, scales[v3 + 1] / 16.0 - 10.0)
    out.scales[v3 + 2] = Math.pow(2, scales[v3 + 2] / 16.0 - 10.0)

    // Rotations: smallest-three (3 components, uint8 normalized to [-1, 1])
    const a = (rotations[v3] - 128) / 128
    const b = (rotations[v3 + 1] - 128) / 128
    const c = (rotations[v3 + 2] - 128) / 128
    const d = Math.sqrt(Math.max(0, 1 - a * a - b * b - c * c))
    // spz default: drop the first component (w); set q = [d, a, b, c]
    out.rotations[v4] = d
    out.rotations[v4 + 1] = a
    out.rotations[v4 + 2] = b
    out.rotations[v4 + 3] = c
  }
  return out
}

const readInt24LE = (bytes: Uint8Array, offset: number): number => {
  const b0 = bytes[offset]
  const b1 = bytes[offset + 1]
  const b2 = bytes[offset + 2]
  let v = b0 | (b1 << 8) | (b2 << 16)
  if (v & 0x800000) v |= ~0xffffff // sign extend
  return v
}

/** Minimal RFC-1951 inflate via DecompressionStream (Chromium/Firefox/Safari 16.4+). */
const gunzip = async (input: Uint8Array): Promise<Uint8Array> => {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(input)
  writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    out.set(c, pos)
    pos += c.byteLength
  }
  return out
}
