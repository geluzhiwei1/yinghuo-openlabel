<template>
  <div class="auth-layout">
    <!-- Left brand panel -->
    <div class="auth-brand">
      <div class="auth-brand__glow" aria-hidden="true" />
      <div class="auth-brand__grid" aria-hidden="true" />
      <div class="auth-brand__inner">
        <div class="auth-brand__eyebrow">
          <span class="auth-brand__dot" />
          <span class="auth-brand__eyebrow-text">FIREFLY · LAB</span>
        </div>
        <h1 class="auth-brand__name">
          萤火<span class="auth-brand__period">.</span>
        </h1>
        <p class="auth-brand__slogan">数据标注的实验室记录本 ——<br />高效、精准、可追溯。</p>
        <div class="auth-brand__features">
          <div class="auth-brand__feature">
            <span class="auth-brand__feature-idx">01</span>
            <Icon icon="lucide:image" :width="20" />
            <span>2D / 3D 多模态标注</span>
          </div>
          <div class="auth-brand__feature">
            <span class="auth-brand__feature-idx">02</span>
            <Icon icon="lucide:cpu" :width="20" />
            <span>AI 辅助标注</span>
          </div>
          <div class="auth-brand__feature">
            <span class="auth-brand__feature-idx">03</span>
            <Icon icon="lucide:users" :width="20" />
            <span>团队协作与审核</span>
          </div>
        </div>
        <div class="auth-brand__quote">
          <span class="auth-brand__quote-mark">"</span>
          <p class="auth-brand__quote-text">Every pixel,<br />every point.</p>
          <span class="auth-brand__quote-src">— LAB NOTE §001</span>
        </div>
      </div>
    </div>

    <!-- Right form panel -->
    <div class="auth-form-panel">
      <div class="auth-form-card">
        <div class="auth-form-card__header">
          <span class="auth-form-card__eyebrow">SIGN IN · §A</span>
          <h2 class="auth-form-card__title">
            欢迎回来<span class="auth-form-card__period">.</span>
          </h2>
          <p class="auth-form-card__subtitle">登录您的账号以继续</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          class="auth-form"
        >
          <!-- Login method segmented -->
          <el-form-item prop="accountType">
            <el-segmented v-model="form.accountType" :options="loginMethodOptions" block />
          </el-form-item>

          <!-- Email login -->
          <template v-if="form.accountType === '2'">
            <el-form-item prop="email" :error="errors.email">
              <el-input
                v-model="form.email"
                :placeholder="t('auth.placeholder.email')"
                autocomplete="username"
                size="large"
                clearable
              >
                <template #prefix>
                  <Icon icon="lucide:mail" :width="18" />
                </template>
              </el-input>
            </el-form-item>

            <el-form-item prop="password" :error="errors.password">
              <el-input
                v-model="form.password"
                type="password"
                :placeholder="t('auth.placeholder.password')"
                autocomplete="current-password"
                size="large"
                show-password
              >
                <template #prefix>
                  <Icon icon="lucide:lock" :width="18" />
                </template>
              </el-input>
            </el-form-item>

            <el-form-item prop="captchaText" :error="errors.captcha">
              <div class="captcha-inline">
                <el-input
                  v-model="form.captchaText"
                  :placeholder="t('auth.placeholder.captcha')"
                  size="large"
                  maxlength="6"
                  clearable
                  class="captcha-inline__input"
                  @blur="checkCaptcha"
                >
                  <template #prefix>
                    <Icon icon="lucide:shield-check" :width="18" />
                  </template>
                </el-input>
                <div class="captcha-inline__img" @click="reloadCaptcha">
                  <img
                    v-if="captchaSrc"
                    :src="captchaSrc"
                    :alt="t('auth.captcha.alt')"
                    class="captcha-inline__img-el"
                  />
                  <div v-else class="captcha-inline__placeholder">
                    <Icon icon="lucide:image" :width="24" />
                  </div>
                </div>
              </div>
            </el-form-item>

            <div class="auth-form-card__options">
              <el-checkbox v-model="form.rememberMe">{{ t('auth.action.rememberMe') }}</el-checkbox>
            </div>

            <el-button
              type="primary"
              size="large"
              class="auth-submit-btn"
              :loading="submitLoading"
              :disabled="!captchaOk"
              @click="submitForm(formRef)"
            >
              {{ t('auth.action.login') }}
            </el-button>

            <div class="auth-form-card__footer-links">
              <el-link type="primary" :underline="false" @click="$router.push('/reset-pwd-v2')">
                {{ t('auth.action.forgotPassword') }}
              </el-link>
              <el-link type="primary" :underline="false" @click="$router.push('/register-v2')">
                {{ t('auth.action.noAccount') }}
              </el-link>
            </div>
          </template>

          <!-- Phone login -->
          <template v-else>
            <el-form-item prop="mobile_phone_no">
              <el-input
                v-model="form.mobile_phone_no"
                :placeholder="t('auth.placeholder.phone')"
                autocomplete="tel"
                size="large"
                maxlength="11"
                clearable
              >
                <template #prefix><span class="phone-cc">+86</span></template>
              </el-input>
            </el-form-item>

            <el-form-item>
              <el-switch
                v-model="form.useMobileMsgCode"
                :inline-prompt="true"
                active-text="短信验证码"
                inactive-text="密码登录"
                size="large"
                style="--el-switch-on-color: var(--y-color-primary)"
              />
            </el-form-item>

            <template v-if="!form.useMobileMsgCode">
              <el-form-item prop="password" :error="errors.password">
                <el-input
                  v-model="form.password"
                  type="password"
                  :placeholder="t('auth.placeholder.password')"
                  autocomplete="current-password"
                  size="large"
                  show-password
                >
                  <template #prefix>
                    <Icon icon="lucide:lock" :width="18" />
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item prop="captchaText" :error="errors.captcha">
                <div class="captcha-inline">
                  <el-input
                    v-model="form.captchaText"
                    :placeholder="t('auth.placeholder.captcha')"
                    size="large"
                    maxlength="6"
                    clearable
                    class="captcha-inline__input"
                    @blur="checkCaptcha"
                  >
                    <template #prefix>
                      <Icon icon="lucide:shield-check" :width="18" />
                    </template>
                  </el-input>
                  <div class="captcha-inline__img" @click="reloadCaptcha">
                    <img v-if="captchaSrc" :src="captchaSrc" :alt="t('auth.captcha.alt')" class="captcha-inline__img-el" />
                    <div v-else class="captcha-inline__placeholder">
                      <Icon icon="lucide:image" :width="24" />
                    </div>
                  </div>
                </div>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item prop="captchaText" :error="errors.captcha">
                <div class="captcha-inline">
                  <el-input
                    v-model="form.captchaText"
                    :placeholder="t('auth.placeholder.captcha')"
                    size="large"
                    maxlength="6"
                    clearable
                    class="captcha-inline__input"
                    @blur="checkCaptcha"
                  >
                    <template #prefix>
                      <Icon icon="lucide:shield-check" :width="18" />
                    </template>
                    <template #append>
                      <el-button @click="sendSmsCode" :disabled="smsCountingDown || !captchaOk">
                        {{ smsCountingDown ? `${smsCountdown}s` : t('auth.action.sendCode') }}
                      </el-button>
                    </template>
                  </el-input>
                  <div class="captcha-inline__img" @click="reloadCaptcha">
                    <img v-if="captchaSrc" :src="captchaSrc" :alt="t('auth.captcha.alt')" class="captcha-inline__img-el" />
                    <div v-else class="captcha-inline__placeholder">
                      <Icon icon="lucide:image" :width="24" />
                    </div>
                  </div>
                </div>
              </el-form-item>

              <el-form-item prop="mobileMsgCode" :error="errors.smsCode">
                <el-input
                  v-model="form.mobileMsgCode"
                  :placeholder="t('auth.placeholder.smsCode')"
                  size="large"
                  maxlength="6"
                  clearable
                >
                  <template #prefix>
                    <Icon icon="lucide:message-square" :width="18" />
                  </template>
                </el-input>
              </el-form-item>
            </template>

            <div class="auth-form-card__options">
              <el-checkbox v-model="form.rememberMe">{{ t('auth.action.rememberMe') }}</el-checkbox>
            </div>

            <el-button
              type="primary"
              size="large"
              class="auth-submit-btn"
              :loading="submitLoading"
              :disabled="form.useMobileMsgCode ? !codeValid : !captchaOk"
              @click="submitForm(formRef)"
            >
              {{ t('auth.action.login') }}
            </el-button>

            <p class="auth-form-card__phone-hint">
              {{ t('auth.hint.phoneAutoRegister') }}
            </p>
          </template>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { clone } from 'radash'
