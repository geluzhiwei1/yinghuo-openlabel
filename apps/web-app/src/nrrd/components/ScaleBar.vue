<template>
  <div class="scale-bar">
    <div class="scale" :style="{ width: 100 * Number(scale) + 'px' }"></div>
    <div>{{ scale }}</div>
  </div>
</template>

<script setup>
import { ref, defineProps } from "vue";
const props = defineProps(["scale"]);
</script>

<style scoped lang="less">
.scale-bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  background: var(--y-color-bg-card);
  border-radius: var(--y-radius-md);
  color: var(--y-color-text-regular);
  font-size: var(--y-font-size-xs);
  border: 1px solid var(--y-color-divider);
  .scale {
    min-width: 50px;
    max-width: 100px;
    height: 15px;
    border: 1px solid var(--y-color-primary);
    border-top: 0px;
    margin-right: 20px;
  }
}
</style>
