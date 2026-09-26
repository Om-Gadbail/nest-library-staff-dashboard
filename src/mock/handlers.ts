import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/api/client'
import { store } from './business'
import {
  addCustomerNote,
  addLeadNote,
  completeTask,
  convertLead,
  createAdmission,
  createBooking,
  createLead,
  createStaff,
  createTask,
  dismissNotification,
  markAllNotificationsRead,
  markContacted,
  markNotificationRead,
  recordPayment,
  renewMembership,
  updateBooking,
  updateBookingStatus,
  updateLead,
  updateLeadStage,
  updateSettings,
  updateStaffRole,
  updateStaffStatus,
  updateTask,
  type BookingInput,
  type LeadInput,
  type TaskInput,
} from './business-service'

/**
 * Dev/test mock adapter. It mirrors the REAL FastAPI REST contract
 * (Page envelopes, /api/v1 paths, error codes) using the in-memory store,
 * so frontend unit tests and offline development exercise the same shapes.
 *
 * Production NEVER uses this: set VITE_ENABLE_MSW=false and point
 * VITE_API_BASE_URL at FastAPI. The demo session below is dev-only and is
 * not real authentication — the backend enforces auth/RBAC server-side.
 */

function page(items: unknown[], url: URL) {
  const pageNum = Number(url.searchParams.get('page') ?? 1)
  const size = Number(url.searchParams.get('page_size') ?? 100)
  const q = (url.searchParams.get('q') ?? '').toLowerCase()
  let rows = items
  if (q) {
    rows = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(q),
    )
  }
  const start = (pageNum - 1) * size
  return { items: rows.slice(start, start + size), total: rows.length, page: pageNum, page_size: size }
}

const DEMO_ME = {
  user_id: 'demo-owner',
  full_name: 'Nest Owner',
  email: 'owner@nestlibrary.in',
  businesses: [
    {
      business_id: 'nest-library-001',
      name: 'Nest Library',
      role: 'owner',
      timezone: 'Asia/Kolkata',
    },
  ],
  permissions: [
    'dashboard.view', 'customers.view', 'customers.manage', 'leads.view', 'leads.manage',
    'leads.convert', 'admissions.create', 'memberships.view', 'memberships.manage',
    'renewals.manage', 'payments.view', 'payments.manage', 'payments.refund',
    'bookings.view', 'bookings.manage', 'bookings.override', 'tasks.view', 'tasks.manage',
    'notifications.view', 'notifications.manage', 'analytics.view', 'staff.view',
    'staff.invite', 'staff.role', 'staff.status', 'settings.view', 'settings.manage',
    'settings.limited', 'whatsapp.view', 'whatsapp.manage', 'whatsapp.send', 'jobs.run',
  ],
}

