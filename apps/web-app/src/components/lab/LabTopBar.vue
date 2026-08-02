<template>
  <header class="lab-topbar">
    <div class="lab-topbar__left">
      <div class="lab-topbar__logo">
        <span class="lab-topbar__logo-dot" />
        <span class="lab-topbar__logo-glow" />
      </div>
      <span class="lab-topbar__brand">萤火<span class="lab-topbar__brand-dot">.</span></span>
      <span class="lab-topbar__brand-en">FIREFLY · LAB</span>
    </div>

    <nav v-if="$slots.nav || navItems.length" class="lab-topbar__nav">
      <slot name="nav">
        <button
          v-for="item in navItems"
          :key="item.value"
          :class="['lab-topbar__nav-item', { 'is-active': item.value === activeNav }]"
          @click="$emit('nav-change', item.value)"
        >
          {{ item.label }}
        </button>
      </slot>
    </nav>

    <div class="lab-topbar__right">
      <div class="lab-topbar__search">
        <Icon icon="lucide:search" :width="14" />
        <input class="lab-topbar__search-input" placeholder="搜索任务、批次、操作员…" />
        <kbd class="lab-topbar__search-kbd">⌘K</kbd>
      </div>

      <slot name="actions">
        <button class="lab-topbar__icon-btn" title="通知">
          <Icon icon="lucide:bell" :width="18" />
          <span class="lab-topbar__dot" />
        </button>
        <div class="lab-topbar__user">
          <span class="lab-topbar__user-avatar">{{ userInitial }}</span>
          <span class="lab-topbar__user-name">{{ userName }}</span>
        </div>
      </slot>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

type NavItem = { value: string; label: string }

const props = withDefaults(defineProps<{
  navItems?: NavItem[]
  activeNav?: string
  userName?: string
}>(), {
  navItems: () => [
    { value: 'tasks', label: '任务中心' },
    { value: 'pointcloud', label: '4D 点云' },
    { value: 'media', label: '图像视频' },
    { value: 'dashboard', label: '看板' },
  ],
  activeNav: 'tasks',
  userName: '标注员',
})

defineEmits<{ (e: 'nav-change', value: string): void }>()

const userInitial = computed(() => props.userName?.slice(0, 1) || 'U')
</script>

<style scoped>
.lab-topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  height: var(--lab-topbar-h);
  padding: 0 var(--lab-space-page-x);
  background: var(--lab-paper);
  border-bottom: 1px solid var(--lab-hairline);
  position: relative;
  z-index: 10;
}

.lab-topbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lab-topbar__logo {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lab-topbar__logo-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-lime);
  animation: lab-blink 1.6s ease-in-out infinite;
}
.lab-topbar__logo-glow {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 14px;
  height: 14px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-lime);
  filter: blur(6px);
  opacity: 0.55;
}

.lab-topbar__brand {
  font-family: var(--y-font-family-display);
  font-style: italic;
  font-size: 22px;
  line-height: 1;
  color: var(--lab-ink);
  letter-spacing: -0.01em;
}
.lab-topbar__brand-dot {
  color: var(--lab-coral);
  margin-left: 1px;
}
.lab-topbar__brand-en {
  font-family: var(--y-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--lab-ash);
  text-transform: uppercase;
  margin-left: 4px;
}

.lab-topbar__nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.lab-topbar__nav-item {
  height: var(--lab-ctrl-h-md);
  padding: 0 14px;
  border: none;
  background: transparent;
  border-radius: var(--lab-radius-pill);
  font-family: var(--y-font-family-base);
  font-size: 13px;
  font-weight: 500;
  color: var(--lab-slate);
  cursor: pointer;
  transition: background-color var(--lab-duration-base) var(--lab-ease),
              color var(--lab-duration-base) var(--lab-ease);
}
.lab-topbar__nav-item:hover {
  background: var(--lab-cream);
  color: var(--lab-ink);
}
.lab-topbar__nav-item.is-active {
  background: var(--lab-ink);
  color: #fff;
}

.lab-topbar__right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.lab-topbar__search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--lab-ctrl-h-md);
  padding: 0 6px 0 14px;
  background: var(--lab-snow);
  border: 1px solid var(--lab-hairline);
  border-radius: var(--lab-radius-pill);
  width: 260px;
  color: var(--lab-ash);
}
.lab-topbar__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12.5px;
  color: var(--lab-ink);
  font-family: var(--y-font-family-base);
}
.lab-topbar__search-input::placeholder { color: var(--lab-ash); }
.lab-topbar__search-kbd {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  height: 18px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-cream);
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono);
  font-size: 10px;
}

.lab-topbar__icon-btn {
  position: relative;
  width: var(--lab-ctrl-h-md);
  height: var(--lab-ctrl-h-md);
  border: none;
  background: transparent;
  border-radius: var(--lab-radius-pill);
  color: var(--lab-slate);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--lab-duration-base), color var(--lab-duration-base);
}
.lab-topbar__icon-btn:hover {
  background: var(--lab-cream);
  color: var(--lab-ink);
}
.lab-topbar__dot {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-coral);
  animation: lab-blink 1.6s ease-in-out infinite;
}

.lab-topbar__user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--lab-ctrl-h-md);
  padding: 0 14px 0 4px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-cream);
  cursor: pointer;
  transition: background-color var(--lab-duration-base);
}
.lab-topbar__user:hover { background: var(--lab-line); }
.lab-topbar__user-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-ink);
  color: var(--lab-lime);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--y-font-family-mono);
  font-size: 11px;
  font-weight: 500;
}
.lab-topbar__user-name {
  font-size: 12.5px;
  color: var(--lab-ink);
  font-weight: 500;
}
</style>
