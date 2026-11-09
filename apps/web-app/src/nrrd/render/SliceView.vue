<template>
  <div ref="hostRef" class="slice-view" :class="{ focused: focused }" @pointerdown="onPointerDown"
    @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @wheel.prevent="onWheel"
    @pointerleave="onPointerLeave" @dblclick="onDblClick" @contextmenu.prevent>
    <canvas ref="imgRef" class="slice-view__img" :style="imgStyle" />
    <canvas ref="ovlRef" class="slice-view__ovl" />
    <div class="slice-view__corner slice-view__corner--tl">{{ letters[0] }}</div>
    <div class="slice-view__corner slice-view__corner--tr">{{ title }} {{ sliceIdx + 1 }}/{{ sliceMax }}</div>
    <div class="slice-view__corner slice-view__corner--bl">{{ readout }}</div>
    <div class="slice-view__corner slice-view__corner--br">{{ letters[1] }}</div>
    <div v-if="focused" class="slice-view__active-bar" />
    <ViewMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @action="onMenuAction" @close="menu = null" />
  </div>
</template>

<script lang="ts" setup>
/**
 * 单个 MPR 视图(轴/冠/矢)。
 * 图像层: 原生分辨率 canvas + CSS transform 缩放(zoom 不触发重合成)。
 * 叠加层: 容器分辨率 canvas, 画交叉线/笔刷光标。
 * 交互: 左键拖=移动交叉线; 滚轮=翻层; Ctrl+滚轮=缩放; 工具激活时 Shift+滚轮=笔刷大小;
 *       右键拖=窗宽窗位; 中键/空格+左键拖=平移; 左下读数优先显示悬停位置的值。
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, toRaw } from 'vue'
import type { Axis } from '../data/volumeModel'
import { axisName, voxelToWorld } from '../data/volumeModel'
import { sliceGeometry, sliceCompositor, type DirtyRect } from './sliceCompositor'
import { getCachedLut } from '../data/presets'
import { volState, stepBrushRadius, RADIUS_TOOLS } from '../store'
import { getLabelmap, type VoxelBBox } from '../seg/labelmap'
import { segmentStyles, segTick, segState } from '../seg/segments'
import { beginStroke, moveStroke, endStroke, onLabelDirty, getContourPreview, isStroking, finishContour, applyMagicWand } from '../seg/tools'
import { beginSeedStroke, paintSeedDisk, seedTick, growState, getSeedLayers } from '../seg/growCut'
import { i18n } from '@/locales'
import ViewMenu from './ViewMenu.vue'

const t = (key: string) => i18n.global.t(key)

const props = defineProps<{ axis: Axis; focused?: boolean; hidden?: boolean }>()

const hostRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLCanvasElement | null>(null)
const ovlRef = ref<HTMLCanvasElement | null>(null)

const title = computed(() => axisName(props.axis))

// 方位字母(几何推导: 见 sliceGeometry 行列约定)
const letters = computed<[string, string]>(() => {
  if (props.axis === 2) return ['A', 'R']          // axial: 上=A, 右=R
  if (props.axis === 1) return ['S', 'R']          // coronal: 上=S, 右=R
  return ['S', 'A']                                // sagittal: 上=S, 右=A
})

const sliceIdx = computed(() => {
  const c = volState.crosshair
  return props.axis === 0 ? c.i : props.axis === 1 ? c.j : c.k
})
const sliceMax = computed(() => volState.base?.grid.dims[props.axis] ?? 1)

// ── 视图变换(pan 为容器像素, zoom = 像素/毫米, 各向异性 spacing 参与) ──
const view = { zoom: 1, panX: 0, panY: 0, fitW: 1, fitH: 1 }
const viewTick = ref(0)

function sliceSize(): { w: number; h: number } {
  const b = volState.base
  if (!b) return { w: 0, h: 0 }
  const g = sliceGeometry(props.axis, b.grid)
  return { w: g.width, h: g.height }
}

/** 本视图 u(列)/v(行) 方向的体素尺寸 mm — zoom 为像素/毫米, 两者相乘=像素/体素 */
function sliceScales(): { su: number; sv: number } {
  const s = volState.base?.grid.spacing ?? [1, 1, 1]
  return props.axis === 2 ? { su: s[0], sv: s[1] }
    : props.axis === 1 ? { su: s[0], sv: s[2] }
    : { su: s[1], sv: s[2] }
}

