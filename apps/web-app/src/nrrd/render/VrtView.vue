<template>
  <div ref="hostRef" class="vrt-view" @contextmenu.prevent @pointerdown="onPointerDown"
    @pointermove="onPointerMove" @pointerup="onPointerUp">
    <canvas ref="canvasRef" class="vrt-view__canvas" />
    <div class="vrt-view__hud">
      <span v-if="interacting" class="vrt-view__fast">{{ t('nrrd.vrt.fastPreview') }}</span>
    </div>
    <!-- 3D 参数就近: 渲染模式 + TF 预设(交互控件需截住指针事件, 不落到画布手势) -->
    <div v-if="volState.base" class="vrt-view__ctl" @pointerdown.stop @pointermove.stop @pointerup.stop
      @wheel.stop @dblclick.stop @contextmenu.stop>
      <el-select :model-value="effectiveVrtMode()" @update:model-value="(v: any) => (volState.vrt.mode = v)"
        size="small" class="vrt-view__sel" :title="t('nrrd.wl.renderMode')"
        popper-class="canvas-hud__pop" :teleported="false">
        <el-option value="vrt" label="VRT" />
        <el-option value="mip" label="MIP" />
        <template v-if="volState.overlay || jobConfig.streams.includes('pet')">
          <el-option value="fused" :label="t('nrrd.wl.fused3d')" :disabled="!volState.overlay || !volState.petOn" />
          <el-option value="petMip" label="PET-MIP" :disabled="!volState.overlay || !volState.petOn" />
        </template>
      </el-select>
      <el-select v-model="volState.vrt.tfPreset" size="small" class="vrt-view__sel" :title="t('nrrd.wl.tfPreset')"
        popper-class="canvas-hud__pop" :teleported="false">
        <el-option v-for="(v, k) in TF_PRESETS" :key="k" :value="k" :label="k" />
      </el-select>
    </div>
    <ViewMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @action="onMenuAction" @close="menu = null" />
  </div>
</template>

<script lang="ts" setup>
/**
 * 3D 体渲染视图: 射线步进盒 mesh + OrbitControls + ViewHelper 方位罗盘。
 * 交互(旋转/缩放)中降采样渲染, 停止后高清重绘。
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'
import { volState, effectiveVrtMode } from '../store'
import { jobConfig } from '@/states/job-config'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const props = defineProps<{ hidden?: boolean }>()
import { packVolumeTexture, disposePack, makeTfTexture, type VolumeTexturePack } from './volumeTexture'
import { createVrtMaterial, VRT_MODE_INDEX, TF_PRESETS } from './vrtMaterial'
import ViewMenu from './ViewMenu.vue'

// 右键: 拖动=OrbitControls 平移, 原地松开=菜单(截图)
let downX = 0, downY = 0, rightMoved = false
const menu = ref<{ x: number; y: number } | null>(null)
const menuItems = [{ key: 'shot', label: t('nrrd.view.saveShot') }]

function onPointerDown(e: PointerEvent) {
  downX = e.clientX; downY = e.clientY
  rightMoved = false
}

function onPointerMove(e: PointerEvent) {
  if (e.buttons & 2 && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 3) rightMoved = true
}

function onPointerUp(e: PointerEvent) {
  if (e.button !== 2 || rightMoved || !hostRef.value) return
  const rect = hostRef.value.getBoundingClientRect()
  menu.value = { x: Math.min(e.clientX - rect.left, rect.width - 130), y: Math.min(e.clientY - rect.top, rect.height - 40) }
}

function onMenuAction(key: string) {
  menu.value = null
  if (key !== 'shot' || !renderer || !scene || !camera || !canvasRef.value) return
  // WebGL canvas 无 preserveDrawingBuffer, 同步渲染后立即读取
  renderer.render(scene, camera)
  const link = document.createElement('a')
  link.href = canvasRef.value.toDataURL('image/png')
  link.download = 'vrt.png'
  link.click()
}

const hostRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const interacting = ref(false)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let helper: ViewHelper | null = null
let mesh: THREE.Mesh | null = null
let ctPack: VolumeTexturePack | null = null
let petPack: VolumeTexturePack | null = null
let material: THREE.ShaderMaterial | null = null
// 隐藏期间体数据换了 → 释放旧纹理待重现时重建(避免隐藏状态下做秒级打包)
let pendingRebuild = false
let rafId = 0
let idleTimer: number | undefined
let curPixelRatio = 1
let curW = -1
let curH = -1

function buildScene() {
  const host = hostRef.value!
  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value!, antialias: false, alpha: false })
  renderer.setClearColor(0x0b0b0f, 1)
  scene = new THREE.Scene()
  const w = host.clientWidth || 400, h = host.clientHeight || 300
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 4000)
  controls = new OrbitControls(camera, canvasRef.value!)
  controls.enableDamping = true
  controls.dampingFactor = 0.15
  controls.addEventListener('start', () => { interacting.value = true; setQuality(0.5) })
  controls.addEventListener('end', () => {
    idleTimer = window.setTimeout(() => { interacting.value = false; setQuality(1) }, 220)
  })
}

/** 释放体渲染资源(mesh/纹理/材质), 保留 renderer 上下文 */
function teardownVolume() {
  if (mesh) { scene?.remove(mesh); mesh.geometry.dispose(); mesh = null }
  disposePack(ctPack); disposePack(petPack)
  ctPack = petPack = null
  material?.dispose()
  material = null
}

