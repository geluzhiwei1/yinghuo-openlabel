<template>
    <div id="m-view-manipulator" :style="topDivStyle">
      <div class="y-view-chip">
        <Icon icon="lucide:box" />
        {{ t('pcStatus.mainView') }}
      </div>
    </div>
    <div id="mainCanvaContainer" :style="rectToolStyle" >
      <canvas id="mainCanva"></canvas>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { uiState, canvaPanel } from '@/states/UiState'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const topDivStyle = ref({})
const rectToolStyle = ref({})

watch(() => uiState.id, () => {
  topDivStyle.value = {
    position: 'absolute',
    left: canvaPanel.left_px + 'px',
    top: canvaPanel.top_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: canvaPanel.height_px + 'px',
  }
  rectToolStyle.value = {
    position: 'absolute',
    left: canvaPanel.left_px + 'px',
    top: canvaPanel.top_px + 'px',
    width: canvaPanel.width_px + 'px',
    height: canvaPanel.height_px + 'px',
    pointerEvents: 'none',
  }
}, {immediate: true})
</script>

<style scoped>
.y-view-chip {
  position: absolute;
  top: 6px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: var(--y-spacing-1);
  padding: 2px var(--y-spacing-2);
  background: var(--y-color-bg-card);
  border: 1px solid var(--y-color-divider);
  border-radius: var(--y-radius-sm);
  font-size: var(--y-font-size-xs);
  font-weight: 600;
  color: var(--y-color-text-secondary);
  z-index: 10;
  user-select: none;
}
</style>