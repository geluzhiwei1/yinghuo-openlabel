// PaperLoading — replaces ElLoading.service
//
// Usage:
//   import { loading } from '@/components/paper'
//   const handle = loading.show({ text: '上传中…' })
//   // ... async work
//   handle.close()
//
// Or scoped to an element:
//   loading.show({ target: '#my-card', text: '加载中' })

type Handle = { close: () => void }

function show(opts: { text?: string; target?: string } = {}): Handle {
  if (opts.target) {
    const target = typeof opts.target === 'string' ? document.querySelector(opts.target) : opts.target
    if (!target) return { close: () => {} }
    const el = document.createElement('div')
    el.className = 'paper-loading paper-loading--scoped'
    el.innerHTML = `
      <div class="paper-loading__spinner"><span></span></div>
      ${opts.text ? `<div class="paper-loading__text">${opts.text}</div>` : ''}
    `
    if (getComputedStyle(target).position === 'static') {
      (target as HTMLElement).style.position = 'relative'
    }
    target.appendChild(el)
    return { close: () => el.remove() }
  }

  const el = document.createElement('div')
  el.className = 'paper-loading paper-loading--fullscreen'
  el.innerHTML = `
    <div class="paper-loading__card">
      <div class="paper-loading__spinner"><span></span></div>
      ${opts.text ? `<div class="paper-loading__text">${opts.text}</div>` : ''}
    </div>
  `
  document.body.appendChild(el)
  return { close: () => el.remove() }
}

export const loading = { show }

const STYLE_ID = 'paper-loading-style'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.paper-loading--scoped {
  position: absolute; inset: 0;
  background: rgba(247,246,242,0.6);
  backdrop-filter: blur(2px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; z-index: 100;
  border-radius: inherit;
}
.paper-loading--fullscreen {
  position: fixed; inset: 0;
  background: rgba(14,14,16,0.35);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2800;
}
.paper-loading__card {
  background: var(--lab-snow, #fff);
  border-radius: 16px;
  padding: 20px 28px;
  box-shadow: 0 20px 40px -24px rgba(14,14,16,0.35);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.paper-loading__spinner {
  width: 28px; height: 28px;
  border-radius: 999px;
  border: 2.5px solid var(--lab-line, #e6e4dc);
  border-top-color: var(--lab-ink, #0e0e10);
  animation: paper-loading-spin 700ms linear infinite;
}
.paper-loading--scoped .paper-loading__spinner { border-top-color: var(--lab-ink, #0e0e10); }
.paper-loading__text {
  font-size: 12.5px; color: var(--lab-slate, #3f4046);
  font-family: var(--y-font-family-mono, monospace);
}
@keyframes paper-loading-spin { to { transform: rotate(360deg); } }
`
  document.head.appendChild(style)
}
