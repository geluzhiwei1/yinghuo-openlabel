// PaperMessageBox — replaces ElMessageBox.confirm / alert
//
// Usage:
//   import { messageBox } from '@/components/paper'
//   const ok = await messageBox.confirm({ title: '删除?', message: '该操作不可撤销' })
//   if (ok) { ... }
//   messageBox.alert({ title: '提示', message: '上传完成' })

import { createApp, h, defineComponent, ref } from 'vue'
import { Icon } from '@iconify/vue'

type Options = {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  kind?: 'default' | 'danger' | 'warning'
}

function mountDialog(opts: Options, mode: 'confirm' | 'alert'): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const close = (result: boolean) => {
      app.unmount()
      el.remove()
      resolve(result)
    }

    const confirmText = opts.confirmText || (mode === 'alert' ? '知道了' : '确认')
    const cancelText = opts.cancelText || '取消'
    const isDanger = opts.kind === 'danger' || opts.kind === 'warning'

    const Dialog = defineComponent({
      name: 'PaperMessageBox',
      setup() {
        const visible = ref(true)
        const onCancel = () => { visible.value = false; setTimeout(() => close(false), 200) }
        const onConfirm = () => { visible.value = false; setTimeout(() => close(true), 200) }
        return () => visible.value ? h('div', { class: 'paper-msgbox-root', onClick: (e: MouseEvent) => { if (e.target === e.currentTarget) onCancel() } }, [
          h('div', { class: 'paper-msgbox' }, [
            h('header', { class: 'paper-msgbox__header' }, [
              h('h2', { class: 'paper-msgbox__title' }, [
                opts.title || (mode === 'alert' ? '提示' : '请确认'),
              ]),
            ]),
            h('div', { class: 'paper-msgbox__body' }, [
              h('p', { class: 'paper-msgbox__message' }, opts.message || ''),
            ]),
            h('footer', { class: 'paper-msgbox__footer' }, [
              mode === 'confirm'
                ? h('button', { class: 'paper-msgbox__btn paper-msgbox__btn--secondary', onClick: onCancel }, cancelText)
                : null,
              h('button', {
                class: ['paper-msgbox__btn', isDanger ? 'paper-msgbox__btn--danger' : 'paper-msgbox__btn--primary'],
                onClick: onConfirm,
              }, confirmText),
            ]),
          ]),
        ]) : null
      },
    })

    const app = createApp(Dialog)
    app.mount(el)
  })
}

export const messageBox = {
  confirm: (opts: Options) => mountDialog(opts, 'confirm'),
  alert:   (opts: Options) => mountDialog(opts, 'alert'),
}

const STYLE_ID = 'paper-msgbox-style'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.paper-msgbox-root {
  position: fixed; inset: 0;
  background: rgba(14,14,16,0.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2500; padding: 20px;
  animation: paper-msgbox-fade 200ms cubic-bezier(0.4,0,0.2,1);
}
.paper-msgbox {
  width: 100%; max-width: 420px;
  background: var(--lab-snow, #fff);
  border-radius: 16px;
  box-shadow: 0 20px 40px -24px rgba(14,14,16,0.35);
  overflow: hidden;
  animation: paper-msgbox-pop 220ms cubic-bezier(0.4,0,0.2,1);
}
.paper-msgbox__header { padding: 18px 24px 8px; }
.paper-msgbox__title {
  margin: 0;
  font-family: var(--y-font-family-display, Georgia, serif);
  font-style: italic; font-size: 20px; line-height: 1;
  color: var(--lab-ink, #0e0e10);
}
.paper-msgbox__body { padding: 4px 24px 20px; }
.paper-msgbox__message { margin: 0; font-size: 13px; color: var(--lab-slate, #3f4046); line-height: 1.55; }
.paper-msgbox__footer { padding: 12px 24px 18px; border-top: 1px solid var(--lab-hairline, #ececea); display: flex; justify-content: flex-end; gap: 8px; }
.paper-msgbox__btn {
  height: 36px; padding: 0 16px;
  border: none; border-radius: 999px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  font-family: inherit;
  transition: background-color 150ms;
}
.paper-msgbox__btn--secondary { background: var(--lab-cream, #fbfaf5); color: var(--lab-slate, #3f4046); }
.paper-msgbox__btn--secondary:hover { background: var(--lab-line, #e6e4dc); color: var(--lab-ink, #0e0e10); }
.paper-msgbox__btn--primary { background: var(--lab-ink, #0e0e10); color: #fff; }
.paper-msgbox__btn--primary:hover { background: #2a2a2e; }
.paper-msgbox__btn--danger { background: var(--lab-coral, #ff6a3d); color: #fff; }
.paper-msgbox__btn--danger:hover { background: #ff7e57; }
@keyframes paper-msgbox-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes paper-msgbox-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
`
  document.head.appendChild(style)
}
