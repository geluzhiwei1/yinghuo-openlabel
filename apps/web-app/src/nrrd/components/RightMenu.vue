<template>
  <div class="right-menu" :style="{ top: top + 'px', left: left + 'px' }">
    <div class="menu" @click.stop="onSave">保存图片</div>
    <div class="menu" @click.stop="onReset">重置视图</div>
    <div class="menu" @click.stop="onInfo">
      {{ infoVisible ? "隐藏信息" : "显示信息" }}
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onBeforeMount, onBeforeUnmount } from "vue";
const props = defineProps(["top", "left", "infoVisible"]);
const emits = defineEmits(["save", "reset", "info"]);
const onSave = () => {
  emits("save");
};
const onReset = () => {
  emits("reset");
};
const onInfo = () => {
  emits("info");
};
</script>

<style scoped lang="less">
.right-menu {
  position: absolute;
  background: var(--y-color-bg-card);
  border: 1px solid var(--y-color-border);
  border-radius: var(--y-radius-sm);
  box-shadow: var(--y-shadow-2);
  padding: var(--y-spacing-1);
  z-index: 100;
}
.menu {
  height: auto;
  padding: 6px 12px;
  border-radius: var(--y-radius-sm);
  cursor: pointer;
  color: var(--y-color-text-regular);
  &:hover {
    background: var(--y-color-primary-soft);
    color: var(--y-color-primary);
  }
}
</style>
