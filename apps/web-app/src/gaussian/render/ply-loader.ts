import { SH_C0, type SplatArray } from './splat-types'

/** Sniff whether the PLY header advertises 3DGS properties (`f_dc_0`). Cheap pre-scan. */
export const isPointCloudPly = (buffer: ArrayBuffer): boolean => {
  // Only scan the first 256KB — header is well within that.
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 256 * 1024))
  const needle = [0x66, 0x5f, 0x64, 0x63, 0x5f, 0x30] // "f_dc_0"
  // Match must be on a token boundary — preceded by whitespace or property declaration.
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    if (bytes[i] !== needle[0]) continue
    let ok = true
    for (let j = 1; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { ok = false; break }
    }
    if (!ok) continue
    return false // has f_dc_0 → 3DGS, not a point cloud
  }
  return true
}

/**
 * Parse a PLY file as gaussian splats.
 *
 * Two flavors are supported:
 *
 *   (A) 3DGS PLY  — INRIA / gaussian-splatting output. The vertex element
 *       carries x,y,z, nx,ny,nz, f_dc_{0,1,2}, optional f_rest_*, opacity,
 *       scale_{0,1,2}, rot_{0,1,2,3}. SH C0 → RGB, sigmoid opacity,
 *       exp(scale), quaternion normalization.
 *
 *   (B) Point-cloud PLY — photogrammetry (COLMAP / OpenMVS / Meshroom / etc.)
 *       output. Vertex has just x,y,z and optionally red/green/blue (or
 *       r/g/b) as uint8 or float. We synthesize constant splat params so
 *       the rest of the pipeline (renderer / picker / labels) works unchanged:
 *           scale   ≈ avg point spacing × 0.6 (auto-computed from bbox)
 *           rot     = identity quaternion [1,0,0,0]
 *           color   = vertex color, or white if absent
 *           opacity = 255
 *
 * Routing is decided once after header parsing — `f_dc_0` ⇒ 3DGS, anything
 * else ⇒ point cloud.
 */
export const parsePly = (buffer: ArrayBuffer): SplatArray => {
  const headerView = new DataView(buffer)
  const decoder = new TextDecoder('ascii')

  // Find "end_header" via explicit byte comparison.
  const TARGET = [0x65, 0x6e, 0x64, 0x5f, 0x68, 0x65, 0x61, 0x64, 0x65, 0x72]
  const scanLimit = Math.min(buffer.byteLength, 256 * 1024)
  let headerEnd = -1
  for (let i = 0; i <= scanLimit - TARGET.length; i++) {
    if (headerView.getUint8(i) !== TARGET[0]) continue
    let ok = true
    for (let j = 1; j < TARGET.length; j++) {
      if (headerView.getUint8(i + j) !== TARGET[j]) { ok = false; break }
    }
    if (!ok) continue
    let k = i + TARGET.length
    while (k < buffer.byteLength && (headerView.getUint8(k) === 0x0d || headerView.getUint8(k) === 0x0a)) k++
    headerEnd = k
    break
  }
  if (headerEnd === -1) {
    throw new Error(`PLY: end_header not found (scanned first ${scanLimit} bytes)`)
  }

  const headerText = decoder.decode(buffer.slice(0, headerEnd))
  const lines = headerText.split(/\r?\n/)

  let isBinaryLittleEndian = false
  let vertexCount = 0
  const props: { name: string; type: string }[] = []
  let inVertex = false

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('format ')) {
      if (line.includes('binary_little_endian')) isBinaryLittleEndian = true
      else if (line.includes('ascii')) isBinaryLittleEndian = false
      else if (line.includes('binary_big_endian'))
        throw new Error('PLY: big-endian binary not supported')
    } else if (line.startsWith('element ')) {
      inVertex = line.startsWith('element vertex')
      if (inVertex) {
        const parts = line.split(/\s+/)
        vertexCount = parseInt(parts[2], 10)
      }
    } else if (line.startsWith('property ') && inVertex) {
      const parts = line.split(/\s+/)
      if (parts[1] === 'list') throw new Error('PLY: list properties unsupported in vertex')
      props.push({ name: parts[2], type: parts[1] })
    } else if (line === 'end_header') {
      break
    }
  }

  if (vertexCount === 0) throw new Error('PLY: no vertices')

  const fieldIdx = new Map<string, number>()
  props.forEach((p, i) => fieldIdx.set(p.name, i))

  const requiredXYZ = ['x', 'y', 'z']
  for (const name of requiredXYZ) {
    if (!fieldIdx.has(name)) throw new Error(`PLY: missing required property "${name}"`)
  }

  const is3DGS = fieldIdx.has('f_dc_0')
  return is3DGS
    ? parse3DGS(buffer, headerEnd, vertexCount, props, fieldIdx, isBinaryLittleEndian)
    : parsePointCloud(buffer, headerEnd, vertexCount, props, fieldIdx, isBinaryLittleEndian)
}

