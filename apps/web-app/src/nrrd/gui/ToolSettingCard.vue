<template>
  <Teleport to="#_Draggable_teleport">
    <Draggable class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
      :storage-key="'yh-nrrd-tool-pos-' + toolId" storage-type="session"
      v-show="show" :resizeable="true" :style="cardStyle" :handle="dragHandle">
      <div ref="dragHandle" class="tool-card__handle" :title="t('nrrd.toolCard.dragHint')">
        <Icon icon="lucide:grip-horizontal" class="tool-card__grip" />
        <span class="tool-card__title">{{ title }}</span>
        <el-tag v-if="hotkey" size="small">{{ hotkey }}</el-tag>
      </div>
      <el-card shadow="never" class="tool-card__body">
        <slot />
      </el-card>
    </Draggable>
  </Teleport>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'

withDefaults(defineProps<{ toolId: string; title: string; hotkey?: string; show?: boolean }>(), {
  hotkey: '', show: false,
})

const t = (key: string) => i18n.global.t(key)

const dragHandle = ref<HTMLElement | null>(null)
const cardStyle = {
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
}
</script>

<style scoped>
/* 标题条即拖拽把手: 与卡身同底拼成一张卡, 用 --y-* 令牌跟随 dark/light(同 nrrd 顶栏) */
.tool-card__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--y-color-text-primary);
  background: var(--y-color-bg-card);
  border: 1px solid var(--y-color-border);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  cursor: move;
  user-select: none;
  transition: background var(--y-duration-base) var(--y-ease-out);
}

.tool-card__handle:hover {
  background: var(--y-color-bg-hover);
}

.tool-card__grip {
  flex-shrink: 0;
  color: var(--y-color-text-secondary);
}

.tool-card__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 覆盖 styles/lab/_ep-bridge.scss 的全局 .el-card{background:var(--lab-snow)}:
   lab 调色板无暗色变体, 会让暗色主题下卡片保持白底白字; 这里改绑 --y-* 令牌,
   并去掉顶边框/顶圆角与上方标题条拼合 */
:deep(.el-card.tool-card__body) {
  background: var(--y-color-bg-card) !important;
  border: 1px solid var(--y-color-border) !important;
  border-top: none !important;
  border-radius: 0 0 10px 10px !important;
}

/* 卡内输入类控件跟随主题: ep-bridge 的 cream 底同为 lab 静态色, 暗色下过亮 */
:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  background: var(--y-color-bg-hover) !important;
  box-shadow: 0 0 0 1px var(--y-color-border-strong) inset !important;
}

:deep(.el-input__inner) {
  color: var(--y-color-text-primary);
}

:deep(.el-input-number__increase),
:deep(.el-input-number__decrease) {
  background: transparent;
}
</style>
