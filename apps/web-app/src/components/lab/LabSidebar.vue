<template>
  <nav class="lab-sidebar">
    <div class="lab-sidebar__top">
      <div class="lab-sidebar__label">NAVIGATION</div>
      <button
        v-for="item in menu"
        :key="item.index"
        :class="['lab-sidebar__item', { 'is-active': isActive(item) }]"
        @click="onSelect(item)"
      >
        <Icon v-if="item.icon" :icon="item.icon" :width="16" />
        <span class="lab-sidebar__item-label">{{ item.title }}</span>
        <span v-if="item.badge" class="lab-sidebar__badge">{{ item.badge }}</span>
      </button>
    </div>

    <div class="lab-sidebar__spacer" />

    <LabQuoteCard
      v-if="quote"
      :text="quote.text"
      :source="quote.source"
    />
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import LabQuoteCard from './LabQuoteCard.vue'

type MenuItem = {
  index: string
  title: string
  icon?: string
  badge?: string | number
  children?: MenuItem[]
}

const props = withDefaults(defineProps<{
  menu?: MenuItem[]
  active?: string
  quote?: { text: string; source: string }
}>(), {
  menu: () => [
    { index: 'tasks', title: '任务中心', icon: 'lucide:pen-tool' },
    { index: 'pointcloud', title: '4D 点云', icon: 'lucide:box' },
    { index: 'media', title: '图像视频', icon: 'lucide:image' },
    { index: 'dashboard', title: '看板', icon: 'lucide:chart-bar' },
    { index: 'batches', title: '批次管理', icon: 'lucide:layers' },
    { index: 'team', title: '团队', icon: 'lucide:users' },
  ],
  active: '',
  quote: () => ({
    text: '把每一帧都当作证据。',
    source: 'LAB · MANIFESTO §01',
  }),
})

const emit = defineEmits<{ (e: 'select', item: MenuItem): void }>()

const isActive = (item: MenuItem) => props.active === item.index
const onSelect = (item: MenuItem) => emit('select', item)
</script>

<style scoped>
.lab-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.lab-sidebar__top {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lab-sidebar__label {
  font-family: var(--y-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lab-ash);
  padding: 0 14px 8px;
}

.lab-sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 14px;
  border: none;
  background: transparent;
  border-radius: var(--lab-radius-pill);
  font-family: var(--y-font-family-base);
  font-size: 13px;
  font-weight: 500;
  color: var(--lab-slate);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background-color var(--lab-duration-base), color var(--lab-duration-base);
}

.lab-sidebar__item:hover {
  background: var(--lab-cream);
  color: var(--lab-ink);
}

.lab-sidebar__item.is-active {
  background: var(--lab-ink);
  color: #fff;
}

.lab-sidebar__item-label { flex: 1; }

.lab-sidebar__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-cream);
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  font-weight: 500;
}

.lab-sidebar__item.is-active .lab-sidebar__badge {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.lab-sidebar__spacer { flex: 1; }
</style>
