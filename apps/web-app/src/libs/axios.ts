/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024-06-03
 * @date 甲辰 [龙] 年 四月廿七
 */

import type {
    InternalAxiosRequestConfig,
    AxiosResponse,
    AxiosInstance,
    AxiosRequestHeaders,
} from 'axios'
import qs from 'qs'
import axios from 'axios'
import { messages } from '@/states'
// import { API1_BASE } from '@/config'


declare interface ResponseWrapper<T> {
    status: number;
    data?: T;
    statusText?: string;
}

const config = {
    code: 0,
    timeout: 60000,
    defaultHeaders: 'application/json',
    // baseURL: API1_BASE,
}

const axiosInstance: AxiosInstance = axios.create({
    ...config,
})
const abortControllerMap: Map<string, AbortController> = new Map()
axiosInstance.interceptors.request.use((res: InternalAxiosRequestConfig) => {
    const controller = new AbortController()
    const url = res.url || ''
    res.signal = controller.signal
    abortControllerMap.set(url, controller)
    return res
})

axiosInstance.interceptors.response.use(
    (res: AxiosResponse) => {
        const url = res.config.url || ''
        abortControllerMap.delete(url)
        return res.data
    },
    (err: any) => err
)

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (
        config.method === 'post' &&
        (config.headers as AxiosRequestHeaders)['Content-Type'] === 'application/x-www-form-urlencoded'
    ) {
        config.data = qs.stringify(config.data)
    }
    if (config.method === 'get' && config.params) {
        let url = config.url as string
        url += '?'
        const keys = Object.keys(config.params)
        for (const key of keys) {
            if (config.params[key] !== void 0 && config.params[key] !== null) {
                url += `${key}=${encodeURIComponent(config.params[key])}&`
            }
        }
        url = url.substring(0, url.length - 1)
        config.params = {}
        config.url = url
    }
    return config
})
axiosInstance.interceptors.response.use((response: AxiosResponse<any>) => {
    if (response?.config?.responseType === 'blob') {
        return response
    } else if (response.status === config.code) {
        return response.data
    } else {
        messages.lastError = response.data.statusText
    }
})


const service = {
    request: (config: any) => {
        return new Promise((resolve, reject) => {
            if (config.interceptors?.requestInterceptors) {
                config = config.interceptors.requestInterceptors(config as any)
            }

            axiosInstance
                .request(config)
                .then((res) => {
                    resolve(res)
                })
                .catch((err: any) => {
                    reject(err)
                })
        })
    },
    cancelRequest: (url: string | string[]) => {
        const urlList = Array.isArray(url) ? url : [url]
        for (const _url of urlList) {
            abortControllerMap.get(_url)?.abort()
            abortControllerMap.delete(_url)
        }
    },
    cancelAllRequest() {
        for (const [_, controller] of abortControllerMap) {
            controller.abort()
        }
        abortControllerMap.clear()
    }
}

const request = (option: any) => {
    const { baseURL, url, method, params, data, headersType, responseType } = option
    return service.request({
        baseURL,
        url: url,
        method,
        params,
        data,
        responseType: responseType,
        headers: {
            'Content-Type': headersType
        }
    })
}

declare type IResponse<T> = AxiosResponse<ResponseWrapper<T>>
export default {
    get: <T = any>(option: any) => {
        return request({ method: 'get', ...option }) as Promise<IResponse<T>>
    },
    post: <T = any>(option: any) => {
        return request({ method: 'post', ...option }) as Promise<IResponse<T>>
    },
    patch: <T = any>(option: any) => {
        return request({ method: 'patch', ...option }) as Promise<IResponse<T>>
    },
    delete: <T = any>(option: any) => {
        return request({ method: 'delete', ...option }) as Promise<IResponse<T>>
    },
    put: <T = any>(option: any) => {
        return request({ method: 'put', ...option }) as Promise<IResponse<T>>
    },
    cancelRequest: (url: string | string[]) => {
        return service.cancelRequest(url)
    },
    cancelAllRequest: () => {
        return service.cancelAllRequest()
    }
}
