<template>
  <div class="y-gs-attrpanel">
    <div class="y-gs-attrpanel__bar">
      <Icon icon="lucide:sliders-horizontal" :width="14" />
      <span>编辑 · EDIT</span>
    </div>

    <div class="y-gs-attrpanel__body">
      <!-- Selection mode -->
      <section class="y-gs-section">
        <div class="y-gs-section__title">选择模式</div>
        <div class="y-gs-mode-grid">
          <button
            v-for="opt in MODE_OPTS"
            :key="opt.value"
            class="y-gs-mode"
            :class="{ 'y-gs-mode--active': gaussianState.selectionMode === opt.value }"
            @click="setMode(opt.value)"
            :disabled="!gaussianState.loaded"
            :title="opt.hint"
          >
            <Icon :icon="opt.icon" :width="16" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
        <p class="y-gs-section__hint" v-if="gaussianState.loaded">
          <template v-if="gaussianState.selectionMode === 'click'">单击选中 · Shift+单击 多选</template>
          <template v-else-if="gaussianState.selectionMode === 'box'">拖拽框选 · Shift+拖拽 追加</template>
          <template v-else-if="gaussianState.selectionMode === 'brush'">按住左键拖拽涂抹 · 可指定写入当前标签</template>
          <template v-else>关闭选择后,左键拖动旋转视角</template>
        </p>
      </section>

      <!-- Brush settings (only when brush mode active) -->
      <section class="y-gs-section" v-if="gaussianState.selectionMode === 'brush'">
        <div class="y-gs-section__title">笔刷</div>
        <div class="y-gs-row">
          <span class="y-gs-brush-label">大小</span>
          <el-slider
            v-model="brushRadiusProxy"
            :min="4"
            :max="120"
            :step="1"
            :format-tooltip="(v: number) => `${v}px`"
            style="flex: 1;"
          />
          <span class="y-gs-num y-gs-brush-num">{{ gaussianState.brushRadiusPx }}px</span>
        </div>
        <div class="y-gs-row">
          <el-button-group>
            <el-button
              size="small"
              :type="gaussianState.brushOp === 'add' ? 'primary' : 'default'"
              @click="gaussianState.brushOp = 'add'"
            >
              <Icon icon="lucide:plus" :width="14" /> 添加
            </el-button>
            <el-button
              size="small"
              :type="gaussianState.brushOp === 'remove' ? 'danger' : 'default'"
              @click="gaussianState.brushOp = 'remove'"
            >
              <Icon icon="lucide:minus" :width="14" /> 擦除
            </el-button>
          </el-button-group>
        </div>
        <div class="y-gs-row y-gs-row--center">
          <el-switch
            v-model="brushAutoProxy"
            size="small"
            :disabled="gaussianState.labels.length === 0"
          />
          <span class="y-gs-section__hint" style="margin: 0;">
            直接涂抹到当前标签
            <span v-if="gaussianState.currentLabelId" class="y-gs-num">
              ({{ currentLabelName }})
            </span>
          </span>
        </div>
        <p class="y-gs-section__hint">
          快捷键:按住 <kbd>X</kbd> 临时切换擦除;按住 <kbd>Shift</kbd> 可强制添加。
        </p>
      </section>

      <!-- Selection actions -->
      <section class="y-gs-section" v-if="gaussianState.loaded">
        <div class="y-gs-section__title">当前选中 ({{ gaussianState.selection.size.toLocaleString() }})</div>
        <div class="y-gs-row">
          <el-button
            size="small"
            @click="assignSelection"
            :disabled="gaussianState.selection.size === 0 || !currentLabel"
          >
            <Icon icon="lucide:tag" :width="14" /> 分配给当前标签
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            @click="deleteSelection"
            :disabled="gaussianState.selection.size === 0"
          >
            <Icon icon="lucide:eraser" :width="14" /> 删除/隐藏
          </el-button>
        </div>
        <div class="y-gs-row">
          <el-button
            size="small"
            plain
            @click="clearSelection"
            :disabled="gaussianState.selection.size === 0"
          >
            <Icon icon="lucide:x" :width="14" /> 清空选中
          </el-button>
          <el-button
            size="small"
            plain
            @click="invertSelection"
            :disabled="gaussianState.count === 0"
          >
            <Icon icon="lucide:shuffle" :width="14" /> 反选
          </el-button>
        </div>
      </section>

      <!-- Label management -->
      <section class="y-gs-section" v-if="gaussianState.loaded">
        <div class="y-gs-section__title-row">
          <span class="y-gs-section__title">标签</span>
          <el-switch
            v-model="showColorsProxy"
            inline-prompt
            size="small"
            active-text="配色"
            inactive-text="配色"
            width="40"
          />
        </div>
        <div class="y-gs-label-add">
          <el-input
            v-model="newLabelName"
            placeholder="新标签名 (Enter 创建)"
            size="small"
            @keyup.enter="addLabel"
          />
          <el-color-picker v-model="newLabelColor" size="small" />
          <el-button size="small" @click="addLabel" :disabled="!newLabelName.trim()">
            <Icon icon="lucide:plus" :width="14" />
          </el-button>
        </div>
        <ul class="y-gs-labels" v-if="gaussianState.labels.length > 0">
          <li
            v-for="label in gaussianState.labels"
            :key="label.id"
            class="y-gs-label"
            :class="{ 'y-gs-label--active': gaussianState.currentLabelId === label.id }"
            @click="gaussianState.currentLabelId = label.id"
          >
            <span class="y-gs-label__swatch" :style="{ background: label.color }" />
            <span class="y-gs-label__name" :title="label.name">{{ label.name }}</span>
            <span class="y-gs-label__count">{{ label.indices.length.toLocaleString() }}</span>
            <button class="y-gs-label__del" @click.stop="removeLabel(label.id)" title="删除标签">
              <Icon icon="lucide:x" :width="12" />
            </button>
          </li>
        </ul>
        <p v-else class="y-gs-section__hint">尚未创建标签。命名后按 Enter 添加。</p>
      </section>

      <!-- Render params -->
      <section class="y-gs-section">
        <div class="y-gs-section__title">粒子尺寸</div>
        <el-slider
          v-model="sizeProxy"
          :min="0.1"
          :max="3"
          :step="0.05"
          :format-tooltip="(v: number) => v.toFixed(2)"
        />
      </section>

      <section class="y-gs-section">
        <div class="y-gs-section__title">不透明度倍率</div>
        <el-slider
          v-model="densityProxy"
          :min="0.05"
          :max="1.5"
          :step="0.05"
          :format-tooltip="(v: number) => v.toFixed(2)"
        />
      </section>

      <section class="y-gs-section">
        <div class="y-gs-section__title">背景色</div>
        <div class="y-gs-row">
          <el-color-picker v-model="gaussianState.sceneColor" size="small" />
          <el-button-group>
            <el-button size="small" @click="gaussianState.sceneColor = '#0e0e10'">深</el-button>
            <el-button size="small" @click="gaussianState.sceneColor = '#f7f6f2'">浅</el-button>
            <el-button size="small" @click="gaussianState.sceneColor = '#1c1c20'">中性</el-button>
          </el-button-group>
        </div>
      </section>

      <section class="y-gs-section" v-if="gaussianState.loaded">
        <div class="y-gs-section__title">隐藏 / 删除</div>
        <p class="y-gs-section__hint">
          已隐藏 <span class="y-gs-num">{{ gaussianState.hidden.size.toLocaleString() }}</span> 个 splat。本会话内有效,导出元数据 JSON 会保留索引列表。
        </p>
        <el-button
          size="small"
          plain
          @click="clearHidden"
          :disabled="gaussianState.hidden.size === 0"
        >
          <Icon icon="lucide:rotate-ccw" :width="14" /> 恢复全部
        </el-button>
      </section>

      <section class="y-gs-section">
        <div class="y-gs-section__title">提示</div>
        <ul class="y-gs-tips">
          <li>左键拖动 · 旋转视角</li>
          <li>右键拖动 · 平移视角</li>
          <li>滚轮 · 缩放</li>
          <li>选择模式开启时,视角控制自动让位</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { gaussianState, LABEL_PALETTE, type SelectionMode } from '../state'

