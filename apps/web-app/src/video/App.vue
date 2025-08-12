<template>
	<el-config-provider :locale="zhCn">
    <AnnoPanel></AnnoPanel>
	</el-config-provider>
</template>

<script setup lang="tsx">
import { onMounted, watch, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useWindowSize } from '@vueuse/core'
import { uiState, topBar, attrPanel, mainPanel, appContainer, canvaPanel, dataPanel, userViewLayout } from '@/states/UiState'
import { useCssVar } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import AnnoPanel from './annoPanel.vue'
import { commonChannel } from './channel'

const { width, height } = useWindowSize()
uiState.ui = 'anno'

const onResize = () => {

  // calcUserViewLayout()

  uiState.appDiv.height_px = height.value
  uiState.appDiv.width_px = width.value

  const el = document.getElementById('topbar-container')
  // uiState.menuBar.height_px = parseInt(useCssVar('--menu-bar-height', el).value)
  uiState.menuBar.height_px = Math.max(el?.clientHeight, parseInt(useCssVar('--menu-bar-height', el).value))
  uiState.menuBar.width_px = width.value

  topBar.height_px = uiState.menuBar.height_px
  topBar.width_px = uiState.menuBar.width_px

  appContainer.height_px = height.value
  appContainer.width_px = width.value

  topBar.height_px += 5
  const panel_height = height.value - topBar.height_px
  attrPanel.value.height_px = panel_height
  mainPanel.height_px = panel_height
  mainPanel.width_px = width.value - attrPanel.value.width_px - dataPanel.value.panelWidth - 10

  // 相对于mainPanel
  canvaPanel.left_px = dataPanel.value.panelWidth
  canvaPanel.top_px = topBar.height_px
  canvaPanel.width_px = mainPanel.width_px - 2
  canvaPanel.height_px = mainPanel.height_px - 4

  // 数据面板
  // dataPanel.panelBarHeight = document.getElementById('panelBar')?.offsetHeight
  // dataPanel.panelBarHeight2 = document.getElementById('panelBar2')?.offsetHeight
  dataPanel.value.panelHeight = canvaPanel.height_px
  dataPanel.value.panelTableHeight = dataPanel.value.panelHeight - dataPanel.value.panelBarHeight - dataPanel.value.panelBar2Height

  uiState.id += 1
}

commonChannel.sub(commonChannel.Events.ReloadUI, onResize)

onMounted(() => {
  topBar.created = true
  onResize()
  watch([width, height], () => {
    onResize()
  })
})
</script>
