/**
 * @description 用户状态：登录状态、token、角色、权限、用户信息
 */
import { useStorage, useLocalStorage } from '@vueuse/core'

export const userAuth = useLocalStorage(
  'yh-store-user',
  {
    isLogin: false,
    access_token: '',
    token_type: 'bearer',
    roles: [] as string[], // 用户的角色
    permissions: [] as string[], // 用户的权限
    user: {} as any, // 用户信息
    mainUser: {} as any, // 主账号
    config: {} as any
  },
  {
    deep: true,
    listenToStorageChanges: true
  }
)

export const cleanLoginfo = () => {
  userAuth.value.access_token = ''
  userAuth.value.isLogin = false
  userAuth.value.roles = []
  userAuth.value.user = {}
  userAuth.value.config = {}
}

export const userSettings = useStorage('yh-user-setting', {
  savePerSeconds: {
    enabled: false,
    prop: 60
  },
  saveBeforeChangeFrame: false
})
