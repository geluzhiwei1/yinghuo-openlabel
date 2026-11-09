<template>
  <div class="vol-annotator">
    <!-- 4 个 pane 恒挂载, 最大化只切 CSS 显隐 — VRT/SliceView 不销毁重建(纹理打包/上下文创建是秒级卡顿) -->
    <Pane v-for="p in panes" :key="p.key" :label="p.label"
      :maximizable="p.key !== 'vrt' || mode !== 'grid'" :class="paneClass(p.key)"
      @focus="activePane = p.key" @maximize="toggleMax(p.key)">
      <SliceView v-if="p.key !== 'vrt'" :axis="p.axis" :focused="activePane === p.key"
        :hidden="mode !== 'grid' && mode !== p.key" />
      <VrtView v-else :hidden="mode !== 'grid' && mode !== 'vrt'" />
    </Pane>

    <CanvasHud />

    <div v-if="volState.loading" class="vol-loading">
      <div class="vol-loading__card">
        <div>{{ volState.loadStage || t('nrrd.loader.loading') }}</div>
        <el-progress :percentage="Math.round(volState.loadProgress * 100)" :stroke-width="10" />
      </div>
    </div>
    <div v-else-if="loadError" class="vol-loading">
      <div class="vol-loading__card vol-loading__card--err">
        <div>{{ loadError }}</div>
        <el-button size="small" @click="reload">{{ t('nrrd.loader.retry') }}</el-button>
      </div>
    </div>
    <div v-else-if="!volState.base" class="vol-empty">{{ t('nrrd.loader.noVolume') }}</div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 2×2 MPR 编排: axial / coronal / sagittal + VRT 占位。
 * 双击视图标题栏最大化(layoutMode), 快捷键 1/2/3/0 切换布局。
 * 切换只改 CSS(pane--max 全幅 / pane--min 隐藏), 组件永不重建。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SliceView from './render/SliceView.vue'
import VrtView from './render/VrtView.vue'
import Pane from './gui/Pane.vue'
import CanvasHud from './gui/CanvasHud.vue'
import { volState, stepBrushRadius } from './store'
import type { LayoutMode } from './store'
import { loadFrame } from './loader'
import { jobConfig } from '@/states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import { undoOne, redoOne, cancelStroke, finishContour } from './seg/tools'
import { runSliceInterpolation } from './seg/interpolate'
import { runGrowCutApply, cancelGrowCutApply } from './seg/growCut'
import { hasUnsavedChanges } from './seg/segDocument'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const panes = [
  { key: 'axial', label: t('nrrd.view.axial'), axis: 2 as const },
  { key: 'coronal', label: t('nrrd.view.coronal'), axis: 1 as const },
  { key: 'sagittal', label: t('nrrd.view.sagittal'), axis: 0 as const },
  { key: 'vrt', label: '3D', axis: 2 as const },
]

const mode = computed<LayoutMode | 'grid'>(() =>
  volState.layoutMode === 'grid' ? 'grid' : volState.layoutMode)

const activePane = ref('axial')

function paneClass(key: string) {
  const m = volState.layoutMode
  if (m === 'grid') return ''
  return key === m ? 'pane--max' : 'pane--min'
}

const paneModes = ['axial', 'coronal', 'sagittal', 'vrt'] as const
function toggleMax(key: string) {
  const m = key as LayoutMode
  if (paneModes.includes(m as any)) {
    volState.layoutMode = volState.layoutMode === m ? 'grid' : m
  }
}

// 快捷键 1/2/3/4 直改 layoutMode 不经 pane 点击, 单视图时聚焦 pane 与布局保持一致
watch(() => volState.layoutMode, m => { if (m !== 'grid') activePane.value = m })

const loadError = ref('')

async function reload() {
  loadError.value = ''
  try {
    await loadFrame()
  } catch (e: any) {
    loadError.value = String(e?.message ?? e)
  }
}

onMounted(() => { if (jobConfig.inited && dataSeqState.loaded) reload() })
// streamMeta(DataSeqState 的 inited watcher 异步拉取)是下载 URL 的来源, 必须等它就绪
watch(() => jobConfig.inited && dataSeqState.loaded, v => { if (v) reload() })
watch(() => jobConfig.frame, (f, o) => {
  if (jobConfig.inited && dataSeqState.loaded && f !== o && f !== undefined) reload()
})

const onKey = (ev: KeyboardEvent) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return
  if (ev.ctrlKey || ev.metaKey) {
    const k = ev.key.toLowerCase()
    if (k === 'z' && ev.shiftKey) { ev.preventDefault(); redoOne(); return }
    if (k === 'z') { ev.preventDefault(); undoOne(); return }
    if (k === 'y') { ev.preventDefault(); redoOne(); return }
    return
  }
  if (ev.code === 'Escape') { cancelGrowCutApply(); cancelStroke(); volState.activeTool = 'none'; return }
  if (ev.code === 'Enter') {
    if (volState.activeTool === 'growCut') runGrowCutApply()
    else finishContour()
    return
  }
  if (ev.code === 'Digit1') volState.layoutMode = 'axial'
  else if (ev.code === 'Digit2') volState.layoutMode = 'coronal'
  else if (ev.code === 'Digit3') volState.layoutMode = 'sagittal'
  else if (ev.code === 'Digit4') volState.layoutMode = 'vrt'
  else if (ev.code === 'Digit0') volState.layoutMode = 'grid'
  else if (ev.code === 'KeyB') volState.activeTool = volState.activeTool === 'brush' ? 'none' : 'brush'
  else if (ev.code === 'KeyE') volState.activeTool = volState.activeTool === 'eraser' ? 'none' : 'eraser'
  else if (ev.code === 'KeyP') volState.activeTool = volState.activeTool === 'sphereBrush' ? 'none' : 'sphereBrush'
  else if (ev.code === 'KeyC') volState.activeTool = volState.activeTool === 'contour' ? 'none' : 'contour'
  else if (ev.code === 'KeyT') volState.activeTool = volState.activeTool === 'thresholdPaint' ? 'none' : 'thresholdPaint'
  else if (ev.code === 'KeyW') volState.activeTool = volState.activeTool === 'magicWand' ? 'none' : 'magicWand'
  else if (ev.code === 'KeyI') runSliceInterpolation()
  else if (ev.code === 'KeyG') volState.activeTool = volState.activeTool === 'growCut' ? 'none' : 'growCut'
  else if (ev.code === 'BracketLeft') volState.brushRadius = stepBrushRadius(volState.brushRadius, -1)
  else if (ev.code === 'BracketRight') volState.brushRadius = stepBrushRadius(volState.brushRadius, 1)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

// 未保存标注时拦截刷新/关闭
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!hasUnsavedChanges()) return
  e.preventDefault()
  e.returnValue = ''
}
</script>

<style scoped>
.vol-annotator {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  background: #101014;
}

.vol-annotator > :deep(.pane) {
  min-height: 0;
  min-width: 0;
}

.vol-annotator > :deep(.pane--max) {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

.vol-annotator > :deep(.pane--min) {
  display: none;
}

.vol-loading,
.vol-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 8, 12, 0.82);
  z-index: 20;
  color: #d7e2da;
}

.vol-loading__card {
  width: 320px;
  padding: 18px 22px;
  border-radius: 8px;
  background: rgba(20, 24, 28, 0.95);
  border: 1px solid rgba(120, 220, 160, 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}

.vol-loading__card--err {
  border-color: rgba(255, 120, 120, 0.4);
}
</style>
