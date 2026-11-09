<template>
  <div class="attr-panel">
    <div class="attr-panel__bar">{{ t('nrrd.attr.title') }}</div>
    <div class="attr-panel__body">
      <template v-if="volState.base">
        <div class="attr-panel__section">
          <div class="attr-panel__title">
            <span>Segments</span>
            <span class="attr-panel__title-btns">
              <el-button size="small" text type="primary" @click="addSegment()">
                <el-icon><Plus /></el-icon>{{ t('nrrd.seg.create') }}
              </el-button>
              <el-button size="small" text type="primary" :loading="importing" @click="fileRef?.click()">
                <el-icon v-if="!importing"><Upload /></el-icon>{{ t('nrrd.seg.import') }}
              </el-button>
              <el-button v-if="inferModels" size="small" text type="primary" @click="aiVisible = true">
                <el-icon><MagicStick /></el-icon>{{ t('nrrd.ai.btn') }}
              </el-button>
              <el-button v-if="modelSegCount" size="small" text type="success" @click="acceptAll">
                <el-icon><Check /></el-icon>{{ t('nrrd.seg.acceptAll') }}
              </el-button>
            </span>
          </div>
          <AiSegment v-model="aiVisible" :models="inferModels" />
          <input ref="fileRef" type="file" class="attr-panel__file" accept=".nrrd,.nii,.gz" @change="onImportFile" />

          <div v-if="!segState.segments.length" class="attr-panel__hint">
            {{ t('nrrd.seg.emptyHint') }}
          </div>
          <div v-for="s in segState.segments" :key="s.id" class="seg-row"
            :class="{ 'is-active': s.id === segState.activeId }" @click="segState.activeId = s.id">
            <span class="seg-row__radio" :class="{ 'is-on': s.id === segState.activeId }" />
            <el-color-picker v-model="s.color" size="small" :predefine="PALETTE" @change="onStyleChange(s.id)"
              @click.stop />
            <input v-model="s.name" class="seg-row__name" size="small" @click.stop @focus="renameOld = s.name"
              @change="onRename(s)" />
            <span v-if="s.origin === 'model'" class="seg-row__ai" :title="t('nrrd.seg.modelTag')">AI</span>
            <span class="seg-row__count" :title="`${s.voxelCount} voxels`">{{ segVolume(s) }}</span>
            <button v-if="s.origin === 'model'" class="seg-row__btn" :title="t('nrrd.seg.accept')"
              @click.stop="acceptSegment(s.id)">
              <el-icon><Check /></el-icon>
            </button>
            <button class="seg-row__btn" :title="`${t('nrrd.seg.interpolate')} (I)`" :disabled="interpId === s.id"
              @click.stop="interpolateRow(s)">
              <el-icon><SetUp /></el-icon>
            </button>
            <button class="seg-row__btn" :title="s.visible ? t('nrrd.seg.hide') : t('nrrd.seg.show')"
              @click.stop="toggleVisible(s)">
              <el-icon><View v-if="s.visible" /><Hide v-else /></el-icon>
            </button>
            <button class="seg-row__btn seg-row__btn--danger" :title="t('nrrd.seg.remove')" @click.stop="removeSegment(s.id)">
              <el-icon><Delete /></el-icon>
            </button>
            <el-select v-if="categories.length" v-model="s.taxonomyKey" class="seg-row__tax"
              size="small" :placeholder="t('nrrd.seg.category')" @change="markSegmentDirty(s.id)" @click.stop>
              <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            </el-select>
          </div>
        </div>
        <div class="attr-panel__section">
          <div class="attr-panel__title">{{ t('nrrd.attr.volume') }}</div>
          <div class="kv"><span>{{ t('nrrd.attr.dims') }}</span><b>{{ dimsText }}</b></div>
          <div class="kv"><span>{{ t('nrrd.attr.spacing') }}</span><b>{{ spacingText }}</b></div>
          <div class="kv"><span>{{ t('nrrd.attr.modality') }}</span><b>{{ volState.base.modality.toUpperCase() }}</b></div>
          <div class="kv" v-if="volState.overlay"><span>{{ t('nrrd.attr.fusion') }}</span><b>{{ t('nrrd.attr.fusedRegistered') }} · {{ t(volState.petOn ? 'nrrd.attr.fusedOn' : 'nrrd.attr.fusedOff') }}</b></div>
        </div>
        <div class="attr-panel__section">
          <div class="attr-panel__title">{{ t('nrrd.attr.display') }}</div>
          <div class="kv row">
            <span>{{ t('nrrd.attr.labelOpacity') }}</span>
            <el-slider v-model="volState.labelAlpha" :min="0" :max="1" :step="0.05" size="small" />
            <b>{{ volState.labelAlpha.toFixed(2) }}</b>
          </div>
        </div>
      </template>
      <div v-else class="attr-panel__hint">{{ t('nrrd.attr.notLoaded') }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, View, Hide, Delete, Upload, SetUp, MagicStick, Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { openlabelApi, volumeInferApi } from '@/api'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)
import { jobConfig } from '@/states/job-config'
import { volState } from '../store'
import { segState, addSegment, removeSegment, acceptSegment, bumpSegRender, markSegmentDirty, PALETTE } from '../seg/segments'
import { parseSegmentationBytes } from '../data/segImport'
import { applyImportedSegmentation } from '../seg/importSeg'
import { runSliceInterpolation } from '../seg/interpolate'
import AiSegment from './AiSegment.vue'

