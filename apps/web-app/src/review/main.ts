/**
 * 业务面审核工作台入口。
 *
 * 独立 SPA,核心交互:三栏(列表/预览/历史)、键盘驱动、对接工作流推进。
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
