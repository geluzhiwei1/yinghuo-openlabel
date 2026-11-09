/**
 * MedicalVolume → three Data3DTexture(WebGL2 sampler3D)。
 * half-float(R16F) 存原强度值: three r170 RedFormat 不支持 UnsignedShort(R16),
 * R8 精度不够, R32F 显存翻倍 — half 11 位尾数对 CT HU / PET SUV 足够。
 */
import * as THREE from 'three'
import { DataUtils } from 'three'
import type { MedicalVolume } from '../data/volumeModel'

export interface VolumeTexturePack {
  texture: THREE.Data3DTexture
  /** float 纹理采样即原值, 无需还原 */
  scale: number
  offset: number
  volume: MedicalVolume
}

const MAX_TEX_DIM = 512   // >512³ 降采样(显存保护)

/** int16 → half 的 65536 项 LUT(Int16Array 数据 O(1) 转换) */
let halfLut: Uint16Array | null = null
function getHalfLut(): Uint16Array {
  if (!halfLut) {
    halfLut = new Uint16Array(65536)
    for (let v = 0; v < 65536; v++) halfLut[v] = DataUtils.toHalfFloat(v - 32768)
  }
  return halfLut
}

export function packVolumeTexture(volume: MedicalVolume): VolumeTexturePack {
  const [nx0, ny0, nz0] = volume.grid.dims
  const f = Math.max(1, Math.ceil(Math.max(nx0, ny0, nz0) / MAX_TEX_DIM))
  const nx = Math.floor(nx0 / f), ny = Math.floor(ny0 / f), nz = Math.floor(nz0 / f)
  const src = volume.data
  const isInt16 = src instanceof Int16Array
  const lut = isInt16 ? getHalfLut() : null
  const toHalf = (v: number) => lut ? lut[v + 32768] : DataUtils.toHalfFloat(v)
  const out = new Uint16Array(nx * ny * nz)
  const [sx, sy] = [nx0, ny0]

  let t = 0
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      const rowBase = (j * f) * sx + (k * f) * sx * sy
      for (let i = 0; i < nx; i++, t++) {
        out[t] = toHalf(src[rowBase + i * f])
      }
    }
  }

  const texture = new THREE.Data3DTexture(out, nx, ny, nz)
  texture.format = THREE.RedFormat
  texture.type = THREE.HalfFloatType
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.unpackAlignment = 2
  texture.needsUpdate = true
  return { texture, scale: 1, offset: 0, volume }
}

export function disposePack(pack: VolumeTexturePack | null) {
  pack?.texture.dispose()
}

/** 传输函数 256×1 RGBA LUT */
export function makeTfTexture(stops: { pos: number; rgba: [number, number, number, number] }[]): THREE.DataTexture {
  const N = 256
  const data = new Uint8Array(N * 4)
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1)
    let s0 = sorted[0], s1 = sorted[sorted.length - 1]
    for (let s = 0; s + 1 < sorted.length; s++) {
      if (p >= sorted[s].pos && p <= sorted[s + 1].pos) { s0 = sorted[s]; s1 = sorted[s + 1]; break }
    }
    if (p < sorted[0].pos) s1 = s0
    if (p > sorted[sorted.length - 1].pos) s0 = s1
    const span = s1.pos - s0.pos
    const t = span > 1e-6 ? (p - s0.pos) / span : 0
    for (let c = 0; c < 4; c++) {
      data[i * 4 + c] = Math.round(s0.rgba[c] + (s1.rgba[c] - s0.rgba[c]) * t)
    }
  }
  const tex = new THREE.DataTexture(data, N, 1)
  tex.format = THREE.RGBAFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}
