import * as THREE from 'three'
import type { SplatArray } from './splat-types'

/**
 * Gaussian Splat renderer.
 *
 * Implementation choice: per-splat screen-space gaussian via THREE.Points +
 * custom ShaderMaterial. Each splat is one point; the fragment shader computes
 * the gaussian falloff from gl_PointCoord and multiplies by the splat color +
 * opacity. Scale of each splat (post-projection) is approximated from the
 * world-space scale × distance to camera.
 *
 * This is not a full 3DGS-style tile-sorted EWA splat — that requires
 * order-independent transparency and is way beyond what a vue component can
 * host. It IS a faithful, interactive preview that supports the same data
 * formats. For full-quality rendering the project can swap in a webgpu-based
 * renderer later without touching the loader layer.
 */
export interface GaussianRendererHandle {
  object: THREE.Points
  dispose: () => void
  update: (data: SplatArray) => void
  /** Hide individual splats by index. Pass null/empty to clear. */
  setHidden: (indices: number[] | null) => void
  /**
   * Override the rendered color of specific splats. Pass null to clear all
   * tints and fall back to natural splat color. Each entry is `[index, r, g, b]`
   * with rgb in 0..1. Indices not present in the list revert to natural color.
   */
  setTint: (tints: Array<[number, number, number, number]> | null) => void
  /** Pick the closest splat to a ray. Returns index or null. */
  pickAt: (raycaster: THREE.Raycaster) => number | null
  /** Re-fit camera to current bounds. */
  frameCamera: (camera: THREE.PerspectiveCamera, controls?: { target: THREE.Vector3; update: () => void }) => void
  getStats: () => { count: number; hidden: number; tinted: number }
  /** Read-only access to the underlying position array — used by the box-selector. */
  positions: () => Float32Array
}

const VERT_SHADER = /* glsl */ `
  precision highp float;
  precision highp int;

  // position is injected by Three.js for ShaderMaterial — do not redeclare.
  attribute float aScale;        // average of 3 axis scales, world space
  attribute vec4 aColor;         // rgba 0..1
  attribute float aHidden;       // 1.0 = hidden, 0.0 = visible
  attribute vec3 aTint;          // 0..1; if all zero use natural color, else override rgb

  uniform float uSizeScale;
  uniform float uDensity;

  varying vec4 vColor;
  varying float vHidden;

  void main() {
    // If tint > 0 use it (override), else fall back to splat color
    float tintLum = dot(aTint, vec3(1.0));
    vec3 baseColor = tintLum > 0.001 ? aTint : aColor.rgb;
    vColor = vec4(baseColor, aColor.a);
    vHidden = aHidden;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Projected size: world scale × (projection fudge) / view distance.
    // The 300.0 is empirical — matches PLY scales to a reasonable on-screen size.
    float dist = -mvPosition.z;
    float size = max(1.0, aScale * uSizeScale * 300.0 / max(dist, 0.001));
    gl_PointSize = clamp(size, 1.0, 128.0);
  }
`

const FRAG_SHADER = /* glsl */ `
  precision highp float;

  uniform float uDensity;
  varying vec4 vColor;
  varying float vHidden;

  void main() {
    if (vHidden > 0.5) discard;
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) discard;

    // Gaussian falloff — 3σ cutoff at r=1
    float alpha = exp(-3.5 * r2) * vColor.a * uDensity;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(vColor.rgb, alpha);
  }
`

