<template>
  <div class="overflow-hidden">
    <el-container>
      <el-header style="height: auto;overflow: hidden;"><TopBar /></el-header>
      <el-container>
        <el-aside :width="dataPanel.panelWidth + 'px'" v-if="dataPanel.panelWidth > 0"  :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><DataPanel /></el-aside>
        <el-container>
          <el-main style="padding: 1px;overflow: hidden;"><ImageAnnotator /></el-main>
          <el-footer height="0px"></el-footer>
        </el-container>
        <el-aside :width="attrPanel.width_px + 'px'" v-if="attrPanel.width_px > 0" :style="{
          boxShadow: `var(--el-box-shadow-lighter)`,
        }"><AttrPanel /></el-aside>
      </el-container>
    </el-container>
    <ModelSelectorUI></ModelSelectorUI>
  </div>
  <div ref="bottomInfoLayer" :style="[bottomInfoLayerStyle]">
    {{  messages.lastInfo  }}
  </div>
  <div id="_Draggable_teleport"></div>
  <div id="labelInfoOverlay" class="fullscreen-transparent-overlay"></div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import TopBar from './toolbar/TopBar.vue'
import AttrPanel from './panels/AttrPanel.vue'
import DataPanel from './panels/DataPanel.vue'
import { onMounted, watch } from 'vue'
import ImageAnnotator from './annotator.vue'
import { ModelSelectorUI } from '@/components/dnn'
import { attrPanel, dataPanel } from '@/states/UiState'

import { jobConfig, initFromQuery } from '@/states/job-config'
import { useTitle } from '@vueuse/core'
import { messages } from '@/states'
import { isEmpty } from 'radash'
import { useDraggable } from '@vueuse/core'
import { canvaPanel } from '@/states/UiState'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const handle = ref<HTMLElement | null>(null)
const bottomInfoLayer = ref<HTMLElement | null>(null)
const bottomInfoLayerStyle = ref({})


watch([()=>canvaPanel.width_px, ()=>canvaPanel.height_px], (newVal, oldVal) => {
  bottomInfoLayerStyle.value = {
    top: (canvaPanel.top_px + canvaPanel.height_px - 32) + 'px',
    left: canvaPanel.left_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: 32 + 'px',
    position: 'absolute',
    textAlign: 'right',
  }
})

const title = useTitle()

onMounted(() => {
  initFromQuery()
  title.value = t('video.app.title', { mission: jobConfig.mission, seq: jobConfig.seq })
})
</script>
<style scoped>
.fullscreen-transparent-overlay {
  position: fixed; /* 使div全屏显示 */
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999; /* 确保div位于其他元素之上 */
  background-color: rgba(0, 0, 0, 0); /* 透明背景，rgba中的最后一个值控制透明度，0为完全透明，1为不透明 */
  pointer-events: none; /* 不接收用户输入 */
}
</style>