function resetView() {
  const { w, h } = sliceSize()
  const host = hostRef.value
  if (!w || !h || !host) return
  const cw = host.clientWidth, ch = host.clientHeight
  const { su, sv } = sliceScales()
  view.fitW = cw / (w * su)
  view.fitH = ch / (h * sv)
  view.zoom = Math.min(view.fitW, view.fitH)
  view.panX = (cw - w * su * view.zoom) / 2
  view.panY = (ch - h * sv * view.zoom) / 2
  viewTick.value++
}

const imgStyle = computed(() => {
  void viewTick.value
  const { w, h } = sliceSize()
  const { su, sv } = sliceScales()
  return {
    width: w + 'px',
    height: h + 'px',
    transform: `translate(${view.panX}px, ${view.panY}px) scale(${su * view.zoom}, ${sv * view.zoom})`,
    transformOrigin: '0 0',
  }
})

// ── 图像合成 ───────────────────────────────────────────────
// 隐藏时跳过整片重合成(滚层/调窗不付隐藏视图的钱), 重现由 ResizeObserver 触发补一次
function recomposite() {
  const canvas = imgRef.value
  const b = toRaw(volState.base)
  if (!canvas || !b || props.hidden) return
  const { w, h } = sliceSize()
  if (!w || !h) return
  canvas.width = w
  canvas.height = h
  const lm = getLabelmap()
  const img = sliceCompositor.compose(props.axis, sliceIdx.value, {
    base: b,
    overlay: volState.petOn ? toRaw(volState.overlay) : null,
    overlayLut: volState.petOn && volState.overlay ? getCachedLut(volState.petLut) : null,
    overlayAlpha: volState.petAlpha,
    wl: volState.wl,
    overlayWl: volState.petWl,
    labelmap: lm && lm.grid === b.grid ? lm.data : null,
    segments: segmentStyles.value,
    labelAlpha: volState.labelAlpha,
  })
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(img, 0, 0)
}

/** 体素脏 bbox → 本视图图像 rect(切片不相交返回 null) */
function dirtyImageRect(bbox: VoxelBBox): DirtyRect | null {
  const b = toRaw(volState.base)
  if (!b) return null
  const [nx, ny, nz] = b.grid.dims
  if (props.axis === 2) {
    if (sliceIdx.value < bbox.k0 || sliceIdx.value > bbox.k1) return null
    return { x0: bbox.i0, y0: ny - 1 - bbox.j1, x1: bbox.i1, y1: ny - 1 - bbox.j0 }
  }
  if (props.axis === 1) {
    if (sliceIdx.value < bbox.j0 || sliceIdx.value > bbox.j1) return null
    return { x0: bbox.i0, y0: nz - 1 - bbox.k1, x1: bbox.i1, y1: nz - 1 - bbox.k0 }
  }
  if (sliceIdx.value < bbox.i0 || sliceIdx.value > bbox.i1) return null
  return { x0: bbox.j0, y0: nz - 1 - bbox.k1, x1: bbox.j1, y1: nz - 1 - bbox.k0 }
}

/** 笔画脏区局部重合成 */
function patchDirty(bbox: VoxelBBox) {
  const canvas = imgRef.value
  const b = toRaw(volState.base)
  if (!canvas || !b) return
  const rect = dirtyImageRect(bbox)
  if (!rect) return
  const lm = getLabelmap()
  const img = sliceCompositor.compose(props.axis, sliceIdx.value, {
    base: b,
    overlay: volState.petOn ? toRaw(volState.overlay) : null,
    overlayLut: volState.petOn && volState.overlay ? getCachedLut(volState.petLut) : null,
    overlayAlpha: volState.petAlpha,
    wl: volState.wl,
    overlayWl: volState.petWl,
    labelmap: lm && lm.grid === b.grid ? lm.data : null,
    segments: segmentStyles.value,
    labelAlpha: volState.labelAlpha,
  }, {
    x0: Math.max(0, rect.x0), y0: Math.max(0, rect.y0),
    x1: Math.min(canvas.width - 1, rect.x1), y1: Math.min(canvas.height - 1, rect.y1),
  })
  const ctx = canvas.getContext('2d')!
  const x0 = Math.max(0, rect.x0), y0 = Math.max(0, rect.y0)
  const w = Math.min(canvas.width - 1, rect.x1) - x0 + 1
  const h = Math.min(canvas.height - 1, rect.y1) - y0 + 1
  // 隐藏时 compose 仍要跑(共享 LRU 缓存条目要跟上笔画), 只省掉 canvas 写入
  if (w > 0 && h > 0 && !props.hidden) ctx.putImageData(img, 0, 0, x0, y0, w, h)
}

