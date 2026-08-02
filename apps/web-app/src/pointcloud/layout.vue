<template>
  <PointcloudAnnotator />
  <!-- Low resolution warning overlay -->
  <div v-if="showLowResWarning" class="y-lowres-overlay">
    <div class="y-lowres-dialog">
      <Icon icon="lucide:triangle-alert" class="y-lowres-icon" />
      <p class="y-lowres-title">{{ t('workbench.lowResTitle') }}</p>
      <p class="y-lowres-desc">{{ t('workbench.lowResDesc') }}</p>
      <el-button type="primary" size="small" @click="showLowResWarning = false">{{ t('action.close') }}</el-button>
    </div>
  </div>
  <div class="overflow-hidden">
    <el-container>
      <el-header style="height: auto; padding: 0; background: transparent; overflow: visible;"><TopBar /></el-header>
      <el-container class="pc-body">
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0"><DataPanel /></el-aside>
        <div
          v-if="dataPanel.panelWidth > 0"
          class="pc-resize-handle pc-resize-handle--left"
          @mousedown="startResizeLeft"
          @dblclick="resetLeftWidth"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整宽度"
        />
        <el-container>
          <PolylineToolSetting></PolylineToolSetting>
          <Box3dToolSettingUi></Box3dToolSettingUi>
          <Point3dToolSetting></Point3dToolSetting>
        </el-container>
        <div
          v-if="attrPanel.width_px > 0"
          class="pc-resize-handle pc-resize-handle--right"
          @mousedown="startResizeRight"
          @dblclick="resetRightWidth"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整宽度"
        />
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
    <ModelSelectorUI></ModelSelectorUI>
  </div>

  <!-- Bottom status bar -->
  <div ref="bottomInfoLayer" class="pc-status" :style="bottomInfoLayerStyle">
    <div class="pc-status__left">
      <span class="pc-status__dot" :class="`pc-status__dot--${saveState}`" aria-hidden="true" />
      <span class="pc-status__eyebrow">CANVAS · §PC</span>
      <span class="pc-status__info">{{ messages.lastInfo }}</span>
    </div>
    <div class="pc-status__right">
      <span class="pc-status__chip" :class="saveStateClass">
        <Icon :icon="saveStateIcon" :width="12" />
        <span>{{ saveStateLabel }}</span>
      </span>
      <span class="pc-status__chip">
        <Icon icon="lucide:move-3d" :width="12" />
        <span class="pc-status__num">{{ pointCountLabel }}</span>
      </span>
      <span class="pc-status__chip pc-status__chip--fps">
        <span class="pc-status__fps-num">{{ fps }}</span>
        <span class="pc-status__fps-unit">FPS</span>
      </span>
    </div>
  </div>

  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import TopBar from './gui/toolbar/TopBar.vue'
import AttrPanel from './gui/panels/anno-attr-panel.vue'
import DataPanel from './gui/panels/DataPanel.vue'
import PointcloudAnnotator from './gui/Annotator.vue'
import { ModelSelectorUI } from '@/components/dnn'
import { attrPanel, dataPanel, canvaPanel } from '@/states/UiState'
import { initFromQuery, jobConfig } from '@/states/job-config'
import { useTitle } from '@vueuse/core'
import { globalStates, messages } from '@/states'
import { i18n } from '@/locales'
import PolylineToolSetting from './tools/ui/polyline3d-tool-setting.vue'
import Box3dToolSettingUi from './tools/ui/box3d-tool-setting.vue'
import Point3dToolSetting from './tools/ui/point3d-tool-setting.vue'
import { MainAnnotator } from './tools/main-annotator'
import { commonChannel } from './channel'

const t = (key: string) => i18n.global.t(key)

globalStates.mainAnnoater = MainAnnotator.getInstance()

const bottomInfoLayer = ref<HTMLElement | null>(null)
const bottomInfoLayerStyle = ref({})
const showLowResWarning = ref(false)
const LOW_RES_THRESHOLD = 1280

const saveState = ref<'saved' | 'unsaved' | 'saving' | 'failed'>('saved')
const pointCount = ref(0)
const fps = ref(0)

const saveStateLabel = computed(() => {
  switch (saveState.value) {
    case 'saved': return t('pcStatus.saved')
    case 'unsaved': return t('pcStatus.unsaved')
    case 'saving': return t('pcStatus.saving')
    case 'failed': return t('pcStatus.saveFailed')
  }
})

