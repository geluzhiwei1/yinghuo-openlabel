<template>
  <div v-if="volState.base" class="canvas-hud" @pointerdown.stop @pointermove.stop @pointerup.stop
    @pointercancel.stop @wheel.stop @dblclick.stop @contextmenu.stop>
    <el-select :model-value="volState.wlPresetKey" @update:model-value="applyPreset" size="small"
      class="canvas-hud__preset" popper-class="canvas-hud__pop" :teleported="false">
      <el-option v-for="p in wlPresets" :key="p.key" :value="p.key" :label="p.name" />
      <el-option value="custom" :label="t('nrrd.wl.custom')" disabled />
    </el-select>
    <span class="canvas-hud__wl">W {{ volState.wl.width.toFixed(0) }} / L {{ volState.wl.level.toFixed(0) }}</span>

    <!-- 融合任务始终显示 PET 开关; 未配对帧 overlay 为空时置灰提示,避免控件凭空消失 -->
    <template v-if="volState.overlay || jobConfig.streams.includes('pet')">
      <div class="canvas-hud__divider" />
      <el-button v-if="volState.overlay" size="small" class="canvas-hud__pet-toggle"
        :type="volState.petOn ? 'primary' : 'info'" :plain="!volState.petOn"
        :title="volState.petOn ? t('nrrd.wl.petOverlayOff') : t('nrrd.wl.petOverlayOn')"
        :aria-label="volState.petOn ? 'pet-overlay-on' : 'pet-overlay-off'"
        @click="volState.petOn = !volState.petOn">
        <el-icon><View v-if="volState.petOn" /><Hide v-else /></el-icon>
        <span>PET</span>
      </el-button>
      <el-tooltip v-else :content="t('nrrd.loader.unpairedPet')" placement="top">
        <span class="canvas-hud__pet-wrap">
          <el-button size="small" class="canvas-hud__pet-toggle" type="info" plain disabled aria-label="pet-overlay-none">
            <el-icon><Hide /></el-icon><span>PET</span>
          </el-button>
        </span>
      </el-tooltip>
      <template v-if="volState.overlay">
        <el-select :model-value="volState.petLut" @update:model-value="(v: any) => (volState.petLut = v)" size="small"
          class="canvas-hud__preset" popper-class="canvas-hud__pop" :teleported="false" :disabled="!volState.petOn">
          <el-option v-for="p in PET_LUT_NAMES" :key="p.key" :value="p.key" :label="p.name" />
        </el-select>
        <span class="canvas-hud__label">α</span>
        <el-slider v-model="volState.petAlpha" :min="0" :max="1" :step="0.05" size="small" class="canvas-hud__slider"
          :disabled="!volState.petOn" />
      </template>
    </template>
  </div>
</template>

<script lang="ts" setup>
/**
 * 2D 显示参数悬浮条(WL 预设/PET 叠加), 浮于 4 视图区底部中央。
 * 深色画布上的交互控件: 事件全部 stop 防止触发画布手势(右键拖 WL/滚轮翻层)。
 */
import { volState, wlPresets } from '../store'
import { jobConfig } from '@/states/job-config'
import { PET_LUT_NAMES } from '../data/presets'
import { i18n } from '@/locales'
import { View, Hide } from '@element-plus/icons-vue'

const t = (key: string) => i18n.global.t(key)

function applyPreset(key: string) {
  const p = wlPresets.find(p => p.key === key)
  if (!p) return
  volState.wlPresetKey = key
  volState.wl = { width: p.width, level: p.level }
}
</script>

<style scoped>
.canvas-hud {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--y-color-bg-elevated, #1d1d24);
  border: 1px solid var(--y-color-divider, #33333d);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  max-width: calc(100% - 16px);
  flex-wrap: wrap;
  justify-content: center;
}

.canvas-hud__preset {
  width: 104px;
}

.canvas-hud__wl {
  font-size: 12px;
  color: rgba(180, 235, 200, 0.9);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  white-space: nowrap;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
}

.canvas-hud__label {
  font-size: 12px;
  color: rgba(213, 213, 222, 0.9);
}

.canvas-hud__divider {
  width: 1px;
  height: 18px;
  background: var(--y-color-divider, #33333d);
}

.canvas-hud__pet-toggle {
  padding: 5px 8px;
  gap: 4px;
}

.canvas-hud__pet-wrap {
  display: inline-flex;
}

.canvas-hud__slider {
  width: 90px;
}
</style>

<!-- teleported=false 时下拉渲染在本组件内, 需非 scoped 暗色皮肤(画布区无 EP 主题先例) -->
<style lang="scss">
.canvas-hud__pop.el-select__popper {
  background: var(--y-color-bg-elevated, #1d1d24);
  border: 1px solid var(--y-color-divider, #33333d);

  .el-select-dropdown__item {
    color: #d5d5de;
    background: transparent;
  }

  .el-select-dropdown__item.is-hovering {
    background: var(--y-color-bg-deep, #2a2a33);
  }

  .el-select-dropdown__item.is-selected {
    color: #7fd4a0;
  }

  .el-popper__arrow::before {
    background: var(--y-color-bg-elevated, #1d1d24);
    border-color: var(--y-color-divider, #33333d);
  }
}
</style>
