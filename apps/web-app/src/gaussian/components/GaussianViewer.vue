<template>
  <div
    class="gaussian-viewer"
    ref="containerRef"
    :style="{ background: gaussianState.sceneColor }"
  >
    <canvas
      ref="canvasRef"
      class="gaussian-viewer__canvas"
      :class="{ 'gaussian-viewer__canvas--picking': isPickingCursor }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
    />

    <!-- Box-select rectangle overlay -->
    <div v-if="boxRect" class="gaussian-viewer__sel-rect" :style="boxRectStyle"></div>

    <!-- Brush cursor overlay (mouse-positioned disk) -->
    <div
      v-if="showBrushCursor"
      class="gaussian-viewer__brush-cursor"
      :class="`gaussian-viewer__brush-cursor--${gaussianState.brushOp}`"
      :style="brushCursorStyle"
    ></div>

    <div class="gaussian-viewer__chip">
      <Icon icon="lucide:boxes" />
      {{ chipLabel }}
    </div>

    <div v-if="gaussianState.selectionMode !== 'off'" class="gaussian-viewer__mode-chip">
      <Icon :icon="modeIcon" :width="12" />
      <span>{{ modeLabel }}</span>
      <span v-if="gaussianState.selection.size > 0" class="gaussian-viewer__mode-count">
        · {{ gaussianState.selection.size.toLocaleString() }} 已选
      </span>
    </div>

    <div v-if="!gaussianState.loaded && !gaussianState.loading" class="gaussian-viewer__empty">
      <Icon icon="lucide:upload-cloud" :width="28" />
      <p class="gaussian-viewer__empty-title">未加载高斯泼溅数据</p>
      <p class="gaussian-viewer__empty-hint">支持 .ply / .splat / .spz —— 在左侧「数据」面板选择文件</p>
    </div>

    <div v-if="gaussianState.loading" class="gaussian-viewer__loading">
      <Icon icon="lucide:loader-circle" :width="24" class="y-spin" />
      <p>解析中…</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Icon } from '@iconify/vue'
import { canvaPanel, uiState } from '@/states/UiState'
import { gaussianState, SELECTION_COLOR } from '../state'
import { createGaussianRenderer, type GaussianRendererHandle } from '../render/gaussian-renderer'
import { computeBounds } from '../render/gaussian-renderer'
import { clickPick, boxPick, brushPick, type ScreenRect } from '../render/pick'
import { eventBus } from '../event/EventBus'

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let splatHandle: GaussianRendererHandle | null = null
let gridHelper: THREE.GridHelper
let axesHelper: THREE.AxesHelper
let frame = 0

const chipLabel = computed(() => {
  if (!gaussianState.loaded) return 'GAUSSIAN · §IDLE'
  return `GAUSSIAN · ${gaussianState.format.toUpperCase()} · ${formatCount(gaussianState.count)}`
})

const modeIcon = computed(() => {
  switch (gaussianState.selectionMode) {
    case 'click': return 'lucide:mouse-pointer-2'
    case 'box':   return 'lucide:square-dashed'
    case 'brush': return 'lucide:paintbrush-2'
    default:      return 'lucide:hand'
  }
})

const modeLabel = computed(() => {
  switch (gaussianState.selectionMode) {
    case 'click': return '单选'
    case 'box':   return '框选'
    case 'brush': return gaussianState.brushAutoAssign && gaussianState.currentLabelId
      ? `涂抹 → ${currentLabelName.value}`
      : '涂抹'
    default:      return '浏览'
  }
})

const currentLabelName = computed(() => {
  const id = gaussianState.currentLabelId
  if (!id) return ''
  return gaussianState.labels.find((l) => l.id === id)?.name ?? ''
})

const isPickingCursor = computed(() => gaussianState.selectionMode !== 'off')

// ─── Brush cursor overlay state ──────────────────────
const brushPos = ref<{ x: number; y: number } | null>(null)
const showBrushCursor = computed(() =>
  gaussianState.selectionMode === 'brush' && brushPos.value !== null,
)
const brushCursorStyle = computed(() => {
  if (!brushPos.value) return { display: 'none' }
  const r = gaussianState.brushRadiusPx
  return {
    left: `${brushPos.value.x - r}px`,
    top: `${brushPos.value.y - r}px`,
    width: `${r * 2}px`,
    height: `${r * 2}px`,
  }
})

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ─── Box-select rectangle state ───────────────────────
const boxRect = ref<ScreenRect | null>(null)
const boxRectStyle = computed(() => {
  if (!boxRect.value) return {}
  const r = boxRect.value
  const x = Math.min(r.x0, r.x1)
  const y = Math.min(r.y0, r.y1)
  const w = Math.abs(r.x1 - r.x0)
  const h = Math.abs(r.y1 - r.y0)
  return { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }
})

