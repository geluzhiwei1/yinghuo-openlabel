/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 */
import request from '@/libs/axios'
import { jobConfig } from '@/states/job-config'
import { userAuth } from '@/states/UserState'
import { reqForm, reqJson } from './req'

// capcha
export const capchaApi = {
  'imgUri': "/api/v1/c/captcha/generate/",
  'checkUri': "/api/v1/c/captcha/validate/",
  'sendcode': "/api/v1/c/mobilecode/sendcode/",
  'checkCode': "/api/v1/c/mobilecode/validate/"
}

// email code
export const emailCodeApi = {
  'sendcode': "/api/v1/c/emailcode/sendcode/",
  'checkUri': "/api/v1/c/emailcode/validate/"
}

// user
const userApiBaseUri = '/api/v1/b/u/a'
export const userApi = {
  login: (data, header) => {
    return reqJson({ uri: userApiBaseUri + '/noau/token', method: 'POST', data, header })
  },
  refresh: (data) => {
    return reqJson({ uri: userApiBaseUri + '/noau/refresh', method: 'POST', data })
  },
  register: (data, header) => {
    return reqJson({ uri: userApiBaseUri + '/noau/register', method: 'POST', data, header })
  },
  reset: (data, header) => {
    return reqJson({ uri: userApiBaseUri + '/noau/reset-password', method: 'POST', data, header })
  },
}


// label
const bizBaseURL = "/api/v1/b"
const adminBaseURL = "/api/v1/a"
export const labelApi = {
  save: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/save', method: 'POST', data })
  },
  load: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/load', method: 'POST', data })
  },
  load_val: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/val', method: 'POST', data })
  },
  frame_save: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/frame_save', method: 'POST', data })
  },
  frame_load: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/frame_load', method: 'POST', data })
  },
  seq_save: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/seq_save', method: 'POST', data })
  },
  seq_load: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/seq_load', method: 'POST', data })
  },
  export: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/export', method: 'POST', data })
  },
  export_coco: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/export_coco', method: 'POST', data })
  },
  export_format: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/export_format', method: 'POST', data })
  },
  export_format_blob: async (data) => {
    const resp = await fetch(bizBaseURL + '/label/export_format', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.value.access_token}`,
      },
      body: JSON.stringify(data),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`导出失败 (${resp.status}): ${text}`)
    }
    return resp.blob()
  },
  export_format: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/export_format', method: 'POST', data })
  },
  export_format_blob: async (data) => {
    const resp = await fetch(bizBaseURL + '/label/export_format', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.value.access_token}`,
      },
      body: JSON.stringify(data),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`导出失败 (${resp.status}): ${text}`)
    }
    return resp.blob()
  },
  deleteSeqAll: (data) => {
    return reqJson({ uri: bizBaseURL + '/label/deleteSeqAll', method: 'POST', data })
  },
}

export const fileAPi = {
  uri2: bizBaseURL + '/file2/get',
  mapJson: (data) => {
    return reqJson({ method: 'GET', uri: bizBaseURL + '/file2/get', data})
  },
}

// statistics
export const statisticsApi = {
  seq: (data) => {
    return reqJson({ uri: bizBaseURL + '/statistics/seq', method: 'POST', data })
  },
  my: (data) => {
    return reqJson({ uri: bizBaseURL + '/statistics/my', method: 'POST', data })
  },
}

// let funcs_msam = null
// DNN model api
export const dnnModelApi = {
  funcapi: async (api_group, api_id, data) => {
    data.params = {
      seq: jobConfig.seq,
      stream: jobConfig.stream,
      frame: jobConfig.frame,
      data_format: jobConfig.data_format,
      data_source: jobConfig.data_source,
      mission: jobConfig.mission,
      ...data.params
    }
    return reqJson({ uri: bizBaseURL + `/dnn/yh-func-api/${api_group}/${api_id}`, method: 'POST', data })
  },
  funcapi2: async (api_group, api_id, jsonData:Object, target_image:Blob) => {
    jsonData.params = {
      seq: jobConfig.seq,
      stream: jobConfig.stream,
      frame: jobConfig.frame,
      data_format: jobConfig.data_format,
      data_source: jobConfig.data_source,
      mission: jobConfig.mission,
      ...jsonData.params
    }
    return reqForm({ uri: bizBaseURL + `/dnn/yh-func-api/${api_group}/${api_id}`, method: 'POST', target_image, json_str: JSON.stringify(jsonData) })
  },
  getList: () => {
    // return request.get({baseURL: bizBaseURL, url: '/dnn/yh-func-api'})
    return reqJson({ method: 'GET', uri: bizBaseURL + '/dnn/yh-func-api' })
  },
}

