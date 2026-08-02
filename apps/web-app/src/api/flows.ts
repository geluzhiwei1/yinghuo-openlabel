/**
 * 业务面 DNN flow 只读 API。走 /api/v1/b/flows,需要普通业务 access token。
 *
 * 与 src/ee/platform/composables/platformApi.ts 中的 platformFlowApi 区别:
 * - flowsApi(本文件):业务面只读,OSS/EE 通用,任何有 business:anno-job:read
 *   权限的用户可调用,用于 home/标注批次 创建界面选择 flow 元数据。
 * - platformFlowApi(EE 专属):平台面管理,需 platform_access token,仅 EE edition
 *   可用,用于 platform.html 平台管理界面增删改 flow。
 */
import { reqJson } from './req'

const base = '/api/v1/b/flows'

export const flowsApi = {
  list: () => reqJson({ uri: `${base}/`, method: 'GET' }),
  get: (id: string) => reqJson({ uri: `${base}/${id}`, method: 'GET' }),
  find: (params: { id?: string; name?: string }) =>
    reqJson({ uri: `${base}/find`, method: 'GET', data: params }),
}
