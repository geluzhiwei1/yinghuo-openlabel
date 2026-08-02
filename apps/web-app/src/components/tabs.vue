<template>
    <div class="tabs-container">
        <el-tabs v-model="activePath" closable class="tabs" type="card" @tab-click="clickTabls" @tab-remove="closeTabs">
            <el-tab-pane
                v-for="item in tabs.list"
                :key="item.path"
                :label="item.title"
                :name="item.path"
                @click="setTags(item)"
            ></el-tab-pane>
        </el-tabs>
        <div class="Tabs-close-box">
            <el-dropdown @command="handleTags">
                <el-button size="small" type="primary" plain>
                    标签选项
                    <Icon icon="lucide:arrow-down" class="el-icon--right" />
                </el-button>
                <template #dropdown>
                    <el-dropdown-menu size="small">
                        <el-dropdown-item command="refresh">刷新</el-dropdown-item>
                        <el-dropdown-item command="other">关闭其他</el-dropdown-item>
                        <el-dropdown-item command="current">关闭当前</el-dropdown-item>
                        <el-dropdown-item command="all">关闭所有</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTabsStore } from '../store/tabs';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';

const route = useRoute();
const router = useRouter();
const activePath = ref(route.fullPath);
const tabs = useTabsStore();
// 设置标签
const setTags = (route: any) => {
    const isExist = tabs.list.some((item) => {
        return item.path === route.fullPath;
    });
    if (!isExist) {
        tabs.setTabsItem({
            name: route.name,
            title: route.meta.title,
            path: route.fullPath,
        });
    }
};
setTags(route);
onBeforeRouteUpdate((to) => {
    setTags(to);
});

// 关闭全部标签
const closeAll = () => {
    tabs.clearTabs();
    router.push('/');
};
// 关闭其他标签
const closeOther = () => {
    const curItem = tabs.list.filter((item) => {
        return item.path === route.fullPath;
    });
    tabs.closeTabsOther(curItem);
};
const handleTags = (command: string) => {
    switch (command) {
        case 'current':
            // 关闭当前页面的标签页
            tabs.closeCurrentTag({
                $router: router,
                $route: route,
            });
            break;
        case 'all':
            closeAll();
            break;

        case 'other':
            closeOther();
            break;

        case 'refresh':
            router.go(0);
            break;
    }
};

const clickTabls = (item: any) => {
    router.push(item.props.name);
};
const closeTabs = (path: string) => {
    const index = tabs.list.findIndex((item) => item.path === path);
    tabs.delTabsItem(index);
    const item = tabs.list[index] || tabs.list[index - 1];
    router.push(item ? item.path : '/');
};

watch(
    () => route.fullPath,
    (newVal, oldVal) => {
        activePath.value = newVal;
    }
);
</script>

<style scss>
.tabs-container {
    position: relative;
    overflow: hidden;
    padding: 6px 130px 0 12px;
    background: var(--lab-paper);
    border-bottom: 1px solid var(--lab-hairline, #ececea);
}

.tabs .el-tabs__header {
    margin-bottom: 0;
    border: none;
}

.tabs .el-tabs__nav {
    height: 32px;
    border: none !important;
}

.tabs .el-tabs__nav-next,
.tabs .el-tabs__nav-prev {
    line-height: 32px;
    color: var(--lab-ash);
}

.tabs .el-tabs__item {
    height: 32px;
    line-height: 32px;
    border: 1px solid var(--lab-line) !important;
    border-radius: var(--lab-radius-pill, 999px) !important;
    background: var(--lab-snow);
    color: var(--lab-slate);
    font-size: 12px;
    padding: 0 14px !important;
    margin-right: 6px;
    transition: all 150ms ease;
    border-bottom: 1px solid var(--lab-line) !important;
}

.tabs .el-tabs__item:hover {
    color: var(--lab-ink);
    background: var(--lab-cream);
    border-color: var(--lab-ash) !important;
}

.tabs .el-tabs__item.is-active {
    background: var(--lab-ink);
    color: var(--lab-snow);
    border-color: var(--lab-ink) !important;
    font-weight: 500;
}

.tabs .el-tabs__item.is-active .is-icon-close {
    color: var(--lab-lime);
}

.tabs .el-tabs__item .is-icon-close:hover {
    background: rgba(255,106,61,0.18);
    color: var(--lab-coral) !important;
    border-radius: 50%;
}

.tabs .el-tabs__nav-wrap::after {
    display: none;
}

.tabs.el-tabs {
    --el-tabs-header-height: 32px;
}

.Tabs-close-box {
    position: absolute;
    right: 0;
    top: 0;
    box-sizing: border-box;
    padding-top: 4px;
    padding-right: 12px;
    text-align: center;
    width: 130px;
    height: 44px;
    background: linear-gradient(to right, transparent, var(--lab-paper) 30%);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: flex-end;
}

.Tabs-close-box .el-button {
    height: 28px !important;
    border-radius: var(--lab-radius-pill, 999px) !important;
    border: 1px solid var(--lab-line) !important;
    background: var(--lab-snow) !important;
    color: var(--lab-slate) !important;
    font-size: 11px !important;
    font-family: var(--y-font-family-mono, "JetBrains Mono", monospace) !important;
    letter-spacing: 0.06em;
    padding: 0 12px !important;
}

.Tabs-close-box .el-button:hover {
    border-color: var(--lab-ink) !important;
    color: var(--lab-ink) !important;
    background: var(--lab-cream) !important;
}
</style>
