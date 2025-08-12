<template>
  <el-config-provider :locale="zhCn">
    <RouterView />
  </el-config-provider>
</template>

<script setup lang="tsx">
/*
Copyright (C) 2025 undefined

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { onMounted, watch, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useWindowSize } from '@vueuse/core'
import {
  uiState,
  topBar,
  attrPanel,
  mainPanel,
  appContainer,
  canvaPanel,
  dataPanel,
  userViewLayout
} from '@/states/UiState'
import { useCssVar } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { userAuth } from '@/states/UserState'

const { width, height } = useWindowSize()
const el = ref(null)

const calcUserViewLayout = () => {
  // 整个窗口的大小
  userViewLayout.window.height_px = Math.max(height.value, 800)
  userViewLayout.window.width_px = Math.max(width.value, 600)

  // 最上层的菜单
  userViewLayout.menuBar.height_px = parseInt(useCssVar('--menu-bar-height', el).value)
  userViewLayout.menuBar.width_px = width.value

  // 右侧菜单
  userViewLayout.sidePanel.height_px =
    userViewLayout.window.height_px - userViewLayout.menuBar.height_px
  // userViewLayout.sidePanel.width_px = userViewLayout.window.width_px - userViewLayout.menuBar.width_px

  // 内容区
  userViewLayout.contentPanel.height_px =
    userViewLayout.window.height_px - userViewLayout.menuBar.height_px
  userViewLayout.contentPanel.width_px =
    userViewLayout.window.width_px - userViewLayout.sidePanel.width_px
}

const onResize = () => {
  calcUserViewLayout()
}

onMounted(() => {
  topBar.created = true
  onResize()
  watch([width, height], () => {
    onResize()
  })
})
</script>

<style scoped></style>