export const createGaussianRenderer = (
  data: SplatArray,
): GaussianRendererHandle => {
  const geometry = new THREE.BufferGeometry()

  const buildAttributes = (splats: SplatArray) => {
    const count = splats.count
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const colors = new Float32Array(count * 4)
    const hidden = new Float32Array(count)
    const tint = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = splats.positions[i * 3]
      positions[i * 3 + 1] = splats.positions[i * 3 + 1]
      positions[i * 3 + 2] = splats.positions[i * 3 + 2]

      const sx = splats.scales[i * 3]
      const sy = splats.scales[i * 3 + 1]
      const sz = splats.scales[i * 3 + 2]
      // geometric mean as projected sprite radius — keeps memory small (1 float/splat)
      scales[i] = Math.cbrt(sx * sy * sz)

      colors[i * 4]     = splats.colors[i * 3] / 255
      colors[i * 4 + 1] = splats.colors[i * 3 + 1] / 255
      colors[i * 4 + 2] = splats.colors[i * 3 + 2] / 255
      colors[i * 4 + 3] = splats.opacities[i] / 255
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 4))
    geometry.setAttribute('aHidden', new THREE.BufferAttribute(hidden, 1))
    geometry.setAttribute('aTint', new THREE.BufferAttribute(tint, 3))
    geometry.boundingSphere = computeBoundingSphere(splats)
  }

  buildAttributes(data)

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT_SHADER,
    fragmentShader: FRAG_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uSizeScale: { value: 1.0 },
      uDensity: { value: 1.0 },
    },
  })

  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false

  let hiddenCount = 0
  let tintCount = 0

  const update = (next: SplatArray) => {
    buildAttributes(next)
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aScale.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
    geometry.attributes.aHidden.needsUpdate = true
    geometry.attributes.aTint.needsUpdate = true
    tintCount = 0
  }

  const setHidden = (indices: number[] | null) => {
    const attr = geometry.getAttribute('aHidden') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    arr.fill(0)
    hiddenCount = 0
    if (indices && indices.length) {
      for (const i of indices) {
        if (i >= 0 && i < arr.length) {
          arr[i] = 1
          hiddenCount++
        }
      }
    }
    attr.needsUpdate = true
  }

  const setTint: GaussianRendererHandle['setTint'] = (tints) => {
    const attr = geometry.getAttribute('aTint') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    arr.fill(0)
    tintCount = 0
    if (tints) {
      for (const [i, r, g, b] of tints) {
        if (i >= 0 && i * 3 + 2 < arr.length) {
          arr[i * 3] = r
          arr[i * 3 + 1] = g
          arr[i * 3 + 2] = b
          tintCount++
        }
      }
    }
    attr.needsUpdate = true
  }

  const pickAt: GaussianRendererHandle['pickAt'] = (raycaster) => {
    const hits = raycaster.intersectObject(object, false)
    // Skip hidden splats — raycaster still intersects them because they exist
    // in the geometry; we filter post-hoc to keep the GPU path untouched.
    const hiddenAttr = geometry.getAttribute('aHidden') as THREE.BufferAttribute
    const hiddenArr = hiddenAttr.array as Float32Array
    for (const hit of hits) {
      if (hit.index === undefined) continue
      if (hiddenArr[hit.index] > 0.5) continue
      return hit.index
    }
    return null
  }

  const frameCamera: GaussianRendererHandle['frameCamera'] = (camera, controls) => {
    const sphere = geometry.boundingSphere
    if (!sphere) return
    const center = sphere.center
    const radius = sphere.radius

    const fov = (camera.fov * Math.PI) / 180
    const dist = (radius * 1.4) / Math.sin(fov / 2)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    camera.position.copy(center).addScaledVector(dir, -dist)
    camera.near = Math.max(0.01, dist * 0.05)
    camera.far = dist * 20 + radius * 4
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  }

  const getStats = () => ({ count: data.count, hidden: hiddenCount, tinted: tintCount })

  const positions = () => geometry.getAttribute('position').array as Float32Array

  const dispose = () => {
    geometry.dispose()
    material.dispose()
  }

  return { object, dispose, update, setHidden, setTint, pickAt, frameCamera, getStats, positions }
}

const computeBoundingSphere = (data: SplatArray): THREE.Sphere => {
  if (data.count === 0) return new THREE.Sphere(new THREE.Vector3(), 0)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  const min = new THREE.Vector3(+Infinity, +Infinity, +Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < data.count; i++) {
    v.set(
      data.positions[i * 3],
      data.positions[i * 3 + 1],
      data.positions[i * 3 + 2],
    )
    min.min(v)
    max.max(v)
  }
  box.set(min, max)
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  return sphere
}

/** Compute world-space bounds — used by the data panel for the bounding-box readout. */
export const computeBounds = (data: SplatArray): THREE.Box3 => {
  const box = new THREE.Box3()
  if (data.count === 0) return box
  const v = new THREE.Vector3()
  for (let i = 0; i < data.count; i++) {
    v.set(
      data.positions[i * 3],
      data.positions[i * 3 + 1],
      data.positions[i * 3 + 2],
    )
    box.expandByPoint(v)
  }
  return box
}
