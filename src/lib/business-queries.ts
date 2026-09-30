import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { freshness } from '@/app/query-client'
import {
  API_MOCK_FALLBACK_ENABLED,
  apiClient,
  isApiError,
  type PageResponse,
} from '@/api/client'
import * as React from 'react'
import {
  activitiesApi,
  admissionsApi,
  analyticsApi,
  bookingsApi,
  customersApi,
  jobsApi,
  leadsApi,
  membersApi,
  membershipsApi,
  notificationsApi,
  paymentsApi,
  plansApi,
  renewalsApi,
  settingsApi,
  staffApi,
  tasksApi,
} from '@/api/services'
import { queryKeys } from '@/lib/query-keys'
import { store } from '@/mock/business'
import {
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
  markNotificationRead,
  recordPayment,
  renewMembership,
  scheduleLeadFollowUp,
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
} from '@/mock/business-service'
import type { AdmissionInput, PaymentInput, RenewInput } from '@/mock/business-service'
import type {
  Activity,
  Booking,
  BookingStatus,
  Customer,
  Lead,
  LeadStage,
  Membership,
  NotificationItem,
  Payment,
  Renewal,
  StaffMember,
  StaffRole,
  StaffStatus,
  Task,
  TaskStatus,
} from '@/types/domain'

async function tick<T>(v: T): Promise<T> {
  return v
}

/**
 * Backend-first data access.
 * With the FastAPI backend running, every hook below reads/writes real
 * PostgreSQL data through the REST contract. If the API is unreachable
 * (network error only — never auth/validation errors) and the dev/test
 * mock fallback is enabled, hooks fall back to the local mock store so
 * offline development and deterministic frontend tests keep working.
 * Production sets VITE_ENABLE_MSW=false: real API only, errors surface.
 */
async function withFallback<T>(apiCall: () => Promise<T>, mockCall: () => Promise<T>): Promise<T> {
  if (!API_MOCK_FALLBACK_ENABLED) return apiCall()
  try {
    return await apiCall()
  } catch (err) {
    if (isApiError(err) && err.kind === 'network') return mockCall()
    throw err
  }
}

function itemsOf<T>(page: PageResponse<unknown>): T[] {
  if (!page || !Array.isArray(page.items)) return []
  return page.items as T[]
}

function adaptTask(t: Task): Task {
  return { ...t, assignee: t.assignee ?? t.assigned_to }
}

function adaptNotification(n: NotificationItem): NotificationItem {
  return { dismissed: false, ...n }
}

/* ---------------- Canonical backend adapters ----------------
 * The FastAPI backend is the authoritative contract (see backend
 * app/models/*_vocab.py + docs/openapi.json). These adapters translate
 * canonical rows into the dashboard's view models. Unknown/absent fields
 * degrade to safe defaults — never to a render crash.
 */

type RawRecord = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

/** Backend lead status -> UI lead stage. */
export function leadStageFromBackend(status: unknown): Lead['stage'] {
  switch (str(status).toLowerCase()) {
    case 'contacted':
      return 'contacted'
    case 'qualified':
      return 'interested'
    case 'booked':
    case 'follow-up':
    case 'follow_up':
      return 'follow-up'
    case 'converted':
      return 'converted'
    case 'lost':
    case 'spam':
      return 'lost'
    default:
      return 'new'
  }
}

/** UI lead stage -> canonical backend status for POST /leads/{id}/status. */
export function leadStatusToBackend(stage: Lead['stage']): string {
  switch (stage) {
    case 'contacted':
      return 'contacted'
    case 'interested':
      return 'qualified'
    case 'follow-up':
      // "needs follow-up" persists as CONTACTED; the follow-up date itself
      // travels via PATCH follow_up_at (see useScheduleFollowUp).
      return 'contacted'
    case 'lost':
      return 'lost'
    case 'new':
      return 'new'
    default:
      return 'new'
  }
}

/** Canonical LeadOut -> UI Lead. */
export function adaptLead(raw: RawRecord): Lead {
  return {
    lead_id: str(raw.id ?? raw.lead_id),
    business_id: str(raw.business_id),
    full_name: str(raw.display_name ?? raw.full_name, 'Unnamed lead'),
    phone: str(raw.phone),
    email: str(raw.email) || undefined,
    stage: leadStageFromBackend(raw.status ?? raw.stage),
    source: str(raw.source, 'website'),
    interested_plan: (raw.service_interest as Lead['interested_plan']) || undefined,
    assigned_to: undefined,
    notes: str(raw.message) || undefined,
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at) || undefined,
    follow_up_at: str(raw.follow_up_at) || undefined,
    last_activity_at: str(raw.updated_at ?? raw.created_at) || undefined,
    last_activity: str(raw.message) || undefined,
    converted_customer_id: str(raw.customer_id) || undefined,
  }
}

/** Canonical AuditEventOut -> UI Activity. */
function adaptAuditEvent(raw: RawRecord): Activity {
  const entity = str(raw.entity_type)
  const kind: Activity['kind'] =
    entity === 'lead' ? 'lead'
    : entity === 'payment' ? 'payment'
    : entity === 'member' || entity === 'customer' || entity === 'membership' ? 'membership'
    : entity === 'booking' ? 'booking'
    : entity === 'task' ? 'task'
    : entity === 'renewal' ? 'renewal'
    : 'system'
  return {
    activity_id: str(raw.id),
    business_id: str(raw.business_id),
    actor: 'System',
    action: str(raw.action, 'activity'),
    detail: str(raw.note ?? (raw.meta as RawRecord | undefined)?.['note'] ?? ''),
    created_at: str(raw.created_at),
    kind,
  }
}

