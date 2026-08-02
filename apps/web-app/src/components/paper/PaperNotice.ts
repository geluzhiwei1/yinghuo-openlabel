// PaperNotice — replaces ElNotification
//
// Top-right stacked card notifications with title/description/kind.
//
// Usage:
//   import { notice } from '@/components/paper'
//   notice.show({ title: '上传完成', description: '12 张图像已入库', kind: 'success' })

import { createApp, h, ref, defineComponent } from 'vue'
import { Icon } from '@iconify/vue'

type Kind = 'success' | 'error' | 'warning' | 'info'

type NoticeItem = {
  id: number
  title: string
  description?: string
  kind: Kind
  duration: number
}

let _id = 0
const items = ref<NoticeItem[]>([])

const ICONS: Record<Kind, string> = {
  success: 'lucide:circle-check',
  error: 'lucide:circle-alert',
  warning: 'lucide:siren',
  info: 'lucide:info',
}

function show(opts: { title: string; description?: string; kind?: Kind; duration?: number }) {
  const id = ++_id
  const item: NoticeItem = {
    id,
    title: opts.title,
    description: opts.description,
    kind: opts.kind || 'info',
    duration: opts.duration ?? 4500,
  }
  items.value.push(item)
  setTimeout(() => {
    items.value = items.value.filter((n) => n.id !== id)
  }, item.duration)
  return { close: () => { items.value = items.value.filter((n) => n.id !== id) } }
}

export const notice = {
  show,
  success: (title: string, description?: string) => show({ title, description, kind: 'success' }),
  error:   (title: string, description?: string) => show({ title, description, kind: 'error' }),
  warning: (title: string, description?: string) => show({ title, description, kind: 'warning' }),
  info:    (title: string, description?: string) => show({ title, description, kind: 'info' }),
}

const PaperNoticeHost = defineComponent({
  name: 'PaperNoticeHost',
  setup() {
    return () => h('div', { class: 'paper-notice-host' }, items.value.map((n) =>
      h('div', { class: `paper-notice paper-notice--${n.kind}`, key: n.id }, [
        h('div', { class: 'paper-notice__icon' }, [h(Icon, { icon: ICONS[n.kind], width: 18 })]),
        h('div', { class: 'paper-notice__body' }, [
          h('div', { class: 'paper-notice__title' }, n.title),
          n.description ? h('div', { class: 'paper-notice__desc' }, n.description) : null,
        ]),
      ])
    ))
  },
})

let mounted = false
export function mountPaperNotice() {
  if (mounted) return
  const el = document.createElement('div')
  el.id = 'paper-notice-mount'
  document.body.appendChild(el)
  const app = createApp(PaperNoticeHost)
  app.mount(el)
  mounted = true
}

const STYLE_ID = 'paper-notice-style'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.paper-notice-host {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
  pointer-events: none;
  max-width: 360px;
}
.paper-notice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 18px;
  border-radius: 16px;
  background: var(--lab-snow, #fff);
  box-shadow: 0 20px 40px -24px rgba(14,14,16,0.35);
  pointer-events: auto;
  animation: paper-notice-in 220ms cubic-bezier(0.4,0,0.2,1);
  border: 1px solid var(--lab-hairline, #ececea);
}
.paper-notice__icon {
  width: 28px; height: 28px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--lab-cream, #fbfaf5);
  color: var(--lab-slate, #3f4046);
  flex-shrink: 0;
}
.paper-notice--success .paper-notice__icon { background: var(--lab-mint, #b8f0d0); color: #1f4a2e; }
.paper-notice--error .paper-notice__icon,
.paper-notice--warning .paper-notice__icon { background: #ffd6c8; color: #8c2e15; }
.paper-notice__title { font-size: 13px; font-weight: 600; color: var(--lab-ink, #0e0e10); line-height: 1.3; }
.paper-notice__desc  { font-size: 12px; color: var(--lab-slate, #3f4046); margin-top: 2px; line-height: 1.45; }
@keyframes paper-notice-in {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
`
  document.head.appendChild(style)
}

if (typeof window !== 'undefined') {
  mountPaperNotice()
}