const dimsText = computed(() => volState.base?.grid.dims.join(' × ') ?? '')
const spacingText = computed(() =>
  volState.base?.grid.spacing.map(s => s.toFixed(2)).join(' × ') ?? '')

function toggleVisible(s: { visible: boolean }) {
  s.visible = !s.visible
  bumpSegRender()
}

// 审核模式: 模型预标注段(origin='model')可采纳
const modelSegCount = computed(() => segState.segments.filter(s => s.origin === 'model').length)
function acceptAll() {
  segState.segments.filter(s => s.origin === 'model').forEach(s => acceptSegment(s.id))
}

function onStyleChange(id: number) {
  markSegmentDirty(id)
  bumpSegRender()
}

// ── 改名防呆: 空名回退, 重名拒绝 ──────────────────────────
let renameOld = ''
function onRename(s: { name: string; id: number }) {
  const v = s.name.trim()
  const dup = segState.segments.some(o => o !== s && o.name === v)
  if (!v || dup) {
    s.name = renameOld
    ElMessage.warning(t(v ? 'nrrd.seg.nameDup' : 'nrrd.seg.nameEmpty'))
    return
  }
  s.name = v
  markSegmentDirty(s.id)
}

/** 体素数 → 临床体积(spacing 已知) */
function segVolume(s: { voxelCount: number }): string {
  const sp = volState.base?.grid.spacing
  if (!sp || !s.voxelCount) return String(s.voxelCount)
  const mm3 = s.voxelCount * sp[0] * sp[1] * sp[2]
  return mm3 >= 1000 ? `${(mm3 / 1000).toFixed(mm3 >= 10000 ? 1 : 2)} cm³` : `${mm3.toFixed(0)} mm³`
}

// 导入分割(.seg.nrrd / 多标签 nrrd / labelmap nii)
const fileRef = ref<HTMLInputElement>()
const importing = ref(false)

// AI 分割(B1): 探测 med-seg 可用性, 503/失败 → 按钮隐藏
const inferModels = ref<Array<{ id: string; label: string; requires: string[]; device?: string }> | null>(null)
const aiVisible = ref(false)
watch(() => volState.base, async base => {
  inferModels.value = base ? await volumeInferApi.models() : null
}, { immediate: true })

// 跨层插值: 逐行触发(作用于该 segment)
const interpId = ref(0)
async function interpolateRow(s: { id: number }) {
  if (interpId.value) return
  segState.activeId = s.id
  interpId.value = s.id
  try {
    await runSliceInterpolation()
  } finally {
    interpId.value = 0
  }
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || importing.value) return
  const grid = volState.base?.grid
  if (!grid) return
  importing.value = true
  try {
    const buf = await file.arrayBuffer()
    await nextTick() // 先让按钮进 loading 态再跑同步解析
    const parsed = parseSegmentationBytes(buf, grid)
    const changed = applyImportedSegmentation(parsed.labels, parsed.segments)
    ElMessage.success(t('nrrd.seg.imported', { n: parsed.segments.length, voxels: changed }))
  } catch (err: any) {
    ElMessage.error(`${file.name}: ${err?.message ?? err}`)
  } finally {
    importing.value = false
  }
}

// 任务 taxonomy 的类别(叶节点名), 供 segment 分类
const categories = ref<string[]>([])
watch(() => jobConfig.inited, async (v) => {
  if (!v) return
  const t: any = jobConfig.taxonomy
  if (!t?.key) return
  try {
    const res = await openlabelApi.query({ taxonomy: t, domain: t.domain })
    const spec = res?.data?.[0]
    const root = spec?.openlabel?.classes?.[0]
    if (!root) return
    const names: string[] = []
    const walk = (n: any) => {
      if (n.children?.length) n.children.forEach(walk)
      else names.push(n.name)
    }
    if (root.children?.length) root.children.forEach(walk)
    categories.value = names
  } catch { /* 无 taxonomy 时 select 不显示 */ }
}, { immediate: true })
</script>

<style scoped>
.attr-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  overflow: hidden;
}

.attr-panel__bar {
  height: 32px;
  line-height: 32px;
  padding: 0 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.attr-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.attr-panel__section {
  margin-bottom: 14px;
}

.attr-panel__title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  padding-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 3px 2px;
}

.kv.row span { flex-shrink: 0; }
.kv.row .el-slider { flex: 1; }
.kv b {
  font-weight: 500;
  font-family: var(--y-font-family-mono, monospace);
}

.attr-panel__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px 2px;
}

.attr-panel__file {
  display: none;
}

.attr-panel__title-btns {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.seg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  flex-wrap: wrap;
}

.seg-row:hover {
  background: var(--el-fill-color-light);
}

.seg-row.is-active {
  background: var(--el-fill-color);
}

.seg-row__radio {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--el-text-color-secondary);
  flex-shrink: 0;
}

.seg-row__radio.is-on {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.seg-row__name {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 12px;
  outline: none;
  padding: 2px;
}

.seg-row__name:focus {
  border-bottom: 1px dashed var(--el-border-color);
}

.seg-row__count {
  font-family: var(--y-font-family-mono, monospace);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.seg-row__ai {
  font-size: 10px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 3px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  flex-shrink: 0;
}

.seg-row__tax {
  width: 100%;
  flex-shrink: 0;
}

.seg-row__btn {
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  font-size: 14px;
}

.seg-row__btn:hover {
  color: var(--el-color-primary);
}

.seg-row__btn--danger:hover {
  color: var(--el-color-danger);
}
</style>
