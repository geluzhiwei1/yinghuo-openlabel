<template>
  <div class="workbench">
    <!-- 左:Unit 列表 -->
    <aside class="col-left">
      <UnitListPanel
        :instances="instances"
        :total="total"
        :loading="loadingList"
        :current-instance-id="currentInstance?.id ?? null"
        @select="onSelectInstance"
        @reload="loadInstances"
      />
    </aside>

    <!-- 中:标签预览 + 操作栏 -->
    <section class="col-center">
      <div class="action-bar" v-if="currentInstance">
        <div class="action-info">
          <span class="info-eyebrow">UNIT</span>
          <span class="info-item">
            <code>#{{ currentInstance.unit_id }}</code>
          </span>
          <span class="info-divider">/</span>
          <span class="info-eyebrow">STAGE</span>
          <span class="info-item">
            <code>{{ currentInstance.current_stage }}</code>
          </span>
          <span
            v-if="currentInstance.current_status === 'arbitrate'"
            class="status-chip status-chip--warn"
          >
            <span class="status-chip__dot" />
            仲裁中
          </span>
          <span
            v-if="currentInstance.sample_skipped"
            class="status-chip status-chip--info"
          >
            该 unit 抽样跳过
          </span>
        </div>
        <div class="action-buttons">
          <button
            class="lab-act lab-act--approve"
            :disabled="submitting"
            :class="{ 'is-loading': submitting }"
            @click="onApprove"
            v-permiss="'business:review:approve'"
          >
            <Icon icon="lucide:check" :width="16" />
            <span>通过</span>
            <kbd>A</kbd>
          </button>
          <button
            class="lab-act lab-act--reject"
            :disabled="submitting"
            @click="onReject"
            v-permiss="'business:review:reject'"
          >
            <Icon icon="lucide:x" :width="16" />
            <span>驳回</span>
            <kbd>R</kbd>
          </button>
          <button
            class="lab-act lab-act--ghost"
            @click="prev"
            :disabled="!canPrev"
          >
            <Icon icon="lucide:arrow-up" :width="16" />
            <kbd>K</kbd>
          </button>
          <button
            class="lab-act lab-act--ghost"
            @click="next"
            :disabled="!canNext"
          >
            <Icon icon="lucide:arrow-down" :width="16" />
            <kbd>J</kbd>
          </button>
        </div>
      </div>

      <LabelPreview
        :unit-id="currentInstance?.unit_id ?? null"
        :label="currentLabel"
        :loading="loadingDetail"
      />
    </section>

    <!-- 右:历史 / Diff -->
    <aside class="col-right">
      <HistoryPanel
        :instance="currentInstance"
        :latest-version="currentLabel?.version ?? null"
      />
    </aside>

    <!-- 驳回弹窗(复用 review 的) -->
    <RejectDialog
      v-model="rejectDialogVisible"
      :submitting="submitting"
      @submit="onRejectSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import UnitListPanel from '@/review/components/UnitListPanel.vue'
import LabelPreview from '@/review/components/LabelPreview.vue'
import HistoryPanel from '@/review/components/HistoryPanel.vue'
import RejectDialog from '@/review/components/RejectDialog.vue'
import { useReviewShortcuts } from '@/review/composables/useReviewShortcuts'
import { useHelpOverlay } from '@/review/composables/useHelpOverlay'
import { useQaSession } from '../composables/useQaSession'
import type { WorkflowInstance } from '@/types/api'

const {
  instances,
  total,
  loadingList,
  currentInstance,
  currentLabel,
  loadingDetail,
  selectedIndex,
  bootstrap,
  loadInstances,
  loadCoverage,
  selectInstance,
  next,
  prev,
  approveCurrent,
  rejectCurrent,
} = useQaSession()

const help = useHelpOverlay()
const rejectDialogVisible = ref(false)
const submitting = ref(false)

const canNext = computed(() => selectedIndex.value < instances.value.length - 1)
const canPrev = computed(() => selectedIndex.value > 0)

useReviewShortcuts({
  onNext: () => next(),
  onPrev: () => prev(),
  onApprove: () => onApprove(),
  onReject: () => onReject(),
  onHelp: () => help.toggle(),
})

const onSelectInstance = (inst: WorkflowInstance) => {
  selectInstance(inst)
}

const onApprove = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    await approveCurrent()
  } finally {
    submitting.value = false
  }
}

const onReject = () => {
  if (!currentInstance.value) {
    ElMessage.warning('未选中任何 unit')
    return
  }
  rejectDialogVisible.value = true
}

const onRejectSubmit = async (reason: {
  category: string
  severity: string
  note?: string
}) => {
  if (submitting.value) return
  submitting.value = true
  try {
    const updated = await rejectCurrent(reason)
    if (updated) {
      rejectDialogVisible.value = false
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await bootstrap()
  await Promise.all([loadInstances(), loadCoverage()])
  if (instances.value.length > 0 && !currentInstance.value) {
    await selectInstance(instances.value[0])
  }
})
</script>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  height: 100%;
  overflow: hidden;
  background: var(--lab-paper);
}
.col-left,
.col-right {
  height: 100%;
  overflow: hidden;
}
.col-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-hairline, #ececea);
  flex-shrink: 0;
}
.action-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--lab-slate);
}

.info-eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--lab-ash);
}

.info-divider {
  color: var(--lab-fog);
  margin: 0 2px;
}

.info-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.info-item code {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  background: var(--lab-cream);
  color: var(--lab-ink);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: var(--lab-radius-pill, 999px);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.04em;
  margin-left: 4px;
}

.status-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-chip--warn {
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
}

.status-chip--warn .status-chip__dot {
  background: var(--lab-coral);
  animation: lab-blink 1.6s ease-in-out infinite;
}

.status-chip--info {
  background: var(--lab-cream);
  color: var(--lab-slate);
  border: 1px dashed var(--lab-line);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lab-act {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 36px;
  border-radius: var(--lab-radius-pill, 999px);
  border: 1px solid var(--lab-line);
  background: var(--lab-snow);
  color: var(--lab-ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease, color 150ms ease, border-color 150ms ease;
}

.lab-act kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--lab-cream);
  border: 1px solid var(--lab-line);
  color: var(--lab-slate);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
}

.lab-act:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14,14,16,0.08);
}

.lab-act:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lab-act--approve {
  background: var(--lab-ink);
  color: var(--lab-snow);
  border-color: var(--lab-ink);
}

.lab-act--approve kbd {
  background: rgba(200,250,75,0.18);
  border-color: rgba(200,250,75,0.4);
  color: var(--lab-lime);
}

.lab-act--approve:hover:not(:disabled) {
  background: var(--lab-graphite);
}

.lab-act--reject {
  background: var(--lab-coral);
  color: var(--lab-snow);
  border-color: var(--lab-coral);
}

.lab-act--reject kbd {
  background: rgba(255,255,255,0.18);
  border-color: rgba(255,255,255,0.3);
  color: var(--lab-snow);
}

.lab-act--reject:hover:not(:disabled) {
  background: #e85a30;
}

.lab-act--ghost {
  padding: 0;
  width: 36px;
  justify-content: center;
}

.lab-act--ghost kbd {
  display: none;
}

.lab-act.is-loading {
  pointer-events: none;
  opacity: 0.7;
}

@media (max-width: 1280px) {
  .workbench {
    grid-template-columns: 260px 1fr 320px;
  }
}
</style>
