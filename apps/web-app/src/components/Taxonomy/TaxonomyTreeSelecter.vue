<template>
  <el-scrollbar height="600px">
    <el-tree
      ref="treeRef"
      v-model="valueRef"
      :data="treeData"
      show-checkbox
      node-key="name"
      default-expand-all
      :expand-on-click-node="false"
      :check-on-click-node="true"
      :check-strictly="true"
      @check="handleCheck"
    >
      <template #default="{ node, data }">
        <span class="custom-tree-node">
          <span>{{ data.name }}</span>
          <span>
            <a
              v-if="node.isLeaf"
              :href="
                get(taxonomyState.taxonnomyInfo, 'ontologies[0]', '') +
                jobConfig.taxonomy +
                '#' +
                data.name
              "
              target="_blank"
            >
              ...
            </a>
            <a style="margin-left: 8px" v-if="node.isLeaf" @click="handleClick(node, data)">
              选择
            </a>
          </span>
        </span>
      </template>
    </el-tree>
    <el-row v-if="jobConfig.taxonomy.type === 'user'">
      <el-col :span="8"
        >当前规范<el-button
          type="success"
          size="small"
          :icon="Refresh"
          circle
          @click="refresh()"
        ></el-button
        >：
      </el-col>
      <el-col :span="16">{{ jobConfig.taxonomy.name }}</el-col>
    </el-row>
    <el-row v-else>
      <el-col :span="8"
        >当前规范<el-button
          type="success"
          size="small"
          :icon="Refresh"
          circle
          @click="refresh()"
        ></el-button
        >：</el-col
      >
      <el-col :span="16">{{
        jobConfig.taxonomy.key + '（' + jobConfig.taxonomy.name + '）'
      }}</el-col>
    </el-row>
  </el-scrollbar>
</template>

<script lang="ts" setup>
import { onMounted, ref, toRaw, watch } from 'vue'
import { ElScrollbar } from 'element-plus'
import { onUnmounted } from 'vue'
import { taxonomyState, loadSpec, getOntologyClassNames } from '@/states/TaxonomyState'
import { get } from '@/utils/lodash'
import { jobConfig } from '@/states/job-config'
import { messages } from '@/states'
import { Refresh } from '@element-plus/icons-vue'

const treeRef = ref()
const treeData = ref()
const handleClick = (node, data) => {
  treeRef.value.setChecked(node, true)
  valueRef.value = data.name
  emit('buttonClick', { node, data })
}

const refresh = () => {
  getOntologyClassNames(jobConfig.mission)
  loadSpec()
}

/**
 * 保证单选
 * 只能选叶子节点
 *
 * @param currObj
 * @param isChecked
 */
const handleCheck = (currObj, isChecked) => {
  const nodeDatas = treeRef.value.store.nodesMap
  if (isChecked) {
    if (nodeDatas[currObj.name].isLeaf) {
      treeRef.value.setCheckedNodes([currObj])
      valueRef.value = toRaw(currObj).name
    } else {
      // treeRef.value.setCheckedNodes([currObj.children[0]])
      messages.lastFailed = '必须选择叶子节点.'
      for (const k of isChecked.checkedKeys) {
        treeRef.value.setChecked(k, false, false)
      }
      treeRef.value.setChecked(valueRef.value, true, false)
    }
  }
}

const props = defineProps({
  selectedValue: {
    type: String,
    default: '',
    required: true
  }
})

// 选择框的值
const valueRef = ref(props.selectedValue)

// 事件定义
const emit = defineEmits(['change', 'buttonClick'])

// 监听和触发
watch(
  () => valueRef.value,
  (val: string) => {
    emit('change', val)
  }
)

watch(
  () => taxonomyState.ontology,
  (newVal) => {
    treeData.value = newVal
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  treeRef.value.setChecked(valueRef.value, false, false)
})
onUnmounted(() => {})
</script>
<style>
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}
</style>
