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
          <span class="auth-brand__quote-src">— LAB NOTE §002</span>
        </div>
      </div>
    </div>

    <!-- Right form panel -->
    <div class="auth-form-panel">
      <div class="auth-form-card">
        <div class="auth-form-card__header">
          <span class="auth-form-card__eyebrow">SIGN UP · §B</span>
          <h2 class="auth-form-card__title">
            创建账号<span class="auth-form-card__period">.</span>
          </h2>
          <p class="auth-form-card__subtitle">加入萤火标注平台</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          class="auth-form"
        >
          <!-- Email -->
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
              <template #append>
                <el-button @click="sendCode" :disabled="sendCodeCountdown > 0">
                  {{ sendCodeCountdown > 0 ? `${sendCodeCountdown}s` : t('auth.action.sendCode') }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>

          <!-- Captcha ID hint -->
          <el-form-item prop="captcha_id_2" :error="errors.captchaId">
            <el-input
              v-model="form.captcha_id_2"
              size="large"
              :placeholder="t('register.placeholder.captchaId')"
            >
              <template #prefix>{{ form.captcha_id_1 || '?' }}-</template>
              <template #suffix>-{{ form.captcha_id_3 || '?' }}</template>
            </el-input>
          </el-form-item>

          <!-- Email captcha -->
          <el-form-item prop="captchaText" :error="errors.captchaText">
            <el-input
              v-model="form.captchaText"
              size="large"
              maxlength="6"
              :placeholder="t('register.placeholder.emailCaptcha')"
              @change="verifyCode"
            >
              <template #prefix>
                <Icon icon="lucide:shield-check" :width="18" />
              </template>
            </el-input>
          </el-form-item>

          <!-- Password -->
          <el-form-item prop="password" :error="errors.password">
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              show-password
              :placeholder="t('auth.placeholder.password')"
              autocomplete="new-password"
            >
              <template #prefix>
                <Icon icon="lucide:lock" :width="18" />
              </template>
            </el-input>
            <!-- Password strength bar -->
            <div class="pwd-strength" v-if="form.password">
              <div class="pwd-strength__bar">
                <div
                  class="pwd-strength__fill"
                  :class="`pwd-strength__fill--${pwdStrength.level}`"
                  :style="{ width: pwdStrength.width }"
                />
              </div>
              <span class="pwd-strength__label" :class="`pwd-strength__label--${pwdStrength.level}`">
                {{ pwdStrength.label }}
              </span>
            </div>
          </el-form-item>

          <!-- Confirm password -->
          <el-form-item prop="password2" :error="errors.password2">
            <el-input
              v-model="form.password2"
              type="password"
              size="large"
              show-password
              :placeholder="t('register.placeholder.confirmPassword')"
              autocomplete="new-password"
            >
              <template #prefix>
                <Icon icon="lucide:lock" :width="18" />
              </template>
            </el-input>
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            class="auth-submit-btn"
            :loading="submitLoading"
            :disabled="!submitEnabled"
            @click="submitForm(formRef)"
          >
            {{ t('register.action.register') }}
          </el-button>

          <p class="auth-form-card__login-link">
            {{ t('register.hint.hasAccount') }}
            <el-link type="primary" :underline="false" @click="$router.push('/login-v2')">
              {{ t('register.action.loginNow') }}
            </el-link>
          </p>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { clone } from 'radash'
import { userApi, emailCodeApi } from '@/api'
import { validateEmail } from '@/libs/validtor'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)
const router = useRouter()

const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const submitEnabled = ref(false)
const sendCodeCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const errors = reactive({
  email: '',
  captchaId: '',
  captchaText: '',
  password: '',
  password2: '',
})

const formDefault = {
  email: '',
  captcha_id_1: '',
  captcha_id_2: '',
  captcha_id_3: '',
  captchaText: '',
  password: '',
  password2: '',
}
const form = reactive({ ...clone(formDefault) })

// Password strength
const pwdStrength = computed(() => {
  const pwd = form.password
  if (!pwd) return { level: 'none', label: '', width: '0%' }
  let score = 0
  if (pwd.length >= 8) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  if (score <= 1) return { level: 'weak', label: t('register.pwdStrength.weak'), width: '33%' }
  if (score === 2 || score === 3) return { level: 'medium', label: t('register.pwdStrength.medium'), width: '66%' }
  return { level: 'strong', label: t('register.pwdStrength.strong'), width: '100%' }
})

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
}

const clearErrors = () => {
  errors.email = ''
  errors.captchaId = ''
  errors.captchaText = ''
  errors.password = ''
  errors.password2 = ''
}

