<template>
  <el-config-provider :locale="zhCn">
    <div class="review-shell" data-face="business">
      <ReviewHeader />
      <main class="review-main">
        <RouterView />
      </main>
      <HelpOverlay />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ReviewHeader from './components/ReviewHeader.vue'
import HelpOverlay from './components/HelpOverlay.vue'
</script>

<style scoped>
.review-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--lab-paper);
}
.review-main {
  flex: 1;
  overflow: hidden;
}

:global(html.dark) .review-shell {
  background: var(--lab-ink);
}
</style>
