<template>
  <el-row id="topbar-container">
    <el-col :span="1">
      <div class="h-full flex items-center">
        <img style="width: 35px;" src="@/assets/logo.png" :alt="t('aria.logo')" />
      </div>
    </el-col>
    <el-col :span="5">
      <div style="float: left" class="h-full flex items-center">
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">{{ t('nrrd.menu.file') }}<Icon icon="lucide:arrow-down" class="el-icon--right" /></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">{{ t('nrrd.menu.export') }}</el-dropdown-item>
              <el-dropdown-item command="import">{{ t('nrrd.menu.import') }}</el-dropdown-item>
              <el-dropdown-item command="settings">{{ t('nrrd.menu.settings') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">{{ t('nrrd.menu.view') }}<Icon icon="lucide:arrow-down" class="el-icon--right" /></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="attrPanel">{{ t('nrrd.menu.attrPanel') }}</el-dropdown-item>
              <el-dropdown-item command="dataPanel">{{ t('nrrd.menu.dataPanel') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">{{ t('nrrd.menu.help') }}<Icon icon="lucide:arrow-down" class="el-icon--right" /></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="shortcuts">{{ t('shortcutCheatsheet.title') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-col>
    <el-col :span="14">
      <div class="topbar-tools">
        <SegOperation />
        <div class="topbar-divider" />
        <CommonOperation />
        <el-link type="danger" href="https://github.com/geluzhiwei1/yinghuo-openlabel" target="_blank" class="topbar-feedback">
          {{ t('dashboard.action.feedback') }}
        </el-link>
      </div>
    </el-col>
    <el-col :span="4">
      <div class="header-actions">
        <ToggleDark></ToggleDark>
        <LocaleSelect />
        <Screenfull />
        <UserProfile></UserProfile>
      </div>
    </el-col>
  </el-row>
  <SystemSettings ref="systemSettings" />
  <ExportAnno ref="exportAnnoRef" />
  <ImportAnno ref="importAnnoRef" />
  <ShortcutCheatsheet v-model:visible="shortcutDialogVisible" mode="nrrd" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { LocaleSelect, i18n } from '@/locales'
import UserProfile from '@/components/UserProfile.vue'
import SystemSettings from '../menu/SystemSettings.vue'
import ExportAnno from '../menu/ExportAnno.vue'
import ImportAnno from '../menu/ImportAnno.vue'
import ShortcutCheatsheet from '@/video/toolbar/ShortcutCheatsheet.vue'
import CommonOperation from './CommonOperation.vue'
import SegOperation from './SegOperation.vue'
import { attrPanel, dataPanel } from '@/states/UiState'

const t = (key: string) => i18n.global.t(key)
const systemSettings = ref(null)
const exportAnnoRef = ref(null)
const importAnnoRef = ref(null)
const shortcutDialogVisible = ref(false)

const toggleAside = (store: { panelWidth?: number; width_px?: number }, key: 'panelWidth' | 'width_px') => {
  const cur = (store as any)[key] as number
  if (cur > 0) {
    ;(store as any)['_last_' + key] = cur
    ;(store as any)[key] = 0
  } else {
    ;(store as any)[key] = (store as any)['_last_' + key] || 300
  }
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'attrPanel':
      toggleAside(attrPanel.value, 'width_px')
      break
    case 'dataPanel':
      toggleAside(dataPanel.value, 'panelWidth')
      break
    case 'settings':
      ;(systemSettings.value as any)?.open()
      break
    case 'export':
      ;(exportAnnoRef.value as any)?.open()
      break
    case 'import':
      ;(importAnnoRef.value as any)?.open()
      break
    case 'shortcuts':
      shortcutDialogVisible.value = true
      break
  }
}
</script>

<style lang="scss" scoped>
/* 与 anno.html(src/video/toolbar/TopBar.vue) 同款悬浮圆角卡片顶栏 */
#topbar-container {
  background: var(--y-color-bg-card);
  border: 1px solid var(--y-color-border);
  border-radius: 10px;
  padding: 2px 8px;
  align-items: center;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  max-width: 1400px;
  margin: 4px auto;
  width: calc(100% - 16px);
}

.menu-item {
  margin-right: 10px;
}

:deep(.el-dropdown-link) {
  color: var(--y-color-text-regular);
  font-size: var(--y-font-size-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  outline: none;
  transition: color var(--y-duration-base) var(--y-ease-out);

  &:hover {
    color: var(--y-color-primary);
  }
}

/* Right-side action buttons — consistent bare-icon style */
.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  height: 100%;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: var(--y-spacing-2);
  flex-wrap: nowrap;
  overflow: hidden;
  min-width: 0;
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--y-color-divider);
  flex-shrink: 0;
  margin-left: 2px;
}

.topbar-feedback {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
}
</style>