// ── 叠加层(交叉线) ──────────────────────────────────────────
function drawOverlay() {
  const canvas = ovlRef.value
  const host = hostRef.value
  if (!canvas || !host || !host.clientWidth) return
  const dpr = window.devicePixelRatio || 1
  const cw = host.clientWidth, ch = host.clientHeight
  canvas.width = Math.max(1, Math.round(cw * dpr))
  canvas.height = Math.max(1, Math.round(ch * dpr))
  canvas.style.width = cw + 'px'
  canvas.style.height = ch + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  if (!volState.base) return

  const [vx, vy] = crosshairImagePos()
  const { su, sv } = sliceScales()
  const sx = view.panX + vx * su * view.zoom
  const sy = view.panY + vy * sv * view.zoom
  ctx.strokeStyle = 'rgba(120, 220, 160, 0.85)'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(sx + 0.5, 0); ctx.lineTo(sx + 0.5, ch)
  ctx.moveTo(0, sy + 0.5); ctx.lineTo(cw, sy + 0.5)
  ctx.stroke()
  ctx.setLineDash([])

  drawSeeds(ctx)
  drawToolCursor(ctx)
}

/** GrowCut 种子层(当前切片): fg=激活段色, bg=灰, 60% 透明 */
function drawSeeds(ctx: CanvasRenderingContext2D) {
  if (!growState.hasSeeds) return
  const lm = getLabelmap()
  if (!lm) return
  const { fg, bg } = getSeedLayers()
  if (!fg) return
  const { w, h } = sliceSize()
  const { su, sv } = sliceScales()
  const zu = su * view.zoom, zv = sv * view.zoom
  const fgColor = segState.segments.find(s => s.id === segState.activeId)?.color ?? '#ffd25a'
  ctx.globalAlpha = 0.6
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? fgColor : '#808080'
    const layer = pass === 0 ? fg : bg!
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const [i, j, k] = imageToVoxel(px, py)
        if (layer[lm.idx(i, j, k)]) {
          ctx.fillRect(view.panX + px * zu, view.panY + py * zv, Math.ceil(zu), Math.ceil(zv))
        }
      }
    }
  }
  ctx.globalAlpha = 1
}

