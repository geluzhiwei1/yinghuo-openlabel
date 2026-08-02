<template>
    <div id="x-view-manipulator" :style="[topDivStyle]" v-show="glGlobals.threeViews?.xView?.states?.visiable">
      <div class="view-toolbar">
        <div class="y-view-chip">
          <Icon icon="lucide:axis-3d" />
          X+
        </div>
        <el-button-group size="small">
          <el-button type="primary" @click="handleClick('reset')" :aria-label="t('shortcutCheatsheet.resetView')"><Icon :icon="'solar:target-line-duotone'"></Icon></el-button>
          <el-button type="primary" @click="handleClick('translate')" :aria-label="t('shortcutCheatsheet.translateView')"><Icon :icon="'iconamoon:move-thin'"></Icon></el-button>
          <el-button type="primary"  @click="handleClick('scale')" :aria-label="t('shortcutCheatsheet.scaleView')"><Icon :icon="'solar:scale-broken'"></Icon></el-button>
          <el-button type="primary"  @click="handleClick('rotate')" :aria-label="t('shortcutCheatsheet.rotateView')"><Icon :icon="'lucide:rotate-3d'"></Icon></el-button>
        </el-button-group>
      </div>
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { eventBus } from '../../event/EventBus'
import { threeView } from '@/states/UiState'
import { glGlobals } from '@/pointcloud/render/GlObjectsHolder'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const handleClick = (mode: string) => {
  glGlobals.threeViews.xView.setContolMode(mode)
}

const topDivStyle = ref({})

eventBus.on(eventBus.Common.WindowResized, () => {
  topDivStyle.value = {
    position: 'absolute',
    left: threeView.backView.left + 'px',
    top: threeView.backView.top + 'px',
    width: threeView.backView.width + 'px',
    height: threeView.backView.height + 'px',
  }
})
</script>

<style scoped>
.view-toolbar {
  position: absolute;
  top: 6px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: var(--y-spacing-2);
  z-index: 10;
}

.y-view-chip {
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
  user-select: none;
}
</style>