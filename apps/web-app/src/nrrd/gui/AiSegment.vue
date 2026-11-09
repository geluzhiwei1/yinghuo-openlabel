<template>
  <el-dialog v-model="visible" :title="t('nrrd.ai.title')" width="460px" append-to-body
    :close-on-click-modal="step !== 'running'">
    <!-- 1) 模型选择 -->
    <template v-if="step === 'models'">
      <div v-if="!usableModels.length" class="ai-seg__empty">{{ t('nrrd.ai.noModels') }}</div>
      <el-checkbox-group v-model="checked">
        <div v-for="m in usableModels" :key="m.id" class="ai-seg__model">
          <el-checkbox :value="m.id">
            <span class="ai-seg__model-name">{{ m.label }}</span>
          </el-checkbox>
          <span class="ai-seg__model-req">{{ reqText(m) }}</span>
        </div>
      </el-checkbox-group>
      <div v-if="cpuOnly" class="ai-seg__warn">{{ t('nrrd.ai.cpuWarn') }}</div>
      <div class="ai-seg__foot">
        <el-button size="small" @click="visible = false">{{ t('action.cancel') }}</el-button>
        <el-button size="small" type="primary" :disabled="!checked.length" @click="run">
          {{ t('nrrd.ai.run') }}
        </el-button>
      </div>
    </template>

    <!-- 2) 运行中 -->
    <template v-else-if="step === 'running'">
      <el-progress :percentage="pct" :stroke-width="10" />
      <div class="ai-seg__hint">{{ runHint }}</div>
    </template>

    <!-- 3) 结构选择(TotalSegmentator 多结构) -->
    <template v-else-if="step === 'select'">
      <div class="ai-seg__presets">
        <el-button size="small" text type="primary" @click="preset('all')">{{ t('nrrd.ai.presetAll') }}</el-button>
        <el-button size="small" text type="primary" @click="preset('organ')">{{ t('nrrd.ai.presetOrgan') }}</el-button>
        <el-button size="small" text type="primary" @click="preset('bone')">{{ t('nrrd.ai.presetBone') }}</el-button>
        <el-button size="small" text type="primary" @click="preset('vessel')">{{ t('nrrd.ai.presetVessel') }}</el-button>
      </div>
      <div class="ai-seg__list">
        <div v-for="s in parsed!.segments" :key="s.value" class="ai-seg__row"
          :class="{ 'is-on': selected.has(s.value) }" @click="toggle(s.value)">
          <el-checkbox :model-value="selected.has(s.value)" @change="toggle(s.value)" @click.stop />
          <span class="ai-seg__name">{{ s.name }}</span>
          <span class="ai-seg__count">{{ s.voxelCount.toLocaleString() }}</span>
        </div>
      </div>
      <div class="ai-seg__foot">
        <el-button size="small" @click="visible = false">{{ t('action.cancel') }}</el-button>
        <el-button size="small" type="primary" :disabled="!selected.size" @click="apply">
          {{ t('nrrd.ai.apply') }}<template v-if="selected.size"> ({{ selected.size }})</template>
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
/**
 * AI 分割对话框(B1): 模型选择(按任务流过滤) → 轮询推理 → 结构选择 → 导入。
 * autoPET 单结构任务跳过选择直接导入; 导入走 applyImportedSegmentation(单条 undo)。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'
import { volumeInferApi } from '@/api'
import { jobConfig } from '@/states/job-config'
import { volState } from '../store'
import { parseSegmentationBytes, type ParsedSegmentation } from '../data/segImport'
import { applyImportedSegmentation } from '../seg/importSeg'

const t = (key: string) => i18n.global.t(key)

const props = defineProps<{
  models: Array<{ id: string; label: string; requires: string[]; device?: string }> | null
}>()

const visible = defineModel<boolean>({ default: false })

type Step = 'models' | 'running' | 'select'
const step = ref<Step>('models')
const checked = ref<string[]>([])
const pct = ref(0)
const parsed = ref<ParsedSegmentation | null>(null)
const selected = ref(new Set<number>())
let timer: ReturnType<typeof setTimeout> | null = null

/** 模型可用性 = 所需流当前任务都有(pet 流 ⟺ fusionMode) */
const usableModels = computed(() =>
  (props.models || []).filter(m => m.requires.every(r => r === 'ct' || (r === 'pet' && volState.fusionMode))))
const cpuOnly = computed(() =>
  usableModels.value.some(m => m.device === 'cpu') && !usableModels.value.some(m => m.device === 'gpu'))
