<template>
  <el-select v-model="valueRef" multiple :placeholder="t('components.rolesSelect.placeholder')">
    <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
  </el-select>
</template>
<script lang="tsx" setup>
/*
Copyright (C) 2025 格律至微

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { onMounted, ref, watch } from 'vue'
import { roleApi } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

const valueRef = ref(props.modelValue)
const roleOptions = ref<{ label: string; value: string }[]>([])

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: string) => {
    emit('update:modelValue', val)
  }
)
onMounted(() => {
  roleApi.query_list().then((res: any) => {
    roleOptions.value = res.data
  })
})
</script>