let dragStart: { x: number; y: number } | null = null
let dragMoved = false

const canvasCoords = (e: MouseEvent) => {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

const onMouseDown = (e: MouseEvent) => {
  if (gaussianState.selectionMode === 'off' || !splatHandle) return
  if (e.button !== 0) return // only left button
  dragMoved = false
  dragStart = canvasCoords(e)
  if (gaussianState.selectionMode === 'box') {
    boxRect.value = { x0: dragStart.x, y0: dragStart.y, x1: dragStart.x, y1: dragStart.y }
    controls.enabled = false
  } else if (gaussianState.selectionMode === 'brush') {
    controls.enabled = false
    // Pick once immediately so a click (no drag) still paints
    runBrushAt(dragStart.x, dragStart.y)
  }
}

const onMouseMove = (e: MouseEvent) => {
  const cur = canvasCoords(e)
  // Always track cursor for brush overlay (even when not dragging)
  if (gaussianState.selectionMode === 'brush') {
    brushPos.value = cur
  }

  if (!dragStart) return
  if (Math.abs(cur.x - dragStart.x) + Math.abs(cur.y - dragStart.y) > 3) dragMoved = true

  if (gaussianState.selectionMode === 'box' && boxRect.value) {
    boxRect.value = { ...boxRect.value, x1: cur.x, y1: cur.y }
  } else if (gaussianState.selectionMode === 'brush') {
    // Throttle: only pick if the cursor moved ≥ 25% of brush radius since
    // the last pick — avoids O(N) re-scan on every mousemove frame.
    const minStep = Math.max(2, gaussianState.brushRadiusPx * 0.25)
    if (
      !lastBrushPos ||
      Math.abs(cur.x - lastBrushPos.x) > minStep ||
      Math.abs(cur.y - lastBrushPos.y) > minStep
    ) {
      runBrushAt(cur.x, cur.y)
      lastBrushPos = cur
    }
  }
}

const onMouseUp = (e: MouseEvent) => {
  if (gaussianState.selectionMode === 'box' || gaussianState.selectionMode === 'brush') {
    controls.enabled = true
  }
  if (!dragStart || !splatHandle) {
    dragStart = null
    boxRect.value = null
    lastBrushPos = null
    return
  }
  const cur = canvasCoords(e)
  const canvas = canvasRef.value!

  if (gaussianState.selectionMode === 'click' && !dragMoved) {
    const ndc = new THREE.Vector2(
      (cur.x / canvas.clientWidth) * 2 - 1,
      -(cur.y / canvas.clientHeight) * 2 + 1,
    )
    const idx = clickPick(splatHandle, camera, ndc)
    if (idx !== null) toggleSelection(idx, e.shiftKey)
  } else if (gaussianState.selectionMode === 'box' && boxRect.value) {
    const rect = boxRect.value
    const hits = boxPick(splatHandle, camera, rect, canvas.clientWidth, canvas.clientHeight)
    if (hits.length > 0) {
      if (e.shiftKey) {
        for (const i of hits) gaussianState.selection.add(i)
      } else {
        gaussianState.selection.clear()
        for (const i of hits) gaussianState.selection.add(i)
      }
    }
  }

  dragStart = null
  boxRect.value = null
  lastBrushPos = null
  syncTints()
}

const onMouseLeave = () => {
  dragStart = null
  boxRect.value = null
  brushPos.value = null
  lastBrushPos = null
  if (gaussianState.selectionMode === 'box' || gaussianState.selectionMode === 'brush') {
    controls.enabled = true
  }
}

// ─── Brush application ────────────────────────────────
let lastBrushPos: { x: number; y: number } | null = null
let dirtyAfterBrush = false
/** Saved op so modifier-release restores the user's panel selection. */
let savedBrushOp: typeof gaussianState.brushOp | null = null

const onKeyDown = (e: KeyboardEvent) => {
  if (gaussianState.selectionMode !== 'brush') return
  // Ignore when typing in an input/textarea
  const t = e.target as HTMLElement
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (savedBrushOp) return
  if (e.key === 'x' || e.key === 'X') {
    savedBrushOp = gaussianState.brushOp
    gaussianState.brushOp = 'remove'
  } else if (e.key === 'Shift') {
    savedBrushOp = gaussianState.brushOp
    gaussianState.brushOp = 'add'
  }
}
const onKeyUp = (e: KeyboardEvent) => {
  if (!savedBrushOp) return
  if (e.key === 'x' || e.key === 'X' || e.key === 'Shift') {
    gaussianState.brushOp = savedBrushOp
    savedBrushOp = null
  }
}

const runBrushAt = (px: number, py: number) => {
  if (!splatHandle || !canvasRef.value) return
  const canvas = canvasRef.value
  const hits = brushPick(
    splatHandle,
    camera,
    { x: px, y: py },
    gaussianState.brushRadiusPx,
    canvas.clientWidth,
    canvas.clientHeight,
  )
  if (hits.length === 0) return
  const op = gaussianState.brushOp
  const auto = gaussianState.brushAutoAssign
  const label = auto
    ? gaussianState.labels.find((l) => l.id === gaussianState.currentLabelId)
    : null

  if (label) {
    const set = new Set(label.indices)
    if (op === 'add') {
      for (const i of hits) set.add(i)
      // Strip from siblings (one splat = one label)
      for (const other of gaussianState.labels) {
        if (other.id === label.id) continue
        if (hits.some((i) => other.indices.includes(i))) {
          other.indices = other.indices.filter((i) => !hits.includes(i))
        }
      }
    } else {
      for (const i of hits) set.delete(i)
    }
    label.indices = Array.from(set)
  } else {
    if (op === 'add') {
      for (const i of hits) gaussianState.selection.add(i)
    } else {
      for (const i of hits) gaussianState.selection.delete(i)
    }
  }
  dirtyAfterBrush = true
}

// Flush tints on RAF after a burst of brush strokes — prevents per-call
// re-upload of the aTint attribute (can be 5MB+) on every mousemove.
const flushBrushTints = () => {
  if (dirtyAfterBrush) {
    syncTints()
    dirtyAfterBrush = false
  }
  requestAnimationFrame(flushBrushTints)
}

const toggleSelection = (idx: number, additive: boolean) => {
  if (additive) {
    if (gaussianState.selection.has(idx)) gaussianState.selection.delete(idx)
    else gaussianState.selection.add(idx)
  } else {
    gaussianState.selection.clear()
    gaussianState.selection.add(idx)
  }
}

// ─── Scene init ──────────────────────────────────────
const initScene = () => {
  const canvas = canvasRef.value!
  scene = new THREE.Scene()
  scene.background = new THREE.Color(gaussianState.sceneColor)

  camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5000)
  camera.position.set(6, 4, 6)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(new THREE.Color(gaussianState.sceneColor), 1)

  controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
  ;(gridHelper.material as THREE.Material).transparent = true
  ;(gridHelper.material as THREE.Material).opacity = 0.25
  scene.add(gridHelper)

  axesHelper = new THREE.AxesHelper(1.5)
  scene.add(axesHelper)

  syncSize()
  startLoop()
}

