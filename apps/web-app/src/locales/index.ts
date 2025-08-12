import { createI18n } from 'vue-i18n'
// element-plus 中的语言配置
import ElzhCn from 'element-plus/dist/locale/zh-cn.mjs'
import Elen from 'element-plus/dist/locale/en.mjs'

import en from './src/lang/en'
import zhCN from './src/lang/zh-CN'
import LocaleSelect from './src/LocaleSelect.vue'
import videoEn from '@/video/locales/en'
import videoZhCN from '@/video/locales/zh-CN'

const messages = {
  en: {
    ...en,
    ...Elen,
    video: videoEn
  },
  'zh-CN': {
    ...zhCN,
    ...ElzhCn,
    video: videoZhCN
  }
}
const i18n = createI18n({
  legacy: false,
  fallbackLocale: 'en', // set fallback locale
  globalInjection: true, // 全局模式，可以直接使用 $t
  messages,
  locale: localStorage.getItem('locale') || navigator.language // 获取浏览器的语言
})

export { i18n, LocaleSelect }
