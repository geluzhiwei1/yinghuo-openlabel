<template>
  <div id="dataPanelContainer" ref="el">
    <el-row id="panelBar">
      <el-col :span="20">
        <el-button-group v-if="uiState.ui === 'anno'">
          <el-button size="default" @click="dataPanel.tabs.active = 'task'"
            :type="dataPanel.tabs.active === 'task' ? 'success' : ''">{{ $t('video.datapanel.task') }}</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'images'"
            :type="dataPanel.tabs.active === 'images' ? 'success' : ''">{{ $t('video.datapanel.data') }}</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'objets'"
            :type="dataPanel.tabs.active === 'objets' ? 'success' : ''">{{ $t('video.datapanel.annotation') }}</el-button>
        </el-button-group>
        <el-button-group v-else-if="uiState.ui === 'seman'">
          <el-button size="default" @click="dataPanel.tabs.active = 'task'"
            :type="dataPanel.tabs.active === 'task' ? 'success' : ''">{{ $t('video.datapanel.task') }}</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'images'"
            :type="dataPanel.tabs.active === 'images' ? 'success' : ''">{{ $t('video.datapanel.data') }}</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'objets'"
            :type="dataPanel.tabs.active === 'objets' ? 'success' : ''">{{ $t('video.datapanel.annotation') }}</el-button>
          <el-button size="default" @click="dataPanel.tabs.active = 'pcSemantic'"
            :type="dataPanel.tabs.active === 'pcSemantic' ? 'success' : ''">{{ $t('video.datapanel.semantic') }}</el-button>
        </el-button-group>
      </el-col>
      <el-col :span="4" style="text-align: right;font-size:18pt;">
        <el-popover placement="bottom-start" :width="600" trigger="click">
          <template #reference>
            <Icon icon="material-symbols-light:tv-options-input-settings-outline" />
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
      <div v-else-if="uiState.ui === 'seman'">
        <div v-show="dataPanel.tabs.active === 'pcSemantic'">
        <PcObjectsInfo></PcObjectsInfo>
      </div>
      </div>
    </el-row>
  </div>
</template>

<script lang="ts" setup>
import { ref, toRaw } from 'vue'
import FrameInfo from './datas/FramesTable.vue'
import ObjectsInfo from './annos/ObjectsInfo.vue'
import PcObjectsInfo from '@/panels/semanPc/ObjectsInfo.vue'
import { uiState } from '@/states/UiState'
import TaskInfo from './annos/TaskInfo.vue'
import { Icon } from '@iconify/vue'
import { dataPanel } from '@/states/UiState'

const panelWidth = ref(toRaw(dataPanel.value.panelWidth))

const changeWidth = () => {
  if (panelWidth.value !== dataPanel.value.panelWidth) {
    dataPanel.value.panelWidth = panelWidth.value
  }
}

</script>
<style lang="scss" scoped></style>