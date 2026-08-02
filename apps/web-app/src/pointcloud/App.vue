<template>
	<el-config-provider :locale="zhCn">
    <Layout></Layout>
	</el-config-provider>
</template>

<script setup lang="tsx">
import { onMounted, watch, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { uiState, topBar, attrPanel, mainPanel, appContainer, canvaPanel, dataPanel, threeView } from '@/states/UiState'
import { useCssVar } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import Layout from './layout.vue'
import { eventBus } from './event/EventBus'
import { commonChannel } from './channel'

const { width, height } = useWindowSize()
const el = ref(null)
uiState.ui = 'anno'

const onResize = () => {

  // calcUserViewLayout()

  uiState.appDiv.height_px = height.value
  uiState.appDiv.width_px = width.value

  // topbar 的外径要包含 margin+border,clientHeight 不算这两项;
  // 之前的 +5 硬编码补丁覆盖不了 #topbar-container 的 margin+border 残差
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

  // 相对于mainPanel
  canvaPanel.left_px = dataPanel.value.panelWidth
  canvaPanel.top_px = topBar.height_px
  canvaPanel.width_px = mainPanel.width_px - 2
  canvaPanel.height_px = mainPanel.height_px - 4


  dataPanel.value.panelHeight = canvaPanel.height_px
  dataPanel.value.panelTableHeight = dataPanel.value.panelHeight - dataPanel.value.panelBarHeight - dataPanel.value.panelBar2Height

  // 三视图
  const threeViewLeft = canvaPanel.left_px + canvaPanel.width_px - threeView.topView.width
  threeView.topView.left = threeViewLeft
  threeView.topView.top = canvaPanel.top_px
  threeView.topView.height = canvaPanel.height_px * 0.3

  threeView.leftView.left = threeViewLeft
  threeView.leftView.top =  threeView.topView.top + threeView.topView.height + 30
  threeView.leftView.height = canvaPanel.height_px * 0.3

  threeView.backView.left = threeViewLeft
  threeView.backView.top = threeView.leftView.top + threeView.leftView.height + 30
  threeView.backView.height = canvaPanel.height_px * 0.3

  uiState.id += 1

  eventBus.emit(eventBus.Common.WindowResized)
}

onMounted(() => {
  topBar.created = true
  onResize()
  watch([width, height], () => {
    onResize()
  })

  uiState.mounted = true
})

// Side-panel resize handles (see layout.vue) publish ReloadUI on drag;
// re-run onResize so canvaPanel / threeView positions stay in sync.
commonChannel.sub(commonChannel.Events.ReloadUI, onResize)
</script>

<style scoped></style>
