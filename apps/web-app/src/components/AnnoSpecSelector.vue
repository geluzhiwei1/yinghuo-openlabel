<template>
  <el-row>
    <el-text type="success" v-show="options.inputVisible && valueRef.key">{{ valueRef.key + ' (' + valueRef.name + ')'}}</el-text>
  </el-row>
  <el-tooltip placement="bottom-start" raw-content content="选择标签分类标准">
    <el-popover placement="bottom" width="1024" auto-close="0" trigger="click">
      <template #reference>
        <el-button size="small" >
          {{ options.btnLabel }}
        </el-button>
      </template>
      <div>
        <el-row>
          <el-col :span="18"> <el-button-group>
              <el-button size="default" @click="currentTab = 'system-spec'"
                :type="currentTab === 'system-spec' ? 'success' : ''">系统规范</el-button>
              <el-button size="default" @click="handleUserSpecClick"
                :type="currentTab === 'my-spec' ? 'success' : ''">我的规范</el-button>
            </el-button-group></el-col>
          <el-col :span="6"><router-link to="/anno-specification">新建规范</router-link></el-col>
        </el-row>
        <div v-show="currentTab === 'system-spec'">
          <el-table-v2 :columns="systemTableColumns" :loading="loading" :data="systemTableDataRef" :width="1000"
            :height="300" :row-height="30" :row-event-handlers="{ onClick: systemTableRowClick }" ref="tableRef"
            fixed />
        </div>
        <div v-show="currentTab === 'my-spec'">
          <el-table-v2 :columns="myTableColumns" :data="myTableDataRef" :width="1024" :height="300" :row-height="30"
            :row-event-handlers="{ onClick: myTableRowClick }" ref="tableRef" fixed />
        </div>
      </div>
    </el-popover>
  </el-tooltip>
</template>
<script setup lang="tsx" name="AnnoBatch">
import { openlabelApi, annoSpecApi } from '@/api'
import { ref, watch, onMounted, reactive, computed } from 'vue'
import { ElTableV2, ElCol, ElTooltip, ElRow, type Column, ElButton, ElPopover, } from 'element-plus'

const tableRef = ref(null)
const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => {
      return {
        key: '',
        type: 'system',
      }
    }
  },
  options: {
    type: Object,
    default: () => {
      return {
        btnLabel: '选择',
        inputVisible: true,
      }
    }
  }
})
const emit = defineEmits(['update:modelValue'])

const currentTab = ref('system-spec')
const options = ref(props.options)
const systemTableDataRef = ref([])
const loading = ref(false)
const label = ref('')
const valueRef = ref(props.modelValue)

watch(() => valueRef.value, (val) => {
  // label.value = val.key + '(' + val.name + ')'
  emit('update:modelValue', val)
})

const systemTableColumns: Column<any>[] = [
  {
    width: 200,
    title: '名称',
    dataKey: 'name',
    key: 'name'
  },
  {
    width: 200,
    title: '编码',
    dataKey: 'taxonomy_key',
    key: 'taxonomy_key'
  },
  {
    width: 200,
    title: '分类',
    dataKey: 'domain',
    key: 'domain'
  },
  {
    width: 50,
    title: '版本',
    dataKey: 'version',
    key: 'version'
  },
  {
    width: 50,
    title: '语言',
    dataKey: 'language',
    key: 'language'
  },
  {
    width: 50,
    title: '参考',
    dataKey: 'url',
    key: 'url'
  },
  {
    width: 100,
    title: '说明',
    dataKey: 'description',
    key: 'description'
  }
]

const myTableColumns: Column<any>[] = [
  { dataKey: 'name', key: 'name', title: '名称', width: 200 },
  { dataKey: 'version', key: 'version', title: '版本', width: 100 },
  { dataKey: 'lang', key: 'lang', title: '语言', width: 100 },
  { dataKey: 'updated_time', key: 'updated_time', title: '更新时间', width: 200 },
  { dataKey: 'enabled', key: 'enabled', title: '是否启用', width: 100 },
  { dataKey: "desc", key: 'desc', title: "描述", width: 200 },
]
const myTableDataRef = ref([])

const loadSystemSpec = () => {
  loading.value = true
  openlabelApi.query({}).then((res: any) => {
    systemTableDataRef.value = res.data
  }).finally(() => {
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
  annoSpecApi.search(condition).then((res: any) => {
    myTableDataRef.value = res.data
  }).finally(() => {
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

const systemTableRowClick = (row) => {
  valueRef.value = { key: row.rowData['taxonomy_key'], type: 'system', name: row.rowData['name'], domain: row.rowData['domain'] }
  // emit('update:modelValue', val)
}
const myTableRowClick = (row) => {
  valueRef.value = { key: row.rowData['_id'], type: 'user', name: row.rowData['name'] }
  // emit('update:modelValue', val)
}

onMounted(() => {
  loadSystemSpec()
})
</script>
