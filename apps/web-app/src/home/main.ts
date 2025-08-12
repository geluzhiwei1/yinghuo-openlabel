/*
Copyright (C) 2025 undefined

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import 'uno.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'
import router from './router'
import { i18n } from '@/locales'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import waterfall from 'vue-waterfall2'
import '../assets/main.css'
import { createPinia } from 'pinia'
// import { usePermissStore } from '../store/permiss';
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
// setupElementPlus(app)
app.use(ElementPlus)
app.use(waterfall)

// 注册elementplus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
// 自定义权限指令
// const permiss = usePermissStore();
app.directive('permiss', {
  mounted(el, binding) {
    // if (binding.value && !permiss.key.includes(String(binding.value))) {
    //     console.log(binding.value);
    //     // show all
    //     el.parentNode?.removeChild(el);
    //     // el['hidden'] = false;
    // }
  }
})

app.mount('#app')
