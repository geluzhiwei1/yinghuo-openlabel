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
  setup(props, { slots,expose }) {
    const target = ref()
    // const refreshKey = ref(1)
    let resized = false
    const handle = computed(() => props.handle ?? target.value)
    const storageValue = props.storageKey && useStorage(
      props.storageKey + '__v3',
      toValue(props.initialValue) || { x: 0, y: 0 },
      isClient
        ? props.storageType === 'session'
          ? sessionStorage
          : localStorage
        : undefined,
    )
    if (storageValue && storageValue.value && storageValue.value.x === 0 && storageValue.value.y === 0) {
      const propInit = toValue(props.initialValue)
      if (propInit && (propInit.x !== 0 || propInit.y !== 0)) {
        storageValue.value = { x: propInit.x, y: propInit.y }
      }
    }
    const initialValue = storageValue || props.initialValue || { x: 0, y: 0 }

    useResizeObserver(target, (entries) => {
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

    const mouseupHandle = (event) => {
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
      if (!storageValue)
        return
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

    const data = reactive(useDraggable(target, {
      ...props,
      handle,
      initialValue,
      onEnd,
    }))

    let classes = ''
    if (props.resizeable) {
      classes += 'resizeable'
    }

    return () => {
      if (slots.default)
        return h(props.as || 'div', { ref: target, onmouseup:mouseupHandle, class: classes, style: `${data.style}` }, slots.default(data))
    }
  },
})
