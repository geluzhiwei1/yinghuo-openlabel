<template>
	<el-config-provider :locale="zhCn">
    <AnnoPanel></AnnoPanel>
	</el-config-provider>
</template>

<script setup lang="tsx">
import { onMounted, watch, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { uiState, topBar, attrPanel, mainPanel, appContainer, canvaPanel, dataPanel, userViewLayout } from '@/states/UiState'
import { useCssVar } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import AnnoPanel from './layout.vue'

const { width, height } = useWindowSize()
const el = ref(null)
uiState.ui = 'anno'

const onResize = () => {

// calcUserViewLayout()

uiState.appDiv.height_px = height.value
uiState.appDiv.width_px = width.value

const topbarEl = document.getElementById('topbar-container')
// topbar 的外径要包含 margin+border,clientHeight 不算这两项;
// 之前的 +5 硬编码补丁覆盖不了 #topbar-container 的 margin+border 残差
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

onMounted(() => {
topBar.created = true
onResize()
watch([width, height], () => {
  onResize()
})
})
</script>

<!--
  全屏不可滚动壳:nrrd 与 home/admin/tenant_admin 共用 src/assets/base.css,
  那里不能加 html/body { overflow: hidden }(会把后台管理页一起锁死),
  所以把这条规则放在 nrrd 自己的 App.vue 里 —— 多页应用里非 scoped <style>
  只会注入到加载本 entry 的页面,不会污染其它入口。
-->
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