// ─── 3DGS path ─────────────────────────────────────────────────────────
const parse3DGS = (
  buffer: ArrayBuffer,
  headerEnd: number,
  vertexCount: number,
  props: { name: string; type: string }[],
  fieldIdx: Map<string, number>,
  isBinaryLittleEndian: boolean,
): SplatArray => {
  const decoder = new TextDecoder('ascii')
  const out: SplatArray = {
    count: vertexCount,
    positions: new Float32Array(vertexCount * 3),
    scales: new Float32Array(vertexCount * 3),
    rotations: new Float32Array(vertexCount * 4),
    colors: new Uint8ClampedArray(vertexCount * 3),
    opacities: new Uint8ClampedArray(vertexCount),
  }

  const required = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']
  for (const name of required) {
    if (!fieldIdx.has(name)) throw new Error(`PLY: missing required property "${name}" (not a 3DGS PLY)`)
  }

  const stride = props.reduce((acc, p) => acc + typeSize(p.type), 0)

  if (!isBinaryLittleEndian) {
    const bodyText = decoder.decode(buffer.slice(headerEnd))
    const tok = bodyText.split(/\s+/).filter(Boolean)
    let cursor = 0
    for (let v = 0; v < vertexCount; v++) {
      for (let p = 0; p < props.length; p++) {
        const val = parseFloat(tok[cursor++])
        assignField3DGS(out, v, props, p, val)
      }
    }
    return out
  }

  const body = new Uint8Array(buffer, headerEnd)
  if (body.byteLength < stride * vertexCount) {
    throw new Error(`PLY: body too small — need ${stride * vertexCount}, have ${body.byteLength}`)
  }
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength)

  let offset = 0
  for (let v = 0; v < vertexCount; v++) {
    let fieldOffset = offset
    for (let p = 0; p < props.length; p++) {
      const prop = props[p]
      const val = readScalar(dv, fieldOffset, prop.type)
      assignField3DGS(out, v, props, p, val)
      fieldOffset += typeSize(prop.type)
    }
    offset += stride
  }
  return out
}

const assignField3DGS = (
  out: SplatArray,
  vIndex: number,
  props: { name: string }[],
  pIndex: number,
  rawValue: number,
) => {
  const name = props[pIndex].name
  const v3 = vIndex * 3
  const v4 = vIndex * 4
  switch (name) {
    case 'x': out.positions[v3] = rawValue; break
    case 'y': out.positions[v3 + 1] = rawValue; break
    case 'z': out.positions[v3 + 2] = rawValue; break
    case 'scale_0': out.scales[v3] = Math.exp(rawValue); break
    case 'scale_1': out.scales[v3 + 1] = Math.exp(rawValue); break
    case 'scale_2': out.scales[v3 + 2] = Math.exp(rawValue); break
    case 'rot_0': out.rotations[v4] = rawValue; break
    case 'rot_1': out.rotations[v4 + 1] = rawValue; break
    case 'rot_2': out.rotations[v4 + 2] = rawValue; break
    case 'rot_3': out.rotations[v4 + 3] = rawValue; break
    case 'f_dc_0': out.colors[v3] = clampByte((0.5 + SH_C0 * rawValue) * 255); break
    case 'f_dc_1': out.colors[v3 + 1] = clampByte((0.5 + SH_C0 * rawValue) * 255); break
    case 'f_dc_2': out.colors[v3 + 2] = clampByte((0.5 + SH_C0 * rawValue) * 255); break
    case 'opacity': out.opacities[vIndex] = clampByte(1 / (1 + Math.exp(-rawValue)) * 255); break
    default:
      // f_rest_* and normals — ignored
      break
  }
  if (pIndex === props.length - 1) {
    const x = out.rotations[v4]
    const y = out.rotations[v4 + 1]
    const z = out.rotations[v4 + 2]
    const w = out.rotations[v4 + 3]
    const len = Math.hypot(x, y, z, w) || 1
    out.rotations[v4] = x / len
    out.rotations[v4 + 1] = y / len
    out.rotations[v4 + 2] = z / len
    out.rotations[v4 + 3] = w / len
  }
}