/** Canonical NotificationOut -> UI NotificationItem. */
function adaptBackendNotification(raw: RawRecord): NotificationItem {
  const severity = str(raw.severity, 'info')
  return {
    notification_id: str(raw.id),
    business_id: str(raw.business_id),
    title: str(raw.title, 'Notification'),
    body: str(raw.body),
    created_at: str(raw.created_at),
    read: Boolean(raw.read_at),
    dismissed: false,
    kind: severity === 'critical' ? 'payment' : severity === 'warning' ? 'renewal' : 'system',
  }
}

/** Canonical TaskOut -> UI Task. */
function adaptBackendTask(raw: RawRecord): Task {
  const status = str(raw.status, 'open')
  const uiStatus: Task['status'] =
    status === 'completed' ? 'done'
    : status === 'in_progress' ? 'in-progress'
    : status === 'cancelled' ? 'archived'
    : 'todo'
  return {
    task_id: str(raw.id),
    business_id: str(raw.business_id),
    title: str(raw.title, 'Untitled task'),
    notes: str(raw.description) || undefined,
    status: uiStatus,
    priority: (str(raw.priority, 'medium') as Task['priority']) || 'medium',
    due_at: str(raw.due_at) || undefined,
    created_at: str(raw.created_at),
  }
}

/** UI task status -> canonical backend status. */
function taskStatusToBackend(status: string): string {
  switch (status) {
    case 'done':
    case 'completed':
      return 'completed'
    case 'in-progress':
      return 'in_progress'
    case 'archived':
    case 'cancelled':
      return 'cancelled'
    default:
      return 'open'
  }
}

/** Canonical BookingOut -> UI Booking. */
function adaptBooking(raw: RawRecord): Booking {
  const status = str(raw.status, 'requested')
  const uiStatus: Booking['status'] =
    status === 'confirmed' ? 'confirmed'
    : status === 'completed' ? 'completed'
    : status === 'cancelled' ? 'cancelled'
    : status === 'no_show' ? 'no-show'
    : 'pending'
  return {
    booking_id: str(raw.id),
    business_id: str(raw.business_id),
    title: str(raw.title, 'Booking'),
    service: str(raw.booking_type) || undefined,
    customer_id: str(raw.customer_id ?? raw.contact_id ?? raw.lead_id) || undefined,
    customer_name: str(raw.display_name, 'Guest'),
    customer_phone: undefined,
    starts_at: str(raw.requested_start_at),
    ends_at: str(raw.requested_end_at),
    status: uiStatus,
    notes: str(raw.notes) || undefined,
  }
}

/** Canonical MemberOut -> UI Customer row. */
function adaptMemberToCustomer(raw: RawRecord): Customer {
  return {
    customer_id: str(raw.id),
    business_id: str(raw.business_id),
    full_name: str(raw.display_name, 'Unnamed member'),
    phone: str(raw.phone),
    email: str(raw.email) || undefined,
    notes: str(raw.notes) || undefined,
    joined_at: str(raw.created_at),
    status: 'active',
    plan: 'monthly',
    expires_at: '',
  }
}

/** Canonical MembershipOut -> UI Membership (names joined from members). */
function adaptMembership(raw: RawRecord, memberName: string, memberPhone: string): Membership {
  const amount = num(raw.final_amount ?? raw.price)
  const state = str(raw.payment_state, 'unpaid')
  return {
    membership_id: str(raw.id),
    business_id: str(raw.business_id),
    customer_id: str(raw.customer_id ?? raw.member_id),
    customer_name: memberName || 'Member',
    customer_phone: memberPhone || undefined,
    plan: 'monthly',
    status: 'active',
    start_at: str(raw.start_date),
    expires_at: str(raw.end_date),
    amount,
    paid: state === 'paid' ? amount : 0,
    balance: state === 'paid' ? 0 : amount,
    payment_state: state === 'paid' ? 'paid' : state === 'partially_paid' ? 'partial' : 'pending',
  }
}

/** Canonical RenewalOut -> UI Renewal (names/plans joined from members/plans). */
function adaptRenewal(
  raw: RawRecord,
  memberName: string,
  memberPhone: string,
  planName?: string,
): Renewal {
  const due = str(raw.due_date)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDate = due ? new Date(due) : null
  const days = dueDate ? Math.round((dueDate.getTime() - startOfToday.getTime()) / 86_400_000) : 0
  const status: Renewal['status'] =
    str(raw.status) === 'expired' || days < 0 ? 'overdue'
    : days === 0 ? 'due-today'
    : 'upcoming'
  return {
    renewal_id: str(raw.id),
    business_id: str(raw.business_id),
    customer_id: str(raw.member_id),
    customer_name: memberName || 'Member',
    customer_phone: memberPhone || undefined,
    plan: (planName || 'monthly') as Renewal['plan'],
    due_at: due,
    amount: num(raw.renewal_amount),
    status,
    bucket: status === 'overdue' ? 'expired' : status === 'due-today' ? 'today' : 'week',
    days_remaining: days,
  }
}

/** Canonical PaymentOut -> UI Payment (names joined from members). */
function adaptPayment(raw: RawRecord, memberName: string): Payment {
  const amount = num(raw.amount)
  const status = str(raw.status, 'pending')
  const method = str(raw.method, 'other').toLowerCase()
  return {
    payment_id: str(raw.id),
    business_id: str(raw.business_id),
    customer_id: str(raw.customer_id ?? raw.member_id),
    customer_name: memberName || str(raw.invoice_no) || 'Receipt',
    membership_id: str(raw.membership_id) || undefined,
    amount,
    paid: status === 'paid' ? amount : status === 'partially_paid' ? amount : 0,
    balance: status === 'paid' ? 0 : amount,
    method: (['upi', 'cash', 'card', 'netbanking', 'bank-transfer', 'other'].includes(method)
      ? method
      : 'other') as Payment['method'],
    status: (['paid', 'partial', 'pending', 'failed', 'refunded'].includes(
      status === 'partially_paid' ? 'partial' : status,
    )
      ? status === 'partially_paid' ? 'partial' : status
      : 'pending') as Payment['status'],
    received_at: str(raw.paid_at ?? raw.created_at),
    receipt_no: str(raw.invoice_no ?? raw.id),
  }
}

