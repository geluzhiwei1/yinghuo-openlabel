<template>
  <el-tree-select v-model="valueRef" :data="data" :render-after-expand="false" show-checkbox />
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { ElTreeSelect } from 'element-plus'

// 自定义控件，自定义UI组件
// 属性定义
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
const emit = defineEmits(['change'])

// 监听和触发
watch(
  () => valueRef.value,
  (val: string) => {
    emit('change', val)
  }
)

const data = [
  {
    value: '1',
    label: 'Level one 1',
    children: [
      {
        value: '1-1',
        label: 'Level two 1-1',
        children: [
          {
            value: '1-1-1',
            label: 'Level three 1-1-1'
          }
        ]
      }
    ]
  },
  {
    value: '2',
    label: 'Level one 2',
    children: [
      {
        value: '2-1',
        label: 'Level two 2-1',
        children: [
          {
            value: '2-1-1',
            label: 'Level three 2-1-1'
          }
        ]
      },
      {
        value: '2-2',
        label: 'Level two 2-2',
        children: [
          {
            value: '2-2-1',
            label: 'Level three 2-2-1'
          }
        ]
      }
    ]
  },
  {
    value: '3',
    label: 'Level one 3',
    children: [
      {
        value: '3-1',
        label: 'Level two 3-1',
        children: [
          {
            value: '3-1-1',
            label: 'Level three 3-1-1'
          }
        ]
      },
      {
        value: '3-2',
        label: 'Level two 3-2',
        children: [
          {
            value: '3-2-1',
            label: 'Level three 3-2-1'
          }
        ]
      }
    ]
  }
]
</script>
