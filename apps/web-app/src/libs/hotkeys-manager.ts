import { computed, watch } from 'vue'
import { useMagicKeys, whenever, useActiveElement } from '@vueuse/core'
import { globalStates } from '@/states'

const { current } = useMagicKeys()

const activeElement = useActiveElement()
const notUsingInput = computed(
  () => activeElement.value?.tagName !== 'INPUT' && activeElement.value?.tagName !== 'TEXTAREA'
)

export class HotkeysManager {
  private currentKeyboard

  private watchers: any[] = []
  private hotkeys: Map<string, any> = new Map()
  private autoOff = true

  constructor(autoOff: boolean = true) {
    this.autoOff = autoOff
    this.currentKeyboard = current
    watch(
      () => globalStates.listenHotkeys,
      (newValue, oldValue) => {
        if (newValue === oldValue) {
          return
        }
        if (newValue === 1) {
          this.onWatchHotKeys()
        } else {
          this.offWatchHotKeys()
        }
      },
      { immediate: true }
    )
  }

  public onWatchHotKeys() {
    this.hotkeys.forEach((value, key) => {
      this.listenHotkey(value)
    })
  }

  public registerHotkeys(conf: any) {
    const { toolId, keys } = conf
    const uniqueId = `${toolId}:${keys}`
    if (this.hotkeys.has(uniqueId)) {
      return
    }
    this.hotkeys.set(uniqueId, conf)
    if (!this.autoOff) {
      this.listenHotkey(conf)
    }
  }

  private listenHotkey(conf: any) {
    const { keys, cb } = conf
    // 有 + 号，则表示组合键
    if (keys.includes('+')) {
      const ks = keys
        .toLocaleLowerCase()
        .split('+')
        .map((key) => key)
      this.watchers.push(
        whenever(
          () =>
            // 当前没有使用输入框，并且按了快捷键
            notUsingInput.value && this.checkKeyCombination(ks),
          () => {
            cb?.()
          }
        )
      )
    }
    // 有 | 符号，则表示或者
    else if (keys.includes('|')) {
      const ks = keys
        .toLocaleLowerCase()
        .split('|')
        .map((key) => key)
      ks.forEach((key) => {
        // 当前没有使用输入框，并且按了快捷键1，或者快捷键2
        this.watchers.push(
          whenever(
            () => notUsingInput.value && this.currentKeyboard.has(key),
            () => {
              cb?.()
            }
          )
        )
      })
    }
    // 只有单个按键
    else {
      this.watchers.push(
        // 当前没有使用输入框，并且按了快捷键
        whenever(
          () => notUsingInput.value && this.checkKeyCombination([keys.toLocaleLowerCase()]),
          () => cb?.()
        )
      )
    }
  }

  protected checkKeyCombination(keys: string[]): boolean {
    if (this.currentKeyboard.size !== keys.length) {
      return false
    }
    for (const key of keys) {
      if (!this.currentKeyboard.has(key)) {
        return false
      }
    }
    return true
  }

  public offWatchHotKeys() {
    this.watchers.forEach((unwatch) => {
      unwatch()
    })
    this.watchers = []
  }
}
