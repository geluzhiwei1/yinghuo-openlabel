<template>
  <el-dialog
    title="编辑协作者"
    v-model="dialogVisible"
    :destroy-on-close="true"
    style="width: 600px"
  >
    <el-row>
      <el-col :span="6"> 协作者邮箱 </el-col>
      <el-col :span="18">
        <div>
          <el-tag
            v-for="tag in dynamicTags"
            :key="tag"
            closable
            :disable-transitions="false"
            @close="handleClose(tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="inputVisible"
            ref="InputRef"
            v-model="inputValue"
            class="w-20"
            size="small"
            @keyup.enter="handleInputConfirm"
            @blur="handleInputConfirm"
          />
          <el-button v-else class="button-new-tag" size="small" @click="showInput">
            + 添加
          </el-button>
        </div>
      </el-col>
    </el-row>
    <el-row>
      <el-col :span="6"> 发送通知邮件 </el-col>
      <el-col :span="18">
        <el-switch v-model="emailNotify" active-text="是" inactive-text="否" />
      </el-col>
    </el-row>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="submitForm()" :loading="saveLoading" type="primary">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import { ElInput, ElMessage } from 'element-plus'
import type { InputInstance } from 'element-plus'
import { annoJobPerformApi } from '@/api'
import { validateEmail } from '@/libs/validtor'

const dialogVisible = ref(false)
const saveLoading = ref(false)
const inputValue = ref('')
const dynamicTags = ref([])
const inputVisible = ref(false)
const InputRef = ref<InputInstance>()
const uuid = ref('')
const emailNotify = ref(true)

const handleClose = (tag: string) => {
  dynamicTags.value.splice(dynamicTags.value.indexOf(tag), 1)
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (validateEmail(inputValue.value)) {
      dynamicTags.value.push(inputValue.value)
      inputVisible.value = false
      inputValue.value = ''
    } else {
      ElMessage({ message: '请输入正确的邮箱', type: 'error' })
    }
  }
}

const submitForm = () => {
  saveLoading.value = true
  annoJobPerformApi
    .update({
      _id: uuid.value,
      authority: {
        collaborators: dynamicTags.value
      }
    })
    .then(() => {
      ElMessage({ message: '保存成功', type: 'success' })
    })
    .finally(() => {
      saveLoading.value = false
    })
}

const open = (row: any) => {
  dynamicTags.value = row.authority.collaborators || []
  uuid.value = row._id
  dialogVisible.value = true
}
const close = () => {
  dialogVisible.value = false
}

defineExpose({ open, close })
</script>
