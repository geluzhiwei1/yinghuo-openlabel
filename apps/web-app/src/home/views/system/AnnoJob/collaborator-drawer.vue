<template>
  <el-drawer v-model="visible" :size="'50%'" destroy-on-close>
    <template #header>
      <h4>协作管理{{ batchMode ? '-批量' : '' }}</h4>
    </template>
    <template #default>
      <el-text> 将任务分配给部门或个人，由部门或个人完成任务 </el-text>
      <h4>分配到部门</h4>
      <el-form :loading="loading">
        <el-form-item label="部门："
          ><deptTreeSelect v-model:modelValue="formData.dept_id"
        /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitDeptForm()"> 保存 </el-button>
        </el-form-item>
      </el-form>
      <el-divider></el-divider>
      <h4>分配到人</h4>
      <el-form :loading="loading">
        <el-form-item label="协作者："
          ><teamMembersSelect v-model:modelValue="formData.collaborators"
        /></el-form-item>
        <el-button type="primary" @click="submitCollaForm()"> 保存 </el-button>
      </el-form>
    </template>
  </el-drawer>
</template>

<script lang="ts" setup>
import { ref, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { ElButton, ElDrawer } from 'element-plus'
import deptTreeSelect from '@/components/dept-tree-select.vue'
import teamMembersSelect from '@/components/team-members-select.vue'
import { isEmpty } from 'radash'
import { annoJobPerformApi } from '@/api'

const loading = ref(false)
const visible = ref(false)
const formData = reactive({
  job_id: '',
  dept_id: '',
  collaborators: []
})
const batchMode = ref(false)
const rows = ref([])

const submitDeptForm = () => {
  if (isEmpty(formData.dept_id)) {
    ElMessage.warning('请选择部门')
  } else {
    // 提交数据
    loading.value = true
    if (!batchMode.value) {
      annoJobPerformApi
        .update_collaborator(formData)
        .then(() => {
          ElMessage.success('保存成功')
        })
        .finally(() => {
          loading.value = false
        })
    } else {
      const dtos = rows.value.map((item: any) => {
        return { job_id: item.uuid, dept_id: formData.dept_id }
      })
      annoJobPerformApi
        .update_collaborators(dtos)
        .then(() => {
          ElMessage.success('批量更新成功')
        })
        .finally(() => {
          loading.value = false
        })
    }
  }
}
const submitCollaForm = () => {
  if (isEmpty(formData.collaborators)) {
    ElMessage.warning('请选择协作者')
  } else {
    // 提交数据
    loading.value = true

    if (!batchMode.value) {
      annoJobPerformApi
        .update_collaborator(formData)
        .then(() => {
          ElMessage.success('保存成功')
        })
        .finally(() => {
          loading.value = false
        })
    } else {
      const dtos = rows.value.map((item: any) => {
        return { job_id: item.uuid, collaborators: formData.collaborators }
      })
      annoJobPerformApi
        .update_collaborators(dtos)
        .then(() => {
          ElMessage.success('批量更新成功')
        })
        .finally(() => {
          loading.value = false
        })
    }
  }
}

const open = (row: any) => {
  visible.value = true

  if (Array.isArray(row)) {
    // 批量操作
    batchMode.value = true
    rows.value = row
    formData.job_id = undefined
    formData.dept_id = undefined
    formData.collaborators = undefined
  } else {
    // 单个操作
    batchMode.value = false
    formData.job_id = row.uuid
    formData.dept_id = row.authority.dept
    formData.collaborators = row.authority.collaborators
  }
}
const close = () => {
  batchMode.value = false
  rows.value = []
  visible.value = false
}

defineExpose({ open, close })
</script>
