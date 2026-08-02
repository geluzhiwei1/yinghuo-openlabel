
import { createApp } from 'vue'
import '@/shared/icons'
import ElementPlus from 'element-plus'
import App from './App.vue'
import router from './router'
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
import { PaperPlugin } from '@/components/paper'
import waterfall from 'vue-waterfall2'
import '../assets/main.css'
import { createPinia } from 'pinia';
// import { usePermissStore } from '../store/permiss';
import { useThemeStore } from '@/store/theme';
import { usePermission } from '@/states/usePermission';

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)
app.use(PaperPlugin)

useThemeStore().initTheme()

// 注册elementplus图标
// 自定义权限指令
// 用法 v-permiss="'business:review:approve'" 或数组 ['business:review:approve','business:review:reject']
// 兼容:不含 ':' 的旧值(菜单项 id)按原行为(no-op)处理
app.directive('permiss', {
    mounted(el, binding) {
        const val = binding.value
        if (val == null || val === '') return
        const keys = Array.isArray(val) ? val.map(String) : [String(val)]
        const permKeys = keys.filter((k) => k.includes(':'))
        if (permKeys.length === 0) return // 老 id,不消费
        const { canAny } = usePermission()
        if (!canAny(permKeys)) {
            el.parentNode?.removeChild(el)
        }
    },
});

app.mount('#app')
