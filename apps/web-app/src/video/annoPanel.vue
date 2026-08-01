<template>
  <div class="overflow-hidden">
    <!-- Low resolution warning overlay -->
    <div v-if="showLowResWarning" class="y-lowres-overlay">
      <div class="y-lowres-dialog">
        <Icon icon="lucide:triangle-alert" class="y-lowres-icon" />
        <p class="y-lowres-title">{{ t('workbench.lowResTitle') }}</p>
        <p class="y-lowres-desc">{{ t('workbench.lowResDesc') }}</p>
        <el-button type="primary" size="small" @click="showLowResWarning = false">{{ t('action.close') }}</el-button>
      </div>
    </div>
    <!-- Stage 9.5: 驳回返工横幅 -->
    <div v-if="isRejectedUnit && latestReject && !bannerCollapsed" class="y-reject-banner">
      <div class="y-reject-banner__icon">
        <Icon icon="lucide:circle-alert" />
      </div>
      <div class="y-reject-banner__body">
        <div class="y-reject-banner__head">
          <span class="y-reject-banner__title">本帧被驳回,请按反馈返工</span>
          <el-tag size="small" :type="severityTagType">{{ severityLabel }}</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ latestReject.category || '未分类' }}</el-tag>
          <span v-if="latestReject.stage_code" class="y-reject-banner__meta">阶段:{{ latestReject.stage_code }}</span>
          <span v-if="rejectActor" class="y-reject-banner__meta">审核员:#{{ rejectActor }}</span>
          <span v-if="rejectTime" class="y-reject-banner__meta">{{ rejectTime }}</span>
        </div>
        <div v-if="latestReject.note" class="y-reject-banner__note">{{ latestReject.note }}</div>
      </div>
      <el-button text size="small" class="y-reject-banner__close" @click="bannerCollapsed = true">
        <Icon icon="lucide:x" />
      </el-button>
    </div>
    <el-container>
      <el-header style="height: auto; padding: 0; background: transparent; overflow: visible;"><TopBar /></el-header>
      <el-container class="anno-body">
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0"><DataPanel /></el-aside>
        <div
          v-if="dataPanel.panelWidth > 0"
          class="anno-resize-handle anno-resize-handle--left"
          @mousedown="startResizeLeft"
          @dblclick="resetLeftWidth"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('aria.dragResize') || '拖动调整宽度'"
        />
        <el-container>
          <el-main style="padding: 1px;overflow: hidden;"><ImageAnnotator /></el-main>
          <el-footer height="0px"></el-footer>
        </el-container>
        <div
          v-if="attrPanel.width_px > 0"
          class="anno-resize-handle anno-resize-handle--right"
          @mousedown="startResizeRight"
          @dblclick="resetRightWidth"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('aria.dragResize') || '拖动调整宽度'"
        />
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
    <ModelSelectorUI></ModelSelectorUI>
  </div>

  <!-- Bottom status bar -->
  <div ref="bottomInfoLayer" class="vid-status" :style="bottomInfoLayerStyle">
    <div class="vid-status__left">
      <span class="vid-status__dot" :class="`vid-status__dot--${saveState}`" aria-hidden="true" />
      <span class="vid-status__eyebrow">CANVAS · §IMG</span>
      <span class="vid-status__info">{{ messages.lastInfo }}</span>
    </div>
    <div class="vid-status__right">
      <span class="vid-status__chip" :class="saveStateClass">
        <Icon :icon="saveStateIcon" :width="12" />
        <span>{{ saveStateLabel }}</span>
      </span>
      <span class="vid-status__chip">
        <Icon icon="lucide:zoom-in" :width="12" />
        <span class="vid-status__num">{{ zoomLabel }}</span>
      </span>
      <span class="vid-status__chip vid-status__chip--coords">
        {{ mouseCoords }}
      </span>
    </div>
  </div>

  <div id="_Draggable_teleport"></div>
  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import TopBar from './toolbar/TopBar.vue'
import AttrPanel from './panels/AttrPanel.vue'
import DataPanel from './panels/DataPanel.vue'
import ImageAnnotator from './annotator.vue'
import { ModelSelectorUI } from '@/components/dnn'
import { attrPanel, dataPanel, canvaPanel } from '@/states/UiState'
import { jobConfig, initFromQuery } from '@/states/job-config'
import { useTitle } from '@vueuse/core'
import { messages, globalStates } from '@/states'
import { i18n } from '@/locales'
import { useUnit } from './composables/useUnit'
import { commonChannel } from './channel'

const t = (key: string) => i18n.global.t(key)

const { isRejectedUnit, latestReject } = useUnit()
const bannerCollapsed = ref(false)

