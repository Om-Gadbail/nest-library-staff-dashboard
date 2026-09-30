import { apiClient, setAccessToken, type PageResponse } from './client'

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

/**
 * Canonical backend GET /auth/me shape (server-authoritative).
 * The staff session resolves business context server-side from memberships;
 * the frontend never invents business identity.
 */
export interface BackendMeResponse {
  user: {
    id: string
    email: string
    full_name: string
    phone: string | null
    is_active: boolean
    is_verified: boolean
    last_login_at: string | null
  }
  business: {
    id: string
    slug?: string
    name: string
    business_type?: string
    status?: string
  } | null
  membership: {
    business_id: string
    role: string | null
    status: string
    is_default: boolean
  } | null
  permissions: string[]
}

/** Normalized staff identity consumed by AuthContext and layout. */
export interface NormalizedBusiness {
  business_id: string
  name: string
  role: string
  timezone: string
}

/** Normalize canonical /auth/me into the shape the dashboard consumes. */
export function normalizeMe(raw: BackendMeResponse): MeResponse {
  const business: NormalizedBusiness | null =
    raw.business && raw.membership
      ? {
          business_id: raw.membership.business_id || raw.business.id,
          name: raw.business.name,
          role: raw.membership.role ?? '',
          timezone: 'Asia/Kolkata',
        }
      : null
  return {
    user_id: raw.user.id,
    full_name: raw.user.full_name || raw.user.email,
    email: raw.user.email,
    businesses: business ? [business] : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then((r) => {
      const token = r.data?.access_token
      if (typeof token === 'string' && token) setAccessToken(token)
      return r.data
    }),
  logout: () =>
    apiClient
      // Empty JSON body: LogoutRequest requires an object; the HttpOnly
      // refresh cookie authenticates the revocation server-side.
      .post('/auth/logout', {})
      .then((r) => r.data)
      .finally(() => setAccessToken(null)),
  refresh: () => apiClient.post('/auth/refresh').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => normalizeMe(r.data)),
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
    apiClient.get<PageResponse<unknown>>(
      '/customers',
      { params: params({ status: p?.status, limit: p?.page_size }) },
    ),
  get: (id: string) => apiClient.get(`/customers/${id}`).then((r) => r.data),
  create: (payload: unknown) => apiClient.post('/customers', payload).then((r) => r.data),
  update: (id: string, payload: unknown) =>
    apiClient.patch(`/customers/${id}`, payload).then((r) => r.data),
}

/**
 * Front-desk admission creates a MEMBER (canonical person record; the backend
 * has no composite /admissions endpoint). Follow-on membership + payment are
 * created from the member profile with real plan UUIDs.
 */
export const admissionsApi = {
  create: (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = {
      display_name: payload.full_name ?? payload.display_name ?? '',
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      source: 'walk_in',
      notes: payload.notes ?? '',
    }
    return apiClient.post('/members', body).then((r) => r.data)
  },
}

/** Canonical person entity used by the Members/Customers surfaces. */
export const membersApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/members',
      { params: params({ search: p?.q, status: p?.status, limit: p?.page_size ?? 100 }) },
    ),
  get: (id: string) => apiClient.get(`/members/${id}`).then((r) => r.data),
  profile: (id: string) => apiClient.get(`/members/${id}/profile`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    apiClient.post('/members', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/members/${id}`, payload).then((r) => r.data),
}

/** Real membership plans (UUIDs) for admission/renew/convert flows. */
export const plansApi = {
  list: () => apiClient.get('/membership-plans').then((r) => r.data),
}

export const membershipsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string; member_id?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/memberships',
      { params: params({ status: p?.status, member_id: p?.member_id, limit: p?.page_size ?? 100 }) },
    ),
  get: (id: string) => apiClient.get(`/memberships/${id}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    apiClient.post('/memberships', payload).then((r) => r.data),
  renew: (id: string, payload: Record<string, unknown>) =>
    apiClient.post(`/memberships/${id}/renew`, payload).then((r) => r.data),
  setStatus: (id: string, payload: { status: string; cancel_reason?: string }) =>
    apiClient.post(`/memberships/${id}/status`, payload).then((r) => r.data),
}

export const renewalsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string; member_id?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/renewals',
      { params: params({ status: p?.status, member_id: p?.member_id, limit: p?.page_size ?? 100 }) },
    ),
  get: (id: string) => apiClient.get(`/renewals/${id}`).then((r) => r.data),
  /** Canonical renewal transition (pending/confirmed/expired/cancelled). No
   *  backend "contacted" transition exists — follow-ups live on the lead. */
  setStatus: (id: string, status: string) =>
    apiClient.post(`/renewals/${id}/status`, { status }).then((r) => r.data),
}

