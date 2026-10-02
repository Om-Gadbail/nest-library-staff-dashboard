import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

/** Set false to force real-API-only mode (production). */
export const API_MOCK_FALLBACK_ENABLED =
  import.meta.env.VITE_ENABLE_MSW !== 'false'

export type ApiErrorKind =
  | 'validation'
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'unavailable'
  | 'server'
  | 'network'

export interface ApiErrorShape {
  message: string
  status?: number
  code?: string
  kind: ApiErrorKind
  details?: unknown
}

function kindFor(status?: number, code?: string): ApiErrorKind {
  if (code === 'validation_error' || status === 422 || status === 400) return 'validation'
  if (code === 'session_expired' || status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate-limited'
  if (status === 503) return 'unavailable'
  if (status && status >= 500) return 'server'
  return 'network'
}

import { coldStartDelay, isColdStartAxiosError, sleep } from './readiness'

export function toApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{
      message?: string
      detail?: string
      error?: { code?: string; message?: string; details?: unknown }
    }>
    if (!ax.response) {
      return {
        message: 'Backend may be waking up. Your entries were kept; wait a moment and try again.',
        kind: 'network',
        code: ax.code,
      }
    }
    const data = ax.response.data
    const nested = data?.error
    const status = ax.response.status
    const message =
      nested?.message ??
      data?.message ??
      (typeof data?.detail === 'string' ? data.detail : undefined) ??
      (status === 401
        ? 'Session expired. Please log in again.'
        : status === 403
          ? "You don't have permission for this action."
          : status === 404
            ? 'Record not found.'
            : status === 409
              ? 'This conflicts with existing data.'
              : status === 429
                ? 'Too many attempts. Try again later.'
                : status === 503
                  ? 'Service unavailable. Try again later.'
                  : 'Request failed')
    const code = nested?.code ?? ax.code
    return { message, status, code, kind: kindFor(status, code), details: nested?.details ?? data }
  }
  if (error instanceof Error) return { message: error.message, kind: 'server' }
  return { message: 'Something went wrong', kind: 'server' }
}

/**
 * Central HTTP client.
 *
 * Auth contract (matches backend /api/v1/auth + owner dashboard):
 * - Access token: short-lived Bearer JWT kept IN MEMORY ONLY and attached
 *   via the `Authorization` header on every request.
 * - Refresh: HttpOnly `refresh_token` cookie (set by login/refresh, path
 *   /api/v1/auth) sent automatically via `withCredentials`; used for silent
 *   refresh on 401. NEVER store tokens in localStorage.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

let refreshPromise: Promise<string> | null = null

/** Silent refresh via the HttpOnly cookie (no interceptors — avoids recursion). */
function silentRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise
  const bare = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  })
  refreshPromise = bare.post('/auth/refresh', {}).then((r) => {
    const next = r.data?.access_token as string | undefined
    if (!next) throw new Error('refresh failed')
    setAccessToken(next)
    return next
  })
  const done = () => {
    refreshPromise = null
  }
  refreshPromise.then(done, done)
  return refreshPromise
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const ax = error as AxiosError
    const original = ax.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined
    const status = ax.response?.status
    const url = original?.url ?? ''
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh')
    // Render free cold start: retry idempotent GETs with bounded backoff.
    // Mutations are never auto-retried (no duplicate payments/bookings).
    const method = (original?.method ?? 'get').toLowerCase()
    if (method === 'get' && original && isColdStartAxiosError(error)) {
      const prior = (original as typeof original & { _coldStartRetries?: number })._coldStartRetries ?? 0
      if (prior < 3) {
        ;(original as typeof original & { _coldStartRetries?: number })._coldStartRetries = prior + 1
        await sleep(coldStartDelay(prior + 1))
        return apiClient(original)
      }
    }
    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true
      try {
        const token = await silentRefresh()
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      } catch {
        setAccessToken(null)
      }
    }
    const shaped = toApiError(error)
    if (shaped.kind === 'auth' && !window.location.pathname.startsWith('/login')) {
      onUnauthorized?.()
    }
    return Promise.reject(shaped)
  },
)

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export function isApiError(error: unknown): error is ApiErrorShape {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error
  )
}
