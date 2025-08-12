// API响应的通用类型定义
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

// 错误响应
export interface ApiError {
  code: number
  message: string
  details?: any
}

// 请求配置
export interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  params?: Record<string, any>
  data?: any
  headers?: Record<string, string>
  timeout?: number
}
