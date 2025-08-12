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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  selectedValue: {
    type: Number,
    default: null
  },
  placeholder: {
    type: String,
    default: 'Please select priority'
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
    label: t('components.prioritySelect.lowest')
  },
  {
    value: 2,
    label: '2'
  },
  {
    value: 3,
    label: t('components.prioritySelect.medium')
  },
  {
    value: 4,
    label: '4'
  },
  {
    value: 5,
    label: t('components.prioritySelect.highest')
  }
])

const selectChange = (val) => {
  emits('onChangeSelect', val)
}
</script>
