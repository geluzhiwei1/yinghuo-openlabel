/**
 * Stage 9 权限校验 helper。
 *
 * 与后端 RBAC 三层权限(platform / admin / business)对齐。
 * 支持:
 *  - 精确匹配:`can('business:review:approve')`
 *  - 通配符:`can('business:review:*')` 任何 `business:review:` 前缀都通过
 *  - 超管短路:`user.is_superuser` 时一律 true
 *
 * 配合路由守卫、菜单过滤、按钮显隐使用。
 */
import { computed } from 'vue'
import { userAuth } from './UserState'

const matchKey = (perm: string, key: string): boolean => {
  if (perm === key) return true
  // 后端约定 `:` 分段,通配符只出现在末尾 `*`
  if (perm.endsWith(':*')) {
    const prefix = perm.slice(0, -1) // 保留 `:`
    if (key.startsWith(prefix)) return true
  }
  if (key.endsWith(':*')) {
    const prefix = key.slice(0, -1)
    if (perm.startsWith(prefix)) return true
  }
  return false
}

export const usePermission = () => {
  const permissions = computed<string[]>(() => userAuth.value?.permissions || [])
  const isSuperuser = computed<boolean>(
    () => !!userAuth.value?.user?.is_superuser,
  )

  const can = (key: string): boolean => {
    if (isSuperuser.value) return true
    if (!key) return true // 无 key 视为公开
    const list = permissions.value
    if (!list || list.length === 0) return false
    return list.some((p) => matchKey(p, key))
  }

  const canAny = (keys: string[]): boolean => {
    if (isSuperuser.value) return true
    if (!keys || keys.length === 0) return true
    return keys.some((k) => can(k))
  }

  const canAll = (keys: string[]): boolean => {
    if (!keys || keys.length === 0) return true
    return keys.every((k) => can(k))
  }

  return { can, canAny, canAll, permissions, isSuperuser }
}
