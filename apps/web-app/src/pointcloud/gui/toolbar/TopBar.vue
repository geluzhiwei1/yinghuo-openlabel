<template>
  <el-row id="topbar-container">
    <el-col :span="1">
      <div class="h-full flex items-center">
      <img style="width: 35px;" src="@/assets/logo.png" :alt="t('aria.logo')" /></div>
    </el-col>
    <el-col :span="3">
      <div class="h-full flex items-center">
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link" >
            文件<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="exportAnno">导入/导出</el-dropdown-item>
              <el-dropdown-item command="labelStatistics">标签统计</el-dropdown-item>
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
                <Icon :icon="attrPanel.width_px > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>属性栏
              </el-dropdown-item>
              <el-dropdown-item command="dataPanel">
                <Icon :icon="dataPanel.panelWidth > 0 ? 'mdi:show-outline' : 'mdi:hide-outline'"></Icon>数据栏
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link">
            帮助<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="shortcuts">{{ t('shortcutCheatsheet.title') }}</el-dropdown-item>
              <el-dropdown-item command="hotkeys"><el-link href="#" target="_blank" :aria-label="t('aria.viewHelp')">使用文档</el-link></el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-col>
    <el-col :span="16">
      <div class="topbar-tools" ref="toolsContainer">
        <!-- Inline slots: each item is wrapped in a measured container.
             v-show keeps it mounted (so offsetWidth is readable) but removed from layout. -->
        <div class="toolbar-item" ref="itemFrameRef" data-tb-id="frame" v-show="!overflowed.includes('frame')">
          <FrameOperation />
          <div class="topbar-divider" />
        </div>
        <div class="toolbar-item" ref="itemEntityRef" data-tb-id="entity" v-show="!overflowed.includes('entity')">
          <EntityOperation />
          <div class="topbar-divider" />
        </div>
        <div class="toolbar-item" ref="itemCommonRef" data-tb-id="common" v-show="!overflowed.includes('common')">
          <CommonOperation />
        </div>

        <!-- Overflow trigger: shown only when something overflowed -->
        <el-popover
          v-if="overflowed.length > 0"
          placement="bottom-end"
          :width="340"
          trigger="click"
          popper-class="y-toolbar-overflow"
          :offset="4"
        >
          <template #reference>
            <button class="toolbar-overflow-trigger" :aria-label="t('action.more')">
              <Icon icon="lucide:ellipsis-vertical" />
            </button>
          </template>
          <div class="toolbar-overflow-body">
            <template v-if="overflowed.includes('frame')">
              <div class="toolbar-overflow-section">帧 · FRAME</div>
              <FrameOperation />
            </template>
            <template v-if="overflowed.includes('entity')">
              <div class="toolbar-overflow-section">对象 · OBJECTS</div>
              <EntityOperation />
            </template>
            <template v-if="overflowed.includes('common')">
              <div class="toolbar-overflow-section">操作 · OPS</div>
              <CommonOperation />
            </template>
          </div>
        </el-popover>

        <el-link type="danger" href="https://github.com/geluzhiwei1/yinghuo-openlabel" target="_blank" class="topbar-feedback">需求/建议</el-link>
      </div>
    </el-col>
    <el-col :span="4">
      <div class="header-actions">
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
  <ShortcutCheatsheet v-model:visible="shortcutDialogVisible"></ShortcutCheatsheet>
</template>

