<template>
  <el-dialog v-model="exportAnnoDlgVisible" title="标签导入导出">
    <el-tabs v-model="activeName" class="demo-tabs" @tab-click="handleClick">
      <el-tab-pane label="导出" name="export">
        <ExportAnno />
      </el-tab-pane>
      <el-tab-pane label="导入" name="import">
        <ImportAnno />
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import ExportAnno from './ExportAnno.vue'
import ImportAnno from './ImportAnno.vue'

const activeName = ref('export')

const exportAnnoDlgVisible = ref(false)
const open = () => {
  //   changeSchema(jobConfig.mission)
  exportAnnoDlgVisible.value = !exportAnnoDlgVisible.value
}
defineExpose({ open })

const handleClick = (tab: TabsPaneContext, event: Event) => {
  console.log(tab, event)
}
</script>

<style>
.demo-tabs > .el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>
