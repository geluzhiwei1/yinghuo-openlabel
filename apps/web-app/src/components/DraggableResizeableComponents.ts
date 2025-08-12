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
import type { UseDraggableOptions, RenderableComponent, Position } from '@vueuse/core'
import { isClient, useDraggable, useStorage } from '@vueuse/core'
import { toValue } from '@vueuse/core'
import { useResizeObserver } from '@vueuse/core'
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
const { width, height } = useWindowSize()
// import { eventBus } from '../../event/EventBus'
// import { useMousePressed } from '@vueuse/core'
// const { pressed, sourceType } = useMousePressed()

export interface UseDraggableProps extends UseDraggableOptions, RenderableComponent {
  /**
   * When provided, use `useStorage` to preserve element's position
   */
  storageKey?: string

  /**
   * Storage type
   *
   * @default 'local'
   */
  storageType?: 'local' | 'session'
  onResized?: (rect: DOMRect, event: any) => void
  onDragEnd?: (rect: DOMRect, event: any) => void
  resizeable?: boolean
}

export const UseDraggable = /* #__PURE__ */ defineComponent<UseDraggableProps>({
  name: 'UseDraggable',
  props: [
    'storageKey',
    'storageType',
    'initialValue',
    'exact',
    'preventDefault',
    'stopPropagation',
    'pointerTypes',
    'as',
    'handle',
    'axis',
    'onStart',
    'onMove',
    'onEnd',
    'resizeable',
    'onResized',
    'onDragEnd'
  ] as unknown as undefined,
  setup(props, { slots, expose }) {
    const target = ref()
    // const refreshKey = ref(1)
    let resized = false
    const handle = computed(() => props.handle ?? target.value)
    const storageValue =
      props.storageKey &&
      useStorage(
        props.storageKey,
        toValue(props.initialValue) || { x: 0, y: 0 },
        isClient ? (props.storageType === 'session' ? sessionStorage : localStorage) : undefined
      )
    const initialValue = storageValue || props.initialValue || { x: 0, y: 0 }

    useResizeObserver(target, () => {
      resized = true
      // const entry = entries[0]
      // const { width, height } = entry.contentRect
      // lastSize.width = width
      // lastSize.height = height
      // text.value = `width: ${width}, height: ${height}`
      // if (!pressed.value) {
      // props.onResized?.(target.value.getBoundingClientRect())
      // }
    })

    const mouseupHandle = (event: any) => {
      if (resized) {
        resized = false
        props.onResized?.(target.value.getBoundingClientRect(), event)
      }
    }

    onMounted(() => {
      resized = false
      watch([width, height], () => {
        if (data.position.x > width.value) {
          data.position.x = width.value - 400
        }
      })
    })

    const onEnd = (position: Position, event: PointerEvent) => {
      props.onEnd?.(position, event)
      props.onDragEnd?.(target.value.getBoundingClientRect(), event)
      if (!storageValue) return
      storageValue.value.x = position.x
      storageValue.value.y = position.y
    }

    // const forceReRender = () => {
    //   refreshKey.value += 1
    // }
    const getClientRect = () => {
      const height = target.value?.clientHeight
      const width = target.value?.clientWidth
      const dimensions = { height, width }
      return dimensions
    }
    expose({
      getClientRect
    })

    const data = reactive(
      useDraggable(target, {
        ...props,
        handle,
        initialValue,
        onEnd
      })
    )

    let classes = ''
    if (props.resizeable) {
      classes += 'resizeable'
    }

    return () => {
      if (slots.default)
        return h(
          props.as || 'div',
          { ref: target, onmouseup: mouseupHandle, class: classes, style: `${data.style}` },
          slots.default(data)
        )
    }
  }
})