const syncSize = () => {
  if (!containerRef.value) return
  const w = canvaPanel.width_px || containerRef.value.clientWidth
  const h = canvaPanel.height_px || containerRef.value.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
}

const startLoop = () => {
  const tick = () => {
    frame = requestAnimationFrame(tick)
    controls.update()
    renderer.render(scene, camera)
  }
  tick()
}

const stopLoop = () => {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

// ─── Tint sync: selection + labels → aTint attribute ───
const SELECTION_RGB: [number, number, number] = hexToRgb(SELECTION_COLOR)

const syncTints = () => {
  if (!splatHandle) return
  const tints: Array<[number, number, number, number]> = []

  // Labeled splats take precedence (if showLabelColors is on)
  if (gaussianState.showLabelColors) {
    for (const label of gaussianState.labels) {
      const [r, g, b] = hexToRgb(label.color)
      for (const i of label.indices) {
        if (!gaussianState.hidden.has(i)) tints.push([i, r, g, b])
      }
    }
  }
  // Then selection — overrides label tint so the user sees what they just picked
  for (const i of gaussianState.selection) {
    if (gaussianState.hidden.has(i)) continue
    tints.push([i, SELECTION_RGB[0], SELECTION_RGB[1], SELECTION_RGB[2]])
  }
  splatHandle.setTint(tints)
}

const rebuildHidden = () => {
  if (!splatHandle) return
  splatHandle.setHidden(gaussianState.hidden.size > 0 ? Array.from(gaussianState.hidden) : null)
  syncTints()
}

const handleSplatLoaded = () => {
  if (splatHandle) {
    scene.remove(splatHandle.object)
    splatHandle.dispose()
    splatHandle = null
  }
  const splats = gaussianState.splats
  if (!splats || splats.count === 0) return

  splatHandle = createGaussianRenderer(splats)
  scene.add(splatHandle.object)
  splatHandle.frameCamera(camera, controls)

  gaussianState.bounds = boxToArray(computeBounds(splats))
  syncTints()
}

const boxToArray = (b: THREE.Box3) => ({
  min: [b.min.x, b.min.y, b.min.z] as [number, number, number],
  max: [b.max.x, b.max.y, b.max.z] as [number, number, number],
})

// ─── Watchers ────────────────────────────────────────
watch(() => gaussianState.sceneColor, (c) => {
  if (!renderer) return
  const col = new THREE.Color(c)
  renderer.setClearColor(col, 1)
  if (scene) scene.background = col
})

watch(() => gaussianState.pointSize, (s) => {
  if (splatHandle) (splatHandle.object.material as any).uniforms.uSizeScale.value = s
})

watch(() => gaussianState.density, (d) => {
  if (splatHandle) (splatHandle.object.material as any).uniforms.uDensity.value = d
})

watch(() => gaussianState.hidden, rebuildHidden, { deep: true })
watch(() => gaussianState.selection, syncTints, { deep: true })
watch(() => gaussianState.labels, syncTints, { deep: true })
watch(() => gaussianState.showLabelColors, syncTints)

watch(() => uiState.id, syncSize)

onMounted(() => {
  initScene()
  if (gaussianState.loaded) handleSplatLoaded()
  flushBrushTints()  // starts its own RAF loop
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  eventBus.on('splat:loaded', handleSplatLoaded)
  eventBus.on('splat:cleared', () => {
    if (splatHandle) {
      scene.remove(splatHandle.object)
      splatHandle.dispose()
      splatHandle = null
    }
  })
  eventBus.on('window:resized', syncSize)
  eventBus.on('frame-camera', () => {
    if (splatHandle) splatHandle.frameCamera(camera, controls)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  eventBus.off('splat:loaded', handleSplatLoaded)
  eventBus.off('window:resized', syncSize)
  stopLoop()
  if (splatHandle) splatHandle.dispose()
  renderer?.dispose()
})

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
</script>

<style scoped>
.gaussian-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.gaussian-viewer__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.gaussian-viewer__canvas--picking {
  cursor: crosshair;
}

.gaussian-viewer__chip,
.gaussian-viewer__mode-chip {
  position: absolute;
  top: 6px;
  display: inline-flex;
  align-items: center;
  gap: var(--y-spacing-1, 6px);
  padding: 2px var(--y-spacing-2, 8px);
  background: var(--y-color-bg-card, #fbfaf5);
  border: 1px solid var(--y-color-divider, #e6e4dc);
  border-radius: var(--y-radius-sm, 6px);
  font-size: 11px;
  font-weight: 600;
  color: var(--y-color-text-secondary, #3f4046);
  z-index: 10;
  user-select: none;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.gaussian-viewer__chip { left: 8px; }
.gaussian-viewer__mode-chip {
  left: 50%;
  transform: translateX(-50%);
  background: var(--lab-ink, #0e0e10);
  color: var(--lab-snow, #ffffff);
  border-color: rgba(255, 255, 255, 0.1);
}
.gaussian-viewer__mode-count {
  color: var(--lab-coral, #ff6a3d);
  font-weight: 600;
}

.gaussian-viewer__sel-rect {
  position: absolute;
  border: 1px solid var(--lab-coral, #ff6a3d);
  background: rgba(255, 106, 61, 0.12);
  pointer-events: none;
  z-index: 9;
}

.gaussian-viewer__brush-cursor {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9;
  border: 1.5px solid var(--lab-coral, #ff6a3d);
  background: rgba(255, 106, 61, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
  transition: border-color 120ms ease, background 120ms ease;
}
.gaussian-viewer__brush-cursor--remove {
  border-color: var(--lab-slate, #8a8b92);
  background: rgba(255, 255, 255, 0.1);
}

.gaussian-viewer__empty,
.gaussian-viewer__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lab-fog, #b8b9be);
  pointer-events: none;
  text-align: center;
  padding: 0 24px;
}

.gaussian-viewer__empty-title {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--lab-snow, #ffffff);
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
}

.gaussian-viewer__empty-hint {
  margin: 0;
  font-size: 11px;
  color: var(--lab-fog, #b8b9be);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

.gaussian-viewer__loading p {
  margin: 6px 0 0;
  font-size: 11px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  color: var(--lab-fog, #b8b9be);
}

.y-spin {
  animation: y-spin 1s linear infinite;
}

@keyframes y-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
