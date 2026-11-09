/**
 * VRT 射线步进 ShaderMaterial(自研, three npm 无体渲染示例)。
 *
 * 模式: 0=MIP(CT) 1=VRT(CT 传输函数) 2=Fused(CT VRT + PET 热图) 3=PET-MIP
 * 几何: 单位盒 mesh, fragment 内由相机→片元方向与体 AABB 求交, front-to-back 合成。
 * CT/PET 双 sampler3D(uint16 打包, scale/offset 还原), TF 256×1 LUT。
 */
import * as THREE from 'three'
import { makeTfTexture } from './volumeTexture'

export type VrtMode = 'mip' | 'vrt' | 'fused' | 'petMip'

export const VRT_MODE_INDEX: Record<VrtMode, number> = { mip: 0, vrt: 1, fused: 2, petMip: 3 }

export const TF_PRESETS: Record<string, { pos: number; rgba: [number, number, number, number] }[]> = {
  '骨骼 CT-VRT': [
    { pos: 0.05, rgba: [0, 0, 0, 0] },
    { pos: 0.35, rgba: [180, 60, 30, 40] },
    { pos: 0.65, rgba: [240, 220, 180, 220] },
    { pos: 1.0, rgba: [255, 255, 255, 255] },
  ],
  '软组织 CT-VRT': [
    { pos: 0.0, rgba: [0, 0, 0, 0] },
    { pos: 0.25, rgba: [90, 40, 40, 30] },
    { pos: 0.5, rgba: [210, 150, 130, 140] },
    { pos: 0.8, rgba: [240, 230, 220, 230] },
    { pos: 1.0, rgba: [255, 255, 255, 255] },
  ],
  '肺 CT-VRT': [
    { pos: 0.0, rgba: [0, 10, 30, 0] },
    { pos: 0.18, rgba: [30, 60, 120, 55] },
    { pos: 0.45, rgba: [200, 200, 210, 120] },
    { pos: 0.75, rgba: [250, 250, 250, 235] },
    { pos: 1.0, rgba: [255, 255, 255, 255] },
  ],
}

