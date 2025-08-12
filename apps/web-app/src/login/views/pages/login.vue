<template>
  <div class="login-bg">
    <div class="login-container">
      <LocaleSelect style="position: absolute; top: 10px; right: 10px" />
      <div class="login-header">
        <img class="logo mr10" src="/src/assets/logo.png" alt="" />
      </div>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        v-loading="formLoading"
        label-position="right"
        label-width="auto"
        style="width: 380px"
        size="large"
      >
        <div>
          <el-form-item prop="email">
            <el-input
              v-model="form.email"
              maxlength="100"
              style="width: 100%"
              autocomplete="on"
              :placeholder="$t('auth.login.emailPlaceholder')"
            >
              <template #prepend>
                <el-icon>
                  <User />
                </el-icon> </template
            ></el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              style="width: 100%"
              type="password"
              :placeholder="$t('auth.login.passwordPlaceholder')"
              show-password
            >
              <template #prepend>
                <el-icon>
                  <Lock />
                </el-icon> </template
            ></el-input>
          </el-form-item>
          <el-button
            class="login-btn"
            type="primary"
            size="large"
            @click="submitForm(formRef)"
            >{{ $t('auth.login.loginBtn') }}</el-button
          >
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { LocaleSelect } from '@/locales'
import type { FormInstance } from 'element-plus'
import { ElButton, ElForm, ElFormItem, ElMessage, ElInput, ElLoading } from 'element-plus'
import { clone } from 'radash'
import { messages } from '@/states'
import { userApi, systemApi } from '@/api'
import { userAuth, cleanLoginfo } from '@/states/UserState'

const { t } = useI18n()
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formRef = ref<FormInstance>() // 表单 Ref
const capchaOk = ref(true) // capcha ok

const rules = {
  email: [
    { required: true, message: t('auth.login.rules.emailRequired') },
    { min: 6, max: 50, message: t('auth.login.rules.emailLength'), triggle: 'blur' }
  ],
  password: [
    { required: true, message: t('auth.login.rules.passwordRequired') },
    { min: 6, max: 50, message: t('auth.login.rules.passwordLength'), triggle: 'blur' }
  ],
}

const formDefault = {
  email: '',
  password: '',
  accountType: '2',
  captchaId: '',
  captchaText: '',
  mobile_phone_no: '',
  mobileMsgCode: '',
  useMobileMsgCode: true
}
const form = reactive({ ...clone(formDefault) })

const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid: boolean) => {
    if (valid) {
      // 设置name
      // formLoading.value = true
      const loading = ElLoading.service({
        lock: true,
        text: t('auth.login.logining'),
        background: 'rgba(0, 0, 0, 0.7)'
      })

      userApi
        .login(form, {})
        .then((json: any) => {
          // 成功后，获取用户信息

          loading.setText(t('auth.login.loginSuccess'))

          userAuth.value.access_token = json.data.access_token
          userAuth.value.token_type = 'jwt'
          userAuth.value.isLogin = true

          systemApi
            .user_info({})
            .then((res: any) => {
              userAuth.value.user = res.data.user
              userAuth.value.roles = res.data.roles
              userAuth.value.permissions = res.data.permissions
              loading.setText(t('auth.login.loadUserConfig'))

              systemApi.config({}).then((res: any) => {
                userAuth.value.config = res.data
                loading.setText(t('auth.login.loadComplete'))
                setTimeout(() => {
                  loading.close()
                  // 跳转到主页
                  window.location.href = (import.meta.env.BASE_URL || '') + '/home.html'
                }, 500)
              })
            })
            .catch(() => {
              // ElMessage({ message: err, type: 'error', })
              loading.setText(t('auth.login.reLogin'))
            })
        })
        .catch(() => {
          // ElMessage({ message: error, type: 'warning' })
          loading.close()
        })
    }
  })
}

cleanLoginfo()

onMounted(() => {
  cleanLoginfo()
})
</script>

<style scoped>
.login-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  /**background: url(../../assets/img/login-bg.jpg) center/cover no-repeat;*/
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.login-title {
  font-size: 22px;
  color: #333;
  font-weight: bold;
}

.login-container {
  width: 450px;
  border-radius: 5px;
  background: #fff;
  padding: 40px 50px 50px;
  box-sizing: border-box;
}

.pwd-tips {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #787878;
}

.login-btn {
  display: block;
  width: 100%;
}
</style>
