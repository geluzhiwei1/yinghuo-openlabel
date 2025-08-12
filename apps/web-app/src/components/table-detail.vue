<template>
  <el-descriptions :title="t(title || '')" :column="column" border>
    <el-descriptions-item v-for="item in list" :span="item.span" :key="item.prop">
      <template #label> {{ t(item.label) }} </template>
      <slot :name="item.prop" :rows="row">
        {{ item.value || row[item.prop] }}
      </slot>
    </el-descriptions-item>
  </el-descriptions>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ListItem {
  prop: string
  label: string
  span?: number
  value?: any
}

interface Data {
  row: any
  title: string
  column?: number
  list: ListItem[]
}

const props = defineProps({
  data: {
    type: Object as () => Data,
    required: true
  }
})
const { row, title, column = 2, list } = props.data
</script>