const sendCode = () => {
  clearErrors()
  if (!validateEmail_(form.email)) {
    errors.email = t('auth.validation.emailInvalid')
    return
  }
  sendCodeCountdown.value = 60
  countdownTimer = setInterval(() => {
    sendCodeCountdown.value--
    if (sendCodeCountdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)

  fetch(emailCodeApi.sendcode, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mail: form.email }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.status === 0) {
        form.captcha_id_1 = j.data[0]
        form.captcha_id_3 = j.data[1]
        ElMessage.success(t('register.message.codeSent'))
      } else {
        ElMessage.error(j.statusText || t('register.error.codeSendFailed'))
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
        sendCodeCountdown.value = 0
      }
    })
    .catch(() => {
      ElMessage.error(t('register.error.codeSendFailed'))
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
      sendCodeCountdown.value = 0
    })
}

const verifyCode = () => {
  if (!form.captchaText || form.captchaText.length !== 6) return
  clearErrors()
  fetch(emailCodeApi.checkUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `${form.captcha_id_1}-${form.captcha_id_2}-${form.captcha_id_3}`,
      text: form.captchaText,
    }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.status === 200) {
        userApi.captcha_id = `${form.captcha_id_1}-${form.captcha_id_2}-${form.captcha_id_3}`
        submitEnabled.value = true
        ElMessage.success(t('register.message.codeVerified'))
      } else {
        errors.captchaText = t('register.error.codeWrong')
        submitEnabled.value = false
      }
    })
    .catch(() => {
      errors.captchaText = t('register.error.codeCheckFailed')
      submitEnabled.value = false
    })
}

const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  clearErrors()
  await formEl.validate((valid) => {
    if (!valid) return
    if (form.password !== form.password2) {
      errors.password2 = t('register.error.passwordMismatch')
      return
    }
    submitLoading.value = true
    userApi
      .register(
        { email: form.email, password: form.password },
        { 'X-Captcha-Id': `${form.captcha_id_1}-${form.captcha_id_2}-${form.captcha_id_3}` },
      )
      .then((data) => {
        if (data) {
          ElMessage.success(t('register.message.registerSuccess'))
          setTimeout(() => router.push('/login-v2'), 1200)
        } else {
          ElMessage.error(t('register.error.registerFailed'))
        }
      })
      .finally(() => {
        submitLoading.value = false
      })
  })
}
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

.auth-form :deep(.el-input-group__append) {
  background: var(--lab-ink);
  border: none;
  border-radius: 0 var(--lab-radius-pill, 999px) var(--lab-radius-pill, 999px) 0;
  padding: 0 16px;
}

.auth-form :deep(.el-input-group__append .el-button) {
  color: #fff;
  font-size: 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.06em;
}

.auth-form :deep(.el-input-group__append .el-button:hover) {
  color: var(--lab-lime);
}

.auth-form :deep(.el-input-group__prepend) {
  background: var(--lab-cream);
  border: none;
  border-radius: var(--lab-radius-pill, 999px) 0 0 var(--lab-radius-pill, 999px);
  padding: 0 12px;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 13px;
  color: var(--lab-slate);
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

.auth-form-card__login-link {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--lab-slate);
  text-align: center;
}

.auth-form-card__login-link :deep(.el-link) {
  --el-link-text-color: var(--lab-ink);
  --el-link-hover-text-color: var(--lab-coral);
  font-weight: 500;
}

/* Password strength */
.pwd-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.pwd-strength__bar {
  flex: 1;
  height: 4px;
  background: var(--lab-cream);
  border-radius: var(--lab-radius-pill, 999px);
  overflow: hidden;
}

.pwd-strength__fill {
  height: 100%;
  border-radius: var(--lab-radius-pill, 999px);
  transition: width 200ms ease, background-color 200ms ease;
}

.pwd-strength__fill--weak {
  background: var(--lab-coral);
  width: 33%;
}

.pwd-strength__fill--medium {
  background: var(--lab-butter, #ffe58a);
  width: 66%;
}

.pwd-strength__fill--strong {
  background: var(--lab-lime);
  width: 100%;
}

.pwd-strength__label {
  font-size: 11px;
  min-width: 36px;
  text-align: right;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  letter-spacing: 0.06em;
}

.pwd-strength__label--weak { color: var(--lab-coral); }
.pwd-strength__label--medium { color: var(--lab-graphite); }
.pwd-strength__label--strong { color: var(--lab-graphite); }

@media (max-width: 960px) {
  .auth-brand { display: none; }
  .auth-form-panel { padding: 24px 16px; }
  .auth-form-card { padding: 28px 24px; }
  .auth-form-card__title { font-size: 40px; }
}
</style>
