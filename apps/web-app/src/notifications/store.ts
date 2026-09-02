/**
 * Stage 12: 通知 Pinia store。
 *
 * 职责:
 * - 维护最近通知 list(去重,最多 50 条)
 * - 维护 unread 计数
 * - 启动/停止 SSE 流(组件 mount 时 start,unmount 时 stop)
 * - 提供 markRead / markAllRead action
 * - 暴露 pushToast 给 bell 组件,在新事件到达时弹 ElNotification
 */
import { defineStore } from 'pinia'
import { ElNotification } from 'element-plus'
import { notificationApi } from '@/api'
import { startTokenAutoRefresh } from '@/api/req'
import {
  startNotificationStream,
  stopNotificationStream,
  onNotification,
  type NotificationEvent,
} from './connector'

const MAX_ITEMS = 50

type NotificationState = {
  items: NotificationEvent[]
  unread: number
  connected: boolean
}

let started = false

export const useNotificationStore = defineStore('notifications', {
  state: (): NotificationState => ({
    items: [],
    unread: 0,
    connected: false,
  }),
  getters: {
    recent: (s) => s.items.slice(0, 20),
  },
  actions: {
    async loadInitial() {
      try {
        const r: any = await notificationApi.list({ limit: MAX_ITEMS })
        this.items = r?.items ?? []
        this.unread = r?.unread ?? 0
      } catch (e) {
        // 静默失败;首次加载失败不弹错(可能 token 未到)
        console.warn('[notifications] loadInitial failed', e)
      }
    },
    async start() {
      if (started) return
      started = true
      // 页面就绪:顺带启动 access_token 主动刷新(过期前 2 分钟换新,避免 401 报错/SSE 掉线)
      startTokenAutoRefresh()
      // 拉历史(必须先 await,否则 SSE 连上时历史 flush 与 items 竞争,去重失效会狂弹 toast)
      await this.loadInitial()
      // 订阅 SSE
      onNotification((evt) => this._onEvent(evt))
      startNotificationStream()
    },
    stop() {
      started = false
      stopNotificationStream()
    },
    _onEvent(evt: NotificationEvent) {
      // 去重:同 id 不重复
      if (this.items.some((x) => x.id === evt.id)) return
      this.items.unshift(evt)
      if (this.items.length > MAX_ITEMS) {
        this.items.length = MAX_ITEMS
      }
      if (!evt.read) this.unread += 1
      this._popToast(evt)
    },
    _popToast(evt: NotificationEvent) {
      // 静音类型:test/ping 不弹
      if (evt.type === 'test' || evt.type === 'ping') return
      // 防御:SSE 连上时后端会 flush 历史未读,这些事件 created_at 已旧,
      // 不应该作为"新通知"弹 toast(用户登录时 bell 角标已经告诉他们了)
      const created = evt.created_at ? Date.parse(evt.created_at) : NaN
      if (!Number.isNaN(created) && Date.now() - created > 60_000) return
      const kind =
        evt.type === 'instance.approved'
          ? 'success'
          : evt.type === 'instance.rejected'
            ? 'warning'
            : evt.type === 'permission.changed'
              ? 'warning'
              : 'info'
      try {
        ElNotification({
          title: evt.title,
          message: evt.body,
          type: kind as any,
          duration: 5000,
          position: 'bottom-right',
        })
      } catch {
        /* ignore */
      }
    },
    async markRead(id: string) {
      const item = this.items.find((x) => x.id === id)
      if (!item || item.read) return
      item.read = true
      this.unread = Math.max(0, this.unread - 1)
      try {
        await notificationApi.markRead(id)
      } catch (e) {
        // 回滚
        item.read = false
        this.unread += 1
        console.warn('[notifications] markRead failed', e)
      }
    },
    async markAllRead() {
      const before = this.unread
      this.items.forEach((x) => (x.read = true))
      this.unread = 0
      try {
        await notificationApi.markAllRead()
      } catch (e) {
        this.unread = before
        console.warn('[notifications] markAllRead failed', e)
      }
    },
  },
})
