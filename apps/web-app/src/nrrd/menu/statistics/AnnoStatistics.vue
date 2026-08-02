<template>
    <el-dialog width="80%" v-model="dlgVisible" title="标签数据统计">
        <el-tabs v-model="activeName" class="demo-tabs">
            <el-tab-pane label="按帧统计" name="withinFrame">
                <WithinFrame />
            </el-tab-pane>
            <el-tab-pane label="任务总计" name="withinTask">
                <WithinTask />
            </el-tab-pane>
        </el-tabs>
    </el-dialog>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import WithinFrame from './WithinFrame.vue'
import WithinTask from './WithinTask.vue'
const activeName = ref('withinFrame')

const dlgVisible = ref(false)
const toggleOpen = () => {
    dlgVisible.value = !dlgVisible.value
}
defineExpose({ toggleOpen })

</script>