const MODE_OPTS: Array<{ value: SelectionMode; label: string; icon: string; hint: string }> = [
  { value: 'off',   label: '浏览', icon: 'lucide:hand',       hint: '关闭选择,纯浏览' },
  { value: 'click', label: '单选', icon: 'lucide:mouse-pointer-2', hint: '单击拾取最近 splat' },
  { value: 'box',   label: '框选', icon: 'lucide:square-dashed',   hint: '拖拽矩形批量选中' },
  { value: 'brush', label: '涂抹', icon: 'lucide:paintbrush-2',    hint: '笔刷涂抹,可写入当前标签' },
]

const setMode = (m: SelectionMode) => {
  gaussianState.selectionMode = m
  if (m === 'off') gaussianState.selection.clear()
}

const sizeProxy = computed({
  get: () => gaussianState.pointSize,
  set: (v: number) => { gaussianState.pointSize = v },
})
const densityProxy = computed({
  get: () => gaussianState.density,
  set: (v: number) => { gaussianState.density = v },
})
const showColorsProxy = computed({
  get: () => gaussianState.showLabelColors,
  set: (v: boolean) => { gaussianState.showLabelColors = v },
})
const brushRadiusProxy = computed({
  get: () => gaussianState.brushRadiusPx,
  set: (v: number) => { gaussianState.brushRadiusPx = v },
})
const brushAutoProxy = computed({
  get: () => gaussianState.brushAutoAssign,
  set: (v: boolean) => { gaussianState.brushAutoAssign = v },
})

