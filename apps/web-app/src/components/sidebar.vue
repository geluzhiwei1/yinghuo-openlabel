<template>
  <div class="sidebar">
    <el-menu
      class="sidebar-el-menu"
      :collapse="sidebar.collapse"
      :background-color="sidebar.bgColor"
      :text-color="sidebar.textColor"
      router
    >
      <template v-for="item in menuData">
        <template v-if="item.children">
          <el-sub-menu :index="item.index" :key="item.index" v-permiss="item.id">
            <template #title>
              <Icon v-if="item.icon" :icon="item.icon" :width="28"></Icon>
              <span>{{ t(item.title) }}</span>
            </template>
            <template v-for="subItem in item.children">
              <el-sub-menu
                v-if="subItem.children"
                :index="subItem.index"
                :key="'sub-' + subItem.index"
                v-permiss="subItem.id"
              >
                <template #title>
                  <Icon v-if="item.icon" :icon="item.icon" :width="28"></Icon>
                  {{ t(subItem.title) }}
                </template>
                <el-menu-item
                  v-for="(threeItem, i) in subItem.children"
                  :key="i"
                  :index="threeItem.index"
                  :route="{ name: threeItem.index }"
                >
                  {{ t(threeItem.title) }}
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item
                v-else
                :index="subItem.index"
                :key="'item-' + subItem.index"
                :route="subItem.index"
                v-permiss="subItem.id"
              >
                {{ t(subItem.title) }}
              </el-menu-item>
            </template>
          </el-sub-menu>
        </template>
        <template v-else>
          <el-menu-item
            :index="item.index"
            :route="item.index"
            :key="item.index"
            v-permiss="item.id"
          >
            <!-- <el-icon>
                            <component :is="item.icon"></component>
                        </el-icon> -->
            <Icon v-if="item.icon" :icon="item.icon" :width="28"></Icon>
            <template #title>{{ t(item.title) }}</template>
          </el-menu-item>
        </template>
      </template>
    </el-menu>
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
import { useSidebarStore } from '../store/sidebar'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
interface MenuItem {
  index: string
  title: string
  icon?: string
  id: string
  children?: MenuItem[]
}

defineProps({
  menuData: {
    type: Array as () => MenuItem[],
    default: () => []
  }
})
// import { useRoute, useRouter } from 'vue-router'
// import { usePermissStore } from '@/store/permiss';

// const permiss = usePermissStore();
// const router = useRouter()
// const route = useRoute()
// watch(route, (to, from) => {
//     router.go(0)
// })
const sidebar = useSidebarStore()
// const menuClick = (item) => {
//     router.push({
//         path: item.index,
//         key: item.index
//     })
// }
</script>

<style scoped>
.sidebar {
  display: block;
  position: absolute;
  left: 0;
  top: 40px;
  bottom: 0;
  overflow-y: scroll;
}

.sidebar::-webkit-scrollbar {
  width: 0;
}

.sidebar-el-menu:not(.el-menu--collapse) {
  width: 250px;
}

.sidebar-el-menu {
  min-height: 100%;
}
</style>
