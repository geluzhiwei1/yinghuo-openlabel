<template>
  <el-button @click="loadData">刷新</el-button>
  <Vue3Plotly v-loading="loading" :data="datas" :layout="layout" />
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import Vue3Plotly from './Vue3Plotly.vue'
import { globalStates } from '@/states'

const loading = ref(false)
const datas = ref([] as any[])

const reloData = () => {
  loading.value = true
  const categoryCountMap = new Map<string, any>()
  globalStates.mainAnnoater.objectsMap().forEach((v, k) => {
    const objType = v.userData.anno.objType
    if (categoryCountMap.has(objType)) {
      categoryCountMap.get(objType)!.count++
    } else {
      categoryCountMap.set(objType, { count: 1 })
    }
  })
  loading.value = false
  return categoryCountMap
}

const loadData = () => {
  const cates = [] as string[]
  const counts = [] as number[]

  const m = reloData()
  m.forEach((v, k) => {
    cates.push(k)
    counts.push(v.count)
  })

  const trace3 = {
    x: cates,
    y: counts,
    type: 'bar'
  }

  datas.value = []
  datas.value.push(trace3)
}

const layout = {
  title: '类别和数量统计'
}
</script>