const runHint = computed(() =>
  step.value === 'running' ? `${t('nrrd.ai.running')} ${pct.value}%` : '')

function reqText(m: { requires: string[] }) {
  return m.requires.join(' + ').toUpperCase()
}

watch(visible, v => {
  if (v) {
    step.value = 'models'
    pct.value = 0
    parsed.value = null
    selected.value = new Set()
    checked.value = usableModels.value.length === 1 ? [usableModels.value[0].id] : ['total-segmentator']
      .filter(id => usableModels.value.some(m => m.id === id))
  } else {
    stopPoll()
  }
})

function stopPoll() {
  if (timer) { clearTimeout(timer); timer = null }
}

async function run() {
  step.value = 'running'
  pct.value = 0
  try {
    const { task_id } = await volumeInferApi.create(jobConfig.uuid, jobConfig.stream, jobConfig.frame, checked.value)
    await poll(task_id)
  } catch (e: any) {
    fail(e)
  }
}

function fail(e: any) {
  stopPoll()
  step.value = 'models'
  ElMessage.error(`${t('nrrd.ai.failed')}: ${e?.message ?? e}`)
}

async function poll(taskId: string) {
  try {
    const st = await volumeInferApi.status(taskId)
    if (!visible.value) return
    if (st.status === 'failed') throw new Error(st.error || 'inference failed')
    pct.value = Math.round((st.progress || 0) * 100)
    if (st.status === 'done' && st.mask_url) {
      const buf = await volumeInferApi.mask(st.mask_url)
      const grid = volState.base?.grid
      if (!grid) throw new Error(t('nrrd.attr.notLoaded'))
      const p = parseSegmentationBytes(buf, grid)
      if (p.segments.length <= 1) {
        finish(p, new Set(p.segments.map(s => s.value)))
        return
      }
      parsed.value = p
      selected.value = new Set()
      step.value = 'select'
      return
    }
    timer = setTimeout(() => poll(taskId), 1000)
  } catch (e: any) {
    fail(e)
  }
}

/** 结构名关键词 → 预设(TotalSegmentator 英文名; PET Lesion 不属于任何预设) */
const PRESETS: Record<string, RegExp> = {
  organ: /liver|lung|heart|spleen|kidney|pancrea|brain|stomach|intestin|bladder|prostate|uterus|thyroid|gallbladder|esophagus|trachea/i,
  bone: /bone|rib|vertebr|spin|femur|hip|skull|pelv|clavicle|scapula|humerus|sacrum|sternum/i,
  vessel: /vessel|aorta|arter|vein|portal|iliac|carotid/i,
}

function preset(kind: 'all' | 'organ' | 'bone' | 'vessel') {
  const segs = parsed.value?.segments || []
  if (kind === 'all') {
    selected.value = new Set(segs.map(s => s.value))
    return
  }
  const re = PRESETS[kind]
  selected.value = new Set(segs.filter(s => re.test(s.name)).map(s => s.value))
}

function toggle(value: number) {
  const s = new Set(selected.value)
  if (s.has(value)) s.delete(value)
  else s.add(value)
  selected.value = s
}

function apply() {
  if (!parsed.value) return
  finish(parsed.value, selected.value)
}

function finish(p: ParsedSegmentation, values: Set<number>) {
  const segs = p.segments.filter(s => values.has(s.value))
  if (!segs.length) {
    step.value = 'select'
    return
  }
  stopPoll()
  const voxels = applyImportedSegmentation(p.labels, segs)
  ElMessage.success(t('nrrd.ai.applied', { n: segs.length, voxels: voxels.toLocaleString() }))
  visible.value = false
}
</script>

<style scoped>
.ai-seg__model {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.ai-seg__model-name {
  font-size: 13px;
}

.ai-seg__model-req {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: var(--y-font-family-mono, monospace);
}

.ai-seg__warn {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-warning);
}

.ai-seg__empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px 0;
}

.ai-seg__hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.ai-seg__presets {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.ai-seg__list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.ai-seg__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px;
  cursor: pointer;
  font-size: 12px;
}

.ai-seg__row:hover {
  background: var(--el-fill-color-light);
}

.ai-seg__row.is-on {
  background: var(--el-fill-color);
}

.ai-seg__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-seg__count {
  font-family: var(--y-font-family-mono, monospace);
  color: var(--el-text-color-secondary);
}

.ai-seg__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
