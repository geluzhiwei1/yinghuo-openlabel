<template>
  <el-select v-model="valueRef" multiple filterable :placeholder="roleOptions.length === 0 ? '请先添加团队成员' : '请选择'">
      <el-option v-for="item in roleOptions" :key="item.value" :label="item.label"
          :value="item.value" />
  </el-select>
</template>
<script lang="tsx" setup>
import { onMounted, ref, watch } from 'vue'
import { teamApi } from '@/api'

const props = defineProps({
  modelValue: {
    type: Array<string>,
    required: true
  }
})

const valueRef = ref(props.modelValue)
const roleOptions = ref([])

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: Array<string>) => {
    emit('update:modelValue', val)
  }
)
onMounted(() => {
  teamApi.query_members().then((res) => {
    roleOptions.value = res.data.map((item: any) => ({
      label: `${item.email}-${item.user_info.name}-${item.user_info.mobile_number}`,
      value: item.user_id,
    }))
    })
})
</script>