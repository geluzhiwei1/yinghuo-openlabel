<template>
  <el-config-provider :locale="zhCn">
    <Layout></Layout>
  </el-config-provider>
</template>

<script setup lang="tsx">
import { onMounted, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import {
  uiState,
  topBar,
  attrPanel,
  mainPanel,
  appContainer,
  canvaPanel,
  dataPanel,
} from '@/states/UiState'
import { useCssVar } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import Layout from './layout.vue'

const { width, height } = useWindowSize()
uiState.ui = 'anno'

const onResize = () => {
  uiState.appDiv.height_px = height.value
  uiState.appDiv.width_px = width.value

  const topbarEl = document.getElementById('topbar-container')
  const fallbackH = parseInt(useCssVar('--menu-bar-height', topbarEl).value) || 35
  let topbarOuter = fallbackH
  if (topbarEl) {
    const cs = getComputedStyle(topbarEl)
    const rect = topbarEl.getBoundingClientRect()
    const mTop = parseFloat(cs.marginTop) || 0
    const mBot = parseFloat(cs.marginBottom) || 0
    if (rect.height > 0) topbarOuter = rect.height + mTop + mBot
  }
  uiState.menuBar.height_px = Math.max(topbarOuter, fallbackH)
  uiState.menuBar.width_px = width.value

  topBar.height_px = uiState.menuBar.height_px
  topBar.width_px = uiState.menuBar.width_px

  appContainer.height_px = height.value
  appContainer.width_px = width.value

  const panel_height = height.value - topBar.height_px
  attrPanel.value.height_px = panel_height
  mainPanel.height_px = panel_height
  mainPanel.width_px = width.value - attrPanel.value.width_px - 10 - dataPanel.value.panelWidth

  canvaPanel.left_px = dataPanel.value.panelWidth
  canvaPanel.top_px = topBar.height_px
  canvaPanel.width_px = mainPanel.width_px - 2
  canvaPanel.height_px = mainPanel.height_px - 4

  dataPanel.value.panelHeight = canvaPanel.height_px
  dataPanel.value.panelTableHeight =
    dataPanel.value.panelHeight - dataPanel.value.panelBarHeight - dataPanel.value.panelBar2Height

  uiState.id += 1
}

onMounted(() => {
  // gaussian.html's only entry point to data is the left 「数据」 panel (file
  // import lives there). Other entries (pc / nrrd / anno) share the same
  // sessionStorage key, so a panel hidden in another entry would otherwise
  // stay hidden here, leaving the user with an empty canvas and no obvious
  // way to import. Force both side panels open on this entry's first mount.
  if (dataPanel.value.panelWidth === 0) dataPanel.value.panelWidth = 300
  if (attrPanel.value.width_px === 0) attrPanel.value.width_px = 300

  topBar.created = true
  onResize()
  watch([width, height], () => onResize())
  uiState.mounted = true
})
</script>

<style>
html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
#app {
  height: 100%;
  min-height: 0;
}
</style>