/** Member id -> {name, phone} lookup for joining canonical rows. */
export function useMembersMap(): Map<string, { name: string; phone: string }> {
  const { data } = useQuery({
    queryKey: queryKeys.members,
    staleTime: freshness.customers,
    queryFn: () =>
      withFallback<RawRecord[]>(
        () => membersApi.list({ page_size: 200 }).then((r) => itemsOf<RawRecord>(r.data)),
        () => tick([]),
      ),
  })
  return React.useMemo(() => {
    const map = new Map<string, { name: string; phone: string }>()
    for (const m of data ?? []) {
      map.set(str(m.id), { name: str(m.display_name), phone: str(m.phone) })
    }
    return map
  }, [data])
}

/** Real membership plans for admission/renew/convert flows. */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    staleTime: 300_000,
    queryFn: () =>
      withFallback<RawRecord[]>(
        () => plansApi.list().then((d) => (Array.isArray(d?.items) ? d.items : [])),
        () => tick([]),
      ),
  })
}

const PLAN_MONTHS_FALLBACK: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
}

/** Match a UI plan enum to a real plan UUID by duration (tenant's own catalog). */
export function usePlanIdFor(plan: string): string | null {
  const { data } = usePlans()
  return React.useMemo(() => {
    const months = PLAN_MONTHS_FALLBACK[plan] ?? 1
    const rows = (data ?? []).filter((p) => num(p.duration_months) === months && p.is_active !== false)
    if (rows.length === 0) return null
    const regular = rows.find((p) => /regular|monthly|fitness/i.test(str(p.code)))
    return str((regular ?? rows[0]).id) || null
  }, [data, plan])
}

/* ---------------- Dashboard (real analytics, real clock) ---------------- */

interface DashboardShape {
  todayRevenue: number
  totalMembers: number
  newLeads: number
  expiringSoon: number
  received: number
  due: number
  expected: number
}

function mockDashboard(): DashboardShape {
  const received = store.payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + p.paid, 0)
  const due = store.payments.reduce((s, p) => s + Math.max(0, p.balance), 0)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayRevenue = store.payments
    .filter((p) => p.status !== 'refunded' && new Date(p.received_at) >= startOfToday)
    .reduce((s, p) => s + p.paid, 0)
  return {
    todayRevenue,
    totalMembers: store.customers.length,
    newLeads: store.leads.filter((l) => l.stage === 'new').length,
    expiringSoon: store.renewals.filter((r) => r.status !== 'overdue').length,
    received,
    due,
    expected: received + due,
  }
}

interface OverviewShape {
  leads?: { new?: number; follow_ups_due?: number; created_today?: number }
  bookings?: { requested?: number; created_today?: number }
  notifications?: { unread?: number }
  tasks?: { mine_open?: number; mine_overdue?: number; open_total?: number }
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function amountOf(raw: RawRecord): number {
  return num(raw.amount ?? raw.final_amount ?? raw.paid)
}

function paidAtOf(raw: RawRecord): string {
  return str(raw.paid_at ?? raw.created_at)
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    staleTime: freshness.dashboard,
    queryFn: () =>
      withFallback<DashboardShape>(
        async () => {
          const [overview, payPage, membersPage, renewalsPage] = await Promise.all([
            analyticsApi.overview() as Promise<OverviewShape>,
            paymentsApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
            membersApi.list({ page_size: 1 }).then((r) => r.data).catch(() => null),
            renewalsApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
          ])
          const payments = payPage ? itemsOf<RawRecord>(payPage) : []
          const paidRows = payments.filter((p) => str(p.status) === 'paid')
          const received = paidRows.reduce((s, p) => s + amountOf(p), 0)
          const due = payments
            .filter((p) => str(p.status) !== 'paid' && str(p.status) !== 'refunded' && str(p.status) !== 'cancelled')
            .reduce((s, p) => s + amountOf(p), 0)
          const today = startOfToday()
          const todayRevenue = paidRows
            .filter((p) => new Date(paidAtOf(p)) >= today)
            .reduce((s, p) => s + amountOf(p), 0)
          const membersTotal =
            membersPage && typeof (membersPage as { total?: number }).total === 'number'
              ? (membersPage as { total: number }).total
              : 0
          const renewals = renewalsPage ? itemsOf<RawRecord>(renewalsPage) : []
          return {
            todayRevenue,
            totalMembers: membersTotal,
            newLeads: num(overview?.leads?.new),
            expiringSoon: renewals.filter((r) => str(r.status) !== 'cancelled').length,
            received,
            due,
            expected: received + due,
          }
        },
        () => tick(mockDashboard()),
      ),
  })
}

interface RevenueShape {
  points: { day: string; revenue: number; date: string }[]
  received: number
  due: number
  expected: number
}

function mockRevenue(range: string): RevenueShape {
  // Real current time — the old hardcoded Sept-2026 demo anchor is gone.
  const now = new Date()
  const end = now
  const start =
    range === '7d'
      ? new Date(now.getTime() - 6 * 86_400_000)
      : range === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - 29 * 86_400_000)
  const byDay = new Map<string, number>()
  for (const p of store.payments) {
    if (p.status === 'refunded') continue
    const d = new Date(p.received_at)
    if (d >= start && d <= end) {
      const k = d.toISOString().slice(0, 10)
      byDay.set(k, (byDay.get(k) ?? 0) + p.paid)
    }
  }
  const points: { day: string; revenue: number; date: string }[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    points.push({
      day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: byDay.get(iso) ?? 0,
      date: iso,
    })
  }
  const received = points.reduce((s, p) => s + p.revenue, 0)
  return {
    points,
    received,
    due: store.payments.reduce((s, p) => s + Math.max(0, p.balance), 0),
    expected: received + store.payments.reduce((s, p) => s + Math.max(0, p.balance), 0),
  }
}