// ─── Point-cloud fallback path ────────────────────────────────────────
const parsePointCloud = (
  buffer: ArrayBuffer,
  headerEnd: number,
  vertexCount: number,
  props: { name: string; type: string }[],
  fieldIdx: Map<string, number>,
  isBinaryLittleEndian: boolean,
): SplatArray => {
  const decoder = new TextDecoder('ascii')

  // Locate color channels — accept both `red/green/blue` and `r/g/b`.
  const rName = pickFirst(fieldIdx, ['red', 'r', 'diffuse_red'])
  const gName = pickFirst(fieldIdx, ['green', 'g', 'diffuse_green'])
  const bName = pickFirst(fieldIdx, ['blue', 'b', 'diffuse_blue'])
  const hasColor = rName && gName && bName

  // Two-pass parse: first collect positions (and colors), then auto-compute
  // a uniform splat scale from the bounding box diagonal and point count.
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Uint8ClampedArray(vertexCount * 3)
  const stride = props.reduce((acc, p) => acc + typeSize(p.type), 0)

  const writeVertex = (vals: number[], vIndex: number) => {
    const v3 = vIndex * 3
    positions[v3]     = vals[fieldIdx.get('x')!]
    positions[v3 + 1] = vals[fieldIdx.get('y')!]
    positions[v3 + 2] = vals[fieldIdx.get('z')!]
    if (hasColor) {
      const rType = props[fieldIdx.get(rName!)!].type
      const gType = props[fieldIdx.get(gName!)!].type
      const bType = props[fieldIdx.get(bName!)!].type
      const rv = vals[fieldIdx.get(rName!)!]
      const gv = vals[fieldIdx.get(gName!)!]
      const bv = vals[fieldIdx.get(bName!)!]
      colors[v3]     = colorToByte(rv, rType)
      colors[v3 + 1] = colorToByte(gv, gType)
      colors[v3 + 2] = colorToByte(bv, bType)
    } else {
      colors[v3] = 255; colors[v3 + 1] = 255; colors[v3 + 2] = 255
    }
  }

  if (!isBinaryLittleEndian) {
    const bodyText = decoder.decode(buffer.slice(headerEnd))
    const tok = bodyText.split(/\s+/).filter(Boolean)
    let cursor = 0
    const vals = new Array(props.length)
    for (let v = 0; v < vertexCount; v++) {
      for (let p = 0; p < props.length; p++) vals[p] = parseFloat(tok[cursor++])
      writeVertex(vals, v)
    }
  } else {
    const body = new Uint8Array(buffer, headerEnd)
    if (body.byteLength < stride * vertexCount) {
      throw new Error(`PLY: body too small — need ${stride * vertexCount}, have ${body.byteLength}`)
    }
    const dv = new DataView(body.buffer, body.byteOffset, body.byteLength)
    const vals = new Array(props.length)
    let offset = 0
    for (let v = 0; v < vertexCount; v++) {
      let fieldOffset = offset
      for (let p = 0; p < props.length; p++) {
        vals[p] = readScalar(dv, fieldOffset, props[p].type)
        fieldOffset += typeSize(props[p].type)
      }
      writeVertex(vals, v)
      offset += stride
    }
  }

  // Auto-compute splat scale from point density.
  const { scale, nanCount } = estimatePointCloudScale(positions, vertexCount)

  if (nanCount > vertexCount * 0.01) {
    console.warn(
      `[ply-loader] ${nanCount.toLocaleString()}/${vertexCount.toLocaleString()} ` +
      `vertices had non-finite positions — body layout doesn't match header. ` +
      `Likely cause: file is a different binary layout than declared, or has ` +
      `non-standard property ordering. Rendering will be partial.`,
    )
  }

  const out: SplatArray = {
    count: vertexCount,
    positions,
    scales: new Float32Array(vertexCount * 3).fill(scale),
    // Identity quaternion: [w=1, x=0, y=0, z=0]
    rotations: (() => {
      const r = new Float32Array(vertexCount * 4)
      for (let i = 0; i < vertexCount; i++) r[i * 4] = 1
      return r
    })(),
    colors,
    opacities: new Uint8ClampedArray(vertexCount).fill(255),
  }
  return out
}