export const lidarApi = {
  predictRotation: (data) => {
    return request.post({ baseURL: bizBaseURL, url: '/dnn-lidar/infer', data })
  }
}


// taxonomy
export const taxonomyApi = {
  schema: (params) => {
    return request.get({ baseURL: bizBaseURL, url: '/taxonomy/schema', params })
  },
  classes: (params) => {
    return request.get({ baseURL: bizBaseURL, url: '/taxonomy/classes', params })
  }
}

const getStreamMeta = (data: any) => {
  return reqJson({ uri: `${bizBaseURL}/seq/stream/meta`, data, method: 'POST' })
}

const getDataSeqMeta = (data: any) => {
  return reqJson({ uri: `${bizBaseURL}/seq/meta`, data, method: 'POST' })
}

export const metaApi = {
  getCurrentSeqMeta: () => {
    return getDataSeqMeta(jobConfig)
  },
  getCurrentStreamMeta: () => {
    return getStreamMeta(jobConfig)
  },
  updateStreamUrils: (uuid:string, uris: any[]) => {
    return reqJson({ uri: `${bizBaseURL}/seq/stream/meta`, 
      data:{jobConfig, uuid, uris}, method: 'PUT' })
  }
}

export const annoJobPerformApi = {
  create: (data) => {
    // return request.post({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'POST' })
  },
  delete: (data) => {
    // return request.delete({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'DELETE' })
  },
  update: (data) => {
    // return request.put({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'PUT' })
  },
  update_collaborator: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_collaborator`, data, method: 'POST' })
  },
  update_collaborators: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_collaborators`, data, method: 'POST' })
  },
  query: (params) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data: params, method: 'GET' })
  },
  info: (params) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/info`, data: params, method: 'GET' })
  },
  searchJob: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/search_job`, data, method: 'POST' })
  },
  search: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/search`, data, method: 'POST' })
  },
  update_status: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_status`, data, method: 'PUT' })
  },
}

export const annoSpecApi = {
  create: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/create`, data, method: 'POST' })
  },
  delete: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/delete`, data, method: 'DELETE' })
  },
  update: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/update`, data, method: 'PUT' })
  },
  query: (params) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/query`, data: params, method: 'GET' })
  },
  search: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/search`, data, method: 'POST' })
  },
  classes: (data) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/classes`, data, method: 'GET' })
  },
}


// ----- Stage 13.2: 角色 / 权限(走 admin app /api/v1/a/roles|permissions/*) -----
// 注:旧的 /api/v1/b/roles/* MongoDB 路由保留给 admin.html(legacy);新 tenant_admin 走 admin app
export const roleApi = {
  create: (data: any) => reqJson({ uri: `${adminBaseURL}/roles`, data, method: 'POST' }),
  update: (data: any) => {
    // 兼容老调用 shape: {id, name, description} 或 {id, description}
    const { id, ...rest } = data
    return reqJson({ uri: `${adminBaseURL}/roles/${id}`, data: rest, method: 'PATCH' })
  },
  updatePermissions: (id: number, permissions: string[]) => reqJson({
    uri: `${adminBaseURL}/roles/${id}/permissions`,
    data: { permissions },
    method: 'PUT',
  }),
  delete: (data: any) => {
    const id = typeof data === 'object' ? data.id : data
    return reqJson({ uri: `${adminBaseURL}/roles/${id}`, method: 'DELETE' })
  },
  query: (params: any) => {
    const id = typeof params === 'object' ? params.id : params
    return reqJson({ uri: `${adminBaseURL}/roles/${id}`, method: 'GET' })
  },
  query_list: () => reqJson({ uri: `${adminBaseURL}/roles`, method: 'GET' }),
}

export const permissionsApi = {
  tree: () => reqJson({ uri: `${adminBaseURL}/permissions/tree`, method: 'GET' }),
}

