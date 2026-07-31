<template>
  <el-row id="topbar-container">
    <el-col :span="1">
      <div class="h-full flex items-center">
        <img style="width: 35px;" src="@/assets/logo.png" :alt="t('aria.logo')" />
      </div>
    </el-col>
    <el-col :span="6">
      <div class="h-full flex items-center" style="gap: 12px;">
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">
            文件<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="import">
                <Icon icon="lucide:upload-cloud" /> 导入高斯泼溅…
              </el-dropdown-item>
              <el-dropdown-item command="export" :disabled="!gaussianState.loaded">
                <Icon icon="lucide:download" /> 导出元数据
              </el-dropdown-item>
              <el-dropdown-item command="clear" :disabled="!gaussianState.loaded" divided>
                <Icon icon="lucide:trash-2" /> 清空
              </el-dropdown-item>
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
                <Icon :icon="attrPanel.width_px > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'" />属性栏
              </el-dropdown-item>
              <el-dropdown-item command="dataPanel">
                <Icon :icon="dataPanel.panelWidth > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'" />数据栏
              </el-dropdown-item>
              <el-dropdown-item command="resetCamera" divided>
                <Icon icon="lucide:locate-fixed" /> 适配视角
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-col>

    <el-col :span="13">
      <div class="topbar-info">
        <span v-if="!gaussianState.loaded" class="topbar-info__idle">未加载 · IDLE</span>
        <template v-else>
          <span class="topbar-info__chip">{{ gaussianState.format.toUpperCase() }}</span>
          <span class="topbar-info__name" :title="gaussianState.fileName">{{ gaussianState.fileName }}</span>
          <span class="topbar-info__count">{{ gaussianState.count.toLocaleString() }} splats</span>
          <span v-if="gaussianState.hidden.size > 0" class="topbar-info__hidden">
            −{{ gaussianState.hidden.size.toLocaleString() }}
          </span>
        </template>
      </div>
    </el-col>

    <el-col :span="4">
      <div class="header-actions">
        <ToggleDark></ToggleDark>
        <Screenfull />
        <UserProfile></UserProfile>
      </div>
    </el-col>
  </el-row>
</template>

<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import UserProfile from '@/components/UserProfile.vue'
import { attrPanel, dataPanel } from '@/states/UiState'
import { i18n } from '@/locales'
import { gaussianState, resetGaussianState } from '../state'
import { eventBus } from '../event/EventBus'
import { ElMessage } from 'element-plus'
import { exportMeta } from '../export-meta'

const t = (key: string) => i18n.global.t(key)

const handleCommand = async (command: string) => {
  switch (command) {
    case 'attrPanel':
      attrPanel.value.width_px = attrPanel.value.width_px > 0 ? 0 : 300
      eventBus.emit('panel:reload')
      break
    case 'dataPanel':
      dataPanel.value.panelWidth = dataPanel.value.panelWidth > 0 ? 0 : 300
      eventBus.emit('panel:reload')
      break
    case 'import':
      eventBus.emit('request-import')
      break
    case 'export':
      exportMeta()
      break
    case 'clear':
      resetGaussianState()
      eventBus.emit('splat:cleared')
      ElMessage.info('已清空')
      break
    case 'resetCamera':
      eventBus.emit('frame-camera')
      break
  }
}
</script>

<style lang="scss" scoped>
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
  flex-wrap: nowrap;
}

#topbar-container :deep(.el-col) {
  min-width: 0;
}

#topbar-container :deep(.el-col-13) {
  flex: 1 1 auto;
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

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  height: 100%;
}

.topbar-info {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--y-color-text-secondary, #3f4046);
  letter-spacing: 0.02em;
  overflow: hidden;
}

.topbar-info__idle {
  color: var(--y-color-text-placeholder, #8a8b92);
}

.topbar-info__chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--lab-coral, #ff6a3d);
  color: var(--lab-snow, #ffffff);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.topbar-info__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--y-color-text-primary, #0e0e10);
}

.topbar-info__count {
  color: var(--y-color-text-regular, #3f4046);
}

.topbar-info__hidden {
  color: var(--lab-coral, #ff6a3d);
  font-weight: 600;
}
</style>