/** 笔刷光标(椭圆, 世界圆形投影)与轮廓预览(手绘折线 / 布点顶点+橡皮筋) */
function drawToolCursor(ctx: CanvasRenderingContext2D) {
  const tool = volState.activeTool
  if (tool === 'none' || !volState.base) return
  const preview = getContourPreview()
  if (tool === 'contour') {
    const onPlane = preview && preview.axis === props.axis && preview.slice === sliceIdx.value
    if (onPlane) {
      const { su, sv } = sliceScales()
      const toScreen = ([u, v]: [number, number]): [number, number] =>
        [view.panX + u * su * view.zoom, view.panY + (sliceSize().h - 1 - v) * sv * view.zoom]
      ctx.strokeStyle = 'rgba(255, 210, 90, 0.95)'
      ctx.lineWidth = 1.5
      if (preview!.mode === 'click') {
        // 已吸附路径(吸附关=顶点折线)
        if (preview!.path.length >= 2) {
          ctx.beginPath()
          preview!.path.forEach(([u, v], tk) => {
            const [x, y] = toScreen([u, v])
            if (tk === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          })
          ctx.stroke()
        }
        // 已布顶点(方块)
        ctx.fillStyle = 'rgba(255, 210, 90, 0.95)'
        for (const p of preview!.vertices) {
          const [x, y] = toScreen(p)
          ctx.fillRect(x - 2.5, y - 2.5, 5, 5)
        }
        // 橡皮筋: 无活路径时最后顶点 → 光标(吸附开的活路径已并入 path)
        if (preview!.cursor && preview!.vertices.length && !preview!.live.length) {
          const [lx, ly] = toScreen(preview!.vertices[preview!.vertices.length - 1])
          const [cx2, cy2] = toScreen(preview!.cursor)
          ctx.setLineDash([4, 3])
          ctx.beginPath()
          ctx.moveTo(lx, ly); ctx.lineTo(cx2, cy2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      } else if (preview!.path.length >= 2) {
        ctx.beginPath()
        preview!.path.forEach(([u, v], tk) => {
          const [x, y] = toScreen([u, v])
          if (tk === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }
    }
    return
  }
  if (tool === 'magicWand') {
    // 魔法棒无半径概念: 小十字标记种子位置
    if (!pointerInside.value) return
    const { su, sv } = sliceScales()
    const cx = view.panX + pointerImg.value[0] * su * view.zoom
    const cy = view.panY + pointerImg.value[1] * sv * view.zoom
    ctx.strokeStyle = 'rgba(255, 210, 90, 0.95)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy)
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6)
    ctx.stroke()
    return
  }
  if (!pointerInside.value) return
  const s = volState.base.grid.spacing
  const { su, sv } = sliceScales()
  const rWorld = volState.brushRadius * Math.min(s[0], s[1], s[2])
  // 视图已按 mm 等比缩放 → 世界圆在屏幕上即正圆
  const rx = rWorld * view.zoom
  const ry = rWorld * view.zoom
  const cx = view.panX + pointerImg.value[0] * su * view.zoom
  const cy = view.panY + pointerImg.value[1] * sv * view.zoom
  ctx.strokeStyle = tool === 'eraser' ? 'rgba(255, 130, 130, 0.95)' : 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 1
  // 椭圆被钳到最小尺寸时用虚线提示"显示大小≠真实半径"
  if (rx < 2 || ry < 2) ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
}

/** 交叉线在本视图图像坐标(像素) */
function crosshairImagePos(): [number, number] {
  const c = volState.crosshair
  if (props.axis === 2) return [c.i, (sliceSize().h - 1) - c.j]
  if (props.axis === 1) return [c.i, (sliceSize().h - 1) - c.k]
  return [c.j, (sliceSize().h - 1) - c.k]
}

/** 图像坐标(像素) → 体素 (i,j,k)(边缘四舍五入钳制到网格内) */
function imageToVoxel(px: number, py: number): [number, number, number] {
  const h = sliceSize().h
  const y = h - 1 - py
  const c = volState.crosshair
  const d = volState.base!.grid.dims
  const cl = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(v)))
  if (props.axis === 2) return [cl(px, d[0]), cl(y, d[1]), c.k]
  if (props.axis === 1) return [cl(px, d[0]), c.j, cl(y, d[2])]
  return [c.i, cl(px, d[1]), cl(y, d[2])]
}

function eventImagePos(e: PointerEvent | WheelEvent): [number, number] {
  const host = hostRef.value!
  const rect = host.getBoundingClientRect()
  const { su, sv } = sliceScales()
  return [
    (e.clientX - rect.left - view.panX) / (su * view.zoom),
    (e.clientY - rect.top - view.panY) / (sv * view.zoom),
  ]
}

// ── 交互状态机 ─────────────────────────────────────────────
type DragMode = 'none' | 'crosshair' | 'wl' | 'pan' | 'paint'
let drag: DragMode = 'none'
let lastX = 0, lastY = 0
let lastWl = { width: 0, level: 0 }
// 悬停位置(ref: 读数 computed 依赖)
const pointerInside = ref(false)
const pointerImg = ref<[number, number]>([0, 0])

// 右键: 拖动=WL, 原地松开=菜单(截图)
let downX = 0, downY = 0
let rightMoved = false
const menu = ref<{ x: number; y: number } | null>(null)
const menuItems = [{ key: 'shot', label: t('nrrd.view.saveShot') }]

const toolActive = () => volState.activeTool !== 'none'

/** 指针事件 → 切片平面坐标 (u=列, v=行, 均为体素单位浮点, v 自下而上) */
function stampEvent(e: PointerEvent) {
  const [px, py] = eventImagePos(e)
  return { axis: props.axis, slice: sliceIdx.value, u: px, v: (sliceSize().h - 1) - py }
}

function onPointerDown(e: PointerEvent) {
  const host = hostRef.value!
  host.setPointerCapture(e.pointerId)
  lastX = e.clientX; lastY = e.clientY
  downX = e.clientX; downY = e.clientY
  rightMoved = false
  if (e.button === 2) {
    drag = 'wl'
    lastWl = { ...volState.wl }
  } else if (e.button === 1 || (e.button === 0 && spaceDown)) {
    drag = 'pan'
  } else if (e.button === 0 && volState.activeTool === 'magicWand') {
    // 魔法棒点击即种子, 不进入拖动绘制
    applyMagicWand(stampEvent(e))
  } else if (e.button === 0 && volState.activeTool === 'growCut') {
    // GrowCut: 笔刷涂 FG/BG 种子(独立种子层, 不写 labelmap)
    drag = 'paint'
    beginSeedStroke()
    paintSeedDisk(stampEvent(e), volState.brushRadius)
  } else if (e.button === 0 && toolActive()) {
    drag = 'paint'
    beginStroke(stampEvent(e))
  } else if (e.button === 0) {
    drag = 'crosshair'
    moveCrosshair(e)
  }
}

function moveCrosshair(e: PointerEvent) {
  const [px, py] = eventImagePos(e)
  const { w, h } = sliceSize()
  if (px < 0 || py < 0 || px >= w || py >= h) return
  const [i, j, k] = imageToVoxel(px, py)
  const d = volState.base!.grid.dims
  volState.crosshair.i = Math.max(0, Math.min(d[0] - 1, i))
  volState.crosshair.j = Math.max(0, Math.min(d[1] - 1, j))
  volState.crosshair.k = Math.max(0, Math.min(d[2] - 1, k))
}

function onPointerMove(e: PointerEvent) {
  pointerInside.value = true
  pointerImg.value = eventImagePos(e)
  if (toolActive() && drag !== 'paint') drawOverlay()
  // 轮廓布点模式: 未按下也要更新橡皮筋预览
  if (volState.activeTool === 'contour' && drag === 'none') drawOverlay()
  if (drag === 'none') return
  const dx = e.clientX - lastX, dy = e.clientY - lastY
  if (drag === 'crosshair') moveCrosshair(e)
  else if (drag === 'paint') {
    if (volState.activeTool === 'growCut') paintSeedDisk(stampEvent(e), volState.brushRadius)
    else moveStroke(stampEvent(e))
    drawOverlay()
  }
  else if (drag === 'wl') {
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 3) rightMoved = true
    volState.wlPresetKey = 'custom'
    volState.wl.width = Math.max(1, lastWl.width + dx * 4)
    volState.wl.level = lastWl.level + dy * 3
  } else if (drag === 'pan') {
    view.panX += dx
    view.panY += dy
    viewTick.value++
  }
  lastX = e.clientX; lastY = e.clientY
}

function onPointerUp(e: PointerEvent) {
  hostRef.value?.releasePointerCapture?.(e.pointerId)
  if (drag === 'paint' && volState.activeTool !== 'growCut') endStroke(stampEvent(e))
  if (e.button === 2 && !rightMoved && volState.base && hostRef.value) {
    const rect = hostRef.value.getBoundingClientRect()
    menu.value = { x: Math.min(e.clientX - rect.left, rect.width - 130), y: Math.min(e.clientY - rect.top, rect.height - 40) }
  }
  drag = 'none'
}

function onMenuAction(key: string) {
  menu.value = null
  if (key !== 'shot') return
  const canvas = imgRef.value
  if (!canvas || !canvas.width) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `${props.axis === 2 ? 'axial' : props.axis === 1 ? 'coronal' : 'sagittal'}_${sliceIdx.value + 1}.png`
  link.click()
}

function onPointerLeave() {
  pointerInside.value = false
  drawOverlay()
}

/** 双击: 轮廓布点模式=闭合; 否则复位视图 */
function onDblClick() {
  if (volState.activeTool === 'contour' && isStroking()) {
    finishContour()
    drawOverlay()
    return
  }
  resetView()
}

function onWheel(e: WheelEvent) {
  // 工具激活时 Shift+滚轮=笔刷大小(笔刷类工具)
  if (e.shiftKey && RADIUS_TOOLS.has(volState.activeTool)) {
    volState.brushRadius = stepBrushRadius(volState.brushRadius, e.deltaY > 0 ? -1 : 1)
    drawOverlay()
    return
  }
  if (e.ctrlKey) {
    const factor = Math.exp(-e.deltaY * 0.0015)
    const host = hostRef.value!
    const rect = host.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const z2 = Math.max(0.05, Math.min(40, view.zoom * factor))
    view.panX = mx - (mx - view.panX) * (z2 / view.zoom)
    view.panY = my - (my - view.panY) * (z2 / view.zoom)
    view.zoom = z2
    viewTick.value++
    return
  }
  const step = e.deltaY > 0 ? 1 : -1
  const d = volState.base?.grid.dims
  if (!d) return
  const cur = sliceIdx.value
  const next = Math.max(0, Math.min(d[props.axis] - 1, cur + step))
  if (props.axis === 0) volState.crosshair.i = next
  else if (props.axis === 1) volState.crosshair.j = next
  else volState.crosshair.k = next
}

// 空格按住临时平移
let spaceDown = false
const onKey = (down: boolean) => (ev: KeyboardEvent) => {
  if (ev.code === 'Space' && !ev.repeat) spaceDown = down
}

// ── 读数(悬停优先, 离开视图回退交叉线) ────────────────────
const readout = computed(() => {
  const b = volState.base
  if (!b) return ''
  let i: number, j: number, k: number
  if (pointerInside.value) {
    const [px, py] = pointerImg.value
    const { w, h } = sliceSize()
    if (px < 0 || py < 0 || px >= w || py >= h) {
      return ''
    }
    ;[i, j, k] = imageToVoxel(px, py)
  } else {
    const c = volState.crosshair
    i = c.i; j = c.j; k = c.k
  }
  const idx = k * b.grid.dims[0] * b.grid.dims[1] + j * b.grid.dims[0] + i
  const hu = b.data[idx]
  const [x, y, z] = voxelToWorld(b.grid, i, j, k)
  const parts = [`(${i}, ${j}, ${k})`, `${hu.toFixed(0)} ${b.modality.toUpperCase()}`, `(${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)})mm`]
  if (volState.overlay && volState.petOn) {
    parts.push(`PET ${volState.overlay.data[idx].toFixed(1)}`)
  }
  return parts.join('  ')
})

// ── 联动重绘 ───────────────────────────────────────────────
watch([sliceIdx, () => volState.wl.width, () => volState.wl.level,
() => volState.petWl.width, () => volState.petWl.level,
() => volState.petAlpha, () => volState.petLut, () => volState.petOn,
() => volState.labelAlpha, () => volState.base, () => volState.overlay,
segTick, segmentStyles], recomposite)

// 笔画脏区 → 本视图局部重绘
let offDirty: (() => void) | null = null

watch(() => volState.crosshair, () => {
  drawOverlay()
  // 交叉线移动只变本轴层号 → 其他两轴重合成由 sliceIdx watcher 各自触发
}, { deep: true })

watch(viewTick, drawOverlay)
watch(seedTick, drawOverlay)

let ro: ResizeObserver | null = null
let roVisible = true
onMounted(async () => {
  await nextTick()
  ro = new ResizeObserver(() => {
    if (!volState.base) return
    const host = hostRef.value
    const visible = !!host && host.clientWidth > 0
    if (!visible) { roVisible = false; return }
    const wasHidden = !roVisible
    roVisible = true
    resetView()
    drawOverlay()
    // 隐藏期间跳过的重合成在重现时补上(层号/窗宽可能已变)
    if (wasHidden) recomposite()
  })
  if (hostRef.value) ro.observe(hostRef.value)
  window.addEventListener('keydown', onKey(true))
  window.addEventListener('keyup', onKey(false))
  offDirty = onLabelDirty(patchDirty)
  resetView()
  recomposite()
})

watch(() => volState.base, (b, old) => {
  if (b !== old) {
    resetView()
    drawOverlay()
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  offDirty?.()
  window.removeEventListener('keydown', onKey(true))
  window.removeEventListener('keyup', onKey(false))
})
</script>

<style scoped>
.slice-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  cursor: crosshair;
  touch-action: none;
}

.slice-view__img {
  position: absolute;
  left: 0;
  top: 0;
  image-rendering: auto;
  will-change: transform;
}

.slice-view__ovl {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.slice-view__corner {
  position: absolute;
  color: rgba(180, 235, 200, 0.9);
  font-size: 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
  padding: 4px 6px;
  white-space: nowrap;
}

.slice-view__corner--tl { top: 0; left: 0; font-size: 14px; font-weight: 600; }
.slice-view__corner--tr { top: 0; right: 0; }
.slice-view__corner--bl { bottom: 0; left: 0; }
.slice-view__corner--br { bottom: 0; right: 0; font-size: 14px; font-weight: 600; }

.slice-view__active-bar {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(120, 220, 160, 0.55);
  pointer-events: none;
}
</style>