function rangeStart(range: string): Date {
  const now = new Date()
  if (range === 'today') return startOfToday()
  if (range === '7d') return new Date(now.getTime() - 6 * 86_400_000)
  return new Date(now.getTime() - 29 * 86_400_000)
}

export function useRevenue(range: string) {
  return useQuery({
    queryKey: queryKeys.revenue(range),
    staleTime: freshness.revenue,
    queryFn: () =>
      withFallback<RevenueShape>(
        async () => {
          // No staff-visible trend endpoint exists server-side; aggregate
          // real receipts by day from the canonical payments list.
          const payPage = await paymentsApi.list({ page_size: 500 }).then((r) => r.data)
          const rows = itemsOf<RawRecord>(payPage)
          const start = rangeStart(range)
          const end = new Date()
          const byDay = new Map<string, number>()
          for (const p of rows) {
            if (str(p.status) === 'refunded' || str(p.status) === 'cancelled') continue
            const at = paidAtOf(p)
            if (!at) continue
            const d = new Date(at)
            if (d >= start && d <= end) {
              const k = d.toISOString().slice(0, 10)
              byDay.set(k, (byDay.get(k) ?? 0) + amountOf(p))
            }
          }
          const points: RevenueShape['points'] = []
          for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
            const d = new Date(t)
            const iso = d.toISOString().slice(0, 10)
            points.push({
              day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
              revenue: byDay.get(iso) ?? 0,
              date: iso,
            })
          }
          const received = points.reduce((s, p) => s + p.revenue, 0)
          const due = rows
            .filter((p) => str(p.status) !== 'paid' && str(p.status) !== 'refunded' && str(p.status) !== 'cancelled')
            .reduce((s, p) => s + amountOf(p), 0)
          return { points, received, due, expected: received + due }
        },
        () => tick(mockRevenue(range)),
      ),
  })
}

/**
 * Members are the canonical person entity. The Customers surface reads the
 * member directory (adapted to Customer rows) so walk-in admissions and
 * converted leads are visible in one place.
 */
export function useMembersRaw() {
  return useQuery({
    queryKey: queryKeys.members,
    staleTime: freshness.customers,
    queryFn: () =>
      withFallback<RawRecord[]>(
        () => membersApi.list({ page_size: 200 }).then((r) => itemsOf<RawRecord>(r.data)),
        () => tick([]),
      ),
  })
}

export function useCustomers() {
  // Warm the member directory cache so name joins resolve quickly.
  useMembersRaw()
  return useQuery({
    queryKey: queryKeys.customers,
    staleTime: freshness.customers,
    queryFn: () =>
      withFallback<Customer[]>(
        async () => {
          const [memberPage, customerPage, membershipPage] = await Promise.all([
            membersApi.list({ page_size: 200 }).then((r) => r.data),
            customersApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
            membershipsApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
          ])
          // Latest membership per member -> real expiry/plan/status.
          const latestByMember = new Map<string, RawRecord>()
          if (membershipPage) {
            for (const m of itemsOf<RawRecord>(membershipPage)) {
              const key = str(m.member_id)
              if (!key) continue
              const prev = latestByMember.get(key)
              if (!prev || str(m.end_date) > str(prev.end_date)) latestByMember.set(key, m)
            }
          }
          const rows = itemsOf<RawRecord>(memberPage).map((raw) => {
            const row = adaptMemberToCustomer(raw)
            const membership = latestByMember.get(str(raw.id))
            if (membership) {
              const end = str(membership.end_date)
              row.expires_at = end
              const snapshot = str(membership.plan_name_snapshot).toLowerCase()
              const plans = ['monthly', 'quarterly', 'half-yearly', 'yearly'] as const
              const match = plans.find((p) => snapshot.includes(p))
              if (match) row.plan = match
              if (str(membership.status) === 'expired' || (end && new Date(end) < startOfToday())) {
                row.status = 'expired'
              } else if (end) {
                const days = Math.round((new Date(end).getTime() - startOfToday().getTime()) / 86_400_000)
                row.status = days <= 7 ? 'expiring' : 'active'
              }
            }
            return row
          })
          if (customerPage) {
            for (const c of itemsOf<RawRecord>(customerPage)) {
              const contact = (c.contact ?? {}) as RawRecord
              rows.push({
                customer_id: str(c.id),
                business_id: str(c.business_id),
                full_name: str(contact.display_name, 'Customer'),
                phone: str(contact.phone),
                email: str(contact.email) || undefined,
                notes: str(c.notes) || undefined,
                joined_at: str(c.customer_since ?? c.created_at),
                status: 'active',
                plan: 'monthly',
                expires_at: '',
              })
            }
          }
          return rows
        },
        () => tick([...store.customers]),
      ),
  })
}

export interface CustomerProfile {
  customer: Customer
  memberships: Membership[]
  payments: Payment[]
  renewals: Renewal[]
  activities: Activity[]
  memberId: string | null
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? 'none'),
    staleTime: freshness.customer,
    enabled: Boolean(id),
    queryFn: () => fetchCustomer(id as string),
  })
}