export const teamApi = {
  create: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/create`, data, method: 'POST' })
  },
  email_notify: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/email_notify`, data, method: 'POST' })
  },
  sign: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/sign`, data, method: 'POST' })
  },
  delete: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/delete`, data, method: 'DELETE' })
  },
  update: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/update`, data, method: 'PUT' })
  },
  query: (params) => {
    return reqJson({ uri: `${bizBaseURL}/team/query`, data: params, method: 'GET' })
  },
  query_members: () => {
    return reqJson({ uri: `${bizBaseURL}/team/query_members`, data: {}, method: 'GET' })
  },
  query_others: () => {
    return reqJson({ uri: `${bizBaseURL}/team/query_others`, data: {}, method: 'GET' })
  },
  search: (data) => {
    return reqJson({ uri: `${bizBaseURL}/team/search`, data, method: 'POST' })
  },
}

export const dataSeqApi = {
  queryDataSeq: (params) => {
    return reqJson({ uri: `${bizBaseURL}/seq/dataSeq`, data: params, method: 'GET' })
  },
  queryDataSeqStreams: (params) => {
    // return request.get({baseURL: bizBaseURL, url: '/seq/dataSeqStreams', params })
    return reqJson({ uri: `${bizBaseURL}/seq/dataSeqStreams`, data: params, method: 'GET' })
  },
}


export const openlabelApi = {
  classes: () => {
    const data = jobConfig
    return reqJson({ uri: `${bizBaseURL}/openlabel/classes`, data, method: 'POST' })
  },
  domains: () => {
    return reqJson({ uri: `${bizBaseURL}/openlabel/domains`, data: {}, method: 'GET' })
  },
  query: (params) => {
    return reqJson({ uri: `${bizBaseURL}/openlabel/query`, data: params, method: 'POST' })
  }
}


export const systemApi = {
  config: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/system/config`, data, method: 'POST' })
  },
  user_info: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/system/user_info`, data, method: 'POST' })
  },
  update_password: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/system/update_password`, data, method: 'POST' })
  },
  update_account: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/system/update_account`, data, method: 'POST' })
  },
}

export const onnxWebModelApi = {
  getList: () => {
    const baseURL = '/'
    return request.get({ url: '/web/app/onnx-web/v1/onnxModelApis.json', baseURL })
  },
}


export const userDeptsApi = {
  create: (data) => {
    return reqJson({ uri: `${bizBaseURL}/depts/create`, data, method: 'POST' })
  },
  delete: (data) => {
    return reqJson({ uri: `${bizBaseURL}/depts/delete`, data, method: 'DELETE' })
  },
  update: (data) => {
    return reqJson({ uri: `${bizBaseURL}/depts/update`, data, method: 'PUT' })
  },
  query: (params) => {
    return reqJson({ uri: `${bizBaseURL}/depts/query`, data: params, method: 'GET' })
  },
  queryTree: () => {
    return reqJson({ uri: `${bizBaseURL}/depts/query_tree`, data: {}, method: 'GET' })
  },
}


export const algoApi = {
  run: async (algo_id:string, data:object) => {
    return reqJson({ uri: bizBaseURL + `/algo/${algo_id}`, method: 'POST', data})
  },
}

// ============================================================================
// Stage 9.1 — Stage 4-8 后端路由 namespace
//
// 这些 namespace 包装 Stage 4(项目/标签集/组织/项目模板)、Stage 5(工作流/质量)、
// Stage 6(unit label 写入)、Stage 7(batch + unit 调度)、Stage 8(me/notifications/
// exports/data-seqs)的全部端点。返回仍是 untyped Promise<any>,具体类型见
// `@/types/api.ts`,供后续 SPA 自由消费。
// ============================================================================

// ----- Stage 4: Projects -----
export const projectsApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/projects`, data: params, method: 'GET' }),
  create: (data: any) => reqJson({ uri: `${bizBaseURL}/projects`, data, method: 'POST' }),
  get: (project_id: number) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}`, method: 'GET' }),
  update: (project_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}`, data, method: 'PATCH' }),
  remove: (project_id: number) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}`, method: 'DELETE' }),
}

// ----- Stage 4: Taxonomies -----
export const taxonomiesApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/taxonomies`, data: params, method: 'GET' }),
  create: (data: any) => reqJson({ uri: `${bizBaseURL}/taxonomies`, data, method: 'POST' }),
  update: (tax_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/taxonomies/${tax_id}`, data, method: 'PATCH' }),
  setCurrent: (tax_id: number) => reqJson({ uri: `${bizBaseURL}/taxonomies/${tax_id}/set-current`, method: 'POST' }),
  remove: (tax_id: number) => reqJson({ uri: `${bizBaseURL}/taxonomies/${tax_id}`, method: 'DELETE' }),
}

// ----- Stage 4 / 13.2: Orgs(走 admin app) -----
export const orgsApi = {
  list: (params?: any) => reqJson({ uri: `${adminBaseURL}/orgs`, data: params, method: 'GET' }),
  tree: () => reqJson({ uri: `${adminBaseURL}/orgs/tree`, method: 'GET' }),
  create: (data: any) => reqJson({ uri: `${adminBaseURL}/orgs`, data, method: 'POST' }),
  update: (org_id: number, data: any) => reqJson({ uri: `${adminBaseURL}/orgs/${org_id}`, data, method: 'PATCH' }),
  remove: (org_id: number) => reqJson({ uri: `${adminBaseURL}/orgs/${org_id}`, method: 'DELETE' }),
  listMembers: (org_id: number) => reqJson({ uri: `${adminBaseURL}/orgs/${org_id}/members`, method: 'GET' }),
  addMember: (org_id: number, data: any) => reqJson({ uri: `${adminBaseURL}/orgs/${org_id}/members`, data, method: 'POST' }),
  removeMember: (org_id: number, user_id: number) => reqJson({ uri: `${adminBaseURL}/orgs/${org_id}/members/${user_id}`, method: 'DELETE' }),
}

// ----- Stage 4: Project Templates -----
export const projectTemplatesApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/project-templates`, data: params, method: 'GET' }),
  create: (data: any) => reqJson({ uri: `${bizBaseURL}/project-templates`, data, method: 'POST' }),
  get: (template_id: number) => reqJson({ uri: `${bizBaseURL}/project-templates/${template_id}`, method: 'GET' }),
  update: (template_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/project-templates/${template_id}`, data, method: 'PATCH' }),
  remove: (template_id: number) => reqJson({ uri: `${bizBaseURL}/project-templates/${template_id}`, method: 'DELETE' }),
  instantiate: (template_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/project-templates/${template_id}/instantiate`, data, method: 'POST' }),
}

