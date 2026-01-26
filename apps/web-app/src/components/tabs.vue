<template>
  <div class="tabs-container">
    <el-tabs v-model="activePath" closable class="tabs" type="card" @tab-click="clickTabls" @tab-remove="closeTabs">
      <el-tab-pane v-for="item in tabs.list" :key="item.path" :label="item.title" :name="item.path"
        @click="setTags(item)"></el-tab-pane>
    </el-tabs>
    <div class="Tabs-close-box">
      <el-dropdown @command="handleTags">
        <el-button size="small" type="primary" plain>
          {{ t('components.tabs.options') }}
          <el-icon class="el-icon--right">
            <arrow-down />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu size="small">
            <el-dropdown-item command="refresh">{{ t('components.tabs.refresh') }}</el-dropdown-item>
            <el-dropdown-item command="other">{{ t('components.tabs.closeOther') }}</el-dropdown-item>
            <el-dropdown-item command="current">{{
              t('components.tabs.closeCurrent')
              }}</el-dropdown-item>
            <el-dropdown-item command="all">{{ t('components.tabs.closeAll') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
Copyright (C) 2025 格律至微

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
import { ref, watch } from 'vue'
import { useTabsStore } from '../store/tabs'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const activePath = ref(route.fullPath)
const tabs = useTabsStore()
// 设置标签
const setTags = (route: any) => {
  const isExist = tabs.list.some((item) => {
    return item.path === route.fullPath
  })
  if (!isExist) {
    tabs.setTabsItem({
      name: route.name,
      title: t(route.meta.title),
      path: route.fullPath
    })
  }
}
setTags(route)
onBeforeRouteUpdate((to) => {
  setTags(to)
})

// 关闭全部标签
const closeAll = () => {
  tabs.clearTabs()
  router.push('/')
}
// 关闭其他标签
const closeOther = () => {
  const curItem = tabs.list.filter((item) => {
    return item.path === route.fullPath
  })
  tabs.closeTabsOther(curItem)
}
const handleTags = (command: string) => {
  switch (command) {
    case 'current':
      // 关闭当前页面的标签页
      tabs.closeCurrentTag({
        $router: router,
        $route: route
      })
      break
    case 'all':
      closeAll()
      break

    case 'other':
      closeOther()
      break

    case 'refresh':
      router.go(0)
      break
  }
}

const clickTabls = (item: any) => {
  router.push(item.props.name)
}
const closeTabs = (path: string) => {
  const index = tabs.list.findIndex((item) => item.path === path)
  tabs.delTabsItem(index)
  const item = tabs.list[index] || tabs.list[index - 1]
  router.push(item ? item.path : '/')
}

watch(
  () => route.fullPath,
  (newVal) => {
    activePath.value = newVal
  }
)
</script>

<style scss>
.tabs-container {
  position: relative;
  overflow: hidden;
  padding: 2px 120px 0 0;
}

.tabs {
  .el-tabs__header {
    margin-bottom: 0;
  }

  .el-tabs__nav {
    height: 28px;
  }

  .el-tabs__nav-next,
  .el-tabs__nav-prev {
    line-height: 32px;
  }

  &.el-tabs {
    --el-tabs-header-height: 28px;
  }
}

.Tabs-close-box {
  position: absolute;
  right: 0;
  top: 0;
  box-sizing: border-box;
  padding-top: 1px;
  text-align: center;
  width: 110px;
  height: 30px;
  box-shadow: -3px 0 15px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}
</style>
