<template>
  <el-button @click="loadData">总计</el-button>
  <Vue3Plotly :data="data" :layout="layout" />
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import Vue3Plotly from './Vue3Plotly.vue'
import { statisticsApi } from '@/api'
import { jobConfig } from '@/states/job-config'

const data = ref([] as any[])
const layout = {
  title: '统计'
}

const loadData = () => {
  const params = {
    seq: jobConfig.seq,
    stream: jobConfig.stream,
    frame: jobConfig.frame,
    current_mission: jobConfig.mission,
    statisticsType: 'objTypeCount',
    uuid: jobConfig.uuid
  }
  statisticsApi.seq(params).then((resData) => {
    data.value = resData
    layout.title = '类别数量总计'
  })
}
</script>