/** Shared fetch so search/command palette can prefetch without waterfalls. */
export function fetchCustomer(id: string): Promise<CustomerProfile> {
  return withFallback<CustomerProfile>(
    async () => {
      // Member profile first (walk-in admissions live here).
      try {
        const profile = (await membersApi.profile(id)) as {
          member: RawRecord
          memberships: RawRecord[]
          payments: RawRecord[]
          attendance: RawRecord[]
          renewals: RawRecord[]
        }
        const customer = adaptMemberToCustomer(profile.member)
        const nameOf = (mid: unknown) =>
          str(mid) === customer.customer_id ? customer.full_name : 'Member'
        return {
          customer,
          memberId: customer.customer_id,
          memberships: (profile.memberships ?? []).map((m) =>
            adaptMembership(m, nameOf(m.member_id), customer.phone),
          ),
          payments: (profile.payments ?? []).map((p) => adaptPayment(p, nameOf(p.member_id))),
          renewals: (profile.renewals ?? []).map((r) =>
            adaptRenewal(r, nameOf(r.member_id), customer.phone),
          ),
          activities: (profile.attendance ?? []).map((a) => ({
            activity_id: str(a.id),
            business_id: customer.business_id,
            actor: 'System',
            action: str(a.checked_out_at ? 'Checked out' : 'Checked in', 'Visit'),
            detail: str(a.notes),
            created_at: str(a.checked_in_at ?? a.created_at),
            kind: 'membership' as const,
          })),
        }
      } catch {
        // Otherwise a converted customer (contact-backed).
        const c = (await customersApi.get(id)) as RawRecord
        const contact = (c.contact ?? {}) as RawRecord
        const customer: Customer = {
          customer_id: str(c.id),
          business_id: str(c.business_id),
          full_name: str(contact.display_name, 'Customer'),
          phone: str(contact.phone),
          email: str(contact.email) || undefined,
          notes: str(c.notes) || undefined,
          joined_at: str(c.customer_since ?? c.created_at),
          status: 'active',
          plan: 'monthly',
          expires_at: '',
        }
        return { customer, memberId: null, memberships: [], payments: [], renewals: [], activities: [] }
      }
    },
    () => {
      const c = store.customers.find((x) => x.customer_id === id)
      if (!c) throw new Error('Customer not found')
      return tick({
        customer: c,
        memberId: null,
        memberships: store.memberships.filter((m) => m.customer_id === id),
        payments: store.payments.filter((p) => p.customer_id === id),
        renewals: store.renewals.filter((r) => r.customer_id === id),
        activities: store.activities.filter((a) => a.customer_id === id),
      })
    },
  )
}

export function useMemberships() {
  const membersMap = useMembersMap()
  return useQuery({
    queryKey: [...queryKeys.memberships, 'members', membersMap.size],
    staleTime: freshness.memberships,
    queryFn: () =>
      withFallback<Membership[]>(
        async () => {
          const page = await membershipsApi.list({ page_size: 200 }).then((r) => r.data)
          return itemsOf<RawRecord>(page).map((m) => {
            const who = membersMap.get(str(m.member_id)) ?? { name: '', phone: '' }
            return adaptMembership(m, who.name, who.phone)
          })
        },
        () => tick([...store.memberships]),
      ),
  })
}

export function useRenewals() {
  const membersMap = useMembersMap()
  const plans = usePlans()
  return useQuery({
    queryKey: [...queryKeys.renewals, 'members', membersMap.size, 'plans', (plans.data ?? []).length],
    staleTime: freshness.renewals,
    queryFn: () =>
      withFallback<Renewal[]>(
        async () => {
          const page = await renewalsApi.list({ page_size: 200 }).then((r) => r.data)
          const planName = new Map<string, string>()
          for (const p of plans.data ?? []) planName.set(str(p.id), str(p.name))
          return itemsOf<RawRecord>(page).map((r) => {
            const who = membersMap.get(str(r.member_id)) ?? { name: '', phone: '' }
            const name =
              planName.get(str(r.new_plan_id)) ?? planName.get(str(r.previous_plan_id))
            return adaptRenewal(r, who.name, who.phone, name)
          })
        },
        () => tick([...store.renewals]),
      ),
  })
}

/** Canonical renewal confirmation (pending/confirmed/expired/cancelled). */
export function useConfirmRenewal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      withFallback(() => renewalsApi.setStatus(id, status), async () => {
        throw new Error('Renewals require the FastAPI backend')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })
}

export function usePayments() {
  const membersMap = useMembersMap()
  return useQuery({
    queryKey: [...queryKeys.payments, 'members', membersMap.size],
    staleTime: freshness.payments,
    queryFn: () =>
      withFallback<Payment[]>(
        async () => {
          const page = await paymentsApi.list({ page_size: 200 }).then((r) => r.data)
          return itemsOf<RawRecord>(page).map((p) => {
            const who = membersMap.get(str(p.member_id)) ?? { name: '', phone: '' }
            return adaptPayment(p, who.name)
          })
        },
        () => tick([...store.payments]),
      ),
  })
}

export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activities,
    staleTime: freshness.activities,
    queryFn: () =>
      withFallback<Activity[]>(
        () =>
          activitiesApi
            .list({ page_size: 12 })
            .then((r) => itemsOf<RawRecord>(r.data).map(adaptAuditEvent)),
        () => tick([...store.activities].slice(0, 8)),
      ),
  })
}

