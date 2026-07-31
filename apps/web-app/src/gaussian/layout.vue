<template>
  <div class="overflow-hidden">
    <el-container>
      <el-header style="height: auto; padding: 0; background: transparent; overflow: visible;"><TopBar /></el-header>
      <el-container class="gs-body">
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0"><DataPanel /></el-aside>
        <div
          v-if="dataPanel.panelWidth > 0"
          class="gs-resize-handle gs-resize-handle--left"
          @mousedown="startResizeLeft"
          @dblclick="resetLeftWidth"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整宽度"
        />
        <el-container>
          <el-main style="padding: 0; overflow: hidden;">
            <Annotator />
          </el-main>
        </el-container>
        <div
          v-if="attrPanel.width_px > 0"
          class="gs-resize-handle gs-resize-handle--right"
          @mousedown="startResizeRight"
          @dblclick="resetRightWidth"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整宽度"
        />
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
  </div>

  <div ref="bottomInfoLayer" class="gs-status" :style="bottomInfoLayerStyle">
    <div class="gs-status__left">
      <span class="gs-status__dot" :class="`gs-status__dot--${statusState}`" aria-hidden="true" />
      <span class="gs-status__eyebrow">CANVAS · §GS</span>
      <span class="gs-status__info">{{ statusInfo }}</span>
    </div>
    <div class="gs-status__right">
      <span class="gs-status__chip">
        <Icon icon="lucide:boxes" :width="12" />
        <span>{{ countLabel }}</span>
      </span>
      <span class="gs-status__chip gs-status__chip--fps">
        <span class="gs-status__fps-num">{{ fps }}</span>
        <span class="gs-status__fps-unit">FPS</span>
      </span>
    </div>
  </div>

  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import TopBar from './toolbar/TopBar.vue'
import DataPanel from './panels/DataPanel.vue'
import AttrPanel from './panels/AttrPanel.vue'
import Annotator from './Annotator.vue'
import { attrPanel, dataPanel, canvaPanel } from '@/states/UiState'
import { gaussianState } from './state'
import { eventBus } from './event/EventBus'
import { messages } from '@/states'

const bottomInfoLayer = ref<HTMLElement | null>(null)
const bottomInfoLayerStyle = ref<{}>({})

const statusState = computed<'idle' | 'ready' | 'error'>(() => {
  if (gaussianState.lastError) return 'error'
  if (gaussianState.loaded) return 'ready'
  return 'idle'
})

const statusInfo = computed(() => {
  if (gaussianState.lastError) return gaussianState.lastError
  if (!gaussianState.loaded) return '等待导入高斯泼溅文件…'
  return messages.lastInfo || `${gaussianState.count.toLocaleString()} splats · ${gaussianState.format.toUpperCase()}`
})

const countLabel = computed(() => {
  const n = gaussianState.count
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M splats`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K splats`
  return `${n} splats`
})

const fps = ref(0)
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

watch([() => canvaPanel.width_px, () => canvaPanel.height_px], () => {
  bottomInfoLayerStyle.value = {
    top: canvaPanel.top_px + canvaPanel.height_px - 32 + 'px',
    left: canvaPanel.left_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: '32px',
    position: 'absolute',
  }
}, { immediate: true })

// ─── Side panel resize handles ───────────────────────
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
    eventBus.emit('panel:reload')
    eventBus.emit('window:resized')
  })
}

const startResize = (which: 'left' | 'right') => (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  const startX = e.clientX
  const startWidth = which === 'left' ? dataPanel.value.panelWidth : attrPanel.value.width_px

  document.body.classList.add('y-is-resizing')

  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    let next = which === 'left' ? startWidth + delta : startWidth - delta
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
    eventBus.emit('window:resized')
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const startResizeLeft = startResize('left')
const startResizeRight = startResize('right')

const resetLeftWidth = () => {
  dataPanel.value.panelWidth = DEFAULT_WIDTH
  eventBus.emit('window:resized')
}
const resetRightWidth = () => {
  attrPanel.value.width_px = DEFAULT_WIDTH
  eventBus.emit('window:resized')
}

onMounted(() => {
  rafId = requestAnimationFrame(countFrame)
  lastFpsUpdate = performance.now()
  updateFps()
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (resizeRafId.value !== null) cancelAnimationFrame(resizeRafId.value)
})
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

.gs-body :deep(.el-aside) {
  flex-shrink: 0;
}

.gs-resize-handle {
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

.gs-status {
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
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.gs-status__left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.gs-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-slate, #8a8b92);
  box-shadow: 0 0 6px var(--lab-slate, #8a8b92);
  flex-shrink: 0;
}

.gs-status__dot--idle { background: var(--lab-slate, #8a8b92); box-shadow: 0 0 6px var(--lab-slate, #8a8b92); }
.gs-status__dot--ready { background: var(--lab-lime); box-shadow: 0 0 6px var(--lab-lime); }
.gs-status__dot--error { background: var(--lab-coral); box-shadow: 0 0 6px var(--lab-coral); animation: lab-blink 0.6s ease-in-out infinite; }

.gs-status__eyebrow {
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.14em;
  font-size: 10px;
}

.gs-status__info {
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 460px;
}

.gs-status__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gs-status__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  font-size: 10.5px;
}

.gs-status__chip--fps {
  background: var(--lab-lime);
  color: var(--lab-ink);
  font-weight: 500;
}

.gs-status__fps-num {
  font-size: 12px;
  font-weight: 600;
}

.gs-status__fps-unit {
  font-size: 9px;
  opacity: 0.7;
}
</style>

<style>
body.y-is-resizing {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>
