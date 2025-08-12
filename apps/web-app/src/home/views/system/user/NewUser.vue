<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    v-loading="formLoading"
    label-position="right"
    label-width="auto"
    style="width: 480px"
  >
    <el-form-item label="邮箱" prop="username">
      <el-input
        type="mail"
        v-model="form.username"
        maxlength="100"
        style="width: 100%"
        placeholder="请输入邮箱"
      >
        <template #append>
          <el-button @click="sendCode()" type="primary" :disabled="!sendCodeBtnEnabled">{{
            sendCodeBtnLabel
          }}</el-button>
        </template>
      </el-input>
    </el-form-item>
    <el-form-item label="验证码ID" prop="captcha_id_2">
      <el-input
        v-model="form.captcha_id_2"
        maxlength="100"
        style="width: 100%"
        placeholder="请输入验证码ID"
      >
        <template #prepend>{{ form.captcha_id_1 }}-</template>
        <template #append>-{{ form.captcha_id_3 }}</template>
      </el-input>
    </el-form-item>
    <el-form-item label="验证码" prop="captchaText">
      <el-input
        type="number"
        controls="false"
        v-model="form.captchaText"
        maxlength="100"
        style="width: 100%"
        placeholder="请输入您邮箱收到的6位数字"
        @change="verifyCode()"
      />
    </el-form-item>
    <el-form-item label="密码" prop="password">
      <el-input
        v-model="form.password"
        style="width: 100%"
        type="password"
        placeholder="请输入密码"
        show-password
      />
    </el-form-item>
    <el-form-item label="重复密码" prop="password2">
      <el-input
        v-model="form.password2"
        style="width: 100%"
        type="password"
        placeholder="请再次输入密码"
        show-password
      />
    </el-form-item>

    <el-form-item>
      <el-row style="justify-content: center; align-items: center; width: 100%">
        <el-button @click="submitForm()" type="primary" :disabled="!submitBtnEnabled"
          >确定</el-button
        >
        <el-button @click="userLogin.visible = false">取消</el-button>
      </el-row>
    </el-form-item>
  </el-form>
</template>
<script setup lang="ts">
import { onMounted, toRaw, ref, reactive, watch } from 'vue'
import { ElButton, ElForm, ElFormItem, ElMessage, ElInput } from 'element-plus'
import { clone, isEmpty } from 'radash'
import { userApi, emailCodeApi } from '@/api'
import { validateEmail } from '@/libs/validtor'

const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formRef = ref() // 表单 Ref
const submitBtnEnabled = ref(false) // capcha ok
const sendCodeBtnEnabled = ref(true)
const sendCodeBtnLabel = ref('发送验证码')
const captchaVisible = ref(false) // capcha
const captchaSrc = ref('') // capcha
const rules = ref({
  username: [
    { required: true, message: '请输入邮箱账号' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  captchaText: [
    { required: true, message: '请输入验证码' },
    { min: 6, max: 6, message: '长度为6', triggle: 'blur' }
  ],
  captcha_id_2: [{ required: true, message: '请输入您邮箱收到的验证码ID' }],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  password2: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' },
    {
      validator: (rule, value, callback) => {
        let error = false
        if (form.password !== form.password2) {
          callback(new Error('两次输入的密码不一致'))
          error = true
          submitBtnEnabled.value = false
        } else {
          // enable button
          submitBtnEnabled.value = true
        }
        if (!error) {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
})

const formDefault = {
  username: '',
  captchaText: '',
  captcha_id_1: '',
  captcha_id_2: '',
  captcha_id_3: '',
  password: '',
  password2: ''
}
const form = reactive({ ...clone(formDefault) })

const startCountdown = () => {
  let countdown = 60
  const intervalId = setInterval(() => {
    countdown--
    if (countdown <= 0) {
      sendCodeBtnEnabled.value = true
      clearInterval(intervalId)
      sendCodeBtnLabel.value = '发送验证码'
    } else {
      sendCodeBtnLabel.value = `${countdown}秒后重试`
    }
  }, 1000)
}

const sendCode = () => {
  if (!validateEmail(form.username)) {
    ElMessage({ message: '请输入合法的邮箱地址', type: 'warning' })
    return
  }
  formLoading.value = true
  fetch(emailCodeApi.sendcode, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mail: form.username
    })
  })
    .then((response) => {
      if (!response.ok) {
        ElMessage({ message: `HTTP error! status: ${response.status}`, type: 'error' })
      }
      return response.json()
    })
    .then((json) => {
      if (json.status !== 0) {
        ElMessage({ message: `Failed: ${json.statusText}`, type: 'error' })
      } else {
        ElMessage({ message: '发送成功，请到邮箱查看验证码。', type: 'success' })
        form.captcha_id_1 = json.data[0]
        form.captcha_id_3 = json.data[1]
      }
    })
    .catch((error) => {
      ElMessage({ message: `HTTP error! ${error}`, type: 'error' })
    })
    .finally(() => {
      formLoading.value = false
      sendCodeBtnEnabled.value = false
      startCountdown()
    })
}

const verifyCode = () => {
  if (isEmpty(form.captchaText) || form.captchaText.length !== 6) {
    return
  }
  formLoading.value = true
  fetch(emailCodeApi.checkUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: form.captcha_id_1 + '-' + form.captcha_id_2 + '-' + form.captcha_id_3,
      text: form.captchaText
    })
  })
    .then((response) => {
      if (!response.ok) {
        ElMessage({ message: `HTTP error! status: ${response.status}`, type: 'error' })
      }
      return response.json()
    })
    .then((json) => {
      if (json.status !== 200) {
        ElMessage({ message: '验证码校验失败', type: 'error' })
        userApi.captcha_id = ''
        submitBtnEnabled.value = false
      } else {
        ElMessage({ message: '验证码校验通过', type: 'success' })
        userApi.captcha_id = form.captcha_id_1 + '-' + form.captcha_id_2 + '-' + form.captcha_id_3
        submitBtnEnabled.value = true
      }
    })
    .catch((error) => {
      ElMessage({ message: `HTTP error! ${error}`, type: 'error' })
    })
    .finally(() => {
      formLoading.value = false
    })
}

const submitForm = () => {
  formRef.value.validate(async (valid, fields) => {
    if (valid) {
      formLoading.value = true
      userApi
        .register(
          {
            email: form.username,
            password: form.password
          },
          {
            'X-Captcha-Id': form.captcha_id_1 + '-' + form.captcha_id_2 + '-' + form.captcha_id_3
          }
        )
        .then((data) => {
          if (data) {
            ElMessage({ message: '注册成功，请登录。', type: 'success' })
          } else {
            ElMessage({ message: '注册失败。如果您已经注册过，请直接登录。', type: 'error' })
          }
        })
        .finally(() => {
          formLoading.value = false
        })
    } else {
      formLoading.value = false
    }
  })
}
</script>
