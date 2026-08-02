import { createApp } from 'vue';
import '@/shared/icons';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css';
import '@/styles/tokens/index.scss'
import '@/styles/_element-overrides.scss'
import '@/styles/_component-patches.scss'
import '@/styles/utilities.scss'
import '@/styles/lab/_index.scss'
import '@/styles/lab/_ep-bridge.scss'
import '@/styles/lab/_shell.scss'
import { PaperPlugin } from '@/components/paper'
import './assets/css/icon.css';
import { i18n } from '@/locales'

i18n.global.locale.value = 'zh-CN'

const app = createApp(App);
app.use(ElementPlus)
app.use(createPinia());
app.use(router);
app.use(PaperPlugin);

// 注册elementplus图标
// 自定义权限指令
app.directive('permiss', {
    mounted(el, binding) {
        // if (binding.value && !permiss.key.includes(String(binding.value))) {
        //     el['hidden'] = true;
        // }
    },
});

app.mount('#app');
