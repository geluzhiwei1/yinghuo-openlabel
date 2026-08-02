<template>
  <div class="wrapper">
    <!-- header部分 -->
    <v-header />
    <!-- 左侧 -->
    <v-sidebar :menuData="menuData" />
    <!-- 右侧主区域 -->
    <div class="content-box" :class="{ 'content-collapse': sidebar.collapse }">
      <v-tabs></v-tabs>
      <div class="content">
        <router-view v-slot="{ Component }">
          <keep-alive :include="tabs.nameList">
              <component :is="Component"></component>
          </keep-alive>
        </router-view>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useSidebarStore } from '@/store/sidebar'
import { useTabsStore } from '@/store/tabs'
import vHeader from '@/components/header.vue'
import vSidebar from '@/components/sidebar.vue'
import vTabs from '@/components/tabs.vue'

import { menuData } from '@/components/menu'

const sidebar = useSidebarStore()
const tabs = useTabsStore()
</script>

<style>
.wrapper {
  height: 100vh;
  overflow: hidden;
}
.content-box {
  position: absolute;
  left: var(--y-sidebar-width);
  right: 0;
  top: var(--y-header-height);
  bottom: 0;
  padding-bottom: 30px;
  -webkit-transition: left var(--y-duration-base) var(--y-ease-in-out);
  transition: left var(--y-duration-base) var(--y-ease-in-out);
  overflow: hidden;
}

.content {
  width: auto;
  height: 100%;
  padding: var(--y-spacing-5);
  overflow-y: scroll;
  box-sizing: border-box;
}

.content::-webkit-scrollbar {
  width: 0;
}

.content-collapse {
  left: var(--y-sidebar-width-collapsed);
}
</style>
