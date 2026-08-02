/**
 * 帮助弹窗显隐,模块级单例。任意组件直接 import 即可触发。
 */
import { ref } from 'vue'

const visible = ref(false)

export const useHelpOverlay = () => {
  const show = () => {
    visible.value = true
  }
  const hide = () => {
    visible.value = false
  }
  const toggle = () => {
    visible.value = !visible.value
  }
  return { visible, show, hide, toggle }
}
