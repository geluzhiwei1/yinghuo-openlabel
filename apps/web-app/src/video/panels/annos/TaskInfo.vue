<template>
        <el-row style="width: 100%">
            <el-col :span="24">
                <el-descriptions title="Job信息" :column="1" :size="size" border>
                    <el-descriptions-item label="Job ID">{{ jobConfig.uuid }}</el-descriptions-item>
                    <el-descriptions-item label="数据格式">{{ jobConfig.data_format }}</el-descriptions-item>
                    <el-descriptions-item label="序列">{{ jobConfig.seq }}</el-descriptions-item>
                    <el-descriptions-item label="传感器">{{ jobConfig.stream }}</el-descriptions-item>
                    <el-descriptions-item label="任务">{{ jobConfig.mission }}</el-descriptions-item>
                    <el-descriptions-item label="">{{ jobConfig.domain }}</el-descriptions-item>
                    <el-descriptions-item label="标注规范">{{ jobConfig.taxonomy }}</el-descriptions-item>
                </el-descriptions>
            </el-col>
        </el-row>
</template>
<script lang="tsx" setup>
import { ref } from 'vue'
import { jobConfig } from '@/states/job-config'
import {
    ElDescriptions,
    ElDescriptionsItem,
    ElCol,
    ElRow,
} from 'element-plus'
import type { ComponentSize } from 'element-plus'

const size = ref<ComponentSize>('default')

</script>
<style scoped>
</style>