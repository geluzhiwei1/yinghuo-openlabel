<template>
  <div v-if="volState.base" class="seg-op">
    <el-button-group>
      <el-tooltip v-for="tool in TOOLS" :key="tool.id"
        :content="`${t('nrrd.tool.' + tool.id)} (${tool.hotkey})`" placement="bottom" :show-after="400">
        <el-button type="primary" :class="{ 'is-tool-active': volState.activeTool === tool.id }"
          @click="toggleTool(tool.id)">
          <Icon :icon="tool.icon" />
        </el-button>
      </el-tooltip>
    </el-button-group>

    <el-button-group>
      <el-tooltip :content="t('nrrd.seg.undo')" placement="bottom" :show-after="400">
        <el-button type="primary" :disabled="!canUndo" @click="undoOne()">
          <Icon icon="lucide:undo-2" />
        </el-button>
      </el-tooltip>
      <el-tooltip :content="t('nrrd.seg.redo')" placement="bottom" :show-after="400">
        <el-button type="primary" :disabled="!canRedo" @click="redoOne()">
          <Icon icon="lucide:redo-2" />
        </el-button>
      </el-tooltip>
    </el-button-group>
  </div>

  <!-- 工具设置浮动卡片: 与 anno.html 工具弹框同款(Teleport + 可拖拽, 位置会话内记忆) -->
  <ToolSettingCard v-if="volState.base" tool-id="brush" :title="t('nrrd.tool.brush')" hotkey="B"
    :show="volState.activeTool === 'brush'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.brushSize')">
        <el-slider v-model="volState.brushRadius" :min="1" :max="BRUSH_MAX" show-input
          :show-input-controls="false" class="seg-card__slider" />
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipBrush') }}</li>
      <li>{{ t('nrrd.seg.tipNeedActive') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="sphereBrush" :title="t('nrrd.tool.sphereBrush')" hotkey="P"
    :show="volState.activeTool === 'sphereBrush'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.brushSize')">
        <el-slider v-model="volState.brushRadius" :min="1" :max="BRUSH_MAX" show-input
          :show-input-controls="false" class="seg-card__slider" />
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipSphere') }}</li>
      <li>{{ t('nrrd.seg.tipNeedActive') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="eraser" :title="t('nrrd.tool.eraser')" hotkey="E"
    :show="volState.activeTool === 'eraser'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.brushSize')">
        <el-slider v-model="volState.brushRadius" :min="1" :max="BRUSH_MAX" show-input
          :show-input-controls="false" class="seg-card__slider" />
      </el-form-item>
      <el-form-item :label="t('nrrd.seg.eraseScope')">
        <el-select :model-value="volState.eraserScope" @update:model-value="setEraseScope">
          <el-option value="active" :label="t('nrrd.seg.eraseActive')" />
          <el-option value="all" :label="t('nrrd.seg.eraseAll')" />
        </el-select>
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipBrush') }}</li>
      <li>{{ t('nrrd.seg.tipEraseScope') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="thresholdPaint" :title="t('nrrd.tool.thresholdPaint')" hotkey="T"
    :show="volState.activeTool === 'thresholdPaint'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.brushSize')">
        <el-slider v-model="volState.brushRadius" :min="1" :max="BRUSH_MAX" show-input
          :show-input-controls="false" class="seg-card__slider" />
      </el-form-item>
      <el-form-item :label="t('nrrd.seg.threshold')">
        <div class="seg-card__row">
          <el-input-number v-model="volState.thresholdRange.lo" :step="20" size="small" controls-position="right" />
          <span class="seg-card__num">~</span>
          <el-input-number v-model="volState.thresholdRange.hi" :step="20" size="small" controls-position="right" />
          <el-tooltip :content="t('nrrd.seg.pickThreshold')" placement="bottom" :show-after="400">
            <el-button type="primary" size="small" :aria-label="t('nrrd.seg.pickThreshold')" @click="pickThreshold">
              <Icon icon="lucide:pipette" />
            </el-button>
          </el-tooltip>
        </div>
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipThresholdPaint') }}</li>
      <li>{{ t('nrrd.seg.tipBrush') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="contour" :title="t('nrrd.tool.contour')" hotkey="C"
    :show="volState.activeTool === 'contour'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.snapEdges')">
        <el-switch v-model="volState.contourSnap" />
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipContour1') }}</li>
      <li>{{ t('nrrd.seg.tipContour2') }}</li>
      <li>{{ t('nrrd.seg.tipContour3') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="magicWand" :title="t('nrrd.tool.magicWand')" hotkey="W"
    :show="volState.activeTool === 'magicWand'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.wandCriterion')">
        <el-select :model-value="volState.wandCriterion" @update:model-value="setWandCriterion">
          <el-option value="tolerance" :label="t('nrrd.seg.wandByTolerance')" />
          <el-option value="threshold" :label="t('nrrd.seg.wandByThreshold')" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="volState.wandCriterion === 'tolerance'" :label="t('nrrd.seg.wandTolerance')">
        <el-input-number v-model="volState.wandTolerance" :min="1" :max="2000" :step="10" size="small"
          controls-position="right" />
      </el-form-item>
      <el-form-item v-if="volState.wandCriterion === 'threshold'" :label="t('nrrd.seg.threshold')">
        <div class="seg-card__row">
          <el-input-number v-model="volState.thresholdRange.lo" :step="20" size="small" controls-position="right" />
          <span class="seg-card__num">~</span>
          <el-input-number v-model="volState.thresholdRange.hi" :step="20" size="small" controls-position="right" />
          <el-tooltip :content="t('nrrd.seg.pickThreshold')" placement="bottom" :show-after="400">
            <el-button type="primary" size="small" :aria-label="t('nrrd.seg.pickThreshold')" @click="pickThreshold">
              <Icon icon="lucide:pipette" />
            </el-button>
          </el-tooltip>
        </div>
      </el-form-item>
      <el-form-item :label="t('nrrd.seg.wandScope')">
        <el-select :model-value="volState.wandScope" @update:model-value="setWandScope">
          <el-option value="slice" :label="t('nrrd.seg.wandSlice')" />
          <el-option value="volume" :label="t('nrrd.seg.wandVolume')" />
        </el-select>
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipWand') }}</li>
    </ol>
  </ToolSettingCard>

  <ToolSettingCard v-if="volState.base" tool-id="growCut" :title="t('nrrd.tool.growCut')" hotkey="G"
    :show="volState.activeTool === 'growCut'">
    <el-form label-width="auto">
      <el-form-item :label="t('nrrd.seg.brushSize')">
        <el-slider v-model="volState.brushRadius" :min="1" :max="BRUSH_MAX" show-input
          :show-input-controls="false" class="seg-card__slider" />
      </el-form-item>
      <el-form-item :label="t('nrrd.seg.seedKind')">
        <el-select :model-value="volState.growSeed" @update:model-value="setGrowSeed">
          <el-option value="fg" :label="t('nrrd.seg.seedFg')" />
          <el-option value="bg" :label="t('nrrd.seg.seedBg')" />
        </el-select>
      </el-form-item>
      <el-form-item label-width="0">
        <div class="seg-card__row">
          <el-button size="small" type="primary" :loading="growState.busy"
            :disabled="!growState.hasSeeds && !growState.busy" @click="runGrowCutApply()">
            {{ growState.busy ? `${Math.round(growState.progress * 100)}%` : t('nrrd.seg.runGrowCut') }}
          </el-button>
          <el-button size="small" :disabled="growState.busy || !growState.hasSeeds" @click="clearGrowCutSeeds()">
            {{ t('nrrd.seg.clearSeeds') }}
          </el-button>
        </div>
      </el-form-item>
    </el-form>
    <ol class="seg-card__tips">
      <li>{{ t('nrrd.seg.tipGrow1') }}</li>
      <li>{{ t('nrrd.seg.tipGrow2') }}</li>
    </ol>
  </ToolSettingCard>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'
import { volState, BRUSH_MAX, type ToolId } from '../store'
import { undoStack, undoTick } from '../seg/undoStack'
import { undoOne, redoOne } from '../seg/tools'
import { growState, runGrowCutApply, clearGrowCutSeeds } from '../seg/growCut'
import ToolSettingCard from './ToolSettingCard.vue'

const t = (key: string) => i18n.global.t(key)

const TOOLS: Array<{ id: ToolId; icon: string; hotkey: string }> = [
  { id: 'brush', icon: 'lucide:brush', hotkey: 'B' },
  { id: 'sphereBrush', icon: 'lucide:circle-dot', hotkey: 'P' },
  { id: 'eraser', icon: 'lucide:eraser', hotkey: 'E' },
  { id: 'thresholdPaint', icon: 'lucide:contrast', hotkey: 'T' },
  { id: 'contour', icon: 'lucide:spline', hotkey: 'C' },
  { id: 'magicWand', icon: 'lucide:wand-2', hotkey: 'W' },
  { id: 'growCut', icon: 'lucide:sprout', hotkey: 'G' },
]

const canUndo = computed(() => { void undoTick.value; return undoStack.canUndo })
const canRedo = computed(() => { void undoTick.value; return undoStack.canRedo })

function toggleTool(id: ToolId) {
  volState.activeTool = volState.activeTool === id ? 'none' : id
}
function setEraseScope(v: 'active' | 'all') { volState.eraserScope = v }
function setWandCriterion(v: 'tolerance' | 'threshold') { volState.wandCriterion = v }
function setWandScope(v: 'slice' | 'volume') { volState.wandScope = v }
function setGrowSeed(v: 'fg' | 'bg') { volState.growSeed = v }

/** 吸取交叉线处 HU 为阈值中心, 保持现有区间宽度 */
function pickThreshold() {
  const b = volState.base
  if (!b) return
  const { i, j, k } = volState.crosshair
  const idx = k * b.grid.dims[0] * b.grid.dims[1] + j * b.grid.dims[0] + i
  const hu = b.data[idx]
  let span = volState.thresholdRange.hi - volState.thresholdRange.lo
  if (span <= 0) span = 100
  volState.thresholdRange.lo = Math.round(hu - span / 2)
  volState.thresholdRange.hi = Math.round(hu + span / 2)
}
</script>

<style scoped>
/* 按钮外观交给全局 _component-patches.scss 的顶栏规则:
   #topbar-container 内 el-button--primary = 描边冷静风, .is-tool-active = 实心主色 */
.seg-op {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--y-spacing-2);
}

/* 浮动卡片内部(卡片骨架在 ToolSettingCard.vue) */
.seg-card__slider {
  width: 100%;
}

.seg-card__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.seg-card__num {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.seg-card__tips {
  margin: 8px 0 0;
  padding-left: 18px;
  text-align: left;
  font-size: 12px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

/* 卡片内表单行距收紧 */
:deep(.el-form-item) {
  margin-bottom: 8px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
