<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    v-loading="formLoading"
    label-position="right"
    label-width="auto"
    style="width: 580px"
  >
    <el-form-item label="手机号" prop="mobile_phone_no">
      <el-input
        v-model="form.mobile_phone_no"
        maxlength="100"
        style="width: 100%"
        placeholder="手机号"
        readonly
      />
    </el-form-item>
    <el-form-item label="邮箱账号" prop="email">
      <el-input
        v-model="form.email"
        maxlength="100"
        style="width: 100%"
        placeholder="登录账号"
        readonly
      />
    </el-form-item>
    <el-form-item label="原密码" prop="old_password">
      <el-input
        v-model="form.old_password"
        style="width: 100%"
        type="password"
        placeholder="请输入原密码"
        show-password
      />
    </el-form-item>
    <el-form-item label="新密码" prop="new_password">
      <el-input
        v-model="form.new_password"
        style="width: 100%"
        type="password"
        placeholder="请输入新密码"
        show-password
      />
    </el-form-item>
    <el-form-item label="重复新密码" prop="new_password2">
      <el-input
        v-model="form.new_password2"
        style="width: 100%"
        type="password"
        placeholder="请再次输入新密码"
        show-password
      />
    </el-form-item>
    <el-form-item>
      <el-row style="justify-content: center; align-items: center; width: 100%">
        <el-button @click="submitForm(formRef)" type="primary">确定</el-button>
      </el-row>
    </el-form-item>
  </el-form>
</template>
<script setup lang="ts">
import { onMounted, toRaw, ref, reactive, watch } from 'vue'
import { ElButton, ElForm, ElFormItem, ElMessage, ElInput } from 'element-plus'
import { clone } from 'radash'
import { messages } from '@/states'
import { userAuth } from '@/states/UserState'
import { systemApi, userApi } from '@/api'

const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formRef = ref() // 表单 Ref

const rules = ref({
  old_password: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  new_password: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  new_password2: [
    { required: true, message: '请重复输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' },
    {
      validator: (rule, value) => {
        if (value !== form.new_password) {
          return Promise.reject('两次输入密码不一致')
        } else return true
      },
      triggle: 'blur'
    }
  ]
})

const formDefault = {
  email: userAuth.value.user.email,
  mobile_phone_no: userAuth.value.user.mobile_phone_no,
  old_password: '',
  new_password: '',
  new_password2: ''
}
const form = reactive({ ...clone(formDefault) })

const submitForm = async (formEl) => {
  if (!formEl) return
  await formEl.validate(async (valid, fields) => {
    if (valid) {
      // 设置name
      formLoading.value = true
      systemApi
        .update_password(form)
        .then((res) => {
          ElMessage({ message: res.statusText || '操作成功', type: 'success' })
        })
        .finally(() => {
          formLoading.value = false
        })
    }
  })
}
</script>
