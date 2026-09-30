import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/api/client'
import { store } from './business'
import {
  addCustomerNote,
  addLeadNote,
  archiveTask,
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
  const size = Number(url.searchParams.get('page_size') ?? url.searchParams.get('limit') ?? 100)
  const q = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').toLowerCase()
  let rows = items
  if (q) {
    rows = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(q),
    )
  }
  const start = (pageNum - 1) * size
  return {
    items: rows.slice(start, start + size),
    total: rows.length,
    limit: size,
    offset: start,
    page: pageNum,
    page_size: size,
  }
}

/**
 * Demo session in the CANONICAL backend shape (nested user/business/
 * membership + canonical `.read` permission keys). The app normalizes this
 * via normalizeMe() exactly like the real GET /auth/me response.
 */
const DEMO_ME = {
  user: {
    id: 'demo-owner',
    email: 'owner@nestlibrary.in',
    full_name: 'Nest Owner',
    phone: null,
    is_active: true,
    is_verified: true,
    last_login_at: null,
  },
  business: {
    id: 'nest-library-001',
    slug: 'nest',
    name: 'Nest Library',
    business_type: 'fitness',
    status: 'active',
  },
  membership: {
    business_id: 'nest-library-001',
    role: 'OWNER',
    status: 'active',
    is_default: true,
  },
  permissions: [
    'dashboard.read', 'customers.read', 'customers.create', 'customers.update',
    'members.read', 'members.create', 'members.update',
    'memberships.read', 'memberships.create', 'memberships.update',
    'membership_plans.read', 'leads.read', 'leads.create', 'leads.update',
    'bookings.read', 'bookings.create', 'bookings.update',
    'attendance.read', 'attendance.create',
    'payments.read', 'payments.create', 'payments.refund',
    'renewals.read', 'renewals.create', 'renewals.update',
    'tasks.read', 'tasks.create', 'tasks.update',
    'notifications.read', 'growth.read', 'reports.read',
    'settings.read', 'settings.update', 'users.read', 'users.create', 'users.update',
    'whatsapp.manage', 'automation.manage', 'audit.read',
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
    HttpResponse.json(
      page(
        store.memberships.map((m) => ({
          id: m.membership_id,
          member_id: m.customer_id,
          customer_id: m.customer_id,
          status: m.status === 'expired' ? 'expired' : 'active',
          payment_state: m.payment_state === 'paid' ? 'paid' : 'unpaid',
          start_date: m.start_at,
          end_date: m.expires_at,
          price: m.amount,
          final_amount: m.amount,
          notes: '',
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/renewals`, ({ request }) =>
    HttpResponse.json(
      page(
        store.renewals.map((r) => ({
          id: r.renewal_id,
          member_id: r.customer_id,
          due_date: r.due_at,
          renewal_amount: r.amount,
          status: r.status === 'overdue' ? 'expired' : 'pending',
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.post(`${API_BASE_URL}/renewals/:id/status`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const r = store.renewals.find((x) => x.renewal_id === String(params.id))
    if (!r) return HttpResponse.json({ error: { code: 'not_found', message: 'Renewal not found' } }, { status: 404 })
    // Mock store keeps UI buckets; confirmed stays visible, expired moves bucket.
    if (b.status === 'expired') r.status = 'overdue'
    else if (b.status === 'cancelled') r.status = 'upcoming'
    return HttpResponse.json({ ok: true })
  }),
  http.get(`${API_BASE_URL}/leads`, ({ request }) =>
    HttpResponse.json(
      page(
        store.leads.map((l) => ({
          id: l.lead_id,
          display_name: l.full_name,
          phone: l.phone,
          email: l.email ?? null,
          source: l.source,
          source_detail: '',
          status:
            l.stage === 'interested' ? 'qualified'
            : l.stage === 'follow-up' ? 'booked'
            : l.stage,
          service_interest: l.interested_plan ?? '',
          message: l.notes ?? '',
          follow_up_at: l.follow_up_at ?? null,
          created_at: l.created_at,
          updated_at: l.created_at,
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/leads/:id`, ({ params }) => {
    const lead = store.leads.find((l) => l.lead_id === String(params.id))
    if (!lead) return HttpResponse.json({ error: { code: 'not_found', message: 'Lead not found' } }, { status: 404 })
    return HttpResponse.json({
      id: lead.lead_id,
      display_name: lead.full_name,
      phone: lead.phone,
      email: lead.email ?? null,
      source: lead.source,
      source_detail: '',
      status:
        lead.stage === 'interested' ? 'qualified'
        : lead.stage === 'follow-up' ? 'booked'
        : lead.stage,
      service_interest: lead.interested_plan ?? '',
      message: lead.notes ?? '',
      follow_up_at: lead.follow_up_at ?? null,
      created_at: lead.created_at,
      updated_at: lead.created_at,
    })
  }),
  http.get(`${API_BASE_URL}/leads/:id/activities`, ({ params }) => {
    const lead = store.leads.find((l) => l.lead_id === String(params.id))
    const rows = store.activities
      .filter((a) => (lead ? a.detail?.includes(lead.full_name) : false))
      .map((a) => ({
        id: a.activity_id,
        lead_id: String(params.id),
        activity_type: a.kind ?? 'note',
        note: `${a.action}${a.detail ? ` — ${a.detail}` : ''}`,
        created_at: a.created_at,
      }))
    return HttpResponse.json({ items: rows, total: rows.length, limit: 100, offset: 0 })
  }),
  http.get(`${API_BASE_URL}/bookings`, ({ request }) =>
    HttpResponse.json(
      page(
        store.bookings.map((b) => ({
          id: b.booking_id,
          title: b.title,
          booking_type: b.service ?? '',
          display_name: b.customer_name,
          requested_start_at: b.starts_at,
          requested_end_at: b.ends_at,
          status:
            b.status === 'scheduled' || b.status === 'pending' ? 'requested'
            : b.status === 'no-show' ? 'no_show'
            : b.status,
          notes: b.notes ?? '',
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/payments`, ({ request }) =>
    HttpResponse.json(
      page(
        store.payments.map((p) => ({
          id: p.payment_id,
          member_id: p.customer_id,
          customer_id: p.customer_id,
          amount: p.amount,
          status: p.status === 'partial' ? 'partially_paid' : p.status,
          method: p.method,
          paid_at: p.received_at,
          invoice_no: p.receipt_no,
          notes: '',
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/notifications`, ({ request }) =>
    HttpResponse.json(
      page(
        store.notifications.map((n) => ({
          id: n.notification_id,
          notification_type: n.kind,
          title: n.title,
          body: n.body,
          severity: 'info',
          read_at: n.read ? n.created_at : null,
          created_at: n.created_at,
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/notifications/unread-count`, () =>
    HttpResponse.json({ unread: store.notifications.filter((n) => !n.read && !n.dismissed).length }),
  ),
  http.get(`${API_BASE_URL}/tasks`, ({ request }) =>
    HttpResponse.json(
      page(
        store.tasks.map((t) => ({
          id: t.task_id,
          title: t.title,
          description: t.notes ?? '',
          priority: t.priority,
          assigned_to_user_id: null,
          due_at: t.due_at ?? null,
          status:
            t.status === 'done' || t.status === 'completed' ? 'completed'
            : t.status === 'in-progress' ? 'in_progress'
            : t.status === 'archived' ? 'cancelled'
            : 'open',
          created_at: t.created_at ?? new Date().toISOString(),
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.post(`${API_BASE_URL}/tasks/:id/status`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const t = store.tasks.find((x) => x.task_id === String(params.id))
    if (!t) return HttpResponse.json({ error: { code: 'not_found', message: 'Task not found' } }, { status: 404 })
    if (b.status === 'completed') await completeTask(t.task_id)
    else if (b.status === 'cancelled') await archiveTask(t.task_id)
    else if (b.status === 'in_progress') t.status = 'in-progress'
    else t.status = 'open'
    return HttpResponse.json({ ok: true })
  }),
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
      full_name: String(b.display_name ?? b.full_name ?? ''),
      phone: String(b.phone ?? ''),
      email: (b.email as string) ?? undefined,
      source: String(b.source ?? 'Walk-in'),
      interested_plan: (b.service_interest ?? b.interested_plan) as 'monthly' | undefined,
      assigned_to: (b.assigned_to as string) ?? undefined,
      notes: String(b.message ?? b.notes ?? '') || undefined,
      follow_up_at: (b.follow_up_at as string) ?? undefined,
    })
    return HttpResponse.json(out, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/leads/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateLead(String(params.id), {
      full_name: (b.display_name ?? b.full_name) as string | undefined,
      phone: b.phone as string | undefined,
      email: b.email as string | undefined,
      source: b.source as string | undefined,
      interested_plan: b.service_interest as 'monthly' | undefined,
      notes: b.message as string | undefined,
      follow_up_at: b.follow_up_at as string | undefined,
    })
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/leads/:id/status`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const toStage =
      b.status === 'qualified' ? 'interested'
      : b.status === 'booked' ? 'follow-up'
      : (b.status as 'new') ?? 'new'
    const out = await updateLeadStage(String(params.id), toStage)
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/leads/:id/notes`, async ({ params, request }) => {
    const b = await bodyOf(request)
    await addLeadNote(String(params.id), String(b.note ?? ''))
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${API_BASE_URL}/leads/:id/convert`, async ({ params }) => {
    try {
      const out = await convertLead({
        lead_id: String(params.id),
        plan: 'monthly',
        start_at: new Date().toISOString(),
        amount: 2000,
        paid: 2000,
        method: 'upi',
      })
      return HttpResponse.json(
        { id: out.customer.customer_id, contact: { display_name: out.customer.full_name } },
        { status: 201 },
      )
    } catch (e) {
      return HttpResponse.json(
        { error: { code: 'conflict', message: (e as Error).message } },
        { status: 409 },
      )
    }
  }),
  http.post(`${API_BASE_URL}/bookings`, async ({ request }) => {
    const b = await bodyOf(request)
    const starts = String(b.requested_start_at ?? b.starts_at ?? '')
    const ends = String(b.requested_end_at ?? b.ends_at ?? '')
    try {
      const input: BookingInput = {
        title: String(b.title ?? ''),
        service: ((b.booking_type ?? b.service) as string) ?? undefined,
        customer_id: (b.customer_id as string) ?? undefined,
        customer_name: String(b.display_name ?? b.customer_name ?? ''),
        customer_phone: (b.phone ?? b.customer_phone) as string | undefined,
        staff: (b.staff as string) ?? undefined,
        date: starts.slice(0, 10),
        start_time: starts.slice(11, 16),
        end_time: ends.slice(11, 16),
        notes: (b.notes as string) ?? undefined,
      }
      const out = await createBooking(input, { allowOverlap: true })
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
    const out = await updateBooking(String(params.id), patch, { allowOverlap: true })
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/:id/confirm`, async ({ params }) => {
    const out = await updateBookingStatus(String(params.id), 'confirmed')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/:id/cancel`, async ({ params }) => {
    const out = await updateBookingStatus(String(params.id), 'cancelled')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/:id/complete`, async ({ params }) => {
    const out = await updateBookingStatus(String(params.id), 'completed')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/:id/no-show`, async ({ params }) => {
    const out = await updateBookingStatus(String(params.id), 'no-show')
    return HttpResponse.json(out)
  }),
  http.post(`${API_BASE_URL}/bookings/:id/reopen`, async ({ params }) => {
    const out = await updateBookingStatus(String(params.id), 'scheduled')
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
      notes: (b.description ?? b.notes) as string | undefined,
    }
    const out = await createTask(input)
    return HttpResponse.json(out, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/tasks/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const out = await updateTask(String(params.id), {
      title: b.title as string | undefined,
      priority: b.priority as TaskInput['priority'],
      due_at: b.due_at as string | undefined,
      notes: b.description as string | undefined,
    })
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

  /* ---- canonical contract (mirrors the real FastAPI shapes) ----
   * The app's live code paths call these endpoints; the mock serves the
   * same in-memory store translated into canonical rows so unit tests
   * exercise the real adapters (adaptLead/adaptBooking/...). */

  http.get(`${API_BASE_URL}/dashboard/overview`, () =>
    HttpResponse.json({
      business_id: 'nest-library-001',
      generated_at: new Date().toISOString(),
      leads: {
        new: store.leads.filter((l) => l.stage === 'new').length,
        follow_ups_due: store.leads.filter((l) => l.stage === 'follow-up').length,
        created_today: store.leads.length,
      },
      bookings: { requested: store.bookings.length, created_today: store.bookings.length },
      notifications: { unread: store.notifications.filter((n) => !n.read).length },
      tasks: { mine_open: store.tasks.length, mine_overdue: 0, open_total: store.tasks.length },
      recent_leads: store.leads.slice(0, 4).map((l) => ({
        id: l.lead_id,
        display_name: l.full_name,
        status: l.stage === 'interested' ? 'qualified' : l.stage === 'follow-up' ? 'contacted' : l.stage,
        source: l.source,
        created_at: l.created_at,
      })),
      recent_activity: store.activities.slice(0, 5).map((a) => ({
        id: a.activity_id,
        activity_type: a.kind ?? 'note',
        note: `${a.action}${a.detail ? ` — ${a.detail}` : ''}`,
        actor_user_id: null,
        created_at: a.created_at,
      })),
    }),
  ),
  http.get(`${API_BASE_URL}/dashboard/activity`, ({ request }) =>
    HttpResponse.json(
      page(
        store.activities.map((a) => ({
          id: a.activity_id,
          action: a.action,
          entity_type: a.kind ?? 'note',
          entity_id: null,
          actor_user_id: null,
          result: 'success',
          request_id: null,
          meta: { note: a.detail ?? '' },
          created_at: a.created_at,
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/dashboard/bookings/summary`, () =>
    HttpResponse.json({ requested: store.bookings.length, confirmed: 0, today: store.bookings.length }),
  ),
  http.get(`${API_BASE_URL}/members`, ({ request }) =>
    HttpResponse.json(
      page(
        store.customers.map((c) => ({
          id: c.customer_id,
          customer_id: null,
          contact_id: null,
          lead_id: null,
          display_name: c.full_name,
          phone: c.phone,
          email: null,
          status: 'active',
          source: 'walk_in',
          emergency_contact_name: '',
          emergency_contact_phone: null,
          seat_preference: '',
          notes: c.notes ?? '',
          created_at: c.joined_at,
          updated_at: c.joined_at,
        })),
        new URL(request.url),
      ),
    ),
  ),
  http.get(`${API_BASE_URL}/members/:id/profile`, ({ params }) => {
    const id = String(params.id)
    const c = store.customers.find((x) => x.customer_id === id)
    if (!c) return HttpResponse.json({ error: { code: 'not_found', message: 'Member not found' } }, { status: 404 })
    return HttpResponse.json({
      member: {
        id: c.customer_id, display_name: c.full_name, phone: c.phone, status: 'active',
        notes: c.notes ?? '', created_at: c.joined_at, updated_at: c.joined_at,
      },
      current_membership: null,
      memberships: store.memberships.filter((m) => m.customer_id === id).map((m) => ({
        id: m.membership_id, member_id: id, status: 'active', payment_state: 'paid',
        start_date: m.start_at, end_date: m.expires_at, final_amount: m.amount, notes: '',
      })),
      payments: store.payments.filter((p) => p.customer_id === id).map((p) => ({
        id: p.payment_id, member_id: id, amount: p.amount, status: p.status,
        method: p.method, paid_at: p.received_at, invoice_no: p.receipt_no, notes: '',
      })),
      attendance: [],
      renewals: store.renewals.filter((r) => r.customer_id === id).map((r) => ({
        id: r.renewal_id, member_id: id, due_date: r.due_at, renewal_amount: r.amount,
        status: r.status === 'upcoming' ? 'pending' : 'expired',
      })),
      active_seat_allocation: null,
    })
  }),
  http.get(`${API_BASE_URL}/members/:id`, ({ params }) => {
    const id = String(params.id)
    const c = store.customers.find((x) => x.customer_id === id)
    if (!c) return HttpResponse.json({ error: { code: 'not_found', message: 'Member not found' } }, { status: 404 })
    return HttpResponse.json({ id: c.customer_id, display_name: c.full_name, phone: c.phone, status: 'active', notes: c.notes ?? '' })
  }),
  http.post(`${API_BASE_URL}/members`, async ({ request }) => {
    const b = await bodyOf(request)
    const c = {
      customer_id: store.next('c'),
      business_id: 'nest-library-001',
      full_name: String(b.display_name ?? ''),
      phone: String(b.phone ?? ''),
      email: (b.email as string) ?? undefined,
      notes: (b.notes as string) ?? undefined,
      joined_at: new Date().toISOString(),
      status: 'active' as const,
      plan: 'monthly' as const,
      expires_at: new Date().toISOString().slice(0, 10),
    }
    store.customers.unshift(c)
    return HttpResponse.json({ id: c.customer_id, display_name: c.full_name }, { status: 201 })
  }),
  http.patch(`${API_BASE_URL}/members/:id`, async ({ params, request }) => {
    const b = await bodyOf(request)
    const c = store.customers.find((x) => x.customer_id === String(params.id))
    if (!c) return HttpResponse.json({ error: { code: 'not_found', message: 'Member not found' } }, { status: 404 })
    if (typeof b.notes === 'string') c.notes = b.notes
    if (typeof b.phone === 'string') c.phone = b.phone
    return HttpResponse.json({ id: c.customer_id, display_name: c.full_name })
  }),
  http.get(`${API_BASE_URL}/membership-plans`, () =>
    HttpResponse.json({
      items: [
        { id: 'plan-monthly', code: 'monthly', name: 'Monthly', duration_months: 1, price: '2000', currency: 'INR', is_active: true },
        { id: 'plan-quarterly', code: 'quarterly', name: 'Quarterly', duration_months: 3, price: '5500', currency: 'INR', is_active: true },
        { id: 'plan-half-yearly', code: 'half-yearly', name: 'Half-yearly', duration_months: 6, price: '10000', currency: 'INR', is_active: true },
        { id: 'plan-yearly', code: 'yearly', name: 'Yearly', duration_months: 12, price: '18000', currency: 'INR', is_active: true },
      ],
      total: 4, limit: 100, offset: 0,
    }),
  ),
  http.get(`${API_BASE_URL}/business/settings`, () =>
    HttpResponse.json({
      business_id: 'nest-library-001',
      branding: {}, contact: {}, address: {}, hours: {},
      localization: { timezone: 'Asia/Kolkata' }, operational: {},
    }),
  ),
  http.patch(`${API_BASE_URL}/business/settings`, async ({ request }) => {
    const b = await bodyOf(request)
    const out = await updateSettings(b as Parameters<typeof updateSettings>[0])
    return HttpResponse.json({ ...out, timezone: 'Asia/Kolkata', currency: 'INR', plans: [] })
  }),
  http.get(`${API_BASE_URL}/attendance`, ({ request }) =>
    HttpResponse.json(page([], new URL(request.url))),
  ),
  http.post(`${API_BASE_URL}/attendance/check-in`, async () =>
    HttpResponse.json({ id: 'att-mock-1', member_id: 'c-101', checked_in_at: new Date().toISOString(), checked_out_at: null }, { status: 201 }),
  ),
  http.post(`${API_BASE_URL}/attendance/:id/check-out`, async () =>
    HttpResponse.json({ id: 'att-mock-1', checked_out_at: new Date().toISOString() }),
  ),
]
