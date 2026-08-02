// Paper component library — barrel + Vue plugin
//
// design.md §5 component specs.
// Replaces Element Plus progressively across the 11 sub-apps.
//
// Plugin side effects:
// 1. Globally registers all Paper* components
// 2. Mounts PaperToast / PaperNotice hosts
// 3. Bridges window.ElMessage / ElNotification / ElMessageBox / ElLoading to Paper equivalents
//    so existing code calling `ElMessage.success('...')` works without changes during migration.

import type { App, Plugin } from 'vue'

import PaperButton from './PaperButton.vue'
import PaperInput from './PaperInput.vue'
import PaperCard from './PaperCard.vue'
import PaperBadge from './PaperBadge.vue'
import PaperTabs from './PaperTabs.vue'
import PaperTable from './PaperTable.vue'
import PaperDialog from './PaperDialog.vue'
import PaperRow from './PaperRow.vue'
import PaperCol from './PaperCol.vue'

import { toast, mountPaperToast } from './PaperToast'
import { notice, mountPaperNotice } from './PaperNotice'
import { messageBox } from './PaperMessageBox'
import { loading } from './PaperLoading'

export {
  PaperButton,
  PaperInput,
  PaperCard,
  PaperBadge,
  PaperTabs,
  PaperTable,
  PaperDialog,
  PaperRow,
  PaperCol,
}

export {
  toast,
  notice,
  messageBox,
  loading,
}

export const PaperPlugin: Plugin = {
  install(app: App) {
    app.component('PaperButton', PaperButton)
    app.component('PaperInput', PaperInput)
    app.component('PaperCard', PaperCard)
    app.component('PaperBadge', PaperBadge)
    app.component('PaperTabs', PaperTabs)
    app.component('PaperTable', PaperTable)
    app.component('PaperDialog', PaperDialog)
    app.component('PaperRow', PaperRow)
    app.component('PaperCol', PaperCol)

    // Mount imperative hosts (browser only)
    if (typeof window !== 'undefined') {
      mountPaperToast()
      mountPaperNotice()
    }

    // Bridge window.El* to Paper equivalents — migration shim.
    // Existing code like `ElMessage.success('x')` continues to work,
    // but renders through Paper visual language.
    if (typeof window !== 'undefined') {
      const w = window as any

      // ElMessage.success(...) → toast.success(...)
      w.ElMessage = Object.assign(
        (text: string) => toast.info(text),
        {
          success: (text: string) => toast.success(text),
          error: (text: string) => toast.error(text),
          warning: (text: string) => toast.warning(text),
          info: (text: string) => toast.info(text),
        }
      )

      // ElNotification → notice
      w.ElNotification = Object.assign(
        (opts: any) => notice.show({
          title: opts?.title || '',
          description: opts?.message,
          kind: opts?.type || 'info',
        }),
        {
          success: (title: string, desc?: string) => notice.success(title, desc),
          error: (title: string, desc?: string) => notice.error(title, desc),
          warning: (title: string, desc?: string) => notice.warning(title, desc),
          info: (title: string, desc?: string) => notice.info(title, desc),
        }
      )

      // ElMessageBox.confirm/alert → messageBox
      w.ElMessageBox = Object.assign(
        () => Promise.resolve(),
        {
          confirm: (message: string, title?: string, opts?: any) =>
            messageBox.confirm({ message, title: typeof title === 'string' ? title : (opts?.title), kind: opts?.type }),
          alert: (message: string, title?: string, opts?: any) =>
            messageBox.alert({ message, title: typeof title === 'string' ? title : (opts?.title), kind: opts?.type }),
        }
      )

      // ElLoading.service({ text }) → loading.show({ text })
      w.ElLoading = { service: (opts: any) => loading.show({ text: opts?.text, target: opts?.target }) }
    }
  },
}
