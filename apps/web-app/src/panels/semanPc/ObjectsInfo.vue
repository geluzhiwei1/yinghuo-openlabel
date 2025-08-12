<template>
  <el-row>
    <el-button-group>
      <el-button
        @click="handleClick('table')"
        size="small"
        round
        :type="viewType === 'table' ? 'success' : ''"
      >
        <Icon :icon="'uis:list-ul'"></Icon>
      </el-button>
      <el-button
        @click="handleClick('category')"
        size="small"
        round
        :type="viewType === 'category' ? 'success' : ''"
      >
        <Icon :icon="'ic:outline-category'"></Icon>
      </el-button>
      <el-button
        @click="handleClick('tag')"
        size="small"
        round
        :type="viewType === 'tag' ? 'success' : ''"
      >
        <Icon :icon="'grommet-icons:tag'"></Icon>
      </el-button>
    </el-button-group>
  </el-row>
  <div v-show="viewType === 'table'"><Instances></Instances></div>
  <!-- <div v-show="viewType === 'category'"><Semantics></Semantics></div> -->
  <div v-show="viewType === 'tag'"><ObjectsTag></ObjectsTag></div>
</template>

<script lang="ts" setup>
import { ref, watch, type Ref } from 'vue'
import { Icon } from '@iconify/vue'
// import Semantics from './Semantics.vue'
// import Instances from './Instances.vue'
import ObjectsTag from '@/video/panels/annos/ObjectsTag.vue'

const viewType = ref('table')
const handleClick = (type: string) => {
  viewType.value = type
}
</script>
<style lang="scss" scoped></style>
