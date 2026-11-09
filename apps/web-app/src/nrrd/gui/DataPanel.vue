<template>
  <div class="data-panel">
    <div class="data-panel__bar">{{ t('nrrd.data.title', { n: frames.length }) }}</div>
    <div class="data-panel__list">
      <template v-if="groups">
        <div v-for="g in groups" :key="g.patient" class="data-panel__group-wrap">
          <div class="data-panel__group" @click="toggleGroup(g.patient)">
            <el-icon class="data-panel__caret" :class="{ 'is-collapsed': collapsed.has(g.patient) }">
              <CaretRight />
            </el-icon>
            <span class="data-panel__patient">{{ g.patient }}</span>
            <span v-if="g.patientName" class="data-panel__pname" :title="g.patientName">{{ g.patientName }}</span>
            <span class="data-panel__count">{{ t('nrrd.data.frames', { n: g.frames.length }) }}</span>
          </div>
          <div v-for="f in g.frames" v-show="!collapsed.has(g.patient)" :key="String(f.key)" class="data-panel__item"
            :class="{ 'is-active': f.key === jobConfig.frame }" @click="selectFrame(f.key)">
            <span class="data-panel__idx">{{ Number(f.key) + 1 }}</span>
            <div class="data-panel__body">
              <div class="data-panel__name" :title="f.name">
                <span v-if="petState(f.key) === 'pet'" class="data-panel__chip">{{ t('nrrd.data.petChip') }}</span>
                <span v-else-if="petState(f.key) === 'ctOnly'" class="data-panel__chip data-panel__chip--ct">{{ t('nrrd.data.ctOnly') }}</span>
                {{ f.name }}
              </div>
              <div v-if="f.sub" class="data-panel__sub">{{ f.sub }}</div>
            </div>
            <span v-if="segsOf(f.key)" class="data-panel__segs"
              :title="t('nrrd.data.segsBadge', { n: segsOf(f.key)!.segments })">
              {{ segsOf(f.key)!.segments }}<i v-if="segsOf(f.key)!.ai" class="data-panel__segs-ai">AI</i>
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="f in frames" :key="String(f.key)" class="data-panel__item"
          :class="{ 'is-active': f.key === jobConfig.frame }" @click="selectFrame(f.key)">
          <span class="data-panel__idx">{{ Number(f.key) + 1 }}</span>
          <span class="data-panel__name" :title="f.name">
            <span v-if="petState(f.key) === 'pet'" class="data-panel__chip">{{ t('nrrd.data.petChip') }}</span>
            <span v-else-if="petState(f.key) === 'ctOnly'" class="data-panel__chip data-panel__chip--ct">{{ t('nrrd.data.ctOnly') }}</span>
            {{ f.name }}
          </span>
          <span v-if="segsOf(f.key)" class="data-panel__segs"
            :title="t('nrrd.data.segsBadge', { n: segsOf(f.key)!.segments })">
            {{ segsOf(f.key)!.segments }}<i v-if="segsOf(f.key)!.ai" class="data-panel__segs-ai">AI</i>
          </span>
        </div>
      </template>
      <div v-if="!frames.length" class="data-panel__empty">{{ t('nrrd.data.empty') }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { CaretRight } from '@element-plus/icons-vue'
import { dataSeqState } from '@/states/DataSeqState'
import { jobConfig } from '@/states/job-config'
import { i18n } from '@/locales'
import { labelApi } from '@/api'
import { volState } from '../store'
import { fetchStreamMeta } from '../api'

const t = (key: string, args?: any) => i18n.global.t(key, args ?? {})

// PET 配对徽标: 融合任务(声明 pet 流)按 pet 流 meta 的帧键集判断,
// 该帧有 pet 数据 → PET 标;任务要融合但这帧没有 → 仅CT 标;meta 拉不到 → 不显示(不误导)
const petFrames = ref<Set<string> | null>(null)
const jobHasPet = computed(() => jobConfig.streams.includes('pet'))
watch(jobHasPet, has => {
  if (!has) { petFrames.value = null; return }
  fetchStreamMeta('pet')
    .then(meta => { petFrames.value = new Set(Object.keys(meta?.openlabel?.frames ?? {})) })
    .catch(() => { petFrames.value = null })
}, { immediate: true })

function petState(key: number | string): 'pet' | 'ctOnly' | 'none' {
  if (!jobHasPet.value || petFrames.value === null) return 'none'
  return petFrames.value.has(String(key)) ? 'pet' : 'ctOnly'
}

// 已标注徽章: 帧级 segment 概要(服务端聚合, 含 AI 预标注标记);
// savedAt 在保存/批量导入成功后 bump, 作为刷新信号
interface FrameSegs { segments: number; ai: boolean }
const frameSegs = ref<Map<string, FrameSegs>>(new Map())

function refreshSegs() {
  if (!jobConfig.inited) return   // seq/uuid 异步填充, 未就绪不发
  labelApi.volume_frames_summary({
    uuid: jobConfig.uuid, seq: jobConfig.seq, stream: jobConfig.stream,
    current_mission: 'volumeSegment3d',
  }).then(res => {
    const fr = res?.data?.frames ?? {}
    const m = new Map<string, FrameSegs>()
    for (const [k, v] of Object.entries(fr)) {
      if ((v as any)?.segments > 0) m.set(k, v as FrameSegs)
    }
    frameSegs.value = m
  }).catch(() => { /* 概要拉不到只是无徽章, 不阻断 */ })
}

watch(() => `${jobConfig.inited}:${volState.savedAt}`, refreshSegs, { immediate: true })

function segsOf(key: number | string): FrameSegs | undefined {
  return frameSegs.value.get(String(key))
}

interface FrameRow { key: number | string; name: string; sub?: string }

const frames = computed<FrameRow[]>(() => {
  const fr = (dataSeqState.streamMeta as any)?.openlabel?.frames ?? {}
  return Object.keys(fr)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => {
      const props = fr[k]?.frame_properties ?? {}
      const parts = [props.studyDate, props.studyDesc].filter(Boolean)
      const modality = props.pairedModality
        ? `${props.modality || ''}+${props.pairedModality}` : props.modality
      if (modality) parts.push(modality)
      return {
        key: Number.isNaN(Number(k)) ? k : Number(k),
        name: props.name || props.uri || `frame ${k}`,
        sub: parts.join(' · '),
        patient: props.patient || '',
        patientName: props.patientName || '',
      }
    })
})

