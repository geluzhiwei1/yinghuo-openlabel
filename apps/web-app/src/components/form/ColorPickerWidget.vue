<template>
  <el-row>
    <el-col :span="20"><el-input v-model="valueRef"></el-input></el-col>
    <el-col :span="4"
      ><el-color-picker v-model="valueRef" show-alpha :predefine="predefineColors"></el-color-picker
    ></el-col>
  </el-row>
</template>
<script lang="tsx" setup>
import { ref, watch } from 'vue'
import { ElInput, ElColorPicker } from 'element-plus'
const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
})
const predefineColors = ref([
  'rgba(255,0,0,0.5)',
  '#ff8c00',
  '#ffd700',
  '#90ee90',
  '#00ced1',
  '#1e90ff',
  '#c71585',
  'rgba(255, 69, 0, 0.68)',
  'rgb(255, 120, 0)',
  'hsv(51, 100, 98)',
  'hsva(120, 40, 94, 0.5)',
  'hsl(181, 100%, 37%)',
  'hsla(209, 100%, 56%, 0.73)',
  '#c7158577'
])
const valueRef = ref(props.modelValue)

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: string) => {
    emit('update:modelValue', val)
  }
)
</script>