export function useOps() {
  return useQuery({
    queryKey: [...queryKeys.dashboard, 'ops'],
    staleTime: freshness.dashboard,
    queryFn: () =>
      withFallback(
        async () => {
          const [overview, payPage, taskPage, renewalPage, memberPage] = await Promise.all([
            analyticsApi.overview() as Promise<OverviewShape>,
            paymentsApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
            tasksApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
            renewalsApi.list({ page_size: 200 }).then((r) => r.data).catch(() => null),
            membersApi.list({ page_size: 1 }).then((r) => r.data).catch(() => null),
          ])
          const payments = payPage ? itemsOf<RawRecord>(payPage) : []
          const tasks = taskPage ? itemsOf<RawRecord>(taskPage) : []
          const renewals = renewalPage ? itemsOf<RawRecord>(renewalPage) : []
          const membersTotal =
            memberPage && typeof (memberPage as { total?: number }).total === 'number'
              ? (memberPage as { total: number }).total
              : 0
          return {
            admissionsToday: membersTotal,
            renewalsToday: renewals.filter((r) => str(r.status) !== 'cancelled').length,
            expired: renewals.filter((r) => str(r.status) === 'expired').length,
            pendingPayments: payments.filter((p) => str(p.status) !== 'paid').length,
            bookingsToday: num(overview?.bookings?.created_today),
            followUps: num(overview?.leads?.new),
            tasksOverdue: tasks.filter((t) => {
              const due = str(t.due_at)
              return due !== '' && new Date(due) < new Date() && str(t.status) !== 'completed'
            }).length,
            tasks: tasks.filter((t) => str(t.status) !== 'completed').length,
          }
        },
        () => {
          const now = new Date()
          const todayIso = now.toISOString().slice(0, 10)
          return tick({
            admissionsToday: store.customers.filter((c) => c.joined_at >= todayIso).length,
            renewalsToday: store.renewals.filter((r) => r.status === 'due-today').length,
            expired: store.renewals.filter((r) => r.status === 'overdue').length,
            pendingPayments: store.payments.filter((p) => p.status !== 'paid').length,
            bookingsToday: store.bookings.filter((b) =>
              b.starts_at.slice(0, 10) === todayIso && b.status !== 'cancelled',
            ).length,
            followUps: store.leads.filter(
              (l) => l.stage === 'follow-up' || l.stage === 'new',
            ).length,
          })
        },
      ),
  })
}

function toAdmissionPayload(input: AdmissionInput): Record<string, unknown> {
  return {
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
  }
}

export function useCreateAdmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdmissionInput) =>
      withFallback(
        () => admissionsApi.create(toAdmissionPayload(input)),
        () => createAdmission(input),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customers })
      qc.invalidateQueries({ queryKey: queryKeys.members })
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export interface RenewMembershipInput extends RenewInput {
  /** Canonical membership UUID (preferred) or legacy customer/member id. */
  membership_id?: string
  customer_id: string
}

export function useRenewMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RenewMembershipInput) =>
      withFallback(
        async () => {
          // Resolve the membership to renew: explicit id wins, otherwise the
          // member's active membership, otherwise any membership linked by
          // the legacy customer id.
          let membershipId = input.membership_id
          if (!membershipId) {
            const page = await membershipsApi.list({ page_size: 200 }).then((r) => r.data)
            const rows = itemsOf<RawRecord>(page)
            const match =
              rows.find(
                (m) =>
                  str(m.member_id) === input.customer_id &&
                  (str(m.status) === 'active' || str(m.status) === 'pending'),
              ) ??
              rows.find(
                (m) => str(m.member_id) === input.customer_id || str(m.customer_id) === input.customer_id,
              )
            if (!match) throw new Error('No membership found to renew.')
            membershipId = str(match.id)
          }
          return membershipsApi.renew(membershipId, {
            start_date: new Date(input.start_at).toISOString().slice(0, 10),
            notes: `Renewed from staff dashboard (plan ${input.plan}).`,
          })
        },
        () => renewMembership(input),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.customers })
      qc.invalidateQueries({ queryKey: queryKeys.members })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
      qc.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentInput) =>
      withFallback(
        () =>
          paymentsApi.record({
            amount: (input as unknown as Record<string, unknown>).paid ??
              (input as unknown as Record<string, unknown>).amount,
            method: (input as unknown as Record<string, unknown>).method ?? 'other',
            notes: (input as unknown as Record<string, unknown>).notes ?? '',
            customer_id: (input as unknown as Record<string, unknown>).customer_id,
            membership_id: (input as unknown as Record<string, unknown>).membership_id,
            member_id: (input as unknown as Record<string, unknown>).member_id ??
              (input as unknown as Record<string, unknown>).customer_id,
          }),
        () => recordPayment(input),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useAddCustomerNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      withFallback(
        async () => {
          // Member notes are the canonical store (MemberUpdate supports notes).
          const current = (await membersApi.get(id)) as RawRecord
          const prev = str(current.notes)
          const next = prev ? `${prev}\n${note}` : note
          return membersApi.update(id, { notes: next.slice(0, 2000) })
        },
        async () => {
          const { addCustomerNote } = await import('@/mock/business-service')
          return addCustomerNote(id, note)
        },
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.customer(v.id) })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

/* ---------------- Leads ---------------- */

export function useLeads() {
  return useQuery({
    queryKey: queryKeys.leads,
    staleTime: freshness.leads,
    queryFn: () =>
      withFallback<Lead[]>(
        () =>
          leadsApi
            .list({ page_size: 200 })
            .then((r) => itemsOf<RawRecord>(r.data).map(adaptLead)),
        () => tick([...store.leads]),
      ),
  })
}

export interface LeadDetail {
  lead: Lead
  activities: Activity[]
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lead(id ?? 'none'),
    staleTime: freshness.leads,
    enabled: Boolean(id),
    queryFn: (): Promise<LeadDetail> =>
      withFallback(
        async () => {
          const raw = (await leadsApi.get(id as string)) as RawRecord
          const toActivity = (a: RawRecord): Activity => ({
            activity_id: str(a.id),
            business_id: '',
            actor: 'System',
            action: str(a.activity_type, 'note'),
            detail: str(a.note),
            created_at: str(a.created_at),
            kind: 'lead' as const,
          })
          const activities: Activity[] = await leadsApi
            .activities(id as string)
            .then((page: { items?: RawRecord[] }) => {
              const rows = Array.isArray(page?.items) ? page.items : []
              return rows.map(toActivity)
            })
            .catch(() => [] as Activity[])
          return { lead: adaptLead(raw), activities }
        },
        () => {
          const lead = store.leads.find((l) => l.lead_id === id)
          if (!lead) throw new Error('Lead not found')
          return tick({
            lead,
            activities: store.activities.filter((a) => a.detail?.includes(lead.full_name)),
          })
        },
      ),
  })
}