import { capchaApi, userApi, systemApi } from '@/api'
import { userAuth, cleanLoginfo } from '@/states/UserState'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)
const router = useRouter()

const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const captchaOk = ref(false)
const codeValid = ref(false)
const captchaId = ref('')
const captchaSrc = ref('')
const smsCountingDown = ref(false)
const smsCountdown = ref(0)

const errors = reactive({
  email: '',
  password: '',
  captcha: '',
  smsCode: '',
})

const loginMethodOptions = [
  { label: t('auth.method.phone'), value: '1' },
  { label: t('auth.method.email'), value: '2' },
]

const formDefault = {
  email: '',
  password: '',
  captchaId: '',
  captchaText: '',
  accountType: '1',
  mobile_phone_no: '',
  mobileMsgCode: '',
  useMobileMsgCode: true,
  rememberMe: true,
}

const form = reactive({ ...clone(formDefault) })

const validateEmail_ = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const rules: FormRules = {
  email: [
    { required: true, message: t('auth.validation.emailRequired'), trigger: 'blur' },
    { validator: (_r, v, cb) => (validateEmail_(v) ? cb() : cb(new Error(t('auth.validation.emailInvalid')))), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    { min: 6, max: 50, message: t('auth.validation.passwordLength'), trigger: 'blur' },
  ],
  mobile_phone_no: [
    { required: true, message: t('auth.validation.phoneRequired'), trigger: 'blur' },
    { min: 11, max: 11, message: t('auth.validation.phoneLength'), trigger: 'blur' },
  ],
  captchaText: [
    { required: true, message: t('auth.validation.captchaRequired'), trigger: 'blur' },
    { min: 6, max: 6, message: t('auth.validation.captchaLength'), trigger: 'blur' },
  ],
  mobileMsgCode: [
    { required: true, message: t('auth.validation.smsCodeRequired'), trigger: 'blur' },
    { min: 6, max: 6, message: t('auth.validation.smsCodeLength'), trigger: 'blur' },
  ],
}

const clearErrors = () => {
  errors.email = ''
  errors.password = ''
  errors.captcha = ''
  errors.smsCode = ''
}

const reloadCaptcha = () => {
  fetch(capchaApi.imgUri, { method: 'POST' })
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      captchaId.value = r.headers.get('captcha-id') || ''
      return r.blob()
    })
    .then((blob) => {
      captchaSrc.value = URL.createObjectURL(blob)
      captchaOk.value = false
      form.captchaText = ''
    })
    .catch((e) => {
      ElMessage.error(t('auth.error.captchaLoadFailed'))
    })
}

