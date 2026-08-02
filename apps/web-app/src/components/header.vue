<template>
    <div class="header">
        <!-- 折叠按钮 -->
        <div class="header-left">
            <div class="brand">
                <span class="brand__dot" aria-hidden="true" />
                <div class="brand__text">
                    <span class="brand__title">萤火<span class="brand__period">.</span></span>
                    <span class="brand__sub">FIREFLY · LAB</span>
                </div>
            </div>
            <button class="collapse-btn" @click="collapseChage" aria-label="toggle sidebar">
                <Icon v-if="sidebar.collapse" icon="lucide:panel-left-open" :width="18" />
                <Icon v-else icon="lucide:panel-left-close" :width="18" />
            </button>
        </div>
        <div class="header-right">
            <div class="header-actions">
                <ToggleDark></ToggleDark>
                <LocaleSelect />
                <Screenfull />
                <NotificationBell></NotificationBell>
                <UserProfile></UserProfile>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue';
import { useSidebarStore } from '../store/sidebar';
import { useRouter } from 'vue-router';
// import imgurl from '../assets/img/img.jpg';
import { ElContainer, ElHeader, ElMain, ElRow, ElCol, ElAside } from 'element-plus'
import Screenfull from '@/components/Screenfull.vue'
import { Icon } from '@iconify/vue'
import { LocaleSelect } from '@/locales'
import UserProfile from '@/components/UserProfile.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import { i18n } from '@/locales'
import { userViewLayout } from '@/states/UiState'
import { useTitle } from '@vueuse/core'
const title = useTitle()
title.value = i18n.global.t('app.title') + ' - 欢迎使用'

const username: string | null = localStorage.getItem('vuems_name');
const message: number = 2;

const sidebar = useSidebarStore();
// 侧边栏折叠
const collapseChage = () => {
    sidebar.handleCollapse();
};

onMounted(() => {
    if (document.body.clientWidth < 1500) {
        collapseChage();
    }
});

// 用户名下拉菜单选择事件
const router = useRouter();
const handleCommand = (command: string) => {
    if (command == 'loginout') {
        localStorage.removeItem('vuems_name');
        router.push('/login');
    }
};

const setFullScreen = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.body.requestFullscreen.call(document.body);
    }
};
</script>
<style scoped>
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    height: var(--y-header-height);
    background: var(--lab-snow);
    border-bottom: 1px solid var(--lab-hairline, #ececea);
    position: relative;
    z-index: 10;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-left: 20px;
    height: 100%;
}

.brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.brand__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--lab-ink);
    position: relative;
}

.brand__dot::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--lab-lime);
    box-shadow: 0 0 8px var(--lab-lime);
    animation: lab-blink 2.4s ease-in-out infinite;
}

.brand__text {
    display: flex;
    flex-direction: column;
    line-height: 1;
    gap: 3px;
}

.brand__title {
    font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
    font-style: italic;
    font-size: 24px;
    font-weight: 400;
    color: var(--lab-ink);
    line-height: 0.9;
    letter-spacing: -0.01em;
}

.brand__period {
    color: var(--lab-coral);
}

.brand__sub {
    font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
    font-size: 9.5px;
    letter-spacing: 0.16em;
    color: var(--lab-ash);
}

.collapse-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--lab-radius-pill, 999px);
    border: 1px solid var(--lab-line);
    background: var(--lab-snow);
    color: var(--lab-slate);
    cursor: pointer;
    transition: all 150ms ease;
    padding: 0;
}

.collapse-btn:hover {
    border-color: var(--lab-ink);
    color: var(--lab-ink);
    background: var(--lab-cream);
}

.header-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 12px;
    height: 100%;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
}

.header-actions :deep(.header-action) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--lab-radius-pill, 999px);
    cursor: pointer;
    color: var(--lab-graphite);
    transition: all 150ms ease;
}

.header-actions :deep(.header-action:hover) {
    background: var(--lab-cream);
    color: var(--lab-ink);
}

.header-actions :deep(.header-action:active) {
    background: var(--lab-line);
}

.el-dropdown-menu__item {
    text-align: center;
}
</style>
