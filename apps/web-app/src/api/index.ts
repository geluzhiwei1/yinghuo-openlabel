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
/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 */
import { jobConfig } from '@/states/job-config'
import { reqForm, reqJson } from './req'

// capcha
export const capchaApi = {
  imgUri: '/api/v1/c/captcha/generate/',
  checkUri: '/api/v1/c/captcha/validate/',
  sendcode: '/api/v1/c/mobilecode/sendcode/',
  checkCode: '/api/v1/c/mobilecode/validate/'
}

// email code
export const emailCodeApi = {
  sendcode: '/api/v1/c/emailcode/sendcode/',
  checkUri: '/api/v1/c/emailcode/validate/'
}

// user
const userApiBaseUri = '/api/v1/b/u/a'
export const userApi = {
  login: (data: any, header: any) => {
    return reqJson({ uri: userApiBaseUri + '/noau/token', method: 'POST', data, header })
  }
}

// label
const bizBaseURL = '/api/v1/b'
export const labelApi = {
  save: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/save', method: 'POST', data })
  },
  load: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/load', method: 'POST', data })
  },
  load_val: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/val', method: 'POST', data })
  },
  frame_save: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/frame_save', method: 'POST', data })
  },
  frame_load: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/frame_load', method: 'POST', data })
  },
  seq_save: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/seq_save', method: 'POST', data })
  },
  seq_load: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/seq_load', method: 'POST', data })
  },
  export: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/export', method: 'POST', data })
  },
  export_coco: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/export_coco', method: 'POST', data })
  },
  deleteSeqAll: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/label/deleteSeqAll', method: 'POST', data })
  }
}

export const fileAPi = {
  uri2: bizBaseURL + '/file2/get',
  mapJson: (data: any) => {
    return reqJson({ method: 'GET', uri: bizBaseURL + '/file2/get', data })
  }
}

// statistics
export const statisticsApi = {
  seq: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/statistics/seq', method: 'POST', data })
  },
  my: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/statistics/my', method: 'POST', data })
  }
}

// let funcs_msam = null
// DNN model api
export const dnnModelApi = {
  funcapi: async (api_group: any, api_id: any, data: any) => {
    data.params = {
      seq: jobConfig.seq,
      stream: jobConfig.stream,
      frame: jobConfig.frame,
      data_format: jobConfig.data_format,
      data_source: jobConfig.data_source,
      mission: jobConfig.mission,
      ...data.params
    }
    return reqJson({
      uri: bizBaseURL + `/dnn/yh-func-api/${api_group}/${api_id}`,
      method: 'POST',
      data
    })
  },
  funcapi2: async (api_group: any, api_id: any, jsonData: any, target_image: Blob) => {
    jsonData.params = {
      seq: jobConfig.seq,
      stream: jobConfig.stream,
      frame: jobConfig.frame,
      data_format: jobConfig.data_format,
      data_source: jobConfig.data_source,
      mission: jobConfig.mission,
      ...jsonData.params
    }
    return reqForm({
      uri: bizBaseURL + `/dnn/yh-func-api/${api_group}/${api_id}`,
      method: 'POST',
      target_image,
      json_str: JSON.stringify(jsonData)
    })
  },
  getList: () => {
    // return request.get({baseURL: bizBaseURL, url: '/dnn/yh-func-api'})
    return reqJson({ method: 'GET', uri: bizBaseURL + '/dnn/yh-func-api' })
  }
}

export const lidarApi = {
  predictRotation: (data: any) => {
    return reqJson({ uri: bizBaseURL + '/dnn-lidar/infer', method: 'POST', data })
  }
}

