<template>
  <el-drawer v-model="visible" :size="'50%'" destroy-on-close>
    <template #header>
      <h4>账号信息</h4>
    </template>
    <template #default>
      <el-button-group>
        <el-button
          size="default"
          @click="curTab = 'accountInfo'"
          :type="curTab === 'accountInfo' ? 'success' : ''"
          >我的账号</el-button
        >
        <el-button
          size="default"
          @click="curTab = 'userpass'"
          :type="curTab === 'userpass' ? 'success' : ''"
          >修改密码</el-button
        >
      </el-button-group>
      <div v-show="curTab === 'userpass'">
        <UserPassword></UserPassword>
      </div>
      <div v-show="curTab === 'accountInfo'">
        <el-form
          ref="form1Ref"
          :model="form1"
          :rules="form1rules"
          v-loading="form1Loading"
          label-position="right"
          label-width="auto"
          style="width: 580px"
        >
          <el-form-item label="手机号" prop="mobile_phone_no">
            <el-input
              v-model="form1.mobile_phone_no"
              style="width: 100%"
              placeholder="请输入手机号"
            >
              <template #prepend> +86 </template>
            </el-input>
          </el-form-item>
          <el-form-item label="邮箱账号" prop="email">
            <el-input
              v-model="form1.email"
              :readonly="form1.email !== ''"
              maxlength="100"
              style="width: 100%"
              placeholder="登录账号"
            />
          </el-form-item>
          <el-form-item>
            <el-row style="justify-content: center; align-items: center; width: 100%">
              <el-button @click="submitForm1(form1Ref)" type="primary">确定</el-button>
            </el-row>
          </el-form-item>
        </el-form>
      </div>
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { onMounted, toRaw, ref, reactive, watch } from 'vue'
import UserPassword from './UserPassword.vue'
import { userAuth } from '@/states/UserState'
import { ElMessage, type FormRules } from 'element-plus'
import { systemApi } from '@/api'
import { validateEmail, validateMobilePhoneNo } from '@/libs/validtor'

const curTab = ref('accountInfo')
const visible = ref(false) // 弹窗的是否展示
const form1Loading = ref(false)
const form1Ref = ref()

const form1Default = {
  email: userAuth.value.user.email || '',
  mobile_phone_no: userAuth.value.user.mobile_phone_no || ''
}
const form1 = reactive({ ...form1Default })

const checkEmail = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请输入邮箱'))
  } else if (!validateEmail(value)) {
    callback(new Error('请输入正确的邮箱'))
  } else {
    callback()
  }
}

const checkPhoneNo = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请输入手机号'))
  } else if (!validateMobilePhoneNo(value)) {
    callback(new Error('请输入正确的手机号'))
  } else {
    callback()
  }
}
const form1rules = reactive<FormRules>({
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { validator: checkEmail, trigger: 'blur' }
  ],
  mobile_phone_no: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { validator: checkPhoneNo, trigger: 'blur' }
  ]
})

const submitForm1 = async (formEl) => {
  if (!formEl) return
  await formEl.validate(async (valid, fields) => {
    if (valid) {
      // 设置name
      form1Loading.value = true
      systemApi
        .update_account(form1)
        .then((res) => {
          ElMessage({ message: res.statusText || '操作成功', type: 'success' })
          reloadUserInfo()
        })
        .finally(() => {
          form1Loading.value = false
        })
    }
  })
}

const reloadUserInfo = () => {
  systemApi.user_info({}).then((res) => {
    userAuth.value.user = res.data.user
    userAuth.value.roles = res.data.roles
    userAuth.value.permissions = res.data.permissions
    systemApi.config({}).then((res) => {
      userAuth.value.config = res.data
    })
  })
}

const open = () => {
  visible.value = true
}

const close = () => {
  visible.value = false
}
defineExpose({ open, close })
</script>
