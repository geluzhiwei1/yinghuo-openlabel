<template>
  <el-config-provider :locale="zhCn">
    <div class="qa-shell" data-face="business">
      <QaHeader />
      <main class="qa-main">
        <RouterView />
      </main>
      <HelpOverlay />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import QaHeader from './components/QaHeader.vue'
import HelpOverlay from '@/review/components/HelpOverlay.vue'
</script>

<style scoped>
.qa-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.qa-main {
  flex: 1;
  overflow: hidden;
}
</style>
