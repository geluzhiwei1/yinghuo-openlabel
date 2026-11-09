<template>
  <div class="overflow-hidden nrrd-shell">
    <el-container>
      <el-header style="height: auto;overflow: hidden;"><TopBar /></el-header>
      <el-container>
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0" :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><DataPanel /></el-aside>
        <el-container>
          <el-main style="padding: 1px;overflow: hidden;"><Annotator /></el-main>
          <el-footer height="0px"></el-footer>
        </el-container>
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0" :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
  </div>
  <div ref="bottomInfoLayer" class="nrrd-status" :style="[bottomInfoLayerStyle]">
    <div class="nrrd-status__left">
      <span class="nrrd-status__dot" />
      <span class="nrrd-status__eyebrow">CANVAS · §VOL</span>
      <span class="nrrd-status__info">{{ messages.lastInfo }}</span>
    </div>
  </div>
  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
  <div id="_Draggable_teleport"></div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import TopBar from './gui/TopBar.vue'
import Annotator from './Annotator.vue'
import DataPanel from './gui/DataPanel.vue'
import AttrPanel from './gui/AttrPanel.vue'
import { attrPanel, dataPanel, canvaPanel } from '@/states/UiState'
import { messages } from '@/states'

import { initFromQuery } from '@/states/job-config'
import { useTitle } from '@vueuse/core'
import { jobConfig } from '@/states/job-config'

const bottomInfoLayer = ref<HTMLElement | null>(null)
const bottomInfoLayerStyle = ref({})

watch([() => canvaPanel.width_px, () => canvaPanel.height_px], () => {
  bottomInfoLayerStyle.value = {
    top: (canvaPanel.top_px + canvaPanel.height_px - 32) + 'px',
    left: canvaPanel.left_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: 32 + 'px',
    position: 'absolute'
  }
})

const title = useTitle()

onMounted(() => {
  initFromQuery()
  title.value = '萤火-标注-' + jobConfig.mission + '-' + jobConfig.seq
})
</script>
<style scoped>
/* 顶栏/外壳跟随主题(浅色白/深色黑,与左右面板同用 --el-bg-color);
   画布区由 Annotator 自行刷深色 #101014,符合 design.md "深色只在画布" */
.nrrd-shell {
  background: var(--el-bg-color);
  /* lab/_index.scss 给 body 硬定 --lab-ink 文字色(lab 体系无全局深色),
     这里必须用 EP 主题变量接住,否则深色模式顶栏文字黑底黑字 */
  color: var(--el-text-color-primary);
  height: 100%;
}

/* 高度链: shell(100%) → 外层 container → 内层 container(flex:1) → main → annotator */
.nrrd-shell > :deep(.el-container) {
  height: 100%;
}

.nrrd-shell :deep(.el-container > .el-container) {
  flex: 1;
  min-height: 0;
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

/* 工具设置浮动卡片的 Teleport 锚点(位置/指针事件规则见 _component-patches.scss) */
#_Draggable_teleport {
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.nrrd-status {
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

.nrrd-status__left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.nrrd-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 6px var(--lab-lime);
  flex-shrink: 0;
  animation: lab-blink 2.4s ease-in-out infinite;
}

.nrrd-status__eyebrow {
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.14em;
  font-size: 10px;
}

.nrrd-status__info {
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 460px;
}
</style>