async function bodyOf(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const handlers = [
  // ---- auth (demo session; real auth lives in FastAPI) ----
  http.post(`${API_BASE_URL}/auth/login`, () =>
    HttpResponse.json({ access_token: 'msw-demo-session', token_type: 'bearer', user: DEMO_ME }),
  ),
  http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json(DEMO_ME)),
  http.post(`${API_BASE_URL}/auth/refresh`, () =>
    HttpResponse.json({ access_token: 'msw-demo-session', token_type: 'bearer' }),
  ),
  http.post(`${API_BASE_URL}/auth/logout`, () => HttpResponse.json({ ok: true })),

  // ---- reads (Page envelopes, like FastAPI) ----
  http.get(`${API_BASE_URL}/customers`, ({ request }) =>
    HttpResponse.json(page([...store.customers], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/customers/:id`, ({ params }) => {
    const id = String(params.id)
    const c = store.customers.find((x) => x.customer_id === id)
    if (!c) return HttpResponse.json({ error: { code: 'not_found', message: 'Customer not found' } }, { status: 404 })
    return HttpResponse.json({
      customer: c,
      memberships: store.memberships.filter((m) => m.customer_id === id),
      payments: store.payments.filter((p) => p.customer_id === id),
      renewals: store.renewals.filter((r) => r.customer_id === id),
      activities: store.activities.filter((a) => a.customer_id === id),
    })
  }),
  http.get(`${API_BASE_URL}/memberships`, ({ request }) =>
    HttpResponse.json(page([...store.memberships], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/renewals`, ({ request }) =>
    HttpResponse.json(page([...store.renewals], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/leads`, ({ request }) =>
    HttpResponse.json(page([...store.leads], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/leads/:id`, ({ params }) => {
    const lead = store.leads.find((l) => l.lead_id === String(params.id))
    if (!lead) return HttpResponse.json({ error: { code: 'not_found', message: 'Lead not found' } }, { status: 404 })
    return HttpResponse.json({
      lead,
      activities: store.activities.filter((a) => a.detail?.includes(lead.full_name)),
    })
  }),
  http.get(`${API_BASE_URL}/bookings`, ({ request }) =>
    HttpResponse.json(page([...store.bookings], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/payments`, ({ request }) =>
    HttpResponse.json(page([...store.payments], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/notifications`, ({ request }) =>
    HttpResponse.json(page([...store.notifications], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/notifications/unread-count`, () =>
    HttpResponse.json({ unread: store.notifications.filter((n) => !n.read && !n.dismissed).length }),
  ),
  http.get(`${API_BASE_URL}/tasks`, ({ request }) =>
    HttpResponse.json(page([...store.tasks], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/activities`, ({ request }) =>
    HttpResponse.json(page([...store.activities], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/staff`, ({ request }) =>
    HttpResponse.json(
      page(
        store.staff.map((s) => ({ ...s, last_active: s.last_active_at })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/settings`, () => HttpResponse.json({ ...store.settings, timezone: 'Asia/Kolkata', currency: 'INR', plans: [] })),
  http.get(`${API_BASE_URL}/analytics/overview`, () =>
    HttpResponse.json({
      customers_total: store.customers.length,
      customers_active: store.customers.filter((c) => c.status === 'active').length,
      customers_expiring: store.customers.filter((c) => c.status === 'expiring').length,
      customers_expired: store.customers.filter((c) => c.status === 'expired').length,
      memberships_active: store.memberships.filter((m) => m.status === 'active').length,
      memberships_expiring: store.memberships.filter((m) => m.status === 'expiring').length,
      memberships_expired: store.memberships.filter((m) => m.status === 'expired').length,
      renewal_rate: 12.5,
      leads_total: store.leads.length,
      leads_new: store.leads.filter((l) => l.stage === 'new').length,
      leads_converted: store.leads.filter((l) => l.stage === 'converted').length,
      lead_conversion_rate: 10,
      bookings_today: store.bookings.length,
      tasks_overdue: 1,
      renewals_due_7d: store.renewals.length,
      revenue_today: 2000,
      revenue_month: 15000,
    }),
  ),
  http.get(`${API_BASE_URL}/analytics/revenue`, () => {
    const received = store.payments
      .filter((p) => p.status !== 'refunded')
      .reduce((s, p) => s + p.paid, 0)
    const due = store.payments.reduce((s, p) => s + Math.max(0, p.balance), 0)
    return HttpResponse.json({
      summary: {
        received, due, outstanding: due, expected: received + due, refunds: 0,
        net: received, transactions: store.payments.length,
        average: store.payments.length ? received / store.payments.length : 0,
        previous_received: received, change_percent: 0, has_data: true,
      },
      trend: [{ key: '2026-09-26', label: '26 Sep', revenue: received, previous: 0 }],
      by_method: [{ name: 'upi', total: received }],
      by_plan: [],
      by_status: [],
      range: { start: '2026-08-28', end: '2026-09-26', preset: 'last-30' },
    })
  }),
  http.get(`${API_BASE_URL}/search`, ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const limit = Number(url.searchParams.get('limit') ?? 8)
    const hit = (v: string | undefined) => (v ?? '').toLowerCase().includes(q)
    return HttpResponse.json({
      customers: store.customers
        .filter((c) => hit(c.full_name) || hit(c.phone))
        .slice(0, limit)
        .map((c) => ({ id: c.customer_id, name: c.full_name, phone: c.phone })),
      leads: store.leads
        .filter((l) => hit(l.full_name) || hit(l.phone))
        .slice(0, limit)
        .map((l) => ({ id: l.lead_id, name: l.full_name, stage: l.stage })),
      bookings: store.bookings
        .filter((b) => hit(b.title) || hit(b.customer_name))
        .slice(0, limit)
        .map((b) => ({ id: b.booking_id, title: b.title, starts_at: b.starts_at })),
      tasks: store.tasks
        .filter((t) => hit(t.title))
        .slice(0, limit)
        .map((t) => ({ id: t.task_id, title: t.title, status: t.status })),
    })
  }),
  http.get(`${API_BASE_URL}/whatsapp/settings`, () =>
    HttpResponse.json({
      provider: 'log', enabled: false, configured: false,
      phone_number_id_set: false, has_token: false,
      reminder_days: '7,3,1,0', templates: 'renewal_reminder',
    }),
  ),
  // ---- writes (delegate to the mock service layer) ----
  http.post(`${API_BASE_URL}/customers`, async ({ request }) => {
    const b = await bodyOf(request)
    const dupe = store.customers.find((c) => c.phone === b.phone)
    if (dupe) {
      return HttpResponse.json(
        { error: { code: 'conflict', message: 'A customer with this phone/email already exists.' } },
        { status: 409 },
      )
    }
    const c = {
      customer_id: store.next('c'),
      business_id: 'nest-library-001',
      full_name: String(b.full_name ?? ''),
      phone: String(b.phone ?? ''),
      email: (b.email as string) ?? undefined,
      notes: (b.notes as string) ?? undefined,
      joined_at: new Date().toISOString(),
      status: 'active' as const,
      plan: 'monthly' as const,
      expires_at: new Date().toISOString().slice(0, 10),
    }
    store.customers.unshift(c)
    return HttpResponse.json(c, { status: 201 })
  }),
  http.post(`${API_BASE_URL}/customers/:id/notes`, async ({ params, request }) => {
    const b = await bodyOf(request)
    await addCustomerNote(String(params.id), String(b.note ?? ''))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/customers/:id/renew`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await renewMembership({
      customer_id: String(params.id),
      plan: (b.plan as 'monthly') ?? 'monthly',
      start_at: String(b.start_at ?? new Date().toISOString()),
      amount: Number(b.amount ?? 0),
      paid: Number(b.paid ?? 0),
      method: (b.method as 'upi') ?? 'upi',
    })
    return HttpResponse.json({ membership_id: out.membership.membership_id, payment_id: out.payment.payment_id })
  }),
  http.post(`${API_BASE_URL}/admissions`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await createAdmission({
      full_name: String(b.full_name ?? ''),
      phone: String(b.phone ?? ''),
      email: (b.email as string) ?? undefined,
      notes: (b.notes as string) ?? undefined,
      plan: (b.plan as 'monthly') ?? 'monthly',
      start_at: String(b.start_at ?? new Date().toISOString()),
      amount: Number(b.amount ?? 0),
      paid: Number(b.paid ?? 0),
      method: (b.method as 'upi') ?? 'upi',
    })
    return HttpResponse.json(out, { status: 201 })
  }),
  http.post(`${API_BASE_URL}/payments`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await recordPayment({
      customer_id: String(b.customer_id ?? ''),
      membership_id: (b.membership_id as string) ?? undefined,
      amount: Number(b.amount ?? 0),
      paid: Number(b.paid ?? 0),
      method: (b.method as 'upi') ?? 'upi',
    })
    return HttpResponse.json(out, { status: 201 })
  }),
  http.post(`${API_BASE_URL}/leads`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await createLead({
      full_name: String(b.full_name ?? ''),
      phone: String(b.phone ?? ''),
      email: (b.email as string) ?? undefined,
      source: String(b.source ?? 'Walk-in'),
      interested_plan: b.interested_plan as 'monthly' | undefined,
      assigned_to: (b.assigned_to as string) ?? undefined,
      notes: (b.notes as string) ?? undefined,
      follow_up_at: (b.follow_up_at as string) ?? undefined,
    })
    return HttpResponse.json(out, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/leads/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateLead(String(params.id), b as Partial<LeadInput>)
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/leads/:id/notes`, async ({ params, request }) => {
    const b = await bodyOf(request)
    await addLeadNote(String(params.id), String(b.note ?? ''))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/leads/:id/convert`, async ({ params, request }) => {
    const b = await bodyOf(request)
    try {
      const out = await convertLead({
        lead_id: String(params.id),
        plan: (b.plan as 'monthly') ?? 'monthly',
        start_at: String(b.start_at ?? new Date().toISOString()),
        amount: Number(b.amount ?? 0),
        paid: Number(b.paid ?? 0),
        method: (b.method as 'upi') ?? 'upi',
      })
      return HttpResponse.json(out, { status: 201 })
    } catch (e) {
      return HttpResponse.json(
        { error: { code: 'conflict', message: (e as Error).message } },
        { status: 409 },
      )
    }
  }),
  http.post(`${API_BASE_URL}/bookings`, async ({ request }) => {
    const b = await bodyOf(request)
    const starts = String(b.starts_at ?? '')
    const ends = String(b.ends_at ?? '')
    try {
      const input: BookingInput = {
        title: String(b.title ?? ''),
        service: (b.service as string) ?? undefined,
        customer_id: (b.customer_id as string) ?? undefined,
        customer_name: String(b.customer_name ?? ''),
        customer_phone: (b.customer_phone as string) ?? undefined,
        staff: (b.staff as string) ?? undefined,
        date: starts.slice(0, 10),
        start_time: starts.slice(11, 16),
        end_time: ends.slice(11, 16),
        notes: (b.notes as string) ?? undefined,
      }
      const out = await createBooking(input, { allowOverlap: Boolean(b.allow_overlap) })
      return HttpResponse.json(out, { status: 201 })
    } catch (e) {
      return HttpResponse.json(
        { error: { code: 'conflict', message: (e as Error).message } },
        { status: 409 },
      )
    }
  }),
  http.patch(`${API_BASE_URL}/bookings/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const patch: Partial<BookingInput> = {
      title: b.title as string | undefined,
      notes: b.notes as string | undefined,
    }
    const out = await updateBooking(String(params.id), patch, {
      allowOverlap: Boolean(b.allow_overlap),
    })
    if (b.status) await updateBookingStatus(String(params.id), b.status as 'scheduled')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/tasks`, async ({ request }) => {
    const b = await bodyOf(request)
    const input: TaskInput = {
      title: String(b.title ?? ''),
      assigned_to: (b.assigned_to as string) ?? undefined,
      customer_id: (b.customer_id as string) ?? undefined,
      priority: (b.priority as TaskInput['priority']) ?? 'medium',
      due_at: (b.due_at as string) ?? undefined,
      notes: (b.notes as string) ?? undefined,
    }
    const out = await createTask(input)
    return HttpResponse.json(out, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/tasks/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateTask(String(params.id), b as Partial<TaskInput>)
    return HttpResponse.json(out)
  }),
  http.patch(`${API_BASE_URL}/notifications/:id/read`, async ({ params }) => {
    await markNotificationRead(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/notifications/read-all`, async () => {
    await markAllNotificationsRead()
    return HttpResponse.json({ ok: true })
  }),
  http.delete(`${API_BASE_URL}/notifications/:id`, async ({ params }) => {
    await dismissNotification(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/renewals/:id/contacted`, async ({ params }) => {
    await markContacted(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/staff/invite`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await createStaff({
      full_name: String(b.full_name ?? ''),
      email: String(b.email ?? ''),
      role: (b.role as 'staff') ?? 'staff',
    })
    return HttpResponse.json(out, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/staff/:id/role`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateStaffRole(String(params.id), (b.role as 'staff') ?? 'staff')
    return HttpResponse.json(out)
  }),
  http.patch(`${API_BASE_URL}/staff/:id/status`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateStaffStatus(String(params.id), (b.status as 'active') ?? 'active')
    return HttpResponse.json(out)
  }),
  http.patch(`${API_BASE_URL}/settings`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await updateSettings(b as Parameters<typeof updateSettings>[0])
    return HttpResponse.json({ ...out, timezone: 'Asia/Kolkata', currency: 'INR', plans: [] })
  }),
  http.post(`${API_BASE_URL}/leads/:id/stage`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateLeadStage(String(params.id), (b.stage as 'new') ?? 'new')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/tasks/:id/complete`, async ({ params }) => {
    const out = await completeTask(String(params.id))
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/conflicts`, async () => HttpResponse.json({ conflicts: [] })),
  http.post(`${API_BASE_URL}/jobs/renewal-check`, async () =>
    HttpResponse.json({ created: 0, skipped: 0 }),
  ),
  http.post(`${API_BASE_URL}/whatsapp/send`, async () =>
    HttpResponse.json(
      { error: { code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp is not configured.' } },
      { status: 503 },
    ),
  ),
  http.post(`${API_BASE_URL}/payments/:id/refund`, async () =>
    HttpResponse.json({ ok: true }),
  ),
  http.patch(`${API_BASE_URL}/customers/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const c = store.customers.find((x) => x.customer_id === String(params.id))
    if (!c) {
      return HttpResponse.json(
        { error: { code: 'not_found', message: 'Customer not found' } },
        { status: 404 },
      )
    }
    Object.assign(c, {
      full_name: b.full_name ?? c.full_name,
      phone: b.phone ?? c.phone,
      email: b.email ?? c.email,
      notes: b.notes ?? c.notes,
    })
    return HttpResponse.json(c)
  }),
  http.get(`${API_BASE_URL}/health`, () => HttpResponse.json({ ok: true })),
  http.get(`${API_BASE_URL}/analytics/transactions`, ({ request }) =>
    HttpResponse.json(page([...store.payments], new URL(request.url))),
  ),
  http.get(`${API_BASE_URL}/whatsapp/messages`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }),
  ),
  http.patch(`${API_BASE_URL}/whatsapp/settings`, async () =>
    HttpResponse.json({
      provider: 'log', enabled: false, configured: false,
      phone_number_id_set: false, has_token: false,
      reminder_days: '7,3,1,0', templates: 'renewal_reminder',
    }),
  ),
]
