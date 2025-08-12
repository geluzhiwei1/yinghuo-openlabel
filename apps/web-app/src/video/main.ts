
import 'uno.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'
import { i18n } from '@/locales'
// import { setupElementPlus } from '@ui-common/plugins/elementPlus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import waterfall from 'vue-waterfall2'
import './assets/main.css'
import { createPinia } from 'pinia';
import Vue3VideoPlayer from '@cloudgeek/vue3-video-player'
// import { usePermissStore } from './store/permiss';
// import * as ElementPlusIconsVue from '@element-plus/icons-vue';

const userAgent = navigator.userAgent || navigator.vendor || window.opera
if (/edg/i.test(userAgent)) {
  alert(
    '对不起，您当前使用的Microsoft Edge浏览器可能不被本网站/应用完全支持。为了获得最佳体验，请考虑使用其他推荐的浏览器。'
  )
}
const app = createApp(App)
app.use(createPinia())
app.use(i18n)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)
app.use(Vue3VideoPlayer, {
  lang: 'zh-CN'
})

app.mount('#app')