<script lang="tsx" setup>
import { ref, nextTick, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'

import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { LocaleSelect } from '@/locales'

import AnnoStatistics from '@/views/statistics/AnnoStatistics.vue'
import SystemSettings from '../menu/SystemSettings.vue'
import DataImExport from '@/components/data-imex/DataImExport.vue'
import UserProfile from '@/components/UserProfile.vue'

import FrameOperation from './FrameOperation.vue'
import EntityOperation from './object-toolbar.vue'
import CommonOperation from '../../../gui/CommonOperation.vue'
import ShortcutCheatsheet from '../../../video/toolbar/ShortcutCheatsheet.vue'

import { attrPanel, dataPanel } from '@/states/UiState'
import { commonChannel } from '../../channel'
import { jobConfig } from '@/states/job-config'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

const dataImExportRef = ref(null)
const systemSettings = ref(null)
const annoStatisticsRef = ref(null)
const shortcutDialogVisible = ref(false)

// ─── Overflow menu logic ─────────────────────────────
// Each toolbar item is measured once (natural width when nothing is hidden),
// then on every container resize we walk the items left-to-right and mark
// overflowed any item whose cumulative width exceeds the available space.
//
// Why natural widths are cached: once v-show hides an item, its offsetWidth
// becomes 0 and we can't recover the original width without re-showing it.
// Caching at mount sidesteps the chicken-and-egg.
//
// Items overflow left-to-right (frame first, common last) because the
// rightmost CommonOperation group (undo/redo/save) is the most frequently
// used and should stay inline the longest.
const TOOLBAR_ITEM_IDS = ['frame', 'entity', 'common'] as const
type ToolbarItemId = typeof TOOLBAR_ITEM_IDS[number]

const toolsContainer = ref<HTMLElement>()
const itemFrameRef = ref<HTMLElement>()
const itemEntityRef = ref<HTMLElement>()
const itemCommonRef = ref<HTMLElement>()

const itemRefs: Record<ToolbarItemId, typeof itemFrameRef> = {
  frame: itemFrameRef,
  entity: itemEntityRef,
  common: itemCommonRef,
}

const naturalWidths = ref<Record<string, number>>({})
const overflowed = ref<ToolbarItemId[]>([])

const OVERFLOW_TRIGGER_WIDTH = 30 // px reserved for the ⋯ button when shown

const measureNaturalWidths = () => {
  // Force-show everything momentarily so offsetWidth reads true widths.
  const previousOverflow = [...overflowed.value]
  overflowed.value = []
  nextTick(() => {
    for (const id of TOOLBAR_ITEM_IDS) {
      const el = itemRefs[id].value
      if (el) naturalWidths.value[id] = el.offsetWidth
    }
    recomputeOverflow()
    void previousOverflow
  })
}

const recomputeOverflow = () => {
  const container = toolsContainer.value
  if (!container) return
  const containerWidth = container.clientWidth

  let total = 0
  for (const id of TOOLBAR_ITEM_IDS) {
    total += naturalWidths.value[id] || 0
  }

  if (total <= containerWidth) {
    if (overflowed.value.length !== 0) overflowed.value = []
    return
  }

  const availableWidth = containerWidth - OVERFLOW_TRIGGER_WIDTH
  let cumulative = 0
  const newOverflow: ToolbarItemId[] = []
  for (const id of TOOLBAR_ITEM_IDS) {
    cumulative += naturalWidths.value[id] || 0
    if (cumulative > availableWidth) {
      newOverflow.push(id)
    }
  }
  const changed =
    newOverflow.length !== overflowed.value.length ||
    newOverflow.some((id, i) => id !== overflowed.value[i])
  if (changed) overflowed.value = newOverflow
}

useResizeObserver(toolsContainer, () => {
  recomputeOverflow()
})

onMounted(() => {
  nextTick(() => {
    measureNaturalWidths()
  })
})

defineExpose({ recomputeOverflow, measureNaturalWidths })
// ──────────────────────────────────────────────────────

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
    case 'shortcuts':
      shortcutDialogVisible.value = true
      break;
    default:
      break;
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
  /* 强制单行:窗口变窄时由 .topbar-tools 的 overflow: hidden + overflow 菜单吸收溢出,
     而不是把右侧 header-actions 挤到第二行。 */
  flex-wrap: nowrap;
}

/* el-col 默认 min-width: auto,会被内部内容(35px logo / 下拉菜单文字等)撑大,
   导致百分比宽度失效、整行换行。允许 col 收缩到内容以下,宽度回归百分比。 */
#topbar-container :deep(.el-col) {
  min-width: 0;
}

/* 左右两侧的 col 撑住固定宽度,中间 col 收纳剩余空间。 */
#topbar-container :deep(.el-col-16) {
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

.topbar-tools {
  display: flex;
  align-items: center;
  gap: var(--y-spacing-2);
  // nowrap + hidden overflow: items stay on one row, overflow gets clipped
  // and recovered by the overflow-menu logic above.
  flex-wrap: nowrap;
  overflow: hidden;
  min-width: 0;
}

.toolbar-item {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--y-spacing-2);
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--y-color-divider);
  flex-shrink: 0;
  margin-left: 2px;
}

.topbar-feedback {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
}

.toolbar-overflow-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--y-color-border);
  border-radius: var(--y-radius-sm);
  background: var(--y-color-bg-card);
  color: var(--y-color-text-regular);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--y-color-bg-hover);
    color: var(--y-color-text-primary);
    border-color: var(--y-color-border-strong);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}
</style>
