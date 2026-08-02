<template>
  <el-row>
    <el-button-group class="panel-tabs">
      <el-button @click="handleClick('table')" size="small" :type="viewType === 'table' ? 'primary' : ''">
        <Icon :icon="'uis:list-ul'"></Icon>
      </el-button>
      <el-button @click="handleClick('category')" size="small" :type="viewType === 'category' ? 'primary' : ''">
        <Icon :icon="'ic:outline-category'"></Icon>
      </el-button>
      <el-button @click="handleClick('tag')" size="small" :type="viewType === 'tag' ? 'primary' : ''">
        <Icon :icon="'grommet-icons:tag'"></Icon>
      </el-button>
    </el-button-group>
    <el-text v-if="viewType === 'table'">标注列表</el-text>
    <el-text v-if="viewType === 'category'">类别列表</el-text>
    <el-text v-if="viewType === 'tag'">标签列表</el-text>
  </el-row>
    <div v-show="viewType === 'table'"><ObjectsTable></ObjectsTable></div>
    <div v-show="viewType === 'category'"><ObjectsCategory></ObjectsCategory></div>
    <div v-show="viewType === 'tag'"><ObjectsTag></ObjectsTag></div>
</template>

<script lang="ts" setup>
import { ref, watch, type Ref } from 'vue'
import { Icon } from '@iconify/vue'
import ObjectsTable from './anno-table.vue'
import ObjectsCategory from './ObjectsCategory.vue'
import ObjectsTag from './ObjectsTag.vue'

const viewType = ref('table')
const handleClick = (type: string) => {
  viewType.value = type
}

</script>
<style lang="scss" scoped>
</style>