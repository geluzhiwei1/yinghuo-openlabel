<template>
  <div class="overflow-hidden nrrd-shell" data-surface="canvas">
    <el-container>
      <el-header style="height: auto;overflow: hidden;"><TopBar /></el-header>
      <el-container>
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0"  :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><DataPanel /></el-aside>
        <el-container>
          <el-main style="padding: 1px;overflow: hidden;"><Annotator /><Box3dToolSettingUi></Box3dToolSettingUi></el-main>
          <el-footer height="0px"></el-footer>
        </el-container>
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0" :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
    <ModelSelectorUI></ModelSelectorUI>
  </div>
  <div ref="bottomInfoLayer" class="nrrd-status" :style="[bottomInfoLayerStyle]">
    <div class="nrrd-status__left">
      <span class="nrrd-status__dot" />
      <span class="nrrd-status__eyebrow">CANVAS · §VOL</span>
      <span class="nrrd-status__info">{{ messages.lastInfo }}</span>
    </div>
  </div>
  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import TopBar from './toolbar/TopBar.vue'
import Annotator from './Annotator.vue'
import { ModelSelectorUI } from '@/components/dnn'
import { attrPanel, dataPanel, canvaPanel } from '@/states/UiState'
import { messages } from '@/states'

import { initFromQuery } from '@/states/job-config'
import { useTitle } from '@vueuse/core'
import { jobConfig } from '@/states/job-config'

import Box3dToolSettingUi from './tools/ui/box3d-tool-setting.vue'

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
  title.value = '萤火-标注-' + jobConfig.mission + '-' +  jobConfig.seq
})
</script>
<style scoped>
.nrrd-shell {
  background: var(--lab-ink);
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
