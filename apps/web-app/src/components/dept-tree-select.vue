<template>
  <el-tree-select
    v-model="valueRef"
    :data="data"
    :render-after-expand="true"
    show-checkbox
    default-expand-all
    node-key="key"
  />
</template>
<script lang="tsx" setup>
import { onMounted, ref, watch } from 'vue'
import { userDeptsApi } from '@/api'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

const valueRef = ref(props.modelValue)
const data = ref([])

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: string) => {
    emit('update:modelValue', val)
  }
)
onMounted(() => {
  userDeptsApi.queryTree().then((res) => {
    data.value = res.data
  })
})
</script>
