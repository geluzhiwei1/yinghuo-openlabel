/**
 * 审核工作台键盘快捷键。
 *
 * J/K  上下切换
 * A    通过
 * R    驳回(打开 dialog)
 * ?    帮助
 *
 * 在 input/textarea 中输入时不触发。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import Mousetrap from 'mousetrap'

export interface ShortcutHandlers {
  onNext: () => void
  onPrev: () => void
  onApprove: () => void
  onReject: () => void
  onHelp: () => void
}

const isEditable = (e?: KeyboardEvent): boolean => {
  const t = e?.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (t as HTMLElement).isContentEditable
  )
}

export const useReviewShortcuts = (handlers: ShortcutHandlers) => {
  const bind = () => {
    Mousetrap.bind(
      'j',
      (e) => {
        if (isEditable(e)) return
        e?.preventDefault()
        handlers.onNext()
      },
      'keydown',
    )
    Mousetrap.bind(
      'k',
      (e) => {
        if (isEditable(e)) return
        e?.preventDefault()
        handlers.onPrev()
      },
      'keydown',
    )
    Mousetrap.bind(
      'a',
      (e) => {
        if (isEditable(e)) return
        e?.preventDefault()
        handlers.onApprove()
      },
      'keydown',
    )
    Mousetrap.bind(
      'r',
      (e) => {
        if (isEditable(e)) return
        e?.preventDefault()
        handlers.onReject()
      },
      'keydown',
    )
    Mousetrap.bind(
      '?',
      (e) => {
        e?.preventDefault()
        handlers.onHelp()
      },
      'keydown',
    )
  }
  const unbind = () => Mousetrap.reset()

  onMounted(bind)
  onBeforeUnmount(unbind)
}
