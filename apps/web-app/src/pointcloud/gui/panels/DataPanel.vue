<template>
  <div id="dataPanelContainer" ref="el">
    <el-row id="panelBar">
      <el-col :span="20">
        <el-button-group v-if="uiState.ui === 'anno'" class="panel-tabs">
          <el-button size="default" @click="dataPanel.tabs.active = 'task'"
            :type="dataPanel.tabs.active === 'task' ? 'primary' : ''">任务</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'images'"
            :type="dataPanel.tabs.active === 'images' ? 'primary' : ''">数据</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'objets'"
            :type="dataPanel.tabs.active === 'objets' ? 'primary' : ''">标注</el-button>
        </el-button-group>
        <el-button-group v-else-if="uiState.ui === 'seman'" class="panel-tabs">
          <el-button size="default" @click="dataPanel.tabs.active = 'task'"
            :type="dataPanel.tabs.active === 'task' ? 'primary' : ''">任务</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'images'"
            :type="dataPanel.tabs.active === 'images' ? 'primary' : ''">数据</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'objets'"
            :type="dataPanel.tabs.active === 'objets' ? 'primary' : ''">标注</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'pcSemantic'"
            :type="dataPanel.tabs.active === 'pcSemantic' ? 'primary' : ''">语义</el-button>
        </el-button-group>
      </el-col>
      <el-col :span="4" class="panel-bar-actions">
        <el-popover placement="bottom-start" :width="600" trigger="click">
          <template #reference>
            <button class="header-action" :aria-label="t('aria.settings') || '面板设置'">
              <Icon icon="material-symbols-light:tv-options-input-settings-outline" />
            </button>
          </template>
          <div style="width: 100%;">
            <el-row><el-button size="small" type='default' @click='dataPanel.panelWidth = 0'>隐藏面板</el-button></el-row>
            <el-row>
              <el-col :span="4">面板宽度</el-col>
              <el-col :span="16"><el-slider size="small" v-model="panelWidth" show-input :max="1000"
                  :min="100" /></el-col>
              <el-col :span="4"><el-button size="small" @click='changeWidth()'>确定</el-button></el-col>
            </el-row>
          </div>
        </el-popover>
      </el-col>
    </el-row>
    <el-row id="panelContent" style="margin-top: 1px;">
      <div v-if="uiState.ui === 'anno'">
        <div v-show="dataPanel.tabs.active === 'task'">
          <TaskInfo></TaskInfo>
        </div>
        <div v-show="dataPanel.tabs.active === 'images'">
          <FrameInfo></FrameInfo>
        </div>
        <div v-show="dataPanel.tabs.active === 'objets'">
          <ObjectsInfo></ObjectsInfo>
        </div>
      </div>
    </el-row>
  </div>
</template>

<script lang="ts" setup>
import { ref, toRaw } from 'vue'
import FrameInfo from './datas/FrameInfo.vue'
import ObjectsInfo from './annos/ObjectsInfo.vue'
import { uiState } from '@/states/UiState'
import TaskInfo from './annos/TaskInfo.vue'
import { Icon } from '@iconify/vue'
import { dataPanel } from '@/states/UiState'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const panelWidth = ref(toRaw(dataPanel.value.panelWidth))

const changeWidth = () => {
  if (panelWidth.value !== dataPanel.value.panelWidth) {
    dataPanel.value.panelWidth = panelWidth.value
  }
}

</script>
<style lang="scss" scoped>
.panel-bar-actions {
  text-align: right;
}

.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--y-radius-sm);
  cursor: pointer;
  color: var(--y-color-text-regular);
  background: transparent;
  border: none;
  outline: none;
  transition: background var(--y-duration-base) var(--y-ease-in-out),
              color var(--y-duration-base) var(--y-ease-in-out);
  font-size: 14px;

  &:hover {
    background: var(--y-color-bg-hover);
    color: var(--y-color-text-primary);
  }

  &:active {
    background: var(--y-color-bg-active);
  }
}
</style>