const severityLabelMap: Record<string, string> = {
  critical: '致命',
  major: '严重',
  minor: '轻微',
}
const severityTagTypeMap: Record<string, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  major: 'warning',
  minor: 'info',
}
const severityLabel = computed(() => {
  const s = latestReject.value?.severity || ''
  return severityLabelMap[s] || s || '—'
})
const severityTagType = computed(() => {
  const s = latestReject.value?.severity || ''
  return severityTagTypeMap[s] || 'warning'
})
const rejectActor = computed(() => latestReject.value?.actor_id ?? null)
const rejectTime = computed(() => {
  const t0 = latestReject.value?.finished_at
  if (!t0) return ''
  try {
    const d = new Date(t0)
    if (isNaN(d.getTime())) return String(t0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return String(t0)
  }
})

// 切换帧时,重置横幅折叠态
watch(
  () => isRejectedUnit.value,
  () => {
    bannerCollapsed.value = false
  },
)

const bottomInfoLayer = ref<HTMLElement | null>(null)
const bottomInfoLayerStyle = ref({})
const showLowResWarning = ref(false)

const LOW_RES_THRESHOLD = 1280

const saveState = ref<'saved' | 'unsaved' | 'saving' | 'failed'>('saved')
const zoomRatio = ref(100)
const mouseX = ref(0)
const mouseY = ref(0)

const saveStateLabel = computed(() => {
  switch (saveState.value) {
    case 'saved': return t('statusBar.saved')
    case 'unsaved': return t('statusBar.unsaved')
    case 'saving': return t('statusBar.saving')
    case 'failed': return t('statusBar.saveFailed')
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

const saveStateClass = computed(() => `vid-status__chip--${saveState.value}`)

const zoomLabel = computed(() => `${Math.round(zoomRatio.value * 100)}%`)

const mouseCoords = computed(() => `${Math.round(mouseX.value)}, ${Math.round(mouseY.value)}`)

// Subscribe to live canvas events once toolsManager is initialized.
// zoomRatio comes from the 'zoom:change' event dispatched by BaseCanvas.onZoomChange
// (see src/video/annotaters/common.ts). mouse coords come from fabric's native
// mouse:move via the BaseCanvas event bus, converted to canvas-space so they
// reflect the actual point under the cursor (post-zoom/pan).
const onZoomChange = (zoom: number) => {
  zoomRatio.value = zoom
}

const onCanvasMouseMove = (opt: any) => {
  try {
    const pointer = globalStates.toolsManager?.baseCanvas?.canvasObj?.getPointer(opt.e)
    if (pointer) {
      mouseX.value = pointer.x
      mouseY.value = pointer.y
    }
  } catch {}
}

const bindCanvasListeners = () => {
  const baseCanvas = globalStates.toolsManager?.baseCanvas
  if (!baseCanvas) return
  baseCanvas.on('zoom:change', onZoomChange)
  baseCanvas.on('mouse:move', onCanvasMouseMove)
  // Seed initial values in case the user hasn't interacted yet
  try {
    const z = baseCanvas.canvasObj?.getZoom?.()
    if (typeof z === 'number') zoomRatio.value = z
  } catch {}
}

const unbindCanvasListeners = () => {
  const baseCanvas = globalStates.toolsManager?.baseCanvas
  if (!baseCanvas) return
  baseCanvas.off('zoom:change', onZoomChange)
  baseCanvas.off('mouse:move', onCanvasMouseMove)
}

// Mark unsaved only when the undo stack actually grows — i.e., the user
// did something worth saving. The previous deep-watch on mainAnnoater
// fired on every property access (including selection changes), which
// produced false "unsaved" states.
watch(
  () => globalStates.mainAnnoater?.undoRedo?.states?.undoCount,
  (newCount, oldCount) => {
    if (typeof newCount === 'number' && typeof oldCount === 'number' && newCount > oldCount) {
      saveState.value = 'unsaved'
    }
  }
)

watch([() => canvaPanel.width_px, () => canvaPanel.height_px], () => {
  bottomInfoLayerStyle.value = {
    top: canvaPanel.top_px + canvaPanel.height_px - 32 + 'px',
    left: canvaPanel.left_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: '32px',
    position: 'absolute',
  }
})

// Bind canvas listeners once tools are initialized (toolsInited flips true
// at the end of AnnotaterManager.init).
watch(
  () => globalStates.toolsInited,
  (inited) => {
    if (inited) {
      bindCanvasListeners()
    }
  },
  { immediate: true }
)

onMounted(() => {
  initFromQuery()
  title.value = '萤火-标注-' + jobConfig.mission + '-' + jobConfig.seq

  // Show low-res warning if viewport < 1280px
  if (window.innerWidth < LOW_RES_THRESHOLD) {
    showLowResWarning.value = true
  }

  // Mark saved after successful label save
  window.addEventListener('message', (e) => {
    if (e.data === 'annotation-saved') saveState.value = 'saved'
    if (e.data === 'annotation-save-failed') saveState.value = 'failed'
  })
})

onUnmounted(() => {
  unbindCanvasListeners()
})

// ─── Side panel resize handles ───────────────────────
// Drag the vertical strip between DataPanel/AttrPanel and the canvas to
// resize the side panels. Widths live in `dataPanel.panelWidth` and
// `attrPanel.width_px` (useStorage → sessionStorage), so they persist
// across reloads. Each mousemove publishes ReloadUI so App.vue's onResize
// recomputes canvaPanel dimensions; rAF-throttled to avoid layout thrash.
const PANEL_MIN = 200
const PANEL_MAX = 600
const DEFAULT_WIDTH = 300

const rafId = ref<number | null>(null)
const pendingReload = ref(false)

const scheduleReload = () => {
  if (pendingReload.value) return
  pendingReload.value = true
  rafId.value = requestAnimationFrame(() => {
    pendingReload.value = false
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
      // Dragging right grows the left panel
      next = startWidth + delta
    } else {
      // Dragging right shrinks the right panel (handle is on its left edge)
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
    // Flush a final reload in case the last rAF was canceled by the next frame
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
    pendingReload.value = false
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

onUnmounted(() => {
  if (rafId.value !== null) cancelAnimationFrame(rafId.value)
})

const title = useTitle()
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

/* ── Video status footer (lab) ─────────────────── */
.vid-status {
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

.vid-status__left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.vid-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  flex-shrink: 0;
}

.vid-status__dot--saved { background: var(--lab-lime); box-shadow: 0 0 6px var(--lab-lime); }
.vid-status__dot--unsaved { background: var(--lab-butter, #ffe58a); box-shadow: 0 0 6px var(--lab-butter, #ffe58a); animation: lab-blink 1.4s ease-in-out infinite; }
.vid-status__dot--saving { background: var(--lab-lilac, #d9ccff); box-shadow: 0 0 6px var(--lab-lilac, #d9ccff); animation: lab-blink 0.8s ease-in-out infinite; }
.vid-status__dot--failed { background: var(--lab-coral); box-shadow: 0 0 6px var(--lab-coral); animation: lab-blink 0.6s ease-in-out infinite; }

.vid-status__eyebrow {
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.14em;
  font-size: 10px;
}

.vid-status__info {
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 460px;
}

.vid-status__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.vid-status__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  font-size: 10.5px;
}

.vid-status__chip--saved { color: var(--lab-lime); }
.vid-status__chip--unsaved { color: var(--lab-butter, #ffe58a); }
.vid-status__chip--saving { color: var(--lab-lilac, #d9ccff); }
.vid-status__chip--failed { color: var(--lab-coral); }

.vid-status__num {
  font-weight: 500;
}

.vid-status__chip--coords {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  min-width: 90px;
  justify-content: center;
}

.y-reject-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 18px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-coral);
  color: var(--lab-ink);
  position: relative;
}

.y-reject-banner::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--lab-coral);
}

.y-reject-banner__icon {
  font-size: 18px;
  color: var(--lab-coral);
  line-height: 1.5;
}

.y-reject-banner__body {
  flex: 1;
  min-width: 0;
}

.y-reject-banner__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.y-reject-banner__title {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 18px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1;
}

.y-reject-banner__meta {
  font-size: 11px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
}

.y-reject-banner__note {
  margin-top: var(--y-spacing-1);
  font-size: var(--y-font-size-sm);
  color: var(--y-color-text-regular);
  white-space: pre-wrap;
}

.y-reject-banner__close {
  flex-shrink: 0;
}

#_Draggable_teleport {
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* ── Resize handles between side panels and canvas ─── */
.anno-resize-handle {
  flex: 0 0 6px;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 5;
  transition: background 150ms ease;

  /* Center hairline so the affordance reads at normal widths */
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

.anno-body {
  position: relative;
}

/* Make el-aside next to handles not collapse during drag */
.anno-body :deep(.el-aside) {
  flex-shrink: 0;
}
</style>

<style>
/* Global — body-level drag state. Scoped CSS can't target body.
   Note: document-level mousemove listeners fire regardless of element
   pointer-events, so we only need to lock the cursor and prevent text
   selection while dragging. */
body.y-is-resizing {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>