const checkCaptcha = () => {
  if (!form.captchaText || form.captchaText.length !== 6) return
  clearErrors()
  fetch(capchaApi.checkUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: captchaId.value, text: form.captchaText }),
  })
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (ok && j.status === 200) {
        captchaOk.value = true
      } else {
        captchaOk.value = false
        errors.captcha = t('auth.error.captchaWrong')
        form.captchaText = ''
        reloadCaptcha()
      }
    })
    .catch(() => {
      errors.captcha = t('auth.error.captchaCheckFailed')
    })
}

const sendSmsCode = () => {
  if (!form.mobile_phone_no || form.mobile_phone_no.length !== 11) {
    ElMessage.warning(t('auth.validation.phoneLength'))
    return
  }
  if (!captchaOk.value) {
    ElMessage.warning(t('auth.error.captchaFirst'))
    return
  }
  smsCountingDown.value = true
  smsCountdown.value = 60
  const interval = setInterval(() => {
    smsCountdown.value--
    if (smsCountdown.value <= 0) {
      clearInterval(interval)
      smsCountingDown.value = false
    }
  }, 1000)

  fetch(capchaApi.sendcode, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captcha_id: captchaId.value, mobile_phone_no: form.mobile_phone_no }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.status === 0) {
        ElMessage.success(t('auth.message.smsSent'))
      } else {
        ElMessage.warning(j.statusText || t('auth.error.smsSendFailed'))
        clearInterval(interval)
        smsCountingDown.value = false
      }
    })
    .catch(() => {
      ElMessage.error(t('auth.error.smsSendFailed'))
      clearInterval(interval)
      smsCountingDown.value = false
    })
}

