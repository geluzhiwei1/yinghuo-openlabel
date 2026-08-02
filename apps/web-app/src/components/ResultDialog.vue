<template>
  <el-dialog
    v-model="visible"
    :title="title || resolvedTitle"
    :width="width"
    :close-on-click-modal="false"
    align-center
    @closed="onClosed"
  >
    <div class="y-result-dialog__body">
      <div class="y-result-dialog__icon" :class="`y-result-dialog__icon--${status}`">
        <Icon :icon="statusIcon" :width="48" />
      </div>
      <div class="y-result-dialog__headline">
        <slot name="headline">{{ headline || resolvedHeadline }}</slot>
      </div>
      <div v-if="$slots.default || message" class="y-result-dialog__message">
        <slot>{{ message }}</slot>
      </div>
      <el-collapse v-if="details" v-model="expandedNames" class="y-result-dialog__details">
        <el-collapse-item :title="detailsLabel" name="details">
          <pre class="y-result-dialog__details-body">{{ detailsBody }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>
    <template #footer>
      <slot name="footer">
        <el-button v-if="showRetry && status !== 'success'" @click="$emit('retry')">
          {{ t('action.retry') }}
        </el-button>
        <el-button type="primary" @click="close">
          {{ status === 'success' ? t('action.confirm') : t('action.close') }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)

export type ResultStatus = 'success' | 'error' | 'warning' | 'info'

interface Props {
  modelValue: boolean
  status?: ResultStatus
  title?: string
  headline?: string
  message?: string
  details?: unknown
  detailsLabel?: string
  width?: string | number
  showRetry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'success',
  title: '',
  headline: '',
  message: '',
  details: undefined,
  detailsLabel: '',
  width: 480,
  showRetry: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'retry'): void
}>()

const visible = ref(props.modelValue)
const expandedNames = ref<string[]>([])

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (!v) expandedNames.value = []
  },
)
watch(visible, (v) => emit('update:modelValue', v))

const statusIcon = computed(() => {
  switch (props.status) {
    case 'success':
      return 'lucide:circle-check-big'
    case 'error':
      return 'lucide:circle-x'
    case 'warning':
      return 'lucide:triangle-alert'
    default:
      return 'lucide:info'
  }
})

const resolvedTitle = computed(() => {
  switch (props.status) {
    case 'success':
      return t('result.successTitle')
    case 'error':
      return t('result.errorTitle')
    case 'warning':
      return t('result.warningTitle')
    default:
      return t('result.infoTitle')
  }
})

const resolvedHeadline = computed(() => {
  switch (props.status) {
    case 'success':
      return t('result.successHeadline')
    case 'error':
      return t('result.errorHeadline')
    case 'warning':
      return t('result.warningHeadline')
    default:
      return t('result.infoHeadline')
  }
})

const detailsBody = computed(() => {
  if (!props.details) return ''
  if (typeof props.details === 'string') return props.details
  try {
    return JSON.stringify(props.details, null, 2)
  } catch {
    return String(props.details)
  }
})

const close = () => {
  visible.value = false
}

const onClosed = () => {
  emit('close')
}
</script>

<style scoped>
.y-result-dialog__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--y-spacing-3);
  padding: var(--y-spacing-4) 0;
}

.y-result-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: var(--y-radius-full);
  margin-bottom: var(--y-spacing-2);
}

.y-result-dialog__icon--success {
  color: var(--y-color-success);
  background: rgba(82, 196, 26, 0.10);
}

.y-result-dialog__icon--error {
  color: var(--y-color-danger);
  background: rgba(245, 34, 45, 0.10);
}

.y-result-dialog__icon--warning {
  color: var(--y-color-warning);
  background: rgba(250, 173, 20, 0.12);
}

.y-result-dialog__icon--info {
  color: var(--y-color-primary);
  background: var(--y-color-primary-soft);
}

.y-result-dialog__headline {
  font-size: var(--y-font-size-xl);
  font-weight: var(--y-font-weight-semibold);
  color: var(--y-color-text-primary);
}

.y-result-dialog__message {
  font-size: var(--y-font-size-sm);
  color: var(--y-color-text-secondary);
  max-width: 420px;
  line-height: var(--y-line-height-relaxed);
}

.y-result-dialog__details {
  width: 100%;
  margin-top: var(--y-spacing-3);
  text-align: left;
  background: var(--y-color-bg-canvas);
  border-radius: var(--y-radius-md);
  padding: 0 var(--y-spacing-3);
}

.y-result-dialog__details-body {
  margin: 0;
  font-family: var(--y-font-family-mono);
  font-size: var(--y-font-size-xs);
  color: var(--y-color-text-regular);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}
</style>
