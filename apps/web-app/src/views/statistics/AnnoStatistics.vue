<template>
  <el-drawer size="70%" v-model="dlgVisible" :title="t('home.statistics.title')">
    <el-tabs v-model="activeName" class="demo-tabs">
      <el-tab-pane :label="t('home.statistics.byFrame')" name="withinFrame">
        <div>
          <el-button @click="loadDataWithinFrame">{{ t('home.statistics.refresh') }}</el-button>
          <Vue3Plotly v-loading="loading" :data="datasWithinFrame" :layout="layoutWithinFrame" />
        </div>
      </el-tab-pane>
      <el-tab-pane :label="t('home.statistics.byTask')" name="withinTask">
        <div>
          <el-button @click="loadData2">{{ t('home.statistics.refresh') }}</el-button>
          <Vue3Plotly :data="datasWithTask" :layout="layoutWithTask" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import Vue3Plotly from './Vue3Plotly.vue'
import { statisticsApi } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const seqData = ref({})
const activeName = ref('withinFrame')

const loading = ref(false)
const datasWithinFrame = ref([] as any[])
const layoutWithinFrame = {
  title: {
    text: t('home.statistics.withinFrame.title')
  },
  xaxis: {
    title: {
      text: t('home.statistics.withinFrame.xaxis')
    }
  },
  yaxis: {
    title: {
      text: t('home.statistics.withinFrame.yaxis')
    }
  }
}

const datasWithTask = ref([] as any[])
const layoutWithTask = {
  title: {
    text: t('home.statistics.withinTask.title')
  },
  xaxis: {
    title: {
      text: t('home.statistics.withinTask.xaxis')
    }
  },
  yaxis: {
    title: {
      text: t('home.statistics.withinTask.yaxis')
    }
  }
}

const loadDataWithinFrame = () => {
  loading.value = true
  statisticsApi
    .seq({
      statisticsType: 'objTypeCountByFrame',
      ...seqData.value
    })
    .then((res: any) => {
      const x = []
      const y = []
      res.data.forEach((item: any) => {
        x.push(item.frame)
        y.push(item.objectCount)
      })
      datasWithinFrame.value = [
        {
          type: 'bar',
          x,
          y
        }
      ]
    })
    .finally(() => {
      loading.value = false
    })
}

const loadData2 = () => {
  loading.value = true
  statisticsApi
    .seq({
      statisticsType: 'objTypeCount',
      ...seqData.value
    })
    .then((res: any) => {
      const x = []
      const y = []

      Object.entries(res.data).forEach(([key, value]) => {
        x.push(key)
        y.push(value)
      })

      datasWithTask.value = [
        {
          type: 'bar',
          x,
          y
        }
      ]
    })
    .finally(() => {
      loading.value = false
    })
}

const dlgVisible = ref(false)
const toggleOpen = (options: any) => {
  console.log(options)
  seqData.value = options
  dlgVisible.value = !dlgVisible.value
}
defineExpose({ toggleOpen })
</script>
