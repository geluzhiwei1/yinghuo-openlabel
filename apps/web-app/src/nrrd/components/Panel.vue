<template>
  <div class="panel">
    <slot></slot>
  </div>
</template>

<script setup></script>

<style scoped lang="less">
.panel {
  position: absolute;
  top: 30px;
  left: 0;
  z-index: 100000;
  border-radius: 4px;
}
</style>