// ----- Stage 5: Workflow Templates + Instances -----
export const workflowApi = {
  // 模板 CRUD
  listTemplates: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows`, data: params, method: 'GET' }),
  createTemplate: (data: any) => reqJson({ uri: `${bizBaseURL}/workflows`, data, method: 'POST' }),
  getTemplate: (template_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}`, method: 'GET' }),
  updateTemplate: (template_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}`, data, method: 'PATCH' }),
  removeTemplate: (template_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}`, method: 'DELETE' }),
  instantiate: (template_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}/instantiate`, data, method: 'POST' }),
  // Stage 10.1: 拓扑校验
  validateTemplate: (stages: any[]) => reqJson({ uri: `${bizBaseURL}/workflows/validate`, data: stages, method: 'POST' }),
  // Stage 10.2: 运行态监控
  monitorSummary: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows/monitor/summary`, data: params, method: 'GET' }),
  monitorStuck: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows/monitor/stuck`, data: params, method: 'GET' }),
  monitorThroughput: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows/monitor/throughput`, data: params, method: 'GET' }),
  // Stage 10.3: 版本管理
  listVersions: (template_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}/versions`, method: 'GET' }),
  getVersion: (template_id: number, version_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}/versions/${version_id}`, method: 'GET' }),
  activateVersion: (template_id: number, version_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}/versions/${version_id}/activate`, method: 'POST' }),
  migrateInstances: (template_id: number, version_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/workflows/${template_id}/versions/${version_id}/migrate-instances`, data, method: 'POST' }),
  // 实例视角
  listInstances: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows/instances`, data: params, method: 'GET' }),
  getInstance: (instance_id: number) => reqJson({ uri: `${bizBaseURL}/workflows/instances/${instance_id}`, method: 'GET' }),
  submitInstance: (instance_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/workflows/instances/${instance_id}/submit`, data, method: 'POST' }),
  getInstanceDiff: (instance_id: number, params: any) => reqJson({ uri: `${bizBaseURL}/workflows/instances/${instance_id}/diff`, data: params, method: 'GET' }),
  // 工作单元(新 instance 入口)
  listUnits: (params?: any) => reqJson({ uri: `${bizBaseURL}/workflows/units`, data: params, method: 'GET' }),
  createUnitInstance: (data: any) => reqJson({ uri: `${bizBaseURL}/workflows/units`, data, method: 'POST' }),
}

