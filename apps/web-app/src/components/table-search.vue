<template>
  <div class="search-container">
    <el-form ref="searchRef" :model="query" :inline="true">
      <el-form-item :label="item.label" :prop="item.prop" v-for="item in options" :key="item.prop">
        <!-- 文本框、下拉框、日期框 -->
        <el-input
          v-if="item.type === 'input'"
          v-model="localQuery[item.prop]"
          :disabled="item.disabled"
          :placeholder="item.placeholder"
          clearable
        ></el-input>
        <el-select
          v-else-if="item.type === 'select'"
          v-model="localQuery[item.prop]"
          :disabled="item.disabled"
          :placeholder="item.placeholder"
          clearable
        >
          <el-option
            v-for="opt in item.opts"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          ></el-option>
        </el-select>
        <el-date-picker
          v-else-if="item.type === 'date'"
          type="date"
          v-model="localQuery[item.prop]"
          :value-format="item.format"
        ></el-date-picker>
        <el-date-picker
          v-else-if="item.type === 'daterange'"
          v-model="localQuery[item.prop]"
          type="daterange"
          :range-separator="t('components.tableSearch.rangeSeparator')"
          :start-placeholder="t('components.tableSearch.startDate')"
          :end-placeholder="t('components.tableSearch.endDate')"
        >
        </el-date-picker>
        <el-switch v-else-if="item.type === 'switch'" v-model="localQuery[item.prop]" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" @click="search">{{
          t('components.tableSearch.search')
        }}</el-button>
        <el-button :icon="Refresh" @click="resetForm(searchRef)">{{
          t('components.tableSearch.reset')
        }}</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
/*
Copyright (C) 2025 undefined

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
import type { FormInstance } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { type PropType, ref, reactive, watch } from 'vue'
import type { FormOptionList } from '@/types/form-option'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  query: {
    type: Object,
    required: true
  },
  options: {
    type: Array as PropType<Array<FormOptionList>>,
    required: true
  },
  search: {
    type: Function,
    default: () => {}
  }
})

const localQuery = reactive(props.query)
watch(
  () => props.query,
  (newVal) => {
    Object.assign(localQuery, newVal)
  },
  { deep: true }
)

const searchRef = ref<FormInstance>()
const resetForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  props.search()
}
</script>

<style scoped>
.search-container {
  /* padding: 20px 30px 0; */
  margin-bottom: 5px;
  /* border: 1px solid #ddd; */
  border-radius: 5px;
}
</style>
