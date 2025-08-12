<template>
  <el-row>
    <el-text type="success" v-show="options.inputVisible && valueRef.key">{{
      valueRef.key + ' (' + valueRef.name + ')'
    }}</el-text>
  </el-row>
  <el-tooltip
    placement="bottom-start"
    raw-content
    :content="t('components.annoSpecSelector.tooltip')"
  >
    <el-popover placement="bottom" width="1024" :auto-close="0" trigger="click">
      <template #reference>
        <el-button size="small">
          {{ options.btnLabel }}
        </el-button>
      </template>
      <div>
        <el-row>
          <el-col :span="18">
            <el-button-group>
              <el-button
                size="default"
                @click="currentTab = 'system-spec'"
                :type="currentTab === 'system-spec' ? 'success' : ''"
                >{{ t('components.annoSpecSelector.systemSpec') }}</el-button
              >
              <el-button
                size="default"
                @click="handleUserSpecClick"
                :type="currentTab === 'my-spec' ? 'success' : ''"
                >{{ t('components.annoSpecSelector.mySpec') }}</el-button
              >
            </el-button-group></el-col
          >
          <el-col :span="6"
            ><router-link to="/anno-specification">{{
              t('components.annoSpecSelector.newSpec')
            }}</router-link></el-col
          >
        </el-row>
        <div v-show="currentTab === 'system-spec'">
          <el-table-v2
            :columns="systemTableColumns"
            :loading="loading"
            :data="systemTableDataRef"
            :width="1000"
            :height="300"
            :row-height="30"
            :row-event-handlers="{ onClick: systemTableRowClick }"
            ref="tableRef"
            fixed
          />
        </div>
        <div v-show="currentTab === 'my-spec'">
          <el-table-v2
            :columns="myTableColumns"
            :data="myTableDataRef"
            :width="1024"
            :height="300"
            :row-height="30"
            :row-event-handlers="{ onClick: myTableRowClick }"
            ref="tableRef"
            fixed
          />
        </div>
      </div>
    </el-popover>
  </el-tooltip>
</template>
<script setup lang="tsx" name="AnnoBatch">
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
import { openlabelApi, annoSpecApi } from '@/api'
import { ref, watch, onMounted } from 'vue'
import { ElTableV2, ElCol, ElTooltip, ElRow, type Column, ElButton, ElPopover } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const tableRef = ref(null)
const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => {
      return {
        key: '',
        type: 'system'
      }
    }
  },
  options: {
    type: Object,
    default: () => {
      return {
        btnLabel: 'Select',
        inputVisible: true
      }
    }
  }
})
const emit = defineEmits(['update:modelValue'])

const currentTab = ref('system-spec')
const options = ref(props.options)
const systemTableDataRef = ref([])
const loading = ref(false)
const valueRef = ref(props.modelValue)

watch(
  () => valueRef.value,
  (val) => {
    // label.value = val.key + '(' + val.name + ')'
    emit('update:modelValue', val)
  }
)

const systemTableColumns: Column<any>[] = [
  {
    width: 200,
    title: t('components.annoSpecSelector.name'),
    dataKey: 'name',
    key: 'name'
  },
  {
    width: 200,
    title: t('components.annoSpecSelector.code'),
    dataKey: 'taxonomy_key',
    key: 'taxonomy_key'
  },
  {
    width: 200,
    title: t('components.annoSpecSelector.category'),
    dataKey: 'domain',
    key: 'domain'
  },
  {
    width: 50,
    title: t('components.annoSpecSelector.version'),
    dataKey: 'version',
    key: 'version'
  },
  {
    width: 50,
    title: t('components.annoSpecSelector.language'),
    dataKey: 'language',
    key: 'language'
  },
  {
    width: 50,
    title: t('components.annoSpecSelector.reference'),
    dataKey: 'url',
    key: 'url'
  },
  {
    width: 100,
    title: t('components.annoSpecSelector.description'),
    dataKey: 'description',
    key: 'description'
  }
]

const myTableColumns: Column<any>[] = [
  { dataKey: 'name', key: 'name', title: t('components.annoSpecSelector.name'), width: 200 },
  {
    dataKey: 'version',
    key: 'version',
    title: t('components.annoSpecSelector.version'),
    width: 100
  },
  { dataKey: 'lang', key: 'lang', title: t('components.annoSpecSelector.language'), width: 100 },
  {
    dataKey: 'updated_time',
    key: 'updated_time',
    title: t('components.annoSpecSelector.updatedTime'),
    width: 200
  },
  {
    dataKey: 'enabled',
    key: 'enabled',
    title: t('components.annoSpecSelector.enabled'),
    width: 100
  },
  { dataKey: 'desc', key: 'desc', title: t('components.annoSpecSelector.desc'), width: 200 }
]
const myTableDataRef = ref([])

const loadSystemSpec = () => {
  loading.value = true
  openlabelApi
    .query({})
    .then((res: any) => {
      systemTableDataRef.value = res.data
    })
    .finally(() => {
      loading.value = false
    })
}

const handleUserSpecClick = () => {
  currentTab.value = 'my-spec'
  loadMySpec()
}

const loadMySpec = () => {
  loading.value = true
  const condition = {
    pager: {
      page: 1,
      page_size: 10
    },
    query: {
      enabled: true
    }
  }
  annoSpecApi
    .search(condition)
    .then((res: any) => {
      myTableDataRef.value = res.data
    })
    .finally(() => {
      loading.value = false
    })
}

// const selectVal = computed({
//   get() {
//     return props.data
//   },
//   set(val) {
//     // inputValue.value = val.key + '（' + val.name + '）'
//     emit('update:modelValue', val)
//   }
// })

const systemTableRowClick = (row: any) => {
  valueRef.value = {
    key: row.rowData['taxonomy_key'],
    type: 'system',
    name: row.rowData['name'],
    domain: row.rowData['domain']
  }
  // emit('update:modelValue', val)
}
const myTableRowClick = (row: any) => {
  valueRef.value = { key: row.rowData['_id'], type: 'user', name: row.rowData['name'] }
  // emit('update:modelValue', val)
}

onMounted(() => {
  loadSystemSpec()
})
</script>
