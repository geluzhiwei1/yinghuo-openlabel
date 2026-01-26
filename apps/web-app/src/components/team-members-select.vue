<template>
  <el-select v-model="valueRef" multiple filterable :placeholder="roleOptions.length === 0
      ? t('components.teamMembersSelect.noMembers')
      : t('components.teamMembersSelect.placeholder')
    ">
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
import { teamApi } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  modelValue: {
    type: Array<string>,
    required: true
  }
})

const valueRef = ref(props.modelValue)
const roleOptions = ref<{ label: string; value: string }[]>([])

const emit = defineEmits(['update:modelValue'])
watch(
  () => valueRef.value,
  (val: Array<string>) => {
    emit('update:modelValue', val)
  }
)
onMounted(() => {
  teamApi.query_members().then((res: any) => {
    roleOptions.value = res.data.map(
      (item: {
        email: string
        user_info: { name: string; mobile_number: string }
        user_id: string
      }) => ({
        label: `${item.email}-${item.user_info.name}-${item.user_info.mobile_number}`,
        value: item.user_id
      })
    )
  })
})
</script>
