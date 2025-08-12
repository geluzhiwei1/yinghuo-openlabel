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
  left: 250px;
  right: 0;
  top: 40px;
  bottom: 0;
  padding-bottom: 30px;
  -webkit-transition: left 0.3s ease-in-out;
  transition: left 0.3s ease-in-out;
  overflow: hidden;
}

.content {
  width: auto;
  height: 100%;
  padding: 20px;
  overflow-y: scroll;
  box-sizing: border-box;
}

.content::-webkit-scrollbar {
  width: 0;
}

.content-collapse {
  left: 65px;
}
</style>
