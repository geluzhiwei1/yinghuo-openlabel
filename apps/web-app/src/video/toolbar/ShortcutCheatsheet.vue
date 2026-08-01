<template>
  <el-dialog
    :model-value="visible"
    :title="t('shortcutCheatsheet.title')"
    width="640px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="y-sc-header">
        <span>{{ t('shortcutCheatsheet.title') }}</span>
        <el-input
          v-model="keyword"
          :placeholder="t('shortcutCheatsheet.searchPlaceholder')"
          prefix-icon="lucide:search"
          clearable
          style="width: 200px"
          size="small"
        />
      </div>
    </template>

    <div class="y-sc-body">
      <div v-for="group in filteredGroups" :key="group.name" class="y-sc-group">
        <div class="y-sc-group__title">{{ group.name }}</div>
        <div class="y-sc-group__list">
          <div v-for="item in group.items" :key="item.key" class="y-sc-item">
            <span class="y-sc-item__name">{{ item.name }}</span>
            <div class="y-sc-item__shortcuts">
              <kbd v-for="k in item.keys" :key="k" class="y-sc-item__key">{{ k }}</kbd>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-if="filteredGroups.length === 0" :description="t('shortcutCheatsheet.empty')" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { i18n } from '@/locales'

interface ShortcutItem {
  name: string
  keys: string[]
}

interface ShortcutGroup {
  name: string
  items: ShortcutItem[]
}

defineProps<{ visible: boolean }>()
defineEmits<{ 'update:visible': [val: boolean] }>()

const t = (key: string) => i18n.global.t(key)

const keyword = ref('')

const allGroups: ShortcutGroup[] = [
  {
    name: t('shortcutCheatsheet.group.file'),
    items: [
      { name: t('shortcutCheatsheet.save'), keys: ['Shift', 'S'] },
      { name: t('shortcutCheatsheet.load'), keys: ['Shift', 'R'] },
    ],
  },
  {
    name: t('shortcutCheatsheet.group.edit'),
    items: [
      { name: t('shortcutCheatsheet.undo'), keys: ['Shift', 'Z'] },
      { name: t('shortcutCheatsheet.redo'), keys: ['Shift', 'D'] },
      { name: t('shortcutCheatsheet.deleteSelected'), keys: ['X'] },
      { name: t('shortcutCheatsheet.deleteAll'), keys: ['Shift', 'X'] },
    ],
  },
  {
    name: t('shortcutCheatsheet.group.navigation'),
    items: [
      { name: t('shortcutCheatsheet.prevImage'), keys: ['R'] },
      { name: t('shortcutCheatsheet.nextImage'), keys: ['F'] },
    ],
  },
  {
    name: t('shortcutCheatsheet.group.tools'),
    items: [
      { name: t('shortcutCheatsheet.newVideoEvent'), keys: ['N'] },
      { name: t('shortcutCheatsheet.toggleVideoEvent'), keys: ['E'] },
      { name: t('shortcutCheatsheet.restoreLastSubTool'), keys: ['Space'] },
    ],
  },
]

const filteredGroups = computed(() => {
  if (!keyword.value.trim()) return allGroups
  const kw = keyword.value.toLowerCase()
  return allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.name.toLowerCase().includes(kw) || i.keys.some((k) => k.toLowerCase().includes(kw))
      ),
    }))
    .filter((g) => g.items.length > 0)
})
</script>

<style scoped>
.y-sc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--y-spacing-3);
}

.y-sc-body {
  max-height: 480px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--y-spacing-4);
  padding-right: var(--y-spacing-1);
}

.y-sc-group__title {
  font-size: var(--y-font-size-sm);
  font-weight: 600;
  color: var(--y-color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--y-spacing-2);
}

.y-sc-group__list {
  display: flex;
  flex-direction: column;
  gap: var(--y-spacing-1);
}

.y-sc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--y-spacing-2) var(--y-spacing-3);
  border-radius: var(--y-radius-md);
  transition: background var(--y-duration-fast);
}

.y-sc-item:hover {
  background: var(--y-color-bg-deep);
}

.y-sc-item__name {
  font-size: var(--y-font-size-sm);
  color: var(--y-color-text-regular);
}

.y-sc-item__shortcuts {
  display: inline-flex;
  align-items: center;
  gap: var(--y-spacing-1);
}

.y-sc-item__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2em;
  height: 1.8em;
  padding: 0 var(--y-spacing-1);
  background: var(--y-color-bg-canvas);
  border: 1px solid var(--y-color-divider);
  border-radius: var(--y-radius-sm);
  font-family: var(--y-font-family-mono);
  font-size: var(--y-font-size-xs);
  color: var(--y-color-text-regular);
  box-shadow: 0 1px 0 var(--y-color-divider);
}
</style>
