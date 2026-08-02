import { i18n } from '@/locales'

const t = (k: string) => i18n.global.t(k)

export type ErrorKind =
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'server'
  | 'validation'
  | 'business'
  | 'unknown'

export type ErrorLevel = 'error' | 'warning' | 'info' | 'silent'

export interface YhErrorOptions {
  kind?: ErrorKind
  code?: string | number
  httpStatus?: number
  level?: ErrorLevel
  details?: unknown
  silent?: boolean
}

export class YhError extends Error {
  kind: ErrorKind
  code?: string | number
  httpStatus?: number
  level: ErrorLevel
  details?: unknown

  constructor(message: string, options: YhErrorOptions = {}) {
    super(message)
    this.name = 'YhError'
    this.kind = options.kind ?? 'unknown'
    this.code = options.code
    this.httpStatus = options.httpStatus
    this.level = options.silent ? 'silent' : options.level ?? 'error'
    this.details = options.details
  }

  get isAuthExpired(): boolean {
    return this.kind === 'auth' || this.kind === 'forbidden'
  }
  get isBusiness(): boolean {
    return this.kind === 'business'
  }
  get isValidation(): boolean {
    return this.kind === 'validation'
  }
  get isNetwork(): boolean {
    return this.kind === 'network'
  }
}

export class NetworkError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.network'), { level: 'error', ...options, kind: 'network' })
    this.name = 'NetworkError'
  }
}

export class AuthError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.auth'), { level: 'error', ...options, kind: 'auth' })
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.forbidden'), { level: 'error', ...options, kind: 'forbidden' })
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.notFound'), { level: 'warning', ...options, kind: 'notFound' })
    this.name = 'NotFoundError'
  }
}

export class ServerError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.server'), { level: 'error', ...options, kind: 'server' })
    this.name = 'ServerError'
  }
}

export class ValidationError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.validation'), { level: 'error', ...options, kind: 'validation' })
    this.name = 'ValidationError'
  }
}

export class BusinessError extends YhError {
  constructor(message?: string, options: YhErrorOptions = {}) {
    super(message ?? t('error.business'), { level: 'warning', ...options, kind: 'business' })
    this.name = 'BusinessError'
  }
}

export function isYhError(err: unknown): err is YhError {
  return err instanceof YhError
}

export function toYhError(err: unknown): YhError {
  if (err instanceof YhError) return err
  if (err instanceof Error) return new YhError(err.message, { kind: 'unknown' })
  return new YhError(String(err ?? ''), { kind: 'unknown' })
}