const currentLabelName = computed(() => {
  const id = gaussianState.currentLabelId
  if (!id) return ''
  return gaussianState.labels.find((l) => l.id === id)?.name ?? ''
})

// ─── Label management ────────────────────────────────
const newLabelName = ref('')
const newLabelColor = ref(LABEL_PALETTE[0])

const addLabel = () => {
  const name = newLabelName.value.trim()
  if (!name) return
  // Pick the next palette slot not yet used
  const used = new Set(gaussianState.labels.map((l) => l.color))
  const color = gaussianState.labels.length < LABEL_PALETTE.length
    ? LABEL_PALETTE[gaussianState.labels.length]
    : newLabelColor.value
  const id = `label-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const label = { id, name, color, indices: [] as number[] }
  gaussianState.labels.push(label)
  gaussianState.currentLabelId = id
  // Advance palette for the swatch picker
  const idx = LABEL_PALETTE.indexOf(color)
  newLabelColor.value = LABEL_PALETTE[(idx + 1) % LABEL_PALETTE.length]
  newLabelName.value = ''
  void used
}

const removeLabel = (id: string) => {
  const idx = gaussianState.labels.findIndex((l) => l.id === id)
  if (idx === -1) return
  gaussianState.labels.splice(idx, 1)
  if (gaussianState.currentLabelId === id) {
    gaussianState.currentLabelId = gaussianState.labels[0]?.id ?? null
  }
}

const currentLabel = computed(() =>
  gaussianState.labels.find((l) => l.id === gaussianState.currentLabelId) ?? null,
)

const assignSelection = () => {
  const label = currentLabel.value
  if (!label || gaussianState.selection.size === 0) return
  const existing = new Set(label.indices)
  for (const i of gaussianState.selection) {
    if (!existing.has(i)) {
      label.indices.push(i)
      existing.add(i)
    }
  }
  // Remove from other labels (one splat = one label)
  for (const other of gaussianState.labels) {
    if (other.id === label.id) continue
    other.indices = other.indices.filter((i) => !existing.has(i))
  }
  ElMessage.success(`已分配 ${gaussianState.selection.size} 个 splat 给「${label.name}」`)
  gaussianState.selection.clear()
}

const deleteSelection = () => {
  if (gaussianState.selection.size === 0) return
  const n = gaussianState.selection.size
  for (const i of gaussianState.selection) gaussianState.hidden.add(i)
  // Also strip from labels
  const sel = new Set(gaussianState.selection)
  for (const label of gaussianState.labels) {
    label.indices = label.indices.filter((i) => !sel.has(i))
  }
  gaussianState.selection.clear()
  ElMessage.info(`已隐藏 ${n.toLocaleString()} 个 splat`)
}

const clearSelection = () => {
  gaussianState.selection.clear()
}

const invertSelection = () => {
  const next = new Set<number>()
  for (let i = 0; i < gaussianState.count; i++) {
    if (gaussianState.hidden.has(i)) continue
    if (!gaussianState.selection.has(i)) next.add(i)
  }
  gaussianState.selection.clear()
  for (const i of next) gaussianState.selection.add(i)
}

const clearHidden = () => {
  gaussianState.hidden.clear()
}
</script>

<style scoped lang="scss">
.y-gs-attrpanel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--y-color-bg-card, #fbfaf5);
  font-size: 12px;
}

.y-gs-attrpanel__bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 32px;
  border-bottom: 1px solid var(--y-color-divider, #e6e4dc);
  color: var(--y-color-text-secondary, #3f4046);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.y-gs-attrpanel__body {
  flex: 1;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.y-gs-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.y-gs-section__title {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--y-color-text-placeholder, #8a8b92);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.y-gs-section__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.y-gs-section__hint {
  font-size: 11px;
  color: var(--y-color-text-placeholder, #8a8b92);
  line-height: 1.5;
  margin: 0;
}

.y-gs-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.y-gs-row--center {
  align-items: center;
}

.y-gs-brush-label {
  font-size: 11px;
  color: var(--y-color-text-secondary, #3f4046);
}

.y-gs-brush-num {
  min-width: 38px;
  text-align: right;
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  background: var(--y-color-bg-hover, #f0eee5);
  border: 1px solid var(--y-color-divider, #e6e4dc);
  border-radius: 3px;
  color: var(--y-color-text-regular, #3f4046);
}

.y-gs-mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.y-gs-mode {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 10px;
  border: 1px solid var(--y-color-divider, #e6e4dc);
  background: var(--y-color-bg-card, #ffffff);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--y-color-text-regular, #3f4046);
  transition: all 120ms ease;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    border-color: var(--y-color-primary, #c0503e);
    color: var(--y-color-primary, #c0503e);
  }
}
.y-gs-mode--active {
  background: var(--lab-ink, #0e0e10);
  color: var(--lab-snow, #ffffff);
  border-color: var(--lab-ink, #0e0e10);
}

.y-gs-label-add {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px;
  align-items: center;
}

.y-gs-labels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.y-gs-label {
  display: grid;
  grid-template-columns: 14px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--y-color-divider, #e6e4dc);
  background: var(--y-color-bg-card, #ffffff);
  cursor: pointer;
  font-size: 11.5px;
  transition: all 120ms ease;

  &:hover { border-color: var(--y-color-border-strong, #c0bcb0); }
}
.y-gs-label--active {
  border-color: var(--lab-ink, #0e0e10);
  box-shadow: inset 0 0 0 1px var(--lab-ink, #0e0e10);
}

.y-gs-label__swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
.y-gs-label__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--y-color-text-primary, #0e0e10);
}
.y-gs-label__count {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  color: var(--y-color-text-placeholder, #8a8b92);
}
.y-gs-label__del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--y-color-text-placeholder, #8a8b92);
  cursor: pointer;
  border-radius: 4px;

  &:hover { color: var(--lab-coral, #ff6a3d); background: rgba(255, 106, 61, 0.1); }
}

.y-gs-tips {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: var(--y-color-text-secondary, #3f4046);
  line-height: 1.8;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}

.y-gs-num {
  color: var(--y-color-text-primary, #0e0e10);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}
</style>