const saveStateIcon = computed(() => {
  switch (saveState.value) {
    case 'saved': return 'lucide:circle-check'
    case 'unsaved': return 'lucide:circle-alert'
    case 'saving': return 'lucide:loader-circle'
    case 'failed': return 'lucide:circle-x'
  }
})

const saveStateClass = computed(() => `pc-status__chip--${saveState.value}`)

const pointCountLabel = computed(() => {
  if (pointCount.value >= 1000000) return `${(pointCount.value / 1000000).toFixed(1)}M pts`
  if (pointCount.value >= 1000) return `${(pointCount.value / 1000).toFixed(1)}K pts`
  return `${pointCount.value} pts`
})

const fpsLabel = computed(() => `${fps.value} FPS`)

// FPS counter using requestAnimationFrame
let frameCount = 0
let lastFpsUpdate = 0
let rafId: number | null = null

const countFrame = () => {
  frameCount++
  rafId = requestAnimationFrame(countFrame)
}

const updateFps = () => {
  const now = performance.now()
  if (now - lastFpsUpdate >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastFpsUpdate = now
  }
  setTimeout(updateFps, 500)
}

// Listen for point count updates from gl-pcs
const handlePcdLoaded = (e: MessageEvent) => {
  if (e.data?.type === 'pcd-loaded') {
    pointCount.value = e.data.pointCount ?? 0
  }
}

watch([() => canvaPanel.width_px, () => canvaPanel.height_px], () => {
  bottomInfoLayerStyle.value = {
    top: canvaPanel.top_px + canvaPanel.height_px - 32 + 'px',
    left: canvaPanel.left_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: '32px',
    position: 'absolute'
  }
})

watch(
  () => globalStates.mainAnnoater,
  () => { saveState.value = 'unsaved' },
  { deep: true }
)

const title = useTitle()

watch(() => jobConfig.inited, (newVal) => {
  if (newVal) {
    title.value = '萤火-标注-' + jobConfig.mission + '-' + jobConfig.seq
  }
})

onMounted(() => {
  initFromQuery()
  rafId = requestAnimationFrame(countFrame)
  lastFpsUpdate = performance.now()
  updateFps()
  window.addEventListener('message', handlePcdLoaded)
  if (window.innerWidth < LOW_RES_THRESHOLD) {
    showLowResWarning.value = true
  }
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (resizeRafId.value !== null) cancelAnimationFrame(resizeRafId.value)
  window.removeEventListener('message', handlePcdLoaded)
})

// ─── Side panel resize handles ───────────────────────
// Same pattern as annoPanel.vue: drag a 6px vertical strip between
// DataPanel/AttrPanel and the 3D canvas to resize the side panels.
// Widths persist to sessionStorage via useStorage. Each mousemove publishes
// ReloadUI (rAF-throttled) so App.vue's onResize recomputes canvaPanel +
// threeView positions.
const PANEL_MIN = 200
const PANEL_MAX = 600
const DEFAULT_WIDTH = 300

const resizeRafId = ref<number | null>(null)
const resizePending = ref(false)

const scheduleReload = () => {
  if (resizePending.value) return
  resizePending.value = true
  resizeRafId.value = requestAnimationFrame(() => {
    resizePending.value = false
    commonChannel.pub(commonChannel.Events.ReloadUI, {})
  })
}

const startResize = (which: 'left' | 'right') => (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  const startX = e.clientX
  const startWidth = which === 'left'
    ? dataPanel.value.panelWidth
    : attrPanel.value.width_px

  document.body.classList.add('y-is-resizing')

  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    let next: number
    if (which === 'left') {
      next = startWidth + delta
    } else {
      next = startWidth - delta
    }
    next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(next)))
    if (which === 'left') {
      if (dataPanel.value.panelWidth !== next) {
        dataPanel.value.panelWidth = next
        scheduleReload()
      }
    } else {
      if (attrPanel.value.width_px !== next) {
        attrPanel.value.width_px = next
        scheduleReload()
      }
    }
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.classList.remove('y-is-resizing')
    if (resizeRafId.value !== null) {
      cancelAnimationFrame(resizeRafId.value)
      resizeRafId.value = null
    }
    resizePending.value = false
    commonChannel.pub(commonChannel.Events.ReloadUI, {})
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const startResizeLeft = startResize('left')
const startResizeRight = startResize('right')