/** Canonical LeadCreate/LeadUpdate fields (extra=forbid server-side). */
const LEAD_WRITE_FIELDS = new Set([
  'display_name',
  'phone',
  'email',
  'source',
  'source_detail',
  'service_interest',
  'message',
  'follow_up_at',
  'consent_marketing',
  'landing_page',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
])

/** Map legacy frontend lead keys to canonical LeadCreate/LeadUpdate keys. */
export function mapLeadPayload(input: Record<string, unknown>): Record<string, unknown> {
  const keyMap: Record<string, string> = {
    full_name: 'display_name',
    name: 'display_name',
    interested_plan: 'service_interest',
    notes: 'message',
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === undefined || v === null || v === '') continue
    // Lifecycle state travels via POST /leads/{id}/status, never PATCH.
    if (k === 'stage' || k === 'status' || k === 'lost_reason') continue
    const mapped = keyMap[k] ?? k
    if (LEAD_WRITE_FIELDS.has(mapped)) out[mapped] = v
  }
  return out
}

export interface LeadStatusPayload {
  status: string
  lost_reason?: string
  note?: string
}

export const leadsApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; stage?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/leads',
      { params: params({ search: p?.q, status: p?.status ?? p?.stage, limit: p?.page_size }) },
    ),
  get: (id: string) => apiClient.get(`/leads/${id}`).then((r) => r.data),
  activities: (id: string) => apiClient.get(`/leads/${id}/activities`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    apiClient.post('/leads', mapLeadPayload(payload)).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/leads/${id}`, mapLeadPayload(payload)).then((r) => r.data),
  addNote: (id: string, note: string) =>
    apiClient.post(`/leads/${id}/notes`, { note }).then((r) => r.data),
  /** Canonical lifecycle transition (server enforces LEAD_TRANSITIONS). */
  setStatus: (id: string, payload: LeadStatusPayload) =>
    apiClient.post(`/leads/${id}/status`, payload).then((r) => r.data),
  convert: (id: string, payload: { customer_notes?: string }) =>
    apiClient.post(`/leads/${id}/convert`, payload).then((r) => r.data),
}

/** Canonical BookingCreate/BookingUpdate fields (status via transition endpoints). */
const BOOKING_WRITE_FIELDS = new Set([
  'display_name',
  'phone',
  'email',
  'booking_type',
  'title',
  'requested_start_at',
  'requested_end_at',
  'notes',
  'source',
  'contact_id',
  'lead_id',
  'assigned_user_id',
])

function mapBookingPayload(input: Record<string, unknown>): Record<string, unknown> {
  const keyMap: Record<string, string> = {
    full_name: 'display_name',
    customer_name: 'display_name',
    customer_phone: 'phone',
    starts_at: 'requested_start_at',
    ends_at: 'requested_end_at',
    start_time: 'requested_start_at',
    end_time: 'requested_end_at',
    service: 'booking_type',
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === undefined || v === null || v === '') continue
    // Lifecycle state + client-only flags never go through PATCH/POST bodies.
    if (k === 'status' || k === 'allow_overlap' || k === 'staff' || k === 'customer_id') continue
    const mapped = keyMap[k] ?? k
    if (BOOKING_WRITE_FIELDS.has(mapped)) out[mapped] = v
  }
  return out
}

export const bookingsApi = {
  list: (p?: {
    page?: number
    page_size?: number
    q?: string
    status?: string
    date_from?: string
    date_to?: string
  }) =>
    apiClient.get<PageResponse<unknown>>(
      '/bookings',
      {
        params: params({
          status: p?.status,
          start_from: p?.date_from,
          start_to: p?.date_to,
          limit: p?.page_size,
        }),
      },
    ),
  get: (id: string) => apiClient.get(`/bookings/${id}`).then((r) => r.data),
  summaries: () => apiClient.get('/dashboard/bookings/summary').then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    apiClient.post('/bookings', mapBookingPayload(payload)).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/bookings/${id}`, mapBookingPayload(payload)).then((r) => r.data),
  confirm: (id: string) => apiClient.post(`/bookings/${id}/confirm`).then((r) => r.data),
  cancel: (id: string, reason?: string) =>
    apiClient.post(`/bookings/${id}/cancel`, { cancellation_reason: reason ?? '' }).then((r) => r.data),
  complete: (id: string) => apiClient.post(`/bookings/${id}/complete`).then((r) => r.data),
  noShow: (id: string) => apiClient.post(`/bookings/${id}/no-show`).then((r) => r.data),
  reopen: (id: string) => apiClient.post(`/bookings/${id}/reopen`).then((r) => r.data),
}