const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  clearErrors()
  await formEl.validate((valid) => {
    if (!valid) return
    submitLoading.value = true

    userApi
      .login(
        {
          email: form.email,
          password: form.password,
          captchaId: captchaId.value,
          captchaText: form.captchaText,
          accountType: form.accountType,
          mobile_phone_no: form.mobile_phone_no,
          mobileMsgCode: form.mobileMsgCode,
          useMobileMsgCode: form.useMobileMsgCode,
        },
        { 'X-Captcha-Id': captchaId.value },
      )
      .then((json) => {
        userAuth.value.access_token = json.data.access_token
        // 保持登录:勾选时保存 refresh_token(7天),不勾时清空(关闭页面即过期)
        userAuth.value.refresh_token = form.rememberMe ? (json.data.refresh_token || '') : ''
        userAuth.value.token_type = 'jwt'
        userAuth.value.isLogin = true

        return systemApi.user_info({})
      })
      .then((res) => {
        userAuth.value.user = res.data.user
        userAuth.value.roles = res.data.roles
        userAuth.value.permissions = res.data.permissions
        return systemApi.config({})
      })
      .then((res) => {
        userAuth.value.config = res.data
        ElMessage.success(t('auth.message.loginSuccess'))
        setTimeout(() => {
          window.location.href = import.meta.env.BASE_URL + '/home.html'
        }, 600)
      })
      .catch((err) => {
        if (err.kind === 'auth') {
          errors.password = t('auth.error.loginFailed')
        } else if (err.kind === 'validation') {
          errors.captcha = t('auth.error.captchaWrong')
          reloadCaptcha()
        }
      })
      .finally(() => {
        submitLoading.value = false
      })
  })
}

onMounted(() => {
  // 保持登录:若已存在有效 access_token 或 refresh_token,直接跳 home,不再要求重新输入
  // 注意:不能在顶层脚本里 cleanLoginfo(),那样会在 onMounted 之前清空,跳转条件永远为 false
  if (userAuth.value.isLogin && (userAuth.value.access_token || userAuth.value.refresh_token)) {
    window.location.href = import.meta.env.BASE_URL + '/home.html'
    return
  }
  cleanLoginfo()
  reloadCaptcha()
})
</script>

<style scoped>
.auth-layout {
  display: flex;
  min-height: 100vh;
  background: var(--lab-paper);
}

/* ── Brand panel (ink black with lime glow) ──── */
.auth-brand {
  flex: 0 0 44%;
  background: var(--lab-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  position: relative;
  overflow: hidden;
  color: #fff;
}

.auth-brand__glow {
  position: absolute;
  width: 480px;
  height: 480px;
  right: -160px;
  top: -160px;
  background: radial-gradient(circle, var(--lab-lime) 0%, transparent 60%);
  filter: blur(80px);
  opacity: 0.35;
  pointer-events: none;
}

.auth-brand__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(circle at 30% 30%, #000 0%, transparent 80%);
  pointer-events: none;
}

.auth-brand__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 440px;
  width: 100%;
}

.auth-brand__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.55);
}

.auth-brand__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lab-lime);
  box-shadow: 0 0 12px var(--lab-lime);
  animation: lab-blink 2.4s ease-in-out infinite;
}

.auth-brand__name {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 96px;
  font-weight: 400;
  line-height: 0.95;
  color: #fff;
  letter-spacing: -0.02em;
}

.auth-brand__period {
  color: var(--lab-lime);
}

.auth-brand__slogan {
  margin: 0;
  font-size: 15px;
  color: rgba(255,255,255,0.7);
  line-height: 1.6;
  max-width: 360px;
}

.auth-brand__features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.auth-brand__feature {
  display: flex;
  align-items: center;
  gap: 14px;
  color: rgba(255,255,255,0.85);
  font-size: 14px;
}

.auth-brand__feature-idx {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  color: var(--lab-lime);
  letter-spacing: 0.1em;
  min-width: 22px;
}

.auth-brand__feature :deep(svg) {
  color: rgba(255,255,255,0.6);
}

.auth-brand__quote {
  margin-top: 24px;
  padding: 24px;
  background: rgba(255,255,255,0.04);
  border-radius: var(--lab-radius-2xl, 16px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.auth-brand__quote::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 140px;
  height: 140px;
  background: var(--lab-lime);
  filter: blur(50px);
  opacity: 0.18;
}

.auth-brand__quote-mark {
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 56px;
  line-height: 0.5;
  color: var(--lab-lime);
}

.auth-brand__quote-text {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 28px;
  line-height: 1.15;
  color: #fff;
}

.auth-brand__quote-src {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.1em;
}

/* ── Form panel ──────────────────────────────── */
.auth-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lab-paper);
  padding: 40px 24px;
  position: relative;
}