// ----- Stage 5: Quality -----
export const qualityApi = {
  overview: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/overview`, data: params, method: 'GET' }),
  byAssignee: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/by-assignee`, data: params, method: 'GET' }),
  byReviewer: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/by-reviewer`, data: params, method: 'GET' }),
  rejectCategories: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/reject-categories`, data: params, method: 'GET' }),
  sampleCoverage: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/sample-coverage`, data: params, method: 'GET' }),
  // Stage 10.4: 性能与耗时分析
  stageDuration: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/stage-duration`, data: params, method: 'GET' }),
  bottleneck: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/bottleneck`, data: params, method: 'GET' }),
  cycleTimeTrend: (params: any) => reqJson({ uri: `${bizBaseURL}/quality/cycle-time-trend`, data: params, method: 'GET' }),
}

// ----- Stage 6: Labels (新 v2 路由,与老 labelApi 并存) -----
export const labelsApi = {
  getLatest: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}`, method: 'GET' }),
  listVersions: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}/versions`, method: 'GET' }),
  getVersion: (unit_id: number, version: number) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}/versions/${version}`, method: 'GET' }),
  diff: (unit_id: number, params: any) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}/diff`, data: params, method: 'GET' }),
  save: (unit_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}`, data, method: 'POST' }),
  submit: (unit_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/labels/units/${unit_id}/submit`, data, method: 'POST' }),
}

// ----- Stage 7: Batches + Units -----
export const batchesApi = {
  listBatches: (project_id: number, params?: any) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}/batches`, data: params, method: 'GET' }),
  createBatch: (project_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}/batches`, data, method: 'POST' }),
  getBatch: (batch_id: number) => reqJson({ uri: `${bizBaseURL}/batches/${batch_id}`, method: 'GET' }),
  updateBatch: (batch_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/batches/${batch_id}`, data, method: 'PATCH' }),
  removeBatch: (batch_id: number) => reqJson({ uri: `${bizBaseURL}/batches/${batch_id}`, method: 'DELETE' }),
  spawnBatch: (batch_id: number, data?: any) => reqJson({ uri: `${bizBaseURL}/batches/${batch_id}/spawn`, data, method: 'POST' }),
  listUnits: (project_id: number, params?: any) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}/units`, data: params, method: 'GET' }),
  claimUnit: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/claim`, method: 'POST' }),
  assignUnit: (unit_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/assign`, data, method: 'POST' }),
  releaseUnit: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/release`, method: 'POST' }),
}

// Stage 7 unit 操作 alias,审核/标注工作台用更短的 namespace
export const unitsApi = {
  list: (project_id: number, params?: any) => reqJson({ uri: `${bizBaseURL}/projects/${project_id}/units`, data: params, method: 'GET' }),
  claim: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/claim`, method: 'POST' }),
  assign: (unit_id: number, data: any) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/assign`, data, method: 'POST' }),
  release: (unit_id: number) => reqJson({ uri: `${bizBaseURL}/units/${unit_id}/release`, method: 'POST' }),
  // Stage 9.5: anno 工作台按 jobConfig 反查 unit
  findByCoord: (params: { seq: string; stream: string; frame: number; mission: string }) =>
    reqJson({ uri: `${bizBaseURL}/units/by-coord`, data: params, method: 'GET' }),
}

// ----- Stage 8: Me / Preferences / Notifications -----
export const meApi = {
  getProfile: () => reqJson({ uri: `${bizBaseURL}/me`, method: 'GET' }),
  updateProfile: (data: any) => reqJson({ uri: `${bizBaseURL}/me`, data, method: 'PATCH' }),
  changePassword: (data: any) => reqJson({ uri: `${bizBaseURL}/me/password`, data, method: 'POST' }),
  getPreferences: () => reqJson({ uri: `${bizBaseURL}/me/preferences`, method: 'GET' }),
  updatePreferences: (data: any) => reqJson({ uri: `${bizBaseURL}/me/preferences`, data, method: 'PATCH' }),
  listNotifications: (params?: any) => reqJson({ uri: `${bizBaseURL}/me/notifications`, data: params, method: 'GET' }),
  unreadCount: () => reqJson({ uri: `${bizBaseURL}/me/notifications/unread_count`, method: 'GET' }),
  markRead: (audit_id: number | string) => reqJson({ uri: `${bizBaseURL}/me/notifications/${audit_id}/read`, method: 'POST' }),
}

// ----- Stage 8: Exports -----
export const exportsApi = {
  exportOpenLabel: (data: any) => reqJson({ uri: `${bizBaseURL}/exports`, data, method: 'POST' }),
  exportCOCO: (data: any) => reqJson({ uri: `${bizBaseURL}/exports/coco`, data, method: 'POST' }),
}

