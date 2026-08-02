<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['paper-btn', `paper-btn--${variant}`, { 'paper-btn--block': block, 'paper-btn--icon-only': iconOnly }]"
    @click="onClick"
  >
    <span v-if="$slots.default" class="paper-btn__label"><slot /></span>
    <span v-if="$slots.icon || icon" class="paper-btn__icon">
      <slot name="icon">
        <Icon v-if="icon" :icon="icon" :width="iconSize" />
      </slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

const props = withDefaults(defineProps<{
  variant?: Variant
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  block?: boolean
  icon?: string
  iconSize?: number | string
  iconOnly?: boolean
}>(), {
  variant: 'secondary',
  type: 'button',
  disabled: false,
  block: false,
  iconSize: 16,
  iconOnly: false,
})

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()
const onClick = (ev: MouseEvent) => { if (!props.disabled) emit('click', ev) }
</script>

<style scoped>
.paper-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--y-font-family-base);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  border: none;
  outline: none;
  user-select: none;
  transition: background-color var(--lab-duration-base) var(--lab-ease),
              color var(--lab-duration-base) var(--lab-ease),
              opacity var(--lab-duration-base) var(--lab-ease);
}

.paper-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Variant: primary — ink black + lime ball icon slot (design.md §5) */
.paper-btn--primary {
  height: var(--lab-ctrl-h-lg);
  padding: 0 6px 0 16px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-ink);
  color: #fff;
}
.paper-btn--primary:hover { background: #2a2a2e; }
.paper-btn--primary:active { background: #000; }

/* The icon slot on primary becomes the signature lime ball */
.paper-btn--primary .paper-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--lab-lime-ball);
  height: var(--lab-lime-ball);
  border-radius: var(--lab-radius-pill);
  background: var(--lab-lime);
  color: var(--lab-lime-ink);
}

/* Variant: secondary */
.paper-btn--secondary {
  height: var(--lab-ctrl-h-md);
  padding: 0 16px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-cream);
  color: var(--lab-slate);
}
.paper-btn--secondary:hover { background: var(--lab-line); color: var(--lab-ink); }

/* Variant: danger — coral */
.paper-btn--danger {
  height: var(--lab-ctrl-h-md);
  padding: 0 16px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-coral);
  color: #fff;
}
.paper-btn--danger:hover { background: #ff7e57; }

/* Variant: success — muted green */
.paper-btn--success {
  height: var(--lab-ctrl-h-md);
  padding: 0 16px;
  border-radius: var(--lab-radius-pill);
  background: #2f7a3e;
  color: #fff;
}
.paper-btn--success:hover { background: #286a35; }

/* Variant: ghost — icon-only bare buttons */
.paper-btn--ghost {
  width: var(--lab-ctrl-icon);
  height: var(--lab-ctrl-icon);
  border-radius: var(--lab-radius-pill);
  background: transparent;
  color: var(--lab-slate);
}
.paper-btn--ghost:hover { background: var(--lab-cream); color: var(--lab-ink); }

/* Icon styling on non-primary variants */
.paper-btn--secondary .paper-btn__icon,
.paper-btn--danger .paper-btn__icon,
.paper-btn--success .paper-btn__icon,
.paper-btn--ghost .paper-btn__icon {
  width: auto;
  height: auto;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Block fills container width */
.paper-btn--block {
  width: 100%;
}

/* Icon-only button — square to circle, no label */
.paper-btn--icon-only {
  padding: 0 !important;
  width: var(--lab-ctrl-icon);
}
.paper-btn--icon-only.paper-btn--primary {
  /* primary icon-only keeps the lime ball aesthetic */
  background: var(--lab-ink);
}
.paper-btn--icon-only.paper-btn--primary .paper-btn__icon {
  background: var(--lab-lime);
}
</style>
