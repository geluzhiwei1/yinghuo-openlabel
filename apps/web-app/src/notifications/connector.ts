/**
 * Stage 12: SSE 连接管理。
 *
 * 用 EventSource 连 /api/v1/b/notifications/stream。
 * 注意:EventSource 不支持自定义 header,所以 token 通过 URL query 传。
 * 后端 AuthControl.is_authed 已支持 Authorization header OR ?token= query(向后备兼容)。
 * 这里走 query,通过 SSE EventSource API。
 *
 * 自动重连:断开后 5s 重连一次;最大重连次数 10(失败后停,等用户刷新页面)。
 */
import { watch } from 'vue'
import { userAuth } from '@/states/UserState'
import { NOTIFICATION_STREAM_URL } from '@/api'

export type NotificationEvent = {
  id: string
  type: string
  title: string
  body: string
  tenant_id: string
  user_id: number
  data: Record<string, any>
  created_at: string
  read: boolean
}

export type NotificationHandler = (evt: NotificationEvent) => void

const RECONNECT_DELAY_MS = 5000
const MAX_RETRIES = 10

let es: EventSource | null = null
let retryCount = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let activeToken = ''
const handlers = new Set<NotificationHandler>()
const openHandlers = new Set<() => void>()
const closeHandlers = new Set<() => void>()

function buildUrl(token: string): string {
  const base = NOTIFICATION_STREAM_URL
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}token=${encodeURIComponent(token)}`
}

function cleanup(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (es) {
    es.onopen = null
    es.onerror = null
    es.onmessage = null
    try {
      es.close()
    } catch {
      /* ignore */
    }
    es = null
  }
}

function connect(): void {
  cleanup()
  const token = userAuth.value.access_token
  if (!token) {
    return
  }
  activeToken = token
  const url = buildUrl(token)
  try {
    es = new EventSource(url)
  } catch (e) {
    console.warn('[notifications] EventSource init failed', e)
    scheduleReconnect()
    return
  }
  es.onopen = () => {
    retryCount = 0
    openHandlers.forEach((h) => h())
  }
  es.onerror = () => {
    closeHandlers.forEach((h) => h())
    if (es?.readyState === EventSource.CLOSED) {
      // 服务端主动关;尝试重连
    }
    scheduleReconnect()
  }
  // 默认 message 事件 + 命名事件(instance.approved / instance.rejected 等)
  // EventSource 对命名事件用 addEventListener;同时兜底 onmessage
  es.onmessage = (ev) => dispatch(ev.data)
  // 已知的命名事件类型
  ;[
    'instance.approved',
    'instance.rejected',
    'instance.stuck',
    'instance.assigned',
    'permission.changed',
    'test',
    'ping',
    'notification',
  ].forEach((type) => {
    es?.addEventListener(type, (ev: MessageEvent) => dispatch(ev.data))
  })
}

function dispatch(raw: unknown): void {
  if (!raw || typeof raw !== 'string') return
  let evt: NotificationEvent
  try {
    evt = JSON.parse(raw)
  } catch {
    return
  }
  handlers.forEach((h) => {
    try {
      h(evt)
    } catch (e) {
      console.warn('[notifications] handler threw', e)
    }
  })
}

function scheduleReconnect(): void {
  if (retryTimer) return
  if (retryCount >= MAX_RETRIES) {
    console.warn(
      `[notifications] giving up after ${MAX_RETRIES} retries;will retry on next user action`,
    )
    return
  }
  retryCount += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (activeToken !== userAuth.value.access_token) {
      // token 变了;让 ensureConnected/start 决定
      return
    }
    connect()
  }, RECONNECT_DELAY_MS)
}

export function startNotificationStream(): void {
  const t = userAuth.value.access_token
  if (!t) return
  if (es && activeToken === t) return
  retryCount = 0
  connect()
}

// token 刷新(主动/被动)后 EventSource 里的旧 URL token 已失效,
// scheduleReconnect 遇到 token 变化会直接放弃;这里监听变化负责重启,
// 同时覆盖多标签页场景(useLocalStorage 会跨标签同步 token)。
if (typeof window !== 'undefined') {
  watch(
    () => userAuth.value.access_token,
    (t) => {
      if (!t) {
        stopNotificationStream()
        return
      }
      if (es && activeToken === t) return
      startNotificationStream()
    },
  )
}

export function stopNotificationStream(): void {
  activeToken = ''
  cleanup()
}

export function onNotification(h: NotificationHandler): () => void {
  handlers.add(h)
  return () => handlers.delete(h)
}

export function onStreamOpen(h: () => void): () => void {
  openHandlers.add(h)
  return () => openHandlers.delete(h)
}

export function onStreamClose(h: () => void): () => void {
  closeHandlers.add(h)
  return () => closeHandlers.delete(h)
}

export function isStreamConnected(): boolean {
  return !!es && es.readyState === EventSource.OPEN
}
