<template>
  <el-dialog
    v-model="visible"
    title="键盘快捷键"
    width="420"
    :close-on-click-modal="true"
  >
    <div class="shortcut-list">
      <div v-for="row in rows" :key="row.keys.join('+')" class="row">
        <div class="keys">
          <kbd v-for="k in row.keys" :key="k">{{ k }}</kbd>
        </div>
        <div class="desc">{{ row.desc }}</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { useHelpOverlay } from '../composables/useHelpOverlay'

const { visible } = useHelpOverlay()

const rows = [
  { keys: ['J'], desc: '下一个 unit' },
  { keys: ['K'], desc: '上一个 unit' },
  { keys: ['A'], desc: '通过当前 unit' },
  { keys: ['R'], desc: '驳回(弹窗)' },
  { keys: ['?'], desc: '显示此帮助' },
]
</script>

<style scoped>
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill, 999px);
}
.keys {
  display: flex;
  gap: 4px;
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  padding: 0 6px;
  background: var(--lab-ink);
  color: var(--lab-lime);
  border: none;
  border-radius: 6px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  font-weight: 500;
  box-shadow: none;
}
.desc {
  color: var(--lab-graphite);
  font-size: 13px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.02em;
}
</style>
