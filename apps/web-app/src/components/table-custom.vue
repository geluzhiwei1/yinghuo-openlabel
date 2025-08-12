<template>
  <div>
    <div class="table-toolbar" v-if="hasToolbar">
      <div class="table-toolbar-left">
        <slot name="toolbarBtn"></slot>
        <slot
          name="dropdownBtn"
          v-if="multipleSelection.length > 0"
          v-bind="{ rows: multipleSelection }"
        ></slot>
      </div>
      <div class="table-toolbar-right flex-center">
        <template v-if="multipleSelection.length > 0">
          <el-tooltip
            effect="dark"
            :content="t('components.tableCustom.deleteSelection')"
            placement="top"
          >
            <el-icon class="columns-setting-icon" @click="delSelection(multipleSelection)">
              <Delete />
            </el-icon>
          </el-tooltip>
          <el-divider direction="vertical" />
        </template>
        <el-tooltip effect="dark" :content="t('components.tableCustom.refresh')" placement="top">
          <el-icon class="columns-setting-icon" @click="refresh">
            <Refresh />
          </el-icon>
        </el-tooltip>
        <el-divider direction="vertical" />
        <el-tooltip
          effect="dark"
          :content="t('components.tableCustom.columnSettings')"
          placement="top"
        >
          <el-dropdown :hide-on-click="false" size="small" trigger="click">
            <el-icon class="columns-setting-icon">
              <Setting />
            </el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="(c, index) in columns" :key="index">
                  <el-checkbox v-model="c.visible" :label="c.label" />
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
      </div>
    </div>
    <el-table
      class="mgb20"
      v-loading="loading"
      :style="{ width: '100%' }"
      border
      :data="tableData"
      :row-key="rowKey"
      @selection-change="handleSelectionChange"
      table-layout="auto"
    >
      <template v-for="item in columns" :key="item.prop">
        <el-table-column
          v-if="item.visible"
          :prop="item.prop"
          :label="item.label"
          :width="item.width"
          :type="item.type"
          :align="item.align || 'center'"
          :show-overflow-tooltip="item.showOverflowTooltip"
        >
          <template #default="{ row, $index }">
            <template v-if="item.type === 'index'">
              {{ getIndex($index) }}
            </template>
            <template v-if="!item.type">
              <slot :name="item.prop" :rows="row" :index="$index">
                <template v-if="item.prop == 'operator'">
                  <el-button size="small" :icon="View" @click="viewFunc(row)">
                    {{ t('components.tableCustom.view') }}
                  </el-button>
                  <el-button type="primary" size="small" :icon="Edit" @click="editFunc(row)">
                    {{ t('components.tableCustom.edit') }}
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    :icon="Delete"
                    @click="handleDelete(row)"
                    :disabled="row.disableDeleteBtn"
                  >
                    {{ t('components.tableCustom.delete') }}
                  </el-button>
                </template>
                <span v-else-if="item.formatter">
                  {{ item.formatter(row[item.prop]) }}
                </span>
                <span v-else>
                  {{ row[item.prop] }}
                </span>
              </slot>
            </template>
          </template>
        </el-table-column>
      </template>
    </el-table>
    <div class="oh pt16" v-if="hasPagination">
      <div class="fr">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :background="true"
          :layout="layout"
          :total="total"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
          :page-sizes="[10, 20, 30, 40, 50]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
import { toRefs, type PropType, ref } from 'vue'
import { Delete, Edit, View, Refresh } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  // 表格相关
  tableData: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array as PropType<any[]>,
    default: () => []
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  hasToolbar: {
    type: Boolean,
    default: true
  },
  //  分页相关
  hasPagination: {
    type: Boolean,
    default: true
  },
  total: {
    type: Number,
    default: 0
  },
  page: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 10
  },

  layout: {
    type: String,
    default: 'total, prev, pager, next, sizes'
  },
  delFunc: {
    type: Function,
    default: () => {}
  },
  viewFunc: {
    type: Function,
    default: () => {}
  },
  editFunc: {
    type: Function,
    default: () => {}
  },
  delSelection: {
    type: Function,
    default: () => {}
  },
  refresh: {
    type: Function,
    default: () => {}
  },
  changePage: {
    type: Function,
    default: () => {}
  },
  changeSize: {
    type: Function,
    default: () => {}
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const {
  tableData,
  columns,
  rowKey,
  hasToolbar,
  hasPagination,
  total,
  page,
  pageSize,
  layout,
  loading
} = toRefs(props)

columns.value.forEach((item) => {
  if (item.visible === undefined) {
    item.visible = true
  }
})

// 当选择项发生变化时会触发该事件
const multipleSelection = ref<any[]>([])
const handleSelectionChange = (selection: any[]) => {
  multipleSelection.value = selection
}

// 当前页码变化的事件
const handleCurrentChange = (val: number) => {
  props.changePage(val)
}

// page-size 改变时触发
const handleSizeChange = (value: number) => {
  props.changeSize(value)
}

const handleDelete = (row: any) => {
  ElMessageBox.confirm(t('components.tableCustom.deleteConfirm'), t('components.tableCustom.deleteTitle'), {
    type: 'warning'
  })
    .then(async () => {
      props.delFunc(row)
    })
    .catch(() => {})
}

const getIndex = (index: number) => {
  return index + 1 + (page.value - 1) * pageSize.value
}
</script>

<style scoped>
.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 10px;
}

.columns-setting-icon {
  display: block;
  font-size: 18px;
  cursor: pointer;
  color: #676767;
}
</style>
<style>
.table-header .cell {
  color: #333;
}
</style>
