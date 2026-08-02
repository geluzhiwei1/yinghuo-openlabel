<template>
  <el-select v-model="valueRef" multiple placeholder="请选择角色">
      <el-option v-for="item in roleOptions" :key="item.value" :label="item.label"
          :value="item.value" />
  </el-select>
</template>
<script lang="tsx" setup>
import { onMounted, ref, watch } from 'vue'
import { roleApi } from '@/api'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

const valueRef = ref(props.modelValue)
const roleOptions = ref([])

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: string) => {
    emit('update:modelValue', val)
  }
)
onMounted(() => {
  roleApi.query_list().then((res) => {
    roleOptions.value = res.data
    })
})
</script>