// taxonomy
export const taxonomyApi = {
  schema: (params: any) => {
    return reqJson({ uri: bizBaseURL + '/taxonomy/schema', method: 'GET', data: params })
  },
  classes: (params: any) => {
    return reqJson({ uri: bizBaseURL + '/taxonomy/classes', method: 'GET', data: params })
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
  updateStreamUrils: (uuid: string, uris: any[]) => {
    return reqJson({
      uri: `${bizBaseURL}/seq/stream/meta`,
      data: { jobConfig, uuid, uris },
      method: 'PUT'
    })
  }
}

export const annoJobPerformApi = {
  create: (data: any) => {
    // return request.post({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'POST' })
  },
  delete: (data: any) => {
    // return request.delete({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    // return request.put({baseURL: bizBaseURL, url: '/anno-job/perform', data })
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data, method: 'PUT' })
  },
  update_collaborator: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_collaborator`, data, method: 'POST' })
  },
  update_collaborators: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_collaborators`, data, method: 'POST' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/perform`, data: params, method: 'GET' })
  },
  info: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/info`, data: params, method: 'GET' })
  },
  searchJob: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/search_job`, data, method: 'POST' })
  },
  search: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/search`, data, method: 'POST' })
  },
  update_status: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno-job/update_status`, data, method: 'PUT' })
  }
}

export const annoSpecApi = {
  create: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/create`, data, method: 'POST' })
  },
  delete: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/delete`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/update`, data, method: 'PUT' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/query`, data: params, method: 'GET' })
  },
  search: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/search`, data, method: 'POST' })
  },
  classes: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/anno_spec/classes`, data, method: 'GET' })
  }
}

export const roleApi = {
  create: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/roles/create`, data, method: 'POST' })
  },
  delete: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/roles/delete`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/roles/update`, data, method: 'PUT' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/roles/query`, data: params, method: 'GET' })
  },
  query_list: () => {
    return reqJson({ uri: `${bizBaseURL}/roles/query_list`, data: {}, method: 'GET' })
  },
  search: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/roles/search`, data, method: 'POST' })
  }
}

export const resourceApi = {
  create: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/resource/create`, data, method: 'POST' })
  },
  delete: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/resource/delete`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/resource/update`, data, method: 'PUT' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/resource/query`, data: params, method: 'GET' })
  },
  query_tree: () => {
    return reqJson({ uri: `${bizBaseURL}/resource/query_tree`, data: {}, method: 'GET' })
  }
}

export const teamApi = {
  create: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/create`, data, method: 'POST' })
  },
  email_notify: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/email_notify`, data, method: 'POST' })
  },
  sign: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/sign`, data, method: 'POST' })
  },
  delete: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/delete`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/update`, data, method: 'PUT' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/query`, data: params, method: 'GET' })
  },
  query_members: () => {
    return reqJson({ uri: `${bizBaseURL}/team/query_members`, data: {}, method: 'GET' })
  },
  query_others: () => {
    return reqJson({ uri: `${bizBaseURL}/team/query_others`, data: {}, method: 'GET' })
  },
  search: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/team/search`, data, method: 'POST' })
  }
}

export const dataSeqApi = {
  queryDataSeq: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/seq/dataSeq`, data: params, method: 'GET' })
  },
  queryDataSeqStreams: (params: any) => {
    // return request.get({baseURL: bizBaseURL, url: '/seq/dataSeqStreams', params })
    return reqJson({ uri: `${bizBaseURL}/seq/dataSeqStreams`, data: params, method: 'GET' })
  }
}

export const openlabelApi = {
  classes: () => {
    const data = jobConfig
    return reqJson({ uri: `${bizBaseURL}/openlabel/classes`, data, method: 'POST' })
  },
  domains: () => {
    return reqJson({ uri: `${bizBaseURL}/openlabel/domains`, data: {}, method: 'GET' })
  },
  query: (params: any) => {
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
  }
}

export const onnxWebModelApi = {
  getList: () => {
    const baseURL = '/'
    return reqJson({
      uri: baseURL + 'web/app/onnx-web/v1/onnxModelApis.json',
      method: 'GET'
    })
  }
}

export const userDeptsApi = {
  create: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/depts/create`, data, method: 'POST' })
  },
  delete: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/depts/delete`, data, method: 'DELETE' })
  },
  update: (data: any) => {
    return reqJson({ uri: `${bizBaseURL}/depts/update`, data, method: 'PUT' })
  },
  query: (params: any) => {
    return reqJson({ uri: `${bizBaseURL}/depts/query`, data: params, method: 'GET' })
  },
  queryTree: () => {
    return reqJson({ uri: `${bizBaseURL}/depts/query_tree`, data: {}, method: 'GET' })
  }
}

export const algoApi = {
  run: async (algo_id: string, data: object) => {
    return reqJson({ uri: bizBaseURL + `/algo/${algo_id}`, method: 'POST', data })
  }
}

