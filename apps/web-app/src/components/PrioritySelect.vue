<template>
  <ElSelect v-model="selectVal" :placeholder="placeholder" @change="selectChange">
    <ElOption
      v-for="item in selectOptions"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </ElSelect>
</template>
<script>
export default {}
</script>
<script setup>
import { ref, computed } from 'vue'
import { ElSelect, ElOption } from 'element-plus'

const props = defineProps({
  selectedValue: {
    type: Number,
    default: null
  },
  placeholder: {
    type: String,
    default: '请选择'
  }
})
const emits = defineEmits(['update:selectedValue', 'onChangeSelect'])
const selectVal = computed({
  get() {
    return props.selectedValue
  },
  set(val) {
    emits('update:selectedValue', val)
  }
})

const selectOptions = ref([
  {
    value: 1,
    label: "1-最低"
  },
  {
    value: 2,
    label: "2"
  },
  {
    value: 3,
    label: "4-中等"
  },
  {
    value: 4,
    label: "4"
  },
  {
    value: 5,
    label: "5-最高"
  }
])

const selectChange = (val) => {
  emits('onChangeSelect', val)
}
</script>
