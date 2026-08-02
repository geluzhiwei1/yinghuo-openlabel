/**
 * 业务面质量看板入口。
 *
 * 独立 SPA,不复用 home 的工作台 layout。三面差异化:data-face="business"
 * 让 _color.scss 的 face-scoped 覆盖生效(后续 stage 实现)。
 */
import { createApp } from 'vue'
import '@/shared/icons'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from '@/locales'
import { usePermission } from '@/states/usePermission'

import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/styles/tokens/index.scss'
import '@/styles/_element-overrides.scss'
import '@/styles/_component-patches.scss'
import '@/styles/utilities.scss'
import '@/styles/lab/_index.scss'
import '@/styles/lab/_ep-bridge.scss'
import '@/styles/lab/_shell.scss'
import { PaperPlugin } from '@/components/paper'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
app.use(ElementPlus)
app.use(PaperPlugin)

// 与 home/admin 一致的 v-permiss 指令(权限 key 走 usePermission)
app.directive('permiss', {
  mounted(el: HTMLElement, binding: any) {
    const val = binding.value
    if (val == null || val === '') return
    const keys = Array.isArray(val) ? val.map(String) : [String(val)]
    const permKeys = keys.filter((k) => k.includes(':'))
    if (permKeys.length === 0) return
    const { canAny } = usePermission()
    if (!canAny(permKeys)) {
      el.parentNode?.removeChild(el)
    }
  },
})

app.mount('#app')
