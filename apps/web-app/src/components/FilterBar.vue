<template>
  <div class="y-filter-bar">
    <div class="y-filter-bar__body">
      <slot />
    </div>
    <div class="y-filter-bar__actions">
      <slot name="actions">
        <el-button @click="onReset">
          <Icon icon="lucide:refresh-cw" class="y-filter-bar__action-icon" />
          {{ t('action.reset') }}
        </el-button>
        <el-button type="primary" @click="onSearch">
          <Icon icon="lucide:search" class="y-filter-bar__action-icon" />
          {{ t('action.search') }}
        </el-button>
      </slot>
    </div>
    <div v-if="presets.length || showSaveInput" class="y-filter-bar__presets">
      <span class="y-filter-bar__presets-label">
        <Icon icon="lucide:bookmark" />
        {{ t('filter.savedViews') }}:
      </span>
      <el-tag
        v-for="(preset, i) in presets"
        :key="i"
        :type="activePresetIndex === i ? 'primary' : 'info'"
        effect="plain"
        class="y-filter-bar__preset"
        @click="applyPreset(preset, i)"
        @close="removePreset(i)"
        closable
      >
        {{ preset.name }}
      </el-tag>
      <el-input
        v-if="showSaveInput"
        v-model="newPresetName"
        size="small"
        class="y-filter-bar__preset-input"
        :placeholder="t('filter.viewName')"
        @keyup.enter="savePreset"
        @blur="cancelSave"
      />
      <el-button
        v-else
        size="small"
        link
        :disabled="!canSavePreset"
        @click="showSaveInput = true"
      >
        <Icon icon="lucide:plus" />
        {{ t('filter.saveCurrent') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

export interface FilterPreset {
  name: string
  value: any
}

interface Props {
  modelValue?: any
  storageKey?: string
  maxPresets?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  storageKey: '',
  maxPresets: 5,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const presets = ref<FilterPreset[]>([])
const showSaveInput = ref(false)
const newPresetName = ref('')
const activePresetIndex = ref<number>(-1)

const storagePath = computed(() => `yh:filter-presets:${props.storageKey}`)
const canSavePreset = computed(() => Boolean(props.storageKey))

const loadPresets = () => {
  if (!props.storageKey) return
  try {
    const raw = localStorage.getItem(storagePath.value)
    if (raw) presets.value = JSON.parse(raw) || []
  } catch {
    presets.value = []
  }
}

const persistPresets = () => {
  if (!props.storageKey) return
  try {
    localStorage.setItem(storagePath.value, JSON.stringify(presets.value))
  } catch (e) {
    ElMessage.warning('视图保存失败，本地存储不可用')
  }
}

const savePreset = () => {
  const name = newPresetName.value.trim()
  if (!name) {
    showSaveInput.value = false
    return
  }
  if (presets.value.length >= props.maxPresets) {
    ElMessage.warning(`最多保存 ${props.maxPresets} 个视图`)
    showSaveInput.value = false
    newPresetName.value = ''
    return
  }
  presets.value.push({ name, value: JSON.parse(JSON.stringify(props.modelValue)) })
  persistPresets()
  activePresetIndex.value = presets.value.length - 1
  showSaveInput.value = false
  newPresetName.value = ''
  ElMessage.success(`视图「${name}」已保存`)
}

const cancelSave = () => {
  showSaveInput.value = false
  newPresetName.value = ''
}

const applyPreset = (preset: FilterPreset, index: number) => {
  emit('update:modelValue', JSON.parse(JSON.stringify(preset.value)))
  activePresetIndex.value = index
  emit('search')
}

const removePreset = (index: number) => {
  const removed = presets.value[index]
  presets.value.splice(index, 1)
  persistPresets()
  if (activePresetIndex.value === index) activePresetIndex.value = -1
  else if (activePresetIndex.value > index) activePresetIndex.value -= 1
  ElMessage.success(`视图「${removed.name}」已删除`)
}

const onSearch = () => {
  activePresetIndex.value = -1
  emit('search')
}

const onReset = () => {
  activePresetIndex.value = -1
  emit('reset')
}

watch(
  () => props.storageKey,
  () => loadPresets(),
  { immediate: true },
)
</script>

<style scoped>
.y-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.y-filter-bar__body {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-end;
}

.y-filter-bar__body > * {
  flex: 0 0 auto;
}

.y-filter-bar__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 4px;
}

.y-filter-bar__action-icon {
  margin-right: 4px;
  vertical-align: -2px;
}

.y-filter-bar__presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--lab-line);
  font-size: 12px;
}

.y-filter-bar__presets-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--lab-ash);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-right: 4px;
}

.y-filter-bar__preset {
  cursor: pointer;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.y-filter-bar__preset-input {
  width: 160px;
}

.y-filter-bar__preset-input :deep(.el-input__wrapper) {
  border-radius: var(--lab-radius-lg, 8px);
}
</style>