.auth-form-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--lab-line) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.5;
  pointer-events: none;
}

.auth-form-card {
  width: 100%;
  max-width: 440px;
  background: var(--lab-snow);
  border-radius: var(--lab-radius-3xl, 24px);
  box-shadow: var(--lab-shadow-soft, 0 2px 8px rgba(14,14,16,0.04), 0 12px 32px rgba(14,14,16,0.06));
  padding: 40px;
  position: relative;
  z-index: 1;
}

.auth-form-card__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 28px;
}

.auth-form-card__eyebrow {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--lab-ash);
  text-transform: uppercase;
}

.auth-form-card__title {
  margin: 0;
  font-family: var(--y-font-family-display, "Instrument Serif", Georgia, serif);
  font-style: italic;
  font-size: 48px;
  font-weight: 400;
  color: var(--lab-ink);
  line-height: 1;
  letter-spacing: -0.01em;
}

.auth-form-card__period {
  color: var(--lab-coral);
}

.auth-form-card__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--lab-slate);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auth-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.auth-form :deep(.el-form-item__label) {
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--lab-ash);
  text-transform: uppercase;
  padding-bottom: 4px;
}

.auth-form :deep(.el-input__wrapper) {
  background: var(--lab-cream);
  border-radius: var(--lab-radius-lg, 8px);
  box-shadow: none !important;
  border: 1px solid transparent;
  padding: 4px 14px;
  transition: border-color 150ms ease;
}

.auth-form :deep(.el-input__wrapper:hover) {
  border-color: var(--lab-line);
}

.auth-form :deep(.el-input__wrapper.is-focus) {
  border-color: var(--lab-ink) !important;
  background: var(--lab-snow);
}

.auth-form :deep(.el-input__inner) {
  height: 38px;
  color: var(--lab-ink);
}

.auth-form :deep(.el-input__inner::placeholder) {
  color: var(--lab-fog);
}

.auth-form :deep(.el-segmented) {
  background: var(--lab-cream);
  border-radius: var(--lab-radius-lg, 8px);
  padding: 3px;
  border: none;
}

.auth-form :deep(.el-segmented__item-label) {
  font-size: 13px;
}

.auth-form :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--lab-slate);
}

.auth-form :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: var(--lab-ink);
  border-color: var(--lab-ink);
}

.auth-submit-btn {
  width: 100%;
  height: 44px !important;
  font-size: 14px !important;
  margin-top: 8px;
  background: var(--lab-ink) !important;
  border: none !important;
  border-radius: var(--lab-radius-pill, 999px) !important;
  color: #fff !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 14px rgba(14,14,16,0.18) !important;
  transition: transform 150ms ease, box-shadow 150ms ease !important;
}

.auth-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(14,14,16,0.25) !important;
}

.auth-submit-btn:disabled {
  background: var(--lab-fog) !important;
  color: var(--lab-snow) !important;
  box-shadow: none !important;
}

.auth-form-card__footer-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.auth-form-card__footer-links :deep(.el-link) {
  font-size: 13px;
  color: var(--lab-slate);
  --el-link-text-color: var(--lab-slate);
  --el-link-hover-text-color: var(--lab-ink);
}

.auth-form-card__options {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 16px;
}

.auth-form-card__phone-hint {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--lab-fog);
  text-align: center;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.05em;
}

/* ── Inline captcha ─────────────────────────── */
.captcha-inline {
  display: flex;
  gap: 8px;
  width: 100%;
}

.captcha-inline__input {
  flex: 1;
}

.captcha-inline__img {
  width: 110px;
  height: 40px;
  border: 1px dashed var(--lab-line);
  border-radius: var(--lab-radius-pill, 999px);
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lab-cream);
  transition: border-color 150ms ease, transform 150ms ease;
}

.captcha-inline__img:hover {
  border-color: var(--lab-ink);
  border-style: solid;
  transform: scale(1.02);
}

.captcha-inline__img-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-inline__placeholder {
  color: var(--lab-fog);
}

.phone-cc {
  display: inline-block;
  margin-right: 6px;
  color: var(--lab-slate);
  font-weight: 500;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 12px;
}

/* ── Responsive ─────────────────────────────── */
@media (max-width: 960px) {
  .auth-brand {
    display: none;
  }
  .auth-form-panel {
    padding: 24px 16px;
  }
  .auth-form-card {
    padding: 28px 24px;
  }
  .auth-form-card__title {
    font-size: 40px;
  }
}
</style>