/**
 * Pick a splat scale that produces roughly overlapping sprites at the
 * observed point density: scale = bboxDiagonal / N^(1/3) * 1.5
 * (cube-root of the per-point volume, times a fill factor).
 *
 * Also sanitizes NaN/Infinity positions to 0 and reports how many were
 * fixed — non-finite positions propagate through boundingSphere and break
 * camera framing, manifesting as a black canvas.
 */
const estimatePointCloudScale = (
  positions: Float32Array,
  count: number,
): { scale: number; nanCount: number } => {
  if (count === 0) return { scale: 0.01, nanCount: 0 }
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let nanCount = 0
  for (let i = 0; i < count; i++) {
    const ix = i * 3
    let x = positions[ix]
    let y = positions[ix + 1]
    let z = positions[ix + 2]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      nanCount++
      x = 0; y = 0; z = 0
      positions[ix] = 0; positions[ix + 1] = 0; positions[ix + 2] = 0
    } else {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
  }
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (!Number.isFinite(diag) || diag === 0) return { scale: 0.05, nanCount }
  const spacing = diag / Math.cbrt(count)
  // 1.5× fill factor — point clouds need visibly overlapping sprites to read
  // as a surface; the splat renderer's screen-space sizing handles the rest.
  return { scale: Math.max(spacing * 1.5, diag * 1e-4), nanCount }
}

// ─── shared helpers ────────────────────────────────────────────────────
const typeSize = (t: string): number => {
  switch (t) {
    case 'float': case 'int32': case 'uint32': return 4
    case 'double': return 8
    case 'int16': case 'uint16': return 2
    case 'int8': case 'uint8': case 'char': case 'uchar': return 1
    default: return 4
  }
}

const readScalar = (dv: DataView, offset: number, type: string): number => {
  switch (type) {
    case 'float': return dv.getFloat32(offset, true)
    case 'double': return dv.getFloat64(offset, true)
    case 'int8': return dv.getInt8(offset)
    case 'uint8': case 'uchar': return dv.getUint8(offset)
    case 'int16': return dv.getInt16(offset, true)
    case 'uint16': return dv.getUint16(offset, true)
    case 'int32': return dv.getInt32(offset, true)
    case 'uint32': return dv.getUint32(offset, true)
    default: return dv.getFloat32(offset, true)
  }
}

const colorToByte = (raw: number, type: string): number => {
  if (type === 'float' || type === 'double') {
    // Float colors in PLY are usually 0..1; some exporters use 0..255 floats — sniff range.
    return clampByte(raw <= 1 && raw >= 0 ? raw * 255 : raw)
  }
  return clampByte(raw)
}

const pickFirst = (idx: Map<string, number>, names: string[]): string | null => {
  for (const n of names) if (idx.has(n)) return n
  return null
}

const clampByte = (v: number): number => Math.max(0, Math.min(255, v | 0))