function invalidateLead(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.leads })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard })
  qc.invalidateQueries({ queryKey: queryKeys.activities })
  qc.invalidateQueries({ queryKey: queryKeys.notifications })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LeadInput) =>
      withFallback(
        () => leadsApi.create(input as unknown as Record<string, unknown>),
        () => createLead(input),
      ),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useUpdateLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) =>
      withFallback(
        async () => {
          // 'converted' materializes a customer via the convert endpoint.
          if (stage === 'converted') {
            return leadsApi.convert(id, {
              customer_notes: 'Converted from staff dashboard pipeline.',
            })
          }
          const status = leadStatusToBackend(stage)
          const payload: { status: string; lost_reason?: string; note?: string } = { status }
          if (stage === 'lost') {
            payload.lost_reason = 'Marked LOST from staff dashboard pipeline.'
          }
          try {
            return await leadsApi.setStatus(id, payload)
          } catch (err) {
            // Already in the target state (or equivalent): treat as success so
            // the pipeline stays usable when UI/backend vocabs overlap.
            if (isApiError(err) && (err.status === 409 || err.status === 422)) {
              return leadsApi.get(id)
            }
            throw err
          }
        },
        () => updateLeadStage(id, stage),
      ),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateLead>[1] }) =>
      withFallback(
        () => leadsApi.update(id, patch as unknown as Record<string, unknown>),
        () => updateLead(id, patch),
      ),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useScheduleFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      withFallback(
        () => leadsApi.update(id, { follow_up_at: date }),
        () => scheduleLeadFollowUp(id, date),
      ),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useAddLeadNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      withFallback(
        () => leadsApi.addNote(id, note),
        async () => {
          const { addLeadNote } = await import('@/mock/business-service')
          return addLeadNote(id, note)
        },
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.lead(v.id) })
      invalidateLead(qc)
    },
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof convertLead>[0]) =>
      withFallback(
        () =>
          leadsApi.convert(input.lead_id, {
            customer_notes: `Plan ${input.plan}, start ${input.start_at}, amount ${input.amount}, paid ${input.paid}, method ${input.method}.`,
          }),
        () => convertLead(input),
      ),
    onSuccess: () => {
      invalidateLead(qc)
      qc.invalidateQueries({ queryKey: queryKeys.customers })
      qc.invalidateQueries({ queryKey: queryKeys.members })
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
    },
  })
}

/* ---------------- Bookings ---------------- */

export function useBookings() {
  return useQuery({
    queryKey: queryKeys.bookings,
    staleTime: freshness.bookings,
    queryFn: () =>
      withFallback<Booking[]>(
        () =>
          bookingsApi
            .list({ page_size: 200 })
            .then((r) => itemsOf<RawRecord>(r.data).map(adaptBooking)),
        () => tick([...store.bookings]),
      ),
  })
}

function invalidateBooking(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.bookings })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard })
  qc.invalidateQueries({ queryKey: queryKeys.activities })
  qc.invalidateQueries({ queryKey: queryKeys.notifications })
}

function toBookingPayload(input: BookingInput): Record<string, unknown> {
  const date = input.date.includes('T') ? input.date.slice(0, 10) : input.date
  return {
    title: input.title,
    booking_type: input.service,
    display_name: input.customer_name,
    phone: input.customer_phone,
    requested_start_at: `${date}T${input.start_time}:00`,
    requested_end_at: `${date}T${input.end_time}:00`,
    notes: input.notes,
    source: 'walk_in',
  }
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, allowOverlap }: { input: BookingInput; allowOverlap?: boolean }) =>
      withFallback(
        () => bookingsApi.create(toBookingPayload(input)),
        () => createBooking(input, { allowOverlap }),
      ),
    onSuccess: () => invalidateBooking(qc),
  })
}

export function useUpdateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
      allowOverlap,
    }: {
      id: string
      patch: Parameters<typeof updateBooking>[1]
      allowOverlap?: boolean
    }) =>
      withFallback(
        () => bookingsApi.update(id, patch as unknown as Record<string, unknown>),
        () => updateBooking(id, patch, { allowOverlap }),
      ),
    onSuccess: () => invalidateBooking(qc),
  })
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      withFallback(
        async () => {
          // Canonical lifecycle transitions (server enforces valid moves).
          switch (status) {
            case 'confirmed':
              return bookingsApi.confirm(id)
            case 'cancelled':
              return bookingsApi.cancel(id)
            case 'completed':
              return bookingsApi.complete(id)
            case 'no-show':
              return bookingsApi.noShow(id)
            default:
              return bookingsApi.reopen(id)
          }
        },
        () => updateBookingStatus(id, status),
      ),
    onSuccess: () => invalidateBooking(qc),
  })
}

/* ---------------- Tasks ---------------- */

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    staleTime: freshness.tasks,
    queryFn: () =>
      withFallback<Task[]>(
        () =>
          tasksApi
            .list({ page_size: 200 })
            .then((r) => itemsOf<RawRecord>(r.data).map(adaptBackendTask).map(adaptTask)),
        () => tick([...store.tasks]),
      ),
  })
}

