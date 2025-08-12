<template>
  <el-row id="topbar-container">
    <el-col :span="1">
      <div class="h-full flex items-center">
      <img style="width: 35px;" src="@/assets/logo.png" alt="" /></div>
    </el-col>
    <el-col :span="5">
      <div style="float: left" class="h-full flex items-center">
        <el-dropdown @command="handleCommand" class="menu-item">
          <span class="el-dropdown-link" >
            {{ $t('video.toolbar.file') }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="exportAnno">{{ $t('video.toolbar.importExport') }}</el-dropdown-item>
              <el-dropdown-item command="labelStatistics">{{ $t('video.toolbar.labelStatistics') }}</el-dropdown-item>
              <el-dropdown-item command="settings">{{ $t('video.toolbar.systemSettings') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item">
          <span class="el-dropdown-link">
            {{ $t('video.toolbar.view') }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="attrPanel">
                <Icon :icon="attrPanel.width_px > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>{{ $t('video.toolbar.attributes') }}
              </el-dropdown-item>
              <el-dropdown-item command="dataPanel">
                <Icon :icon="dataPanel.panelWidth > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>{{ $t('video.toolbar.data') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item">
          <span class="el-dropdown-link">
            {{ $t('video.toolbar.help') }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="hotkeys"><el-link href="#"
                  target="_blank">{{ $t('video.toolbar.docs') }}</el-link></el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-col>
    <el-col :span="14">
      <div style="text-align: left">
        <ImageOperation></ImageOperation>
        <EntityOperation></EntityOperation>
        <CommonOperation></CommonOperation>
        <el-link type="danger" href="https://gitee.com/gerwee/yinghuo" target="blank" style="margin-right: 10px;">{{ $t('video.toolbar.feedback') }}</el-link>
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
  <InterpolateObjectUI></InterpolateObjectUI>
</template>

<script lang="tsx" setup>
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import {
  ElIcon, 
  ElRow,
  ElCol,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
} from 'element-plus'
import { Icon } from '@iconify/vue'

import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { LocaleSelect } from '@/locales'

import AnnoStatistics from '@/views/statistics/AnnoStatistics.vue'
import SystemSettings from '../menu/SystemSettings.vue'
import DataImExport from '@/components/data-imex/DataImExport.vue'
import UserProfile from '@/components/UserProfile.vue'

import ImageOperation from './ImageOperation.vue'
import EntityOperation from './EntityOperation.vue'
// import CommonOperation from './CommonOperation.vue'
import CommonOperation from '@/components/CommonOperation.vue'

import { attrPanel, dataPanel, uiState } from '@/states/UiState'
import { commonChannel } from '../channel'
import { jobConfig } from '@/states/job-config'

import InterpolateObjectUI from '../../tools/ui/inpterpolate-object.vue'

const dataImExportRef = ref(null)
const systemSettings = ref(null)
const annoStatisticsRef = ref(null)

const handleCommand = (command: string) => {
  switch (command) {
    case 'attrPanel':
      if (attrPanel.value.width_px === 0) {
        attrPanel.value.width_px = 300
      } else {
        attrPanel.value.width_px = 0
      }
      commonChannel.pub(commonChannel.Events.ReloadUI, {})
      break;
    case 'dataPanel':
      // dataPanel.visible = !dataPanel.visible
      if (dataPanel.value.panelWidth === 0) {
        dataPanel.value.panelWidth = 300
      } else {
        dataPanel.value.panelWidth = 0
      }
      commonChannel.pub(commonChannel.Events.ReloadUI, {})
      break;
    case 'labelStatistics':
      annoStatisticsRef.value.toggleOpen({
        stream: jobConfig.stream,
        uuid: jobConfig.uuid,
        current_mission: jobConfig.mission,
        seq: jobConfig.seq,
      })
      break;
    case 'exportAnno':
      dataImExportRef.value.open()
      break
    case 'settings':
      systemSettings.value.open()
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
</style>