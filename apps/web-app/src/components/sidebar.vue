<template>
    <div class="sidebar">
        <el-menu class="sidebar-el-menu" :collapse="sidebar.collapse" router>
            <template v-for="item in menuData">
                <template v-if="item.children">
                    <el-sub-menu :index="item.index" :key="item.index" v-permiss="item.id">
                        <template #title>
                            <Icon :icon="item.icon" :width="20"></Icon>
                            <span>{{ item.title }}</span>
                        </template>
                        <template v-for="subItem in item.children">
                            <el-sub-menu v-if="subItem.children" :index="subItem.index" :key="subItem.index"
                                v-permiss="subItem.id">
                                <template #title>
                                    <Icon :icon="item.icon" :width="20"></Icon>
                                    {{ subItem.title }}
                                </template>
                                <el-menu-item v-for="(threeItem, i) in subItem.children" :key="i"
                                    :index="threeItem.index" :route="{ name: threeItem.index }" >
                                    {{ threeItem.title }}
                                </el-menu-item>
                            </el-sub-menu>
                            <el-menu-item v-else :index="subItem.index" :route="subItem.index" v-permiss="subItem.id"
                                >
                                {{ subItem.title }}
                            </el-menu-item>
                        </template>
                    </el-sub-menu>
                </template>
                <template v-else>
                    <el-menu-item :index="item.index" :route="item.index" :key="item.index" 
                        v-permiss="item.id">
                        <!-- <el-icon>
                            <component :is="item.icon"></component>
                        </el-icon> -->
                        <Icon :icon="item.icon" :width="20"></Icon>
                        <template #title>{{ item.title }}</template>
                    </el-menu-item>
                </template>
            </template>
        </el-menu>
    </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useSidebarStore } from '../store/sidebar'
import { Icon } from '@iconify/vue'

const props = defineProps({
    menuData: {
        type: Array,
        default: []
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
    top: var(--y-header-height);
    bottom: 0;
    overflow-y: scroll;
    background: var(--lab-paper);
    border-right: 1px solid var(--lab-hairline, #ececea);
}

.sidebar::-webkit-scrollbar {
    width: 0;
}

.sidebar-el-menu:not(.el-menu--collapse) {
    width: var(--y-sidebar-width);
    border-right: none !important;
    background: transparent;
}

.sidebar-el-menu {
    min-height: 100%;
    background: transparent;
    border-right: none !important;
}

.sidebar-el-menu :deep(.el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu__title) {
    height: 40px;
    line-height: 40px;
    border-radius: var(--lab-radius-lg, 8px);
    margin: 4px 10px;
    padding-right: 16px !important;
    color: var(--lab-slate);
    font-size: 13px;
    transition: all 150ms ease;
}

.sidebar-el-menu :deep(.el-menu-item:hover),
.sidebar-el-menu :deep(.el-sub-menu__title:hover) {
    background: var(--lab-cream);
    color: var(--lab-ink);
}

.sidebar-el-menu :deep(.el-menu-item.is-active) {
    background: var(--lab-ink);
    color: var(--lab-snow);
    font-weight: 500;
}

.sidebar-el-menu :deep(.el-menu-item.is-active .el-icon),
.sidebar-el-menu :deep(.el-menu-item.is-active svg) {
    color: var(--lab-lime);
}

.sidebar-el-menu :deep(.el-sub-menu .el-menu-item) {
    height: 36px;
    line-height: 36px;
    margin: 2px 10px 2px 24px;
    font-size: 12px;
    min-width: auto;
}

.sidebar-el-menu :deep(.el-sub-menu .el-menu) {
    background: transparent;
}

.sidebar-el-menu :deep(.el-sub-menu__icon-arrow) {
    color: var(--lab-fog);
}

.sidebar-el-menu :deep(.el-menu-item .el-icon),
.sidebar-el-menu :deep(.el-sub-menu__title .el-icon) {
    color: var(--lab-ash);
    transition: color 150ms ease;
}

.sidebar-el-menu :deep(.el-menu-item:hover .el-icon),
.sidebar-el-menu :deep(.el-sub-menu__title:hover .el-icon) {
    color: var(--lab-ink);
}

/* Collapsed state */
.sidebar-el-menu.el-menu--collapse {
    width: 64px;
}

.sidebar-el-menu.el-menu--collapse :deep(.el-menu-item),
.sidebar-el-menu.el-menu--collapse :deep(.el-sub-menu__title) {
    margin: 4px 8px;
    padding: 0 !important;
    justify-content: center;
}
</style>