const resetLeftWidth = () => {
  dataPanel.value.panelWidth = DEFAULT_WIDTH
  commonChannel.pub(commonChannel.Events.ReloadUI, {})
}
const resetRightWidth = () => {
  attrPanel.value.width_px = DEFAULT_WIDTH
  commonChannel.pub(commonChannel.Events.ReloadUI, {})
}
</script>

<style lang="scss" scoped>
:deep(.el-aside) {
  border-left: 1px solid var(--y-color-border);
  background: var(--y-color-bg-card);
}
:deep(.el-aside:first-child) {
  border-left: none;
  border-right: 1px solid var(--y-color-border);
}

:deep(.el-container) {
  max-width: 100%;
}

/* ── Resize handles between side panels and 3D canvas ─── */
.pc-resize-handle {
  flex: 0 0 6px;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 5;
  transition: background 150ms ease;

  &::after {
    content: '';
    position: absolute;
    inset: 0 2px;
    background: var(--y-color-border, var(--lab-hairline, #e5e3dc));
    transition: background 150ms ease;
  }

  &:hover::after,
  &:active::after {
    background: var(--y-color-primary, var(--lab-coral, #c0503e));
  }
}

.pc-body :deep(.el-aside) {
  flex-shrink: 0;
}

.fullscreen-transparent-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
  background-color: rgba(0, 0, 0, 0);
  pointer-events: none;
}

/* ── Low-res warning dialog (lab style) ─────────── */
.y-lowres-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(14, 14, 16, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.y-lowres-dialog {
  background: var(--lab-snow);
  border-radius: var(--lab-radius-3xl, 24px);
  padding: 36px 32px 28px;
  max-width: 420px;
  text-align: left;
  color: var(--lab-ink);
  box-shadow: 0 30px 80px rgba(0,0,0,0.4);
  position: relative;
  overflow: hidden;
}

.y-lowres-dialog::before {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: var(--lab-coral);
  filter: blur(60px);
  opacity: 0.18;
}

.y-lowres-icon {
  font-size: 36px;
  color: var(--lab-coral);
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.y-lowres-title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 28px;
  font-weight: 400;
  margin: 0 0 8px;
  line-height: 1.1;
  letter-spacing: -0.01em;
  position: relative;
  z-index: 1;
}

.y-lowres-desc {
  font-size: 12px;
  color: var(--lab-slate);
  margin: 0 0 24px;
  line-height: 1.5;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
  position: relative;
  z-index: 1;
}

/* ── Status footer (lab) ────────────────────────── */
.pc-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--lab-ink);
  color: var(--lab-snow);
  font-size: 11px;
  user-select: none;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.pc-status__left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pc-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  flex-shrink: 0;
}

.pc-status__dot--saved { background: var(--lab-lime); box-shadow: 0 0 6px var(--lab-lime); }
.pc-status__dot--unsaved { background: var(--lab-butter, #ffe58a); box-shadow: 0 0 6px var(--lab-butter, #ffe58a); animation: lab-blink 1.4s ease-in-out infinite; }
.pc-status__dot--saving { background: var(--lab-lilac, #d9ccff); box-shadow: 0 0 6px var(--lab-lilac, #d9ccff); animation: lab-blink 0.8s ease-in-out infinite; }
.pc-status__dot--failed { background: var(--lab-coral); box-shadow: 0 0 6px var(--lab-coral); animation: lab-blink 0.6s ease-in-out infinite; }

.pc-status__eyebrow {
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.14em;
  font-size: 10px;
}

.pc-status__info {
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 460px;
}

.pc-status__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pc-status__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  font-size: 10.5px;
}

.pc-status__chip--saved { color: var(--lab-lime); }
.pc-status__chip--unsaved { color: var(--lab-butter, #ffe58a); }
.pc-status__chip--saving { color: var(--lab-lilac, #d9ccff); }
.pc-status__chip--failed { color: var(--lab-coral); }

.pc-status__num {
  font-weight: 500;
}

.pc-status__chip--fps {
  background: var(--lab-lime);
  color: var(--lab-ink);
  font-weight: 500;
}

.pc-status__fps-num {
  font-size: 12px;
  font-weight: 600;
}

.pc-status__fps-unit {
  font-size: 9px;
  opacity: 0.7;
}
</style>

<style>
/* Global — body-level drag state. Scoped CSS can't target body. */
body.y-is-resizing {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>