
import { createApp } from 'vue'
import '@/shared/icons'
import ElementPlus from 'element-plus'
import App from './App.vue'
import { i18n } from '@/locales'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/styles/tokens/index.scss'
import '@/styles/_element-overrides.scss'
import '@/styles/_component-patches.scss'
import '@/styles/utilities.scss'
import '@/styles/lab/_index.scss'
import '@/styles/lab/_ep-bridge.scss'
import '@/styles/lab/_shell.scss'
import '@/styles/_anno-theme.scss'
import { PaperPlugin } from '@/components/paper'
import waterfall from 'vue-waterfall2'
import './assets/main.css'
import { createPinia } from 'pinia';
import { useThemeStore } from '@/store/theme';

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)
app.use(PaperPlugin)

// Reuse the anno workbench's lab palette + panel/tab styling — pc.html
// shares the same paper/ink design system as anno.html.
document.body.classList.add('anno-app')

useThemeStore().initTheme()

app.mount('#app')
