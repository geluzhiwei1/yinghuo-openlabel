<template>
  <el-row id="topbar-container">
    <el-col :span="1">
      <div class="h-full flex items-center">
      <img style="width: 35px;" src="@/assets/logo.png" :alt="t('aria.logo')" /></div>
    </el-col>
    <el-col :span="5">
      <div style="float: left" class="h-full flex items-center">
        <el-dropdown @command="handleCommand" class="menu-item" :teleported="true" popper-class="y-toolbar-popper">
          <span class="el-dropdown-link" >
            文件<Icon icon="lucide:arrow-down" class="el-icon--right" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="exportAnno">导入/导出</el-dropdown-item>
              <el-dropdown-item command="labelStatistics">标签统计</el-dropdown-item>
              <el-dropdown-item command="settings">系统设置</el-dropdown-item>
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
    <el-col :span="14">
      <div class="topbar-tools" ref="toolsContainer">
        <!-- Inline slots: each item is wrapped in a measured container.
             v-show keeps it mounted (so offsetWidth is readable) but removed from layout. -->
        <div class="toolbar-item" ref="itemImageRef" data-tb-id="image" v-show="!overflowed.includes('image')">
          <ImageOperation />
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
            <template v-if="overflowed.includes('image')">
              <div class="toolbar-overflow-section">导航 · NAVIGATE</div>
              <ImageOperation />
            </template>
            <template v-if="overflowed.includes('entity')">
              <div class="toolbar-overflow-section">工具 · TOOLS</div>
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
  <InterpolateObjectUI></InterpolateObjectUI>
  <ShortcutCheatsheet v-model:visible="shortcutDialogVisible"></ShortcutCheatsheet>
</template>

<script lang="tsx" setup>
import { ref, nextTick, onMounted } from 'vue'
import {
    ElRow,
  ElCol,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElPopover,
} from 'element-plus'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'

import Screenfull from '@/components/Screenfull.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { LocaleSelect } from '@/locales'

import AnnoStatistics from '@/views/statistics/AnnoStatistics.vue'
import SystemSettings from '../menu/SystemSettings.vue'
import DataImExport from '@/components/data-imex/DataImExport.vue'
import UserProfile from '@/components/UserProfile.vue'

import ImageOperation from './ImageOperation.vue'
import EntityOperation from './EntityOperation.vue'
import CommonOperation from '@/gui/CommonOperation.vue'
import ShortcutCheatsheet from './ShortcutCheatsheet.vue'

import { attrPanel, dataPanel } from '@/states/UiState'
import { commonChannel } from '../channel'
import { jobConfig } from '@/states/job-config'
import { i18n } from '@/locales'

import InterpolateObjectUI from '../../tools/ui/inpterpolate-object.vue'

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
// Caching at mount + mission-change sidesteps the chicken-and-egg.
//
// Items overflow left-to-right (image first, common last) because the
// rightmost CommonOperation group (undo/redo/save) is the most frequently
// used and should stay inline the longest.
const TOOLBAR_ITEM_IDS = ['image', 'entity', 'common'] as const
type ToolbarItemId = typeof TOOLBAR_ITEM_IDS[number]

const toolsContainer = ref<HTMLElement>()
const itemImageRef = ref<HTMLElement>()
const itemEntityRef = ref<HTMLElement>()
const itemCommonRef = ref<HTMLElement>()

const itemRefs: Record<ToolbarItemId, typeof itemImageRef> = {
  image: itemImageRef,
  entity: itemEntityRef,
  common: itemCommonRef,
}

const naturalWidths = ref<Record<string, number>>({})
const overflowed = ref<ToolbarItemId[]>([])

const OVERFLOW_TRIGGER_WIDTH = 30 // px reserved for the ⋯ button when shown

const measureNaturalWidths = () => {
  // Force-show everything momentarily so offsetWidth reads true widths.
  // We do this by temporarily clearing `overflowed`, reading widths on the
  // next paint, then recomputing. Vue batches the DOM update so users
  // don't see a flash.
  const previousOverflow = [...overflowed.value]
  overflowed.value = []
  nextTick(() => {
    for (const id of TOOLBAR_ITEM_IDS) {
      const el = itemRefs[id].value
      if (el) naturalWidths.value[id] = el.offsetWidth
    }
    recomputeOverflow()
    // If recomputation didn't change anything from previous, we're done.
    // Otherwise Vue will re-render with the new overflowed state.
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

  // Reserve space for the ⋯ trigger button
  const availableWidth = containerWidth - OVERFLOW_TRIGGER_WIDTH
  let cumulative = 0
  const newOverflow: ToolbarItemId[] = []
  for (const id of TOOLBAR_ITEM_IDS) {
    cumulative += naturalWidths.value[id] || 0
    if (cumulative > availableWidth) {
      newOverflow.push(id)
    }
  }
  // Only update if changed — avoids needless re-renders
  const changed =
    newOverflow.length !== overflowed.value.length ||
    newOverflow.some((id, i) => id !== overflowed.value[i])
  if (changed) overflowed.value = newOverflow
}

useResizeObserver(toolsContainer, () => {
  // On container resize, the items' natural widths haven't changed,
  // so we can recompute directly without re-measuring.
  recomputeOverflow()
})

// Re-measure when mission changes — different mission renders different
// tool buttons (e.g., BBox vs RBBox vs Semantic2d), so cached widths
// become stale.
const reMeasureOnMissionChange = () => {
  measureNaturalWidths()
}

onMounted(() => {
  nextTick(() => {
    measureNaturalWidths()
  })
})

// Expose for tests / external triggers
defineExpose({ recomputeOverflow, measureNaturalWidths, reMeasureOnMissionChange })
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

/* Right-side action buttons — consistent bare-icon style */
.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  height: 100%;
}

:deep(.header-action) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--y-radius-sm);
  cursor: pointer;
  color: var(--y-color-text-regular);
  transition: background var(--y-duration-base) var(--y-ease-in-out),
              color var(--y-duration-base) var(--y-ease-in-out);
  outline: none;
}

:deep(.header-action:hover) {
  background: var(--y-color-bg-hover);
  color: var(--y-color-text-primary);
}

:deep(.header-action:active) {
  background: var(--y-color-bg-active);
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