function invalidateTask(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.tasks })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard })
  qc.invalidateQueries({ queryKey: queryKeys.activities })
  qc.invalidateQueries({ queryKey: queryKeys.notifications })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) =>
      withFallback(
        () =>
          tasksApi.create({
            title: input.title,
            description: input.notes,
            priority: input.priority,
            due_at: input.due_at,
          }),
        () => createTask(input),
      ),
    onSuccess: () => invalidateTask(qc),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTask>[1] }) =>
      withFallback(
        async () => {
          const p = patch as unknown as Record<string, unknown>
          // Lifecycle state travels via the status endpoint, never PATCH.
          if (typeof p.status === 'string') {
            return tasksApi.setStatus(id, taskStatusToBackend(p.status))
          }
          return tasksApi.update(id, p)
        },
        () => updateTask(id, patch),
      ),
    onSuccess: () => invalidateTask(qc),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(() => tasksApi.complete(id), () => completeTask(id)),
    onSuccess: () => invalidateTask(qc),
  })
}

export function useArchiveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(() => tasksApi.setStatus(id, 'cancelled'), () => archiveTask(id)),
    onSuccess: () => invalidateTask(qc),
  })
}

/* ---------------- Notifications ---------------- */

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    staleTime: freshness.notifications,
    queryFn: () =>
      withFallback<NotificationItem[]>(
        () =>
          notificationsApi
            .list({ page_size: 50 })
            .then((r) => itemsOf<RawRecord>(r.data).map(adaptBackendNotification).map(adaptNotification)),
        () => tick([...store.notifications]),
      ),
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(() => notificationsApi.markRead(id), () => markNotificationRead(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withFallback(() => notificationsApi.markAllRead(), () => markAllNotificationsRead()),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(() => notificationsApi.dismiss(id), () => dismissNotification(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

/* ---------------- Staff & settings ---------------- */

export function useStaff() {
  return useQuery({
    queryKey: queryKeys.staff,
    staleTime: freshness.staff,
    queryFn: () =>
      withFallback(
        () =>
          staffApi
            .list({ page: 1, page_size: 100 })
            .then((r) => itemsOf<StaffMember>(r.data)),
        () => tick([...store.staff]),
      ),
  })
}

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof createStaff>[0]) =>
      withFallback(() => staffApi.invite(input), () => createStaff(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useUpdateStaffRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) =>
      withFallback(() => staffApi.updateRole(id, { role }), () => updateStaffRole(id, role)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useUpdateStaffStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffStatus }) =>
      withFallback(() => staffApi.updateStatus(id, { status }), () => updateStaffStatus(id, status)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    staleTime: freshness.settings,
    queryFn: () =>
      withFallback(
        () => settingsApi.get(),
        () => tick({ ...store.settings }),
      ),
  })
}

/** Business timezone comes from persisted settings, defaulting to Asia/Kolkata. */
export function useBusinessTimezone(): string {
  const { data } = useSettings()
  const tz = (data as { timezone?: string } | undefined)?.timezone
  return tz || 'Asia/Kolkata'
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateSettings>[0]) =>
      withFallback(() => settingsApi.update(patch), () => updateSettings(patch)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }),
  })
}

/* ---------------- Server-side global search ---------------- */

export interface GlobalSearchResults {
  customers: { id: string; name: string; phone?: string }[]
  leads: { id: string; name: string; stage?: string }[]
  bookings: { id: string; title: string; starts_at?: string }[]
  tasks: { id: string; title: string; status?: string }[]
}

export function useGlobalSearch(query: string, limit = 8) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['search', query, limit],
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
    queryFn: (): Promise<GlobalSearchResults> =>
      withFallback(
        async () => {
          // No backend global-search endpoint exists; filter the already-cached
          // canonical lists client-side (real data, no extra requests).
          const q = query.trim().toLowerCase()
          const hit = (v: string | undefined) => (v ?? '').toLowerCase().includes(q)
          const customers =
            qc.getQueryData<Customer[]>(queryKeys.customers) ??
            qc.getQueryData<RawRecord[]>(queryKeys.members)?.map(adaptMemberToCustomer) ??
            []
          const leads = qc.getQueryData<Lead[]>(queryKeys.leads) ?? []
          const bookings = qc.getQueryData<Booking[]>(queryKeys.bookings) ?? []
          const tasks = qc.getQueryData<Task[]>(queryKeys.tasks) ?? []
          return {
            customers: customers
              .filter((c) => hit(c.full_name) || hit(c.phone))
              .slice(0, limit)
              .map((c) => ({ id: c.customer_id, name: c.full_name, phone: c.phone })),
            leads: leads
              .filter((l) => hit(l.full_name) || hit(l.phone))
              .slice(0, limit)
              .map((l) => ({ id: l.lead_id, name: l.full_name, stage: l.stage })),
            bookings: bookings
              .filter((b) => hit(b.title) || hit(b.customer_name))
              .slice(0, limit)
              .map((b) => ({ id: b.booking_id, title: b.title, starts_at: b.starts_at })),
            tasks: tasks
              .filter((t) => hit(t.title))
              .slice(0, limit)
              .map((t) => ({ id: t.task_id, title: t.title, status: t.status })),
          }
        },
        () => {
          const hit = (v: string | undefined) =>
            (v ?? '').toLowerCase().includes(query.trim().toLowerCase())
          return tick({
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
        },
      ),
  })
}

/* ---------------- Realtime (inert until a backend event stream ships) ---------------- */

/**
 * Realtime event subscription.
 *
 * The canonical backend exposes no SSE endpoint, so this hook is deliberately
 * inert: it performs no requests (and logs no console errors) while keeping
 * the call-site contract. Freshness comes from query staleTime/refetch
 * configuration. Re-enable when a backend event stream ships.
 */
export function useRealtimeEvents(_enabled = true) {
  return useQuery({
    queryKey: ['realtime', 'subscription'],
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () => tick(null),
  })
}

/* ---------------- Jobs ---------------- */

export function useRenewalCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withFallback(
        () => apiClient.post('/jobs/renewal-check').then((r) => r.data),
        async () => ({ created: 0, skipped: 0 }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })
}

export { jobsApi }

export type { TaskStatus }
