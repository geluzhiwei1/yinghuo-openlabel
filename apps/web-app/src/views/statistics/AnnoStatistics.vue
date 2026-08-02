<template>
    <el-drawer size="70%" v-model="dlgVisible" title="标签数据统计">
        <el-tabs v-model="activeName" class="demo-tabs">
            <el-tab-pane label="按帧统计" name="withinFrame">
                <div>
                    <el-button @click="loadDataWithinFrame">刷新</el-button>
                    <Vue3Plotly v-loading="loading" :data="datasWithinFrame" :layout="layoutWithinFrame" />
                </div>
            </el-tab-pane>
            <el-tab-pane label="任务总计" name="withinTask">
                <div>
                    <el-button @click="loadData2">刷新</el-button>
                    <Vue3Plotly :data="datasWithTask" :layout="layoutWithTask" />
                </div>
            </el-tab-pane>
        </el-tabs>
    </el-drawer>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import Vue3Plotly from './Vue3Plotly.vue'
import { statisticsApi } from '@/api'

const seqData = ref({})
const activeName = ref('withinFrame')

const loading = ref(false)
const datasWithinFrame = ref([] as any[])
const layoutWithinFrame = {
    title: {
        text: '每帧的标签数量'
    },
    xaxis: {
        title: {
            text: '帧ID'
        }
    },
    yaxis: {
        title: {
            text: '标签数量'
        }
    },
}

const datasWithTask = ref([] as any[])
const layoutWithTask = {
    title: {
        text: '每类别标签数量'
    },
    xaxis: {
        title: {
            text: '类别'
        }
    },
    yaxis: {
        title: {
            text: '标签数量'
        }
    },
}

const loadDataWithinFrame = () => {
    loading.value = true
    statisticsApi.seq({
        statisticsType: 'objTypeCountByFrame',
        ...seqData.value
    }).then((res: any) => {
        const x = []
        const y = []
        res.data.forEach((item: any) => {
            x.push(item.frame)
            y.push(item.objectCount)
        })
        datasWithinFrame.value = [{
            type: 'bar',
            x,
            y
        }]
    }).finally(() => {
        loading.value = false
    })
}

const loadData2 = () => {
    loading.value = true
    statisticsApi.seq({
        statisticsType: 'objTypeCount',
        ...seqData.value
    }).then((res: any) => {
        const x = []
        const y = []

        Object.entries(res.data).forEach(([key, value]) => {
            x.push(key)
            y.push(value)
        });

        datasWithTask.value = [{
            type: 'bar',
            x,
            y
        }]
    }).finally(() => {
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