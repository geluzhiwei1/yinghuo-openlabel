
import { createApp } from 'vue'
import '@/shared/icons'
import ElementPlus from 'element-plus'
import App from './App.vue'
import { i18n } from '@/locales'
// import { setupElementPlus } from '@ui-common/plugins/elementPlus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/styles/tokens/index.scss'
import '@/styles/_element-overrides.scss'
import '@/styles/_anno-theme.scss'
import '@/styles/_component-patches.scss'
import '@/styles/utilities.scss'
import '@/styles/lab/_index.scss'
import '@/styles/lab/_ep-bridge.scss'
import '@/styles/lab/_shell.scss'
import { PaperPlugin } from '@/components/paper'
import waterfall from 'vue-waterfall2'
import './assets/main.css'
import { createPinia } from 'pinia';
import Vue3VideoPlayer from '@cloudgeek/vue3-video-player'
// import { usePermissStore } from './store/permiss';
//
import { useThemeStore } from '@/store/theme';

const userAgent = navigator.userAgent || navigator.vendor || window.opera
const isEdge = /edg/i.test(userAgent)
const app = createApp(App)
app.use(createPinia())
app.use(i18n)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)
app.use(PaperPlugin)
app.use(Vue3VideoPlayer, {
  lang: 'zh-CN'
})

useThemeStore().initTheme()

// Anno workbench: scoped palette via body.anno-app. Light/Dark follows the
// ToggleDark (useDark) switch — both modes are polished in _anno-theme.scss.
document.body.classList.add('anno-app')

app.mount('#app')

if (isEdge) {
  import('element-plus').then(({ ElNotification }) => {
    ElNotification({
      title: '浏览器兼容性提示',
      message: '您当前使用的是 Microsoft Edge 浏览器，部分功能可能不被完全支持。建议使用最新版 Chrome 以获得最佳体验。',
      type: 'warning',
      duration: 0,
      position: 'top-right',
    })
  })
}