/** Canonical PaymentCreate fields (idempotency supported server-side). */
const PAYMENT_WRITE_FIELDS = new Set([
  'amount',
  'currency',
  'method',
  'member_id',
  'membership_id',
  'customer_id',
  'provider_ref',
  'invoice_no',
  'due_at',
  'notes',
  'idempotency_key',
])

export const paymentsApi = {
  list: (p?: {
    page?: number
    page_size?: number
    q?: string
    status?: string
    method?: string
    date_from?: string
    date_to?: string
  }) =>
    apiClient.get<PageResponse<unknown>>(
      '/payments',
      {
        params: params({
          status: p?.status,
          method: p?.method,
          created_from: p?.date_from,
          created_to: p?.date_to,
          limit: p?.page_size,
        }),
      },
    ),
  record: (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = {}
    for (const k of PAYMENT_WRITE_FIELDS) {
      const v = payload[k]
      if (v !== undefined && v !== null && v !== '') body[k] = v
    }
    if (body.amount === undefined && payload.paid !== undefined) body.amount = payload.paid
    if (!body.idempotency_key) {
      body.idempotency_key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
    }
    return apiClient.post('/payments', body).then((r) => r.data)
  },
  refund: (id: string) => apiClient.post(`/payments/${id}/refund`).then((r) => r.data),
  setStatus: (id: string, status: string) =>
    apiClient.post(`/payments/${id}/status`, { status }).then((r) => r.data),
}

export const notificationsApi = {
  list: (p?: { page?: number; page_size?: number; unread?: boolean }) =>
    apiClient.get<PageResponse<unknown>>(
      '/notifications',
      { params: params({ limit: p?.page_size }) },
    ),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.post('/notifications/read-all').then((r) => r.data),
  /** No backend delete exists — dismiss hides by marking read. */
  dismiss: (id: string) => apiClient.post(`/notifications/${id}/read`).then((r) => r.data),
}

/** Canonical TaskUpdate fields (status travels via POST /tasks/{id}/status). */
const TASK_WRITE_FIELDS = new Set([
  'title',
  'description',
  'priority',
  'due_at',
  'assigned_to_user_id',
  'related_entity_type',
  'related_entity_id',
])

export const tasksApi = {
  list: (p?: { page?: number; page_size?: number; q?: string; status?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/tasks',
      { params: params({ search: p?.q, status: p?.status, limit: p?.page_size }) },
    ),
  create: (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = {}
    for (const k of TASK_WRITE_FIELDS) {
      const v = payload[k]
      if (v !== undefined && v !== null && v !== '') body[k] = v
    }
    return apiClient.post('/tasks', body).then((r) => r.data)
  },
  update: (id: string, payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = {}
    for (const k of TASK_WRITE_FIELDS) {
      const v = payload[k]
      if (v !== undefined && v !== null && v !== '') body[k] = v
    }
    return apiClient.patch(`/tasks/${id}`, body).then((r) => r.data)
  },
  /** Canonical completion (backend statuses: open/in_progress/completed/cancelled). */
  setStatus: (id: string, status: string) =>
    apiClient.post(`/tasks/${id}/status`, { status }).then((r) => r.data),
  complete: (id: string) =>
    apiClient.post(`/tasks/${id}/status`, { status: 'completed' }).then((r) => r.data),
}

export const activitiesApi = {
  /** Canonical activity feed (audit-backed). */
  list: (p?: { page?: number; page_size?: number; customer_id?: string }) =>
    apiClient.get<PageResponse<unknown>>(
      '/dashboard/activity',
      { params: params({ limit: p?.page_size ?? 8 }) },
    ),
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
  get: () => apiClient.get('/business/settings').then((r) => r.data),
  update: (payload: unknown) => apiClient.patch('/business/settings', payload).then((r) => r.data),
}

export const analyticsApi = {
  /** Canonical staff overview (KPIs, recent leads/activity). */
  overview: () => apiClient.get('/dashboard/overview').then((r) => r.data),
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