interface PatientGroup { patient: string; patientName: string; frames: FrameRow[] }

// 任一帧带 patient 元数据(manifest/导入链路)→ 按患者分组;否则平面渲染(legacy job 兼容)
const groups = computed<PatientGroup[] | null>(() => {
  const rows = frames.value as any[]
  if (!rows.some(r => r.patient)) return null
  const order: string[] = []
  const byPatient = new Map<string, PatientGroup>()
  for (const r of rows) {
    const pid = r.patient || 'UNKNOWN'
    let g = byPatient.get(pid)
    if (!g) {
      g = { patient: pid, patientName: r.patientName || '', frames: [] }
      byPatient.set(pid, g)
      order.push(pid)
    }
    if (!g.patientName && r.patientName) g.patientName = r.patientName
    g.frames.push(r)
  }
  return order.map(pid => byPatient.get(pid)!)
})

const collapsed = ref(new Set<string>())

function toggleGroup(patient: string) {
  if (collapsed.value.has(patient)) collapsed.value.delete(patient)
  else collapsed.value.add(patient)
}

function selectFrame(key: number | string) {
  if (key !== jobConfig.frame) jobConfig.frame = key as number
}
</script>

<style scoped>
.data-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  overflow: hidden;
}
.data-panel__bar {
  height: 32px;
  line-height: 32px;
  padding: 0 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}
.data-panel__list {
  flex: 1;
  overflow-y: auto;
}
.data-panel__group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-extra-light);
  cursor: pointer;
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-panel__group:hover { background: var(--el-fill-color); }
.data-panel__caret {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.15s;
  flex-shrink: 0;
}
.data-panel__caret.is-collapsed { transform: rotate(0deg); }
.data-panel__caret:not(.is-collapsed) { transform: rotate(90deg); }
.data-panel__patient { color: var(--el-text-color-primary); }
.data-panel__pname {
  color: var(--el-text-color-secondary);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.data-panel__count {
  color: var(--el-text-color-secondary);
  font-weight: 400;
  font-size: 11px;
  flex-shrink: 0;
}
.data-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.data-panel__item:hover { background: var(--el-fill-color-light); }
.data-panel__item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.data-panel__idx {
  width: 24px;
  text-align: right;
  color: var(--el-text-color-secondary);
  font-family: var(--y-font-family-mono, monospace);
  flex-shrink: 0;
}
.data-panel__body {
  flex: 1;
  overflow: hidden;
}
.data-panel__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-panel__chip {
  display: inline-block;
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 15px;
  vertical-align: 1px;
  color: #7a2d00;
  background: #ffb56b;
}
.data-panel__chip--ct {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.data-panel__segs {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  line-height: 16px;
  font-family: var(--y-font-family-mono, monospace);
  color: #144d2b;
  background: #bfe8cd;
  justify-content: center;
}
.data-panel__segs-ai {
  font-style: normal;
  font-size: 9px;
  line-height: 10px;
  padding: 0 3px;
  border-radius: 5px;
  color: #7a2d00;
  background: #ffb56b;
}
.data-panel__sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-panel__empty {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
