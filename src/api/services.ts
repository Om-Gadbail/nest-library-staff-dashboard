import { apiClient, type PageResponse } from './client'

/**
 * Real FastAPI service layer.
 * Component -> feature hook -> this service -> apiClient -> FastAPI -> PostgreSQL.
 * The mock store (src/mock) remains only as an offline/test fallback and for
 * deterministic frontend unit tests — production reads through these functions.
 */

export interface BusinessContext {
  business_id: string
}

function params(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  refresh: () => apiClient.post('/auth/refresh').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
}

export interface MeResponse {
  user_id: string
  full_name: string
  email: string
  businesses: { business_id: string; name: string; role: string; timezone: string }[]
  permissions: string[]
}

export const customersApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>('/customers', { params: params(p ?? {}) }),
  get: (id: string) => apiClient.get(`/customers/${id}`).then((r) => r.data),
  create: (payload: unknown) => apiClient.post('/customers', payload).then((r) => r.data),
  update: (id: string, payload: unknown) =>
    apiClient.patch(`/customers/${id}`, payload).then((r) => r.data),
  addNote: (id: string, note: string) =>
    apiClient.post(`/customers/${id}/notes`, { note }).then((r) => r.data),
  renew: (id: string, payload: unknown) =>
    apiClient.post(`/customers/${id}/renew`, payload).then((r) => r.data),
}

export const admissionsApi = {
  create: (payload: unknown) => apiClient.post('/admissions', payload).then((r) => r.data),
}

export const membershipsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>('/memberships', { params: params(p ?? {}) }),
}

export const renewalsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>('/renewals', { params: params(p ?? {}) }),
  markContacted: (id: string) =>
    apiClient.post(`/renewals/${id}/contacted`).then((r) => r.data),
}

export const leadsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; stage?: string }) =>
    apiClient.get<PageResponse<unknown>>('/leads', { params: params(p ?? {}) }),
  get: (id: string) => apiClient.get(`/leads/${id}`).then((r) => r.data),
  create: (payload: unknown) => apiClient.post('/leads', payload).then((r) => r.data),
  update: (id: string, payload: unknown) =>
    apiClient.patch(`/leads/${id}`, payload).then((r) => r.data),
  addNote: (id: string, note: string) =>
    apiClient.post(`/leads/${id}/notes`, { note }).then((r) => r.data),
  updateStage: (id: string, payload: unknown) =>
    apiClient.patch(`/leads/${id}`, payload).then((r) => r.data),
  convert: (id: string, payload: unknown) =>
    apiClient.post(`/leads/${id}/convert`, payload).then((r) => r.data),
}

export const bookingsApi = {
  list: (p?: {
    page?: number
    page_size?: number
    q?: string
    status?: string
    date_from?: string
    date_to?: string
  }) => apiClient.get<PageResponse<unknown>>('/bookings', { params: params(p ?? {}) }),
  get: (id: string) => apiClient.get(`/bookings/${id}`).then((r) => r.data),
  create: (payload: unknown) => apiClient.post('/bookings', payload).then((r) => r.data),
  update: (id: string, payload: unknown) =>
    apiClient.patch(`/bookings/${id}`, payload).then((r) => r.data),
  checkConflicts: (payload: unknown) =>
    apiClient.post('/bookings/conflicts', payload).then((r) => r.data),
}

export const paymentsApi = {
  list: (p?: {
    page?: number
    page_size?: number
    q?: string
    status?: string
    method?: string
    date_from?: string
    date_to?: string
  }) => apiClient.get<PageResponse<unknown>>('/payments', { params: params(p ?? {}) }),
  record: (payload: unknown) => apiClient.post('/payments', payload).then((r) => r.data),
  refund: (id: string) => apiClient.post(`/payments/${id}/refund`).then((r) => r.data),
}

export const notificationsApi = {
  list: (p?: { page?: number; page_size?: number; unread?: boolean }) =>
    apiClient.get<PageResponse<unknown>>('/notifications', { params: params(p ?? {}) }),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.post('/notifications/read-all').then((r) => r.data),
  dismiss: (id: string) => apiClient.delete(`/notifications/${id}`).then((r) => r.data),
}

export const tasksApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>('/tasks', { params: params(p ?? {}) }),
  create: (payload: unknown) => apiClient.post('/tasks', payload).then((r) => r.data),
  update: (id: string, payload: unknown) =>
    apiClient.patch(`/tasks/${id}`, payload).then((r) => r.data),
  complete: (id: string) =>
    apiClient.patch(`/tasks/${id}`, { status: 'done' }).then((r) => r.data),
}

export const activitiesApi = {
  list: (p?: { page?: number; page_size?: number; customer_id?: string }) =>
    apiClient.get<PageResponse<unknown>>('/activities', { params: params(p ?? {}) }),
}

export const staffApi = {
  list: (p?: { page?: number; page_size?: number }) =>
    apiClient.get<PageResponse<unknown>>('/staff', { params: params(p ?? {}) }),
  invite: (payload: unknown) => apiClient.post('/staff/invite', payload).then((r) => r.data),
  updateRole: (id: string, payload: unknown) =>
    apiClient.patch(`/staff/${id}/role`, payload).then((r) => r.data),
  updateStatus: (id: string, payload: unknown) =>
    apiClient.patch(`/staff/${id}/status`, payload).then((r) => r.data),
}

export const settingsApi = {
  get: () => apiClient.get('/settings').then((r) => r.data),
  update: (payload: unknown) => apiClient.patch('/settings', payload).then((r) => r.data),
}

export const analyticsApi = {
  overview: () => apiClient.get('/analytics/overview').then((r) => r.data),
  revenue: (p?: {
    preset?: string
    date_from?: string
    date_to?: string
    group?: string
  }) => apiClient.get('/analytics/revenue', { params: params(p ?? {}) }).then((r) => r.data),
  transactions: (p?: {
    preset?: string
    date_from?: string
    date_to?: string
    q?: string
    page?: number
    page_size?: number
  }) =>
    apiClient
      .get<PageResponse<unknown>>('/analytics/transactions', { params: params(p ?? {}) }),
}

export const searchApi = {
  global: (q: string, limit = 8) =>
    apiClient.get('/search', { params: { q, limit } }).then((r) => r.data),
}

export const whatsappApi = {
  getSettings: () => apiClient.get('/whatsapp/settings').then((r) => r.data),
  updateSettings: (payload: unknown) =>
    apiClient.patch('/whatsapp/settings', payload).then((r) => r.data),
  send: (payload: unknown) => apiClient.post('/whatsapp/send', payload).then((r) => r.data),
  messages: (p?: { page?: number; page_size?: number }) =>
    apiClient.get<PageResponse<unknown>>('/whatsapp/messages', { params: params(p ?? {}) }),
}

export const jobsApi = {
  renewalCheck: () => apiClient.post('/jobs/renewal-check').then((r) => r.data),
}
