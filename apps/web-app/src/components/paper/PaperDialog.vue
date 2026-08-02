<template>
  <Teleport to="body">
    <Transition name="paper-dialog">
      <div v-if="modelValue" class="paper-dialog-root" @click.self="onClose">
        <div class="paper-dialog" :style="{ maxWidth: typeof width === 'number' ? `${width}px` : width }">
          <header class="paper-dialog__header">
            <div class="paper-dialog__title-wrap">
              <span v-if="eyebrow" class="paper-dialog__eyebrow">{{ eyebrow }}</span>
              <h2 class="paper-dialog__title">{{ title }}<span v-if="coralDot" class="paper-dialog__dot">.</span></h2>
            </div>
            <button v-if="closable" type="button" class="paper-dialog__close" @click="onClose">
              <Icon icon="lucide:x" :width="18" />
            </button>
          </header>
          <div class="paper-dialog__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="paper-dialog__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  eyebrow?: string
  coralDot?: boolean
  width?: number | string
  closable?: boolean
  closeOnMask?: boolean
}>(), {
  width: 480,
  closable: true,
  closeOnMask: true,
})

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const onClose = () => {
  if (props.closeOnMask && props.closable) emit('update:modelValue', false)
}
</script>

<style scoped>
.paper-dialog-root {
  position: fixed;
  inset: 0;
  background: rgba(14, 14, 16, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.paper-dialog {
  width: 100%;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-2xl);
  box-shadow: var(--lab-shadow-lift);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
}

.paper-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--lab-hairline);
}

.paper-dialog__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.paper-dialog__eyebrow {
  font-family: var(--y-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lab-ash);
}

.paper-dialog__title {
  margin: 0;
  font-family: var(--y-font-family-display);
  font-style: italic;
  font-size: 22px;
  line-height: 1;
  color: var(--lab-ink);
}

.paper-dialog__dot {
  color: var(--lab-coral);
}

.paper-dialog__close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--lab-radius-pill);
  color: var(--lab-ash);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--lab-duration-base), color var(--lab-duration-base);
}
.paper-dialog__close:hover { background: var(--lab-cream); color: var(--lab-ink); }

.paper-dialog__body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.paper-dialog__footer {
  padding: 12px 24px 18px;
  border-top: 1px solid var(--lab-hairline);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  align-items: center;
}

/* Transition */
.paper-dialog-enter-active,
.paper-dialog-leave-active {
  transition: opacity var(--lab-duration-slow) var(--lab-ease);
}
.paper-dialog-enter-active .paper-dialog,
.paper-dialog-leave-active .paper-dialog {
  transition: transform var(--lab-duration-slow) var(--lab-ease),
              opacity var(--lab-duration-slow) var(--lab-ease);
}
.paper-dialog-enter-from,
.paper-dialog-leave-to { opacity: 0; }
.paper-dialog-enter-from .paper-dialog,
.paper-dialog-leave-to .paper-dialog {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}
</style>
