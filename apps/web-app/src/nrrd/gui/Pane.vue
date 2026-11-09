<template>
  <div class="pane" @pointerdown="$emit('focus')">
    <div class="pane__head" @dblclick="$emit('maximize')">
      <span class="pane__label">{{ label }}</span>
      <span v-if="maximizable" class="pane__btn" :title="t('nrrd.pane.maximize')" @click.stop="$emit('maximize')">⤢</span>
    </div>
    <div class="pane__body"><slot /></div>
  </div>
</template>

<script lang="ts" setup>
import { i18n } from '@/locales'

defineProps<{ label: string; maximizable?: boolean }>()
defineEmits<{ (e: 'focus'): void; (e: 'maximize'): void }>()

const t = (key: string) => i18n.global.t(key)
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: #0c0c10;
  border: 1px solid #1e1e26;
  border-radius: 4px;
  overflow: hidden;
}

.pane__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  height: 22px;
  background: #14141a;
  border-bottom: 1px solid #1e1e26;
  color: rgba(200, 215, 205, 0.75);
  font-size: 11px;
  user-select: none;
  flex-shrink: 0;
}

.pane__btn {
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.6;
}
.pane__btn:hover { opacity: 1; }

.pane__body {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
