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
import { ElMessage } from 'element-plus'
import { userAuth } from '@/states/UserState'

export const reqJson = (options: any) => {
  const { uri, method, data, header } = options
  const j_data = data || {}
  let _uri = uri
  let _opt
  if (method === 'GET') {
    _uri += `?${new URLSearchParams(j_data).toString()}`
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
  // if (userApi.captcha_id) {
  //   _opt.headers['X-Captcha-Id'] = userApi.captcha_id
  // }
  return doFetch(_uri, _opt)
}
export const reqForm = async (options: any) => {
  const { uri, method, header = {}, target_image, json_str } = options
  if (!target_image || !json_str) {
    throw new Error('target_image and json_str are required')
  }
  const formData = new FormData()
  formData.append('target_image', target_image, 'target.jpg')
  formData.append('json_str', json_str)

  const _opt = {
    method,
    headers: {
      ...header,
      // 'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${userAuth.value.access_token}`
    },
    body: formData
  }

  const _uri = uri

  return doFetch(_uri, _opt)
}
const doFetch = async (
  _uri: any,
  _opt:
    | { method: any; headers: { 'Content-Type': string; Authorization: string } }
    | { method: any; headers: any; body: string }
) => {
  return new Promise((resolve, reject) => {
    fetch(_uri, _opt).then((response) => {
      // TODO 检查登录
      if (response.status === 401) {
        userAuth.value.access_token = ''
        window.location.href = `${import.meta.env.BASE_URL}/login.html`
        return
      } else if (response.status === 403) {
        window.location.href = '/403'
        return
      } else if (response.status === 404) {
        // window.location.href = '/'
        return
      } else if (response.status === 500) {
        ElMessage.error('服务器后台异常')
        reject('服务器后台异常')
        return
      } else if (response.status === 422) {
        ElMessage.error('提交的数据字段不完整或格式错误')
        reject('提交的数据字段不完整或格式错误')
        return
      } else if (!response.ok) {
        response
          .json()
          .then((j) => {
            const errMsg = j.statusText || j.detail || '服务器处理异常'
            ElMessage.error(errMsg)
            reject(errMsg)
            return
          })
          .catch((err: any) => {
            reject(err)
            return
          })
      } else {
        response
          .json()
          .then((j) => {
            if (j) {
              if ('status' in j) {
                if (j.status === 0 || j.status === 200) {
                  // 返回结果完全正确
                  resolve(j)
                } else {
                  // 业务错误
                  const errMsg = j.statusText || '服务器处理异常'
                  // messages.lastFailed = errMsg
                  ElMessage.warning(errMsg)
                  reject(errMsg)
                }
              } else {
                // ElMessage.error('unknown response format')
                resolve(j)
              }
            } else {
              ElMessage.error('response empty')
            }
          })
          .catch((err: any) => {
            reject(err)
          })
      }
    })
  })
}
