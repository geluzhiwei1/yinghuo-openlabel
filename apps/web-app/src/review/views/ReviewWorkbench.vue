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
          <span class="info-item">
            <span class="info-item__label">UNIT</span>
            <code class="info-item__code">#{{ currentInstance.unit_id }}</code>
          </span>
          <span class="info-item">
            <span class="info-item__label">STAGE</span>
            <code class="info-item__code">{{ currentInstance.current_stage }}</code>
          </span>
          <span v-if="currentInstance.current_status === 'arbitrate'" class="arb-chip">
            <span class="arb-chip__dot" />
            仲裁中
          </span>
        </div>
        <div class="action-buttons">
          <button
            class="act-btn act-btn--approve"
            :disabled="submitting"
            @click="onApprove"
            v-permiss="'business:review:approve'"
          >
            <Icon icon="lucide:check" :width="16" />
            <span>通过</span>
            <kbd>A</kbd>
          </button>
          <button
            class="act-btn act-btn--reject"
            :disabled="submitting"
            @click="onReject"
            v-permiss="'business:review:reject'"
          >
            <Icon icon="lucide:x" :width="16" />
            <span>驳回</span>
            <kbd>R</kbd>
          </button>
          <button class="act-ghost" @click="prev" :disabled="!canPrev">
            <Icon icon="lucide:arrow-up" :width="14" />
            <kbd>K</kbd>
          </button>
          <button class="act-ghost" @click="next" :disabled="!canNext">
            <Icon icon="lucide:arrow-down" :width="14" />
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

    <!-- 驳回弹窗 -->
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
import UnitListPanel from '../components/UnitListPanel.vue'
import LabelPreview from '../components/LabelPreview.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import RejectDialog from '../components/RejectDialog.vue'
import { useReviewSession } from '../composables/useReviewSession'
import { useReviewShortcuts } from '../composables/useReviewShortcuts'
import { useHelpOverlay } from '../composables/useHelpOverlay'
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
  selectInstance,
  next,
  prev,
  approveCurrent,
  rejectCurrent,
} = useReviewSession()

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
  await loadInstances()
  // 默认选第一个,方便立刻开干
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

/* ── Action bar ──────────────────────────────── */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: var(--lab-snow);
  border-bottom: 1px solid var(--lab-hairline);
  flex-shrink: 0;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.info-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.info-item__label {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--lab-ash);
}

.info-item__code {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  background: var(--lab-cream);
  color: var(--lab-ink);
  padding: 2px 8px;
  border-radius: var(--lab-radius-pill, 999px);
  font-size: 11.5px;
  letter-spacing: 0.02em;
}

.arb-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--lab-radius-pill, 999px);
  background: var(--lab-butter, #ffe58a);
  color: var(--lab-graphite);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.arb-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lab-graphite);
  animation: lab-blink 1.4s ease-in-out infinite;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Action buttons ──────────────────────────── */
.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 6px 0 14px;
  border: none;
  border-radius: var(--lab-radius-pill, 999px);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.act-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.act-btn--approve {
  background: var(--lab-lime);
  color: var(--lab-ink);
  box-shadow: 0 4px 12px rgba(200,250,75,0.4);
}

.act-btn--approve:hover:not(:disabled) {
  background: #b8e83a;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(200,250,75,0.5);
}

.act-btn--reject {
  background: var(--lab-coral);
  color: var(--lab-snow);
  box-shadow: 0 4px 12px rgba(255,106,61,0.32);
}

.act-btn--reject:hover:not(:disabled) {
  background: #e85a30;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(255,106,61,0.42);
}

.act-btn kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(14,14,16,0.18);
  color: inherit;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10.5px;
  font-weight: 600;
}

.act-btn--reject kbd {
  background: rgba(255,255,255,0.22);
  color: var(--lab-snow);
}

.act-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-pill, 999px);
  color: var(--lab-slate);
  cursor: pointer;
  transition: all 150ms ease;
}

.act-ghost:hover:not(:disabled) {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
  background: var(--lab-cream);
}

.act-ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.act-ghost kbd {
  display: none;
}

@media (max-width: 1280px) {
  .workbench {
    grid-template-columns: 260px 1fr 320px;
  }
}

:global(html.dark) .workbench { background: var(--lab-ink); }
:global(html.dark) .action-bar { background: var(--lab-graphite); border-bottom-color: rgba(255,255,255,0.06); }
:global(html.dark) .info-item__code { background: rgba(255,255,255,0.06); color: var(--lab-snow); }
</style>