// ----- Stage 8: DataSeqs (新 /data-seqs,与老 dataSeqApi 并存) -----
export const dataSeqsApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/data-seqs`, data: params, method: 'GET' }),
  get: (uuid: string) => reqJson({ uri: `${bizBaseURL}/data-seqs/${uuid}`, method: 'GET' }),
  listFrames: (uuid: string, stream: string, params?: any) => reqJson({ uri: `${bizBaseURL}/data-seqs/${uuid}/streams/${stream}/frames`, data: params, method: 'GET' }),
}

// ----- Stage 9.7: 租户审计日志 -----
export const auditApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/audit-logs`, data: params, method: 'GET' }),
  listActions: () => reqJson({ uri: `${bizBaseURL}/audit-logs/actions`, method: 'GET' }),
}

// ----- Stage 13.2: 租户用户管理(走 admin app /api/v1/a/users/*) -----
// 注意:admin /users/search 是 { pager, query } 嵌套结构,这里做适配
// update 走 PATCH /users/{id},前端不同场景传不同子集字段
export const tenantUsersApi = {
  search: (data: any) => reqJson({
    uri: `${adminBaseURL}/users/search`,
    data: {
      pager: { page: data?.page ?? 1, page_size: data?.page_size ?? 20 },
      query: {
        email: data?.email ?? null,
        mobile_phone_no: data?.mobile_phone_no ?? null,
        name: data?.name ?? null,
      },
    },
    method: 'POST',
  }),
  create: (data: any) => reqJson({ uri: `${adminBaseURL}/users`, data, method: 'POST' }),
  update: (id: number, data: any) => {
    // 前端字段 enabled → 后端 is_active
    const body: any = { ...data }
    if ('enabled' in body) {
      body.is_active = body.enabled
      delete body.enabled
    }
    delete body.id
    return reqJson({ uri: `${adminBaseURL}/users/${id}`, data: body, method: 'PATCH' })
  },
  resetPassword: (id: number, new_password: string) => reqJson({
    uri: `${adminBaseURL}/users/${id}/reset-password`,
    data: { new_password },
    method: 'POST',
  }),
  remove: (id: number) => reqJson({ uri: `${adminBaseURL}/users/${id}`, method: 'DELETE' }),
}

// ----- Stage 9.8: 平台面(/api/v1/p/*) -----
const platformBaseURL = "/api/v1/p"
export const platformAuthApi = {
  login: (data: any, header?: any) => reqJson({ uri: `${platformBaseURL}/auth/login`, method: 'POST', data, header }),
  logout: () => reqJson({ uri: `${platformBaseURL}/auth/logout`, method: 'POST' }),
}

export const platformTenantsApi = {
  list: (params?: any) => reqJson({ uri: `${platformBaseURL}/tenants`, data: params, method: 'GET' }),
  create: (data: any) => reqJson({ uri: `${platformBaseURL}/tenants`, data, method: 'POST' }),
  update: (id: number, data: any) => reqJson({ uri: `${platformBaseURL}/tenants/${id}`, data, method: 'PATCH' }),
  remove: (id: number) => reqJson({ uri: `${platformBaseURL}/tenants/${id}`, method: 'DELETE' }),
}

export const platformFeatureFlagsApi = {
  list: () => reqJson({ uri: `${platformBaseURL}/feature-flags`, method: 'GET' }),
  update: (key: string, data: any) => reqJson({ uri: `${platformBaseURL}/feature-flags/${key}`, data, method: 'PATCH' }),
}

export const platformAuditApi = {
  list: (params?: any) => reqJson({ uri: `${platformBaseURL}/audit`, data: params, method: 'GET' }),
}

export const platformUsersApi = {
  list: (params?: any) => reqJson({ uri: `${platformBaseURL}/users`, data: params, method: 'GET' }),
}

// ----- Stage 12: 通知(SSE + REST) -----
export const notificationApi = {
  list: (params?: any) => reqJson({ uri: `${bizBaseURL}/notifications`, data: params, method: 'GET' }),
  unread: () => reqJson({ uri: `${bizBaseURL}/notifications/unread`, method: 'GET' }),
  markRead: (id: string) => reqJson({ uri: `${bizBaseURL}/notifications/${id}/read`, method: 'POST' }),
  markAllRead: () => reqJson({ uri: `${bizBaseURL}/notifications/read-all`, method: 'POST' }),
  testSelf: (data: { type?: string; title?: string; body?: string }) =>
    reqJson({ uri: `${bizBaseURL}/notifications/_test/self`, data, method: 'POST' }),
}

export const NOTIFICATION_STREAM_URL = `${bizBaseURL}/notifications/stream`