// PaperToast — replaces ElMessage
//
// Imperative API mounted on a singleton root. Each call spawns a pill that
// slides in from the top, holds ~3s, then fades out.
//
// Usage:
//   import { toast } from '@/components/paper'
//   toast.success('保存成功')
//   toast.error('上传失败')

import { createApp, h, ref, onMounted, defineComponent } from 'vue'
import { Icon } from '@iconify/vue'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

type ToastItem = {
  id: number
  kind: ToastKind
  text: string
  duration: number
}

let _id = 0
const items = ref<ToastItem[]>([])

const ICONS: Record<ToastKind, string> = {
  success: 'lucide:check',
  error: 'lucide:x',
  warning: 'lucide:siren',
  info: 'lucide:info',
}

function push(kind: ToastKind, text: string, duration = 2400) {
  const id = ++_id
  items.value.push({ id, kind, text, duration })
  setTimeout(() => {
    items.value = items.value.filter((t) => t.id !== id)
  }, duration)
}

export const toast = {
  success: (text: string, duration?: number) => push('success', text, duration),
  error:   (text: string, duration?: number) => push('error', text, duration),
  warning: (text: string, duration?: number) => push('warning', text, duration),
  info:    (text: string, duration?: number) => push('info', text, duration),
}

const PaperToastHost = defineComponent({
  name: 'PaperToastHost',
  setup() {
    return () => h('div', { class: 'paper-toast-host' }, items.value.map((t) =>
      h('div', { class: `paper-toast paper-toast--${t.kind}`, key: t.id }, [
        h(Icon, { icon: ICONS[t.kind], width: 16 }),
        h('span', { class: 'paper-toast__text' }, t.text),
      ])
    ))
  },
})

let mounted = false
export function mountPaperToast() {
  if (mounted) return
  const el = document.createElement('div')
  el.id = 'paper-toast-mount'
  document.body.appendChild(el)
  const app = createApp(PaperToastHost)
  app.mount(el)
  mounted = true
}

// Inject host styles once (idempotent)
const STYLE_ID = 'paper-toast-style'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.paper-toast-host {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
.paper-toast {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--lab-ink, #0e0e10);
  color: #fff;
  font-size: 12.5px;
  font-weight: 500;
  box-shadow: 0 20px 40px -24px rgba(14,14,16,0.35);
  pointer-events: auto;
  animation: paper-toast-in 200ms cubic-bezier(0.4,0,0.2,1);
}
.paper-toast--success { background: #2f7a3e; }
.paper-toast--warning,
.paper-toast--error   { background: var(--lab-coral, #ff6a3d); }
.paper-toast--info    { background: var(--lab-ink, #0e0e10); }
@keyframes paper-toast-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`
  document.head.appendChild(style)
}

// Mount lazily on first call (browser only)
if (typeof window !== 'undefined') {
  onMounted(() => mountPaperToast())
  // Also try immediately for non-component contexts
  mountPaperToast()
}
