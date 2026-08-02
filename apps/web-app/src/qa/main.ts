/**
 * 业务面终检(QA)工作台入口。
 *
 * 与 review 共享组件 + 快捷键;区别:
 *  - 默认仅显示 sample_review / qa stage 的 instance
 *  - 顶部显示抽样覆盖率
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
