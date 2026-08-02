<template>
  <div class="y-toast-center">
    <transition-group name="y-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="y-toast-center__item"
        :class="`y-toast-center__item--${toast.level}`"
        @click="dismiss(toast.id)"
      >
        <Icon :icon="iconFor(toast.level)" class="y-toast-center__icon" />
        <div class="y-toast-center__body">
          <div v-if="toast.title" class="y-toast-center__title">{{ toast.title }}</div>
          <div class="y-toast-center__message">{{ toast.message }}</div>
        </div>
        <Icon
          v-if="toast.closable"
          icon="lucide:x"
          class="y-toast-center__close"
          @click.stop="dismiss(toast.id)"
        />
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'

export interface ToastItem {
  id: number
  level: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
  closable?: boolean
}

const toasts = ref<ToastItem[]>([])
let nextId = 1
let timer: ReturnType<typeof setInterval> | null = null

const push = (toast: Omit<ToastItem, 'id'>) => {
  const id = nextId++
  toasts.value.push({ ...toast, id })
  if (toast.duration !== 0) {
    const ttl = toast.duration ?? 3500
    setTimeout(() => dismiss(id), ttl)
  }
}

const dismiss = (id: number) => {
  const idx = toasts.value.findIndex((t) => t.id === id)
  if (idx >= 0) toasts.value.splice(idx, 1)
}

const clear = () => {
  toasts.value = []
}

const iconFor = (level: ToastItem['level']) => {
  switch (level) {
    case 'success':
      return 'lucide:circle-check-big'
    case 'error':
      return 'lucide:circle-x'
    case 'warning':
      return 'lucide:triangle-alert'
    default:
      return 'lucide:info'
  }
}

onMounted(() => {
  ;(window as any).__yhToastCenter = { push, dismiss, clear }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  delete (window as any).__yhToastCenter
})

defineExpose({ push, dismiss, clear })
</script>

<style scoped>
.y-toast-center {
  position: fixed;
  top: calc(var(--y-header-height) + var(--y-spacing-4));
  right: var(--y-spacing-4);
  z-index: var(--y-z-toast, 3000);
  display: flex;
  flex-direction: column;
  gap: var(--y-spacing-2);
  pointer-events: none;
}

.y-toast-center__item {
  display: flex;
  align-items: flex-start;
  gap: var(--y-spacing-2);
  width: 360px;
  max-width: calc(100vw - var(--y-spacing-8));
  padding: var(--y-spacing-3) var(--y-spacing-4);
  background: var(--y-color-bg-card);
  border-radius: var(--y-radius-md);
  box-shadow: var(--y-shadow-md);
  border-left: 3px solid var(--y-color-info);
  pointer-events: auto;
  cursor: pointer;
  transition: opacity var(--y-duration-base) var(--y-ease-in-out);
}

.y-toast-center__item--success {
  border-left-color: var(--y-color-success);
}

.y-toast-center__item--error {
  border-left-color: var(--y-color-danger);
}

.y-toast-center__item--warning {
  border-left-color: var(--y-color-warning);
}

.y-toast-center__item--info {
  border-left-color: var(--y-color-primary);
}

.y-toast-center__icon {
  font-size: var(--y-font-size-xl);
  flex-shrink: 0;
}

.y-toast-center__item--success .y-toast-center__icon {
  color: var(--y-color-success);
}
.y-toast-center__item--error .y-toast-center__icon {
  color: var(--y-color-danger);
}
.y-toast-center__item--warning .y-toast-center__icon {
  color: var(--y-color-warning);
}
.y-toast-center__item--info .y-toast-center__icon {
  color: var(--y-color-primary);
}

.y-toast-center__body {
  flex: 1;
  min-width: 0;
}

.y-toast-center__title {
  font-size: var(--y-font-size-sm);
  font-weight: var(--y-font-weight-semibold);
  color: var(--y-color-text-primary);
  margin-bottom: var(--y-spacing-1);
}

.y-toast-center__message {
  font-size: var(--y-font-size-sm);
  color: var(--y-color-text-regular);
  line-height: var(--y-line-height-base);
  word-break: break-all;
}

.y-toast-center__close {
  font-size: var(--y-font-size-lg);
  color: var(--y-color-text-disabled);
  cursor: pointer;
  flex-shrink: 0;
}

.y-toast-center__close:hover {
  color: var(--y-color-text-secondary);
}

.y-toast-enter-active,
.y-toast-leave-active {
  transition: all var(--y-duration-base) var(--y-ease-in-out);
}

.y-toast-enter-from,
.y-toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
