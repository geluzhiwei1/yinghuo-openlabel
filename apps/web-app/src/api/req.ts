import { ElMessage } from 'element-plus'
import { userAuth } from '@/states/UserState'
import { i18n } from '@/locales'
import {
  AuthError,
  BusinessError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  ValidationError,
  YhError,
  type YhErrorOptions,
} from '@/api/errors'

const t = (key: string) => i18n.global.t(key)

const notify = (err: YhError) => {
  if (err.level === 'silent') return
  if (err.level === 'warning') ElMessage.warning(err.message)
  else if (err.level === 'info') ElMessage.info(err.message)
  else ElMessage.error(err.message)
}

const authRedirect = (path: string) => {
  if (typeof window === 'undefined') return
  if (!window.location.pathname.endsWith(path)) {
    window.location.href = `${import.meta.env.BASE_URL}${path}`
  }
}

// ── refresh-on-401 ─────────────────────────────────────────────
// 单飞 promise:并发 401 时多个请求共用一次 refresh,refresh 完成后大家各自重试
let _refreshPromise: Promise<string> | null = null

const refreshAccessToken = async (): Promise<string> => {
  if (_refreshPromise) return _refreshPromise
  const refreshToken = userAuth.value.refresh_token
  if (!refreshToken) {
    throw new AuthError('no refresh token')
  }
  _refreshPromise = (async () => {
    const resp = await fetch('/api/v1/b/u/a/noau/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!resp.ok) {
      throw new AuthError('refresh failed')
    }
    const j = await resp.json()
    const data = j?.data ?? j
    if (!data?.access_token) {
      throw new AuthError('refresh malformed')
    }
    userAuth.value.access_token = data.access_token
    if (data.refresh_token) {
      userAuth.value.refresh_token = data.refresh_token
    }
    return data.access_token as string
  })().finally(() => {
    _refreshPromise = null
  })
  return _refreshPromise
}

export const reqJson = (options: any) => {
  const { uri, method, data, header } = options
  const j_data = data || {}
  let _uri = uri
  let _opt
  if (method === 'GET') {
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(j_data)) {
      if (v === undefined || v === null) continue
      clean[k] = typeof v === 'string' ? v : String(v)
    }
    _uri += `?${new URLSearchParams(clean).toString()}`
    _opt = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.value.access_token}`
      }
    }
  } else {
    _opt = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.value.access_token}`,
        ...header
      },
      body: JSON.stringify(j_data)
    }
  }
  return doFetch(_uri, _opt)
}

export const reqForm = async (options: any) => {
  const { uri, method, header = {}, target_image, json_str } = options
  if (!target_image || !json_str) {
    throw new ValidationError('target_image and json_str are required')
  }
  const formData = new FormData()
  formData.append('target_image', target_image, 'target.jpg')
  formData.append('json_str', json_str)

  const _opt = {
    method,
    headers: {
      ...header,
      Authorization: `Bearer ${userAuth.value.access_token}`,
    },
    body: formData,
  }

  return doFetch(uri, _opt)
}

const buildErrorFromStatus = async (response: Response): Promise<YhError> => {
  const httpStatus = response.status
  let body: any = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const bodyMsg = body?.statusText || body?.detail || body?.message

  const opts: YhErrorOptions = { httpStatus, details: body }

  if (httpStatus === 401) {
    // Stage 9: token 失效时连同 permissions/tenant/preferences 一并清空,
    // 防止页面残留过期权限导致用户看到本不该看到的菜单/按钮
    userAuth.value.access_token = ''
    userAuth.value.refresh_token = ''
    userAuth.value.isLogin = false
    userAuth.value.permissions = []
    userAuth.value.tenant_id = ''
    userAuth.value.preferences = {}
    authRedirect('/auth.html')
    return new AuthError(bodyMsg, opts)
  }
  if (httpStatus === 403) {
    authRedirect('/403')
    return new ForbiddenError(bodyMsg, opts)
  }
  if (httpStatus === 404) {
    return new NotFoundError(bodyMsg, opts)
  }
  if (httpStatus === 422) {
    return new ValidationError(bodyMsg ?? t('error.validation'), { ...opts, details: body?.detail ?? body })
  }
  if (httpStatus >= 500) {
    if (bodyMsg && typeof bodyMsg === 'string') {
      return new BusinessError(bodyMsg, { ...opts, kind: 'business', level: 'warning' })
    }
    return new ServerError(t('error.server'), opts)
  }
  return new YhError(bodyMsg ?? t('error.fallback'), { ...opts, kind: 'unknown' })
}

const doFetch = async (_uri: any, _opt: any) => {
  let response: Response
  try {
    response = await fetch(_uri, _opt)
  } catch (e: any) {
    const err = new NetworkError(e?.message, { details: e })
    notify(err)
    throw err
  }

  if (response.status === 401 && userAuth.value.refresh_token) {
    // 401 + refresh_token:刷新 access_token 并重试一次原请求
    // 失败模式分两种:
    //   (a) refresh 本身失败(token 过期/服务异常)→ 清理 + 跳登录
    //   (b) retry 仍失败 → 已由 buildErrorFromStatus 处理(可能 redirect 或抛业务错)
    let newToken: string
    try {
      newToken = await refreshAccessToken()
    } catch {
      // refresh 失败 → 清空登录态并跳转登录页
      userAuth.value.access_token = ''
      userAuth.value.refresh_token = ''
      userAuth.value.isLogin = false
      userAuth.value.permissions = []
      userAuth.value.tenant_id = ''
      userAuth.value.preferences = {}
      authRedirect('/auth.html')
      const err = new AuthError('session expired')
      err.level = 'silent'
      notify(err)
      throw err
    }
    const retryOpt = {
      ..._opt,
      headers: { ..._opt.headers, Authorization: `Bearer ${newToken}` },
    }
    const retryResp = await fetch(_uri, retryOpt)
    if (retryResp.ok) {
      return retryResp.json()
    }
    // 重试仍失败 → 走标准错误流
    const err = await buildErrorFromStatus(retryResp)
    notify(err)
    throw err
  }

  if (!response.ok) {
    const err = await buildErrorFromStatus(response)
    notify(err)
    throw err
  }

  let j: any
  try {
    j = await response.json()
  } catch (e: any) {
    const err = new ServerError(t('error.empty'), { details: e })
    notify(err)
    throw err
  }

  if (j && typeof j === 'object' && 'status' in j) {
    if (j.status === 0 || j.status === 200) {
      return j
    }
    const err = new BusinessError(j.statusText || t('error.business'), { code: j.status, details: j })
    notify(err)
    throw err
  }
  return j
}
