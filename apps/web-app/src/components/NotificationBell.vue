<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="380"
    trigger="click"
    popper-class="notif-bell__pop"
    @show="onPanelOpen"
  >
    <template #reference>
      <el-badge
        :value="unread || ''"
        :hidden="!unread"
        :max="99"
        class="notif-bell__badge"
      >
        <span class="header-action">
          <Icon icon="lucide:bell" width="20" />
        </span>
      </el-badge>
    </template>

    <div class="notif-bell">
      <header class="notif-bell__head">
        <span class="notif-bell__title">通知</span>
        <el-button
          link
          type="primary"
          :disabled="!unread"
          @click="onMarkAll"
        >全部已读</el-button>
      </header>

      <div v-if="!recent.length" class="notif-bell__empty">
        暂无通知
      </div>

      <ul v-else class="notif-bell__list">
        <li
          v-for="item in recent"
          :key="item.id"
          class="notif-bell__item"
          :class="{ 'is-unread': !item.read }"
          @click="onClickItem(item)"
        >
          <div class="notif-bell__item-head">
            <span class="notif-bell__item-title">{{ item.title }}</span>
            <span class="notif-bell__item-time">{{ formatTime(item.created_at) }}</span>
          </div>
          <div class="notif-bell__item-body">{{ item.body }}</div>
        </li>
      </ul>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useNotificationStore } from '@/notifications/store'
import type { NotificationEvent } from '@/notifications/connector'

const store = useNotificationStore()
const visible = ref(false)

const unread = computed(() => store.unread)
const recent = computed(() => store.recent)

function formatTime(iso: string): string {
  if (!iso) return ''
  // 简单相对时间
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function onClickItem(item: NotificationEvent) {
  if (!item.read) store.markRead(item.id)
  // 点击 body 里的 instance_id 时,可考虑跳转;MVP 不做路由
}

function onPanelOpen() {
  // 打开面板时刷新一次 unread(防止 SSE 漏推)
  store.loadInitial()
}

function onMarkAll() {
  store.markAllRead()
}

onMounted(() => {
  store.start()
})
onUnmounted(() => {
  // 组件被卸载时不要停 stream(单页 SPA 切换 view 时希望保持后台)
  // 只在 user logout 时 stop(由 logout flow 调用)
})
</script>

<style lang="scss" scoped>
.notif-bell__badge {
  --el-badge-text-color: var(--y-color-bg-card);
}

.notif-bell {
  max-height: 480px;
  display: flex;
  flex-direction: column;
}

.notif-bell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.notif-bell__title {
  font-weight: 500;
  font-size: 14px;
}

.notif-bell__empty {
  padding: 32px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.notif-bell__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  max-height: 420px;
}

.notif-bell__item {
  padding: 10px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-unread {
    background: var(--el-color-primary-light-9);
  }
}

.notif-bell__item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.notif-bell__item-title {
  font-weight: 500;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.notif-bell__item-time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.notif-bell__item-body {
  font-size: 12px;
  color: var(--el-text-color-regular);
  word-break: break-all;
}
</style>
