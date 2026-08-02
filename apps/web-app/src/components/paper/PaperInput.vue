<template>
  <div :class="['paper-input', { 'paper-input--block': block }]">
    <label v-if="label" class="paper-input__label">{{ label }}</label>
    <div class="paper-input__field">
      <span v-if="$slots.prefix || prefixIcon" class="paper-input__prefix">
        <slot name="prefix">
          <Icon v-if="prefixIcon" :icon="prefixIcon" :width="14" />
        </slot>
      </span>
      <input
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :name="name"
        :autocomplete="autocomplete"
        class="paper-input__inner"
        @input="onInput"
        @change="onChange"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <span v-if="$slots.suffix || suffixIcon" class="paper-input__suffix">
        <slot name="suffix">
          <Icon v-if="suffixIcon" :icon="suffixIcon" :width="14" />
        </slot>
      </span>
    </div>
    <div v-if="hint || error" class="paper-input__hint" :class="{ 'is-error': error }">
      {{ error || hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
  readonly?: boolean
  block?: boolean
  name?: string
  autocomplete?: string
  prefixIcon?: string
  suffixIcon?: string
}>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  block: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'keydown', ev: KeyboardEvent): void
  (e: 'focus', ev: FocusEvent): void
  (e: 'blur', ev: FocusEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const onInput = (ev: Event) => {
  emit('update:modelValue', (ev.target as HTMLInputElement).value)
}
const onChange = (ev: Event) => emit('change', (ev.target as HTMLInputElement).value)
const onKeydown = (ev: KeyboardEvent) => emit('keydown', ev)
const onFocus = (ev: FocusEvent) => emit('focus', ev)
const onBlur = (ev: FocusEvent) => emit('blur', ev)

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<style scoped>
.paper-input {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
}
.paper-input--block { display: flex; width: 100%; }

.paper-input__label {
  font-size: 11px;
  color: var(--lab-ash);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.paper-input__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--lab-ctrl-h-lg);
  padding: 0 14px;
  border-radius: var(--lab-radius-pill);
  background: var(--lab-cream);
  border: 1px solid transparent;
  transition: border-color var(--lab-duration-base) var(--lab-ease),
              background-color var(--lab-duration-base) var(--lab-ease);
}
.paper-input--block .paper-input__field { width: 100%; }

.paper-input__field:hover {
  background: #f3f1e8;
}

.paper-input__field:focus-within {
  background: var(--lab-snow);
  border-color: var(--lab-ink);
}

.paper-input__prefix,
.paper-input__suffix {
  display: inline-flex;
  align-items: center;
  color: var(--lab-ash);
  flex-shrink: 0;
}

.paper-input__inner {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--y-font-family-base);
  font-size: 13px;
  color: var(--lab-ink);
  line-height: 1;
}
.paper-input__inner::placeholder {
  color: var(--lab-ash);
}
.paper-input__inner:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.paper-input__hint {
  font-size: 11px;
  color: var(--lab-ash);
}
.paper-input__hint.is-error {
  color: var(--lab-coral);
}
</style>
