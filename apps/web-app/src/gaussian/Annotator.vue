<template>
  <div id="gsMainContainer" :style="{ height: canvaPanel.height_px + 'px' }">
    <GaussianViewer />
  </div>
</template>

<script lang="ts" setup>
import { canvaPanel } from '@/states/UiState'
import GaussianViewer from './components/GaussianViewer.vue'
</script>

<style scoped>
#gsMainContainer {
  position: relative;
  width: 100%;
  overflow: hidden;
}
</style>
