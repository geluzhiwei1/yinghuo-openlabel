<template>
  <el-config-provider :locale="locale">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'

const { locale: i18nLocale } = useI18n()
const locale = computed(() => {
  return i18nLocale.value === 'zh-CN' ? zhCn : en
})
</script>
<style>
@import './assets/css/main.css';
</style>
