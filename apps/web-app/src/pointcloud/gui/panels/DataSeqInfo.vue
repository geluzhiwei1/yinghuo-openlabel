<template>
  <el-form label-width="120px">
    <el-form-item label="数据序列">
      <el-input v-model="jobConfig.seq" />
    </el-form-item>
    <el-form-item label="路径">
      <el-input v-model="jobConfig.seq" />
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { jobConfig } from '@/states/job-config'
</script>
