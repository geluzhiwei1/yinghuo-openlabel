<template>
  <div class="user-info-page">
    <el-card shadow="never">
      <template #header>
        <div class="user-info-page__header">
          <Icon icon="lucide:user" :width="20" />
          <span>账号信息</span>
        </div>
      </template>
      <UserProfileContent></UserProfileContent>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import UserProfileContent from './user/UserProfileContent.vue'
</script>
<style scoped>
.user-info-page {
  padding: 16px 24px;
}
.user-info-page__header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
</style>