function rebuildVolume() {
  if (!scene || !camera || !volState.base) return
  teardownVolume()

  const base = volState.base
  ctPack = packVolumeTexture(base)
  petPack = volState.overlay ? packVolumeTexture(volState.overlay) : null

  const [nx, ny, nz] = base.grid.dims
  const [sx, sy, sz] = base.grid.spacing
  const origin = new THREE.Vector3(...base.grid.origin)
  const size = new THREE.Vector3(nx * sx, ny * sy, nz * sz)
  material = createVrtMaterial({
    ct: ctPack,
    pet: petPack,
    origin, size,
    wl: volState.wl,
    petMax: volState.overlay?.intensity.max ?? 1,
    petThreshold: 0.35,
    steps: volState.vrt.steps,
  })
  mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
  mesh.scale.copy(size)
  mesh.position.copy(origin.clone().add(size.clone().multiplyScalar(0.5)))
  scene.add(mesh)

  // 相机对准体中心, 距离按对角线
  const center = mesh.position.clone()
  const diag = size.length()
  camera.position.copy(center.clone().add(new THREE.Vector3(0.6, -0.7, 1).normalize().multiplyScalar(diag * 0.9)))
  camera.near = diag / 100
  camera.far = diag * 10
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()

  applyMode()
  applyTf()
}

function applyMode() {
  if (!material) return
  material.uniforms.uMode.value = VRT_MODE_INDEX[effectiveVrtMode()]
}
function applyTf() {
  if (!material) return
  const stops = TF_PRESETS[volState.vrt.tfPreset]
  if (stops) {
    material.uniforms.uTF.value?.dispose?.()
    material.uniforms.uTF.value = makeTfTexture(stops)
  }
  material.uniforms.uPetAlpha.value = volState.petAlpha
  material.uniforms.uSteps.value = volState.vrt.steps
  material.uniforms.uCTLo.value = volState.wl.level - volState.wl.width / 2
  material.uniforms.uCTHi.value = volState.wl.level + volState.wl.width / 2
}

function setQuality(q: number) {
  if (!renderer || !hostRef.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * q * volState.vrt.quality
  const ratio = Math.max(0.3, dpr)
  const w = hostRef.value.clientWidth, h = hostRef.value.clientHeight
  if (w < 2 || h < 2) return
  if (Math.abs(ratio - curPixelRatio) < 0.01 && w === curW && h === curH) return
  curPixelRatio = ratio
  curW = w; curH = h
  renderer.setPixelRatio(ratio)
  renderer.setSize(w, h, false)
  camera!.aspect = w / h
  camera!.updateProjectionMatrix()
}

function render() {
  rafId = requestAnimationFrame(render)
  if (props.hidden || !renderer || !scene || !camera || !controls) return
  controls.update()
  renderer.render(scene, camera)
  if (helper) {
    // ViewHelper 内部 renderer.render 会按 autoClear 清屏, 关掉避免抹掉体渲染结果
    renderer.autoClear = false
    helper.render(renderer)
    renderer.autoClear = true
  }
}

function onResize() {
  if (!renderer || !hostRef.value || !camera) return
  setQuality(interacting.value ? 0.5 : 1)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  buildScene()
  helper = new ViewHelper(camera!, canvasRef!)
  if (props.hidden) pendingRebuild = true
  else rebuildVolume()
  ro = new ResizeObserver(onResize)
  ro.observe(hostRef.value!)
  render()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.clearTimeout(idleTimer)
  ro?.disconnect()
  controls?.dispose()
  helper?.dispose?.()
  teardownVolume()
  renderer?.dispose()
})

watch(() => volState.base, () => {
  if (props.hidden) { teardownVolume(); pendingRebuild = true }
  else rebuildVolume()
})
watch(() => props.hidden, h => {
  if (!h && pendingRebuild) { pendingRebuild = false; rebuildVolume() }
})
watch(() => [volState.vrt.mode, volState.overlay, volState.petOn], applyMode)
watch(() => [volState.vrt.tfPreset, volState.petAlpha, volState.vrt.steps, volState.wl.width, volState.wl.level], applyTf)
</script>

<style scoped>
.vrt-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 45%, #16161c, #0b0b0f);
}

.vrt-view__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.vrt-view__ctl {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 6px;
  align-items: center;
}

.vrt-view__sel {
  width: 96px;
}

.vrt-view__hud {
  position: absolute;
  top: 4px;
  left: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: rgba(180, 235, 200, 0.85);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  pointer-events: none;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
}

.vrt-view__fast {
  color: rgba(255, 210, 80, 0.9);
}
</style>
