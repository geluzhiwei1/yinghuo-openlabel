<template>
  <el-row id="topbar-container">
    <el-col :span="4">
      <div style="float: right" class="h-full flex items-center">
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link" >
            文件<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="labelStatistics">标签统计</el-dropdown-item>
              <el-dropdown-item command="settings">系统设置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">
            视图<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="attrPanel">
                <Icon :icon="attrPanel.visible ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>属性栏
              </el-dropdown-item>
              <el-dropdown-item command="dataPanel">
                <Icon :icon="dataPanel.visible ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>数据栏
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">
            帮助<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="shortcuts">{{ t('shortcutCheatsheet.title') }}</el-dropdown-item>
              <el-dropdown-item command="hotkeys"><el-link href="#" target="_blank" :aria-label="t('aria.viewHelp')">使用文档</el-link></el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-col>
    <el-col :span="16">
      <div style="text-align: center" class="topbar-tools">
        <ImageOperation></ImageOperation>
        <div class="topbar-divider" />
        <EntityOperation></EntityOperation>
        <div class="topbar-divider" />
        <CommonOperation></CommonOperation>
      </div>
    </el-col>
    <el-col :span="4">
      <div style="float: right" class="h-full flex items-center">
        <ToggleDark></ToggleDark>
        <LocaleSelect />
        <Screenfull />
        <UserProfile></UserProfile>
      </div>
    </el-col>
  </el-row>
  <DataImExport ref="dataImExportRef"></DataImExport>
  <SystemSettings ref="systemSettings"></SystemSettings>
  <AnnoStatistics ref="annoStatisticsRef" />
  <ShortcutCheatsheet v-model:visible="shortcutDialogVisible"></ShortcutCheatsheet>
</template>

<script lang="tsx" setup>
import { ref } from 'vue'
import {
    ElRow,
  ElCol,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
} from 'element-plus'
import { Icon } from '@iconify/vue'

import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { LocaleSelect, i18n } from '@/locales'

import AnnoStatistics from '../menu/statistics/AnnoStatistics.vue'
import SystemSettings from '../menu/SystemSettings.vue'
import DataImExport from '../menu/DataImExport.vue'
import UserProfile from '@/components/UserProfile.vue'

import ImageOperation from './ImageOperation.vue'
import EntityOperation from './EntityOperation.vue'
import CommonOperation from './CommonOperation.vue'
import ShortcutCheatsheet from '@/video/toolbar/ShortcutCheatsheet.vue'

import { attrPanel, dataPanel } from '@/states/UiState'

const t = (key: string) => i18n.global.t(key)

const dataImExportRef = ref(null)
const systemSettings = ref(null)
const annoStatisticsRef = ref(null)
const shortcutDialogVisible = ref(false)

const handleCommand = (command: string) => {
  switch (command) {
    case 'attrPanel':
      attrPanel.visible = !attrPanel.visible
      break;
    case 'dataPanel':
      dataPanel.visible = !dataPanel.visible
      break;
    case 'labelStatistics':
      annoStatisticsRef.value.toggleOpen()
      break;
    case 'settings':
      systemSettings.value.open()
      break;
    case 'shortcuts':
      shortcutDialogVisible.value = true
      break;
    default:
      break;
  }
}
</script>
<style lang="scss" scoped>
.menu-item {
  margin-right: 15px;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: var(--y-spacing-2);
}

.topbar-divider {
  width: 1px;
  height: 24px;
  background: var(--y-color-divider);
  flex-shrink: 0;
}
</style>