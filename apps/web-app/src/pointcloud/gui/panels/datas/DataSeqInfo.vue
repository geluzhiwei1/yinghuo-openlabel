<template>
  <el-form label-width="120px">
    <el-form-item label="数据片ID">
      <el-input v-model="jobConfig.seq" readonly/>
    </el-form-item>
    <el-form-item label="传感器">
      <el-input v-model="jobConfig.stream"  readonly/>
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { jobConfig } from '@/states/job-config'
import {
  ElInput,
  ElForm,
  ElFormItem
} from 'element-plus'

</script>
