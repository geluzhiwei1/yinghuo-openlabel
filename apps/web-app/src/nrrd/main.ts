
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
import '@/styles/_component-patches.scss'
import '@/styles/utilities.scss'
import '@/styles/lab/_index.scss'
import '@/styles/lab/_ep-bridge.scss'
import '@/styles/lab/_shell.scss'
import { PaperPlugin } from '@/components/paper'
import waterfall from 'vue-waterfall2'
import '../assets/main.css'
import { createPinia } from 'pinia';
// import { usePermissStore } from './store/permiss';
import { useThemeStore } from '@/store/theme';

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)
app.use(PaperPlugin)
useThemeStore().initTheme()

app.mount('#app')