const VERT = /* glsl */ `
out vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vWorldPos;
uniform sampler3D uCT;
uniform sampler3D uPET;
uniform sampler2D uTF;
uniform vec3 uVolOrigin;     // voxel(0,0,0) 中心世界坐标
uniform vec3 uVolSize;       // dims * spacing
uniform float uCTScale, uCTOffset, uCTLo, uCTHi;
uniform float uPETScale, uPETOffset, uPETLo;
uniform int uMode;
uniform float uSteps;
uniform float uPetAlpha;
out vec4 outColor;

vec2 rayBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

float sampleCT(vec3 p) {
  vec3 uvw = (p - uVolOrigin) / uVolSize + 0.5 / vec3(textureSize(uCT, 0));
  return texture(uCT, uvw).r * uCTScale + uCTOffset;
}

float samplePET(vec3 p) {
  vec3 uvw = (p - uVolOrigin) / uVolSize + 0.5 / vec3(textureSize(uPET, 0));
  return texture(uPET, uvw).r * uPETScale + uPETOffset;
}

// PET SUV → 热图 RGBA(hot iron 近似)
vec4 petColor(float v) {
  float t = clamp((v - uPETLo) / max(1e-4, 1.0 - uPETLo), 0.0, 1.0);
  return vec4(smoothstep(0.25, 1.0, t), smoothstep(0.5, 1.0, t) * 0.7, smoothstep(0.75, 1.0, t) * 0.4, t);
}

vec4 applyTF(float hu) {
  float t = clamp((hu - uCTLo) / max(1e-3, uCTHi - uCTLo), 0.0, 1.0);
  return texture(uTF, vec2(t, 0.5));
}

void main() {
  vec3 bmin = uVolOrigin - 0.5 * (uVolSize / vec3(textureSize(uCT, 0)));
  vec3 bmax = uVolOrigin + uVolSize - 0.5 * (uVolSize / vec3(textureSize(uCT, 0)));
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - cameraPosition);
  vec2 hit = rayBox(ro, rd, bmin, bmax);
  if (hit.y <= max(hit.x, 0.0)) discard;

  float tStart = max(hit.x, 0.0) + 0.001;
  float tEnd = hit.y - 0.001;
  float dt = (tEnd - tStart) / uSteps;

  // MIP / PET-MIP
  if (uMode == 0 || uMode == 3) {
    float best = uMode == 0 ? -1e9 : 0.0;
    vec3 p = ro + rd * tStart;
    for (int s = 0; s < 700; s++) {
      if (s >= int(uSteps)) break;
      if (uMode == 0) best = max(best, sampleCT(p));
      else best = max(best, samplePET(p));
      p += rd * dt;
    }
    if (uMode == 0) {
      float t = clamp((best - uCTLo) / max(1e-3, uCTHi - uCTLo), 0.0, 1.0);
      if (best < uCTLo) discard;
      outColor = vec4(vec3(t), 1.0);
    } else {
      if (best <= uPETLo) discard;
      outColor = vec4(petColor(best).rgb, 1.0);
    }
    return;
  }

  // VRT / Fused: front-to-back 合成
  vec4 acc = vec4(0.0);
  vec3 p = ro + rd * tStart;
  float petAcc = 0.0;
  for (int s = 0; s < 700; s++) {
    if (s >= int(uSteps)) break;
    vec4 c = applyTF(sampleCT(p));
    if (uMode == 2) {
      float pv = samplePET(p);
      vec4 pc = petColor(pv);
      c.rgb = mix(c.rgb, pc.rgb, pc.a * uPetAlpha);
      c.a = max(c.a, pc.a * uPetAlpha * 0.85);
    }
    if (c.a > 0.003) {
      float a = (1.0 - acc.a) * c.a;
      acc.rgb += a * c.rgb;
      acc.a += a;
      if (acc.a > 0.97) break;
    }
    p += rd * dt;
  }
  if (acc.a < 0.004) discard;
  outColor = vec4(acc.rgb / acc.a, acc.a);
}
`

export interface VrtMaterialOptions {
  ct: { texture: THREE.Data3DTexture; scale: number; offset: number }
  pet?: { texture: THREE.Data3DTexture; scale: number; offset: number } | null
  origin: THREE.Vector3
  size: THREE.Vector3
  wl: { width: number; level: number }
  petMax: number
  petThreshold: number   // 0..1, PET 显示下限(相对 max)
  steps?: number
}

export function createVrtMaterial(opts: VrtMaterialOptions): THREE.ShaderMaterial {
  const empty = new THREE.Data3DTexture(new Uint16Array(1), 1, 1, 1)
  empty.format = THREE.RedFormat
  empty.type = THREE.HalfFloatType
  empty.needsUpdate = true

  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,   // 相机可进盒内
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCT: { value: opts.ct.texture },
      uPET: { value: opts.pet?.texture ?? empty },
      uTF: { value: makeTfTexture(TF_PRESETS['骨骼 CT-VRT']) },
      uVolOrigin: { value: opts.origin.clone() },
      uVolSize: { value: opts.size.clone() },
      uCTScale: { value: opts.ct.scale },
      uCTOffset: { value: opts.ct.offset },
      uCTLo: { value: opts.wl.level - opts.wl.width / 2 },
      uCTHi: { value: opts.wl.level + opts.wl.width / 2 },
      uPETScale: { value: opts.pet?.scale ?? 1 },
      uPETOffset: { value: opts.pet?.offset ?? 0 },
      uPETLo: { value: (opts.pet ? opts.pet.offset + opts.petThreshold * (opts.petMax - opts.pet.offset) : 1e9) },
      uMode: { value: 1 },
      uSteps: { value: opts.steps ?? 400 },
      uPetAlpha: { value: 0.85 },
    },
  })
  return mat
}
