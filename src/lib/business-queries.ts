import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { freshness } from '@/app/query-client'
import {
  API_MOCK_FALLBACK_ENABLED,
  apiClient,
  isApiError,
  type PageResponse,
} from '@/api/client'
import {
  activitiesApi,
  admissionsApi,
  analyticsApi,
  bookingsApi,
  customersApi,
  jobsApi,
  leadsApi,
  membershipsApi,
  notificationsApi,
  paymentsApi,
  renewalsApi,
  searchApi,
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
  markContacted,
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

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    staleTime: freshness.dashboard,
    queryFn: () =>
      withFallback<DashboardShape>(
        async () => {
          const o = (await analyticsApi.overview()) as {
            revenue_today: number
            customers_total: number
            leads_new: number
            renewals_due_7d: number
            revenue_month: number
          }
          const pay = await paymentsApi
            .list({ page: 1, page_size: 100 })
            .then((r) => r.data)
            .catch(() => ({ items: [], total: 0, page: 1, page_size: 100 }))
          const rows = itemsOf<Payment>(pay)
          const received = rows
            .filter((p) => p.status === 'paid')
            .reduce((s, p) => s + p.paid, 0)
          const due = rows.reduce((s, p) => s + Math.max(0, p.balance), 0)
          return {
            todayRevenue: o.revenue_today,
            totalMembers: o.customers_total,
            newLeads: o.leads_new,
            expiringSoon: o.renewals_due_7d,
            received,
            due,
            expected: received + due,
          }
        },
        () => tick(mockDashboard()),
      ),
  })
}

type RevenueRange = 'today' | '7d' | '30d' | string

function presetFor(range: RevenueRange): string {
  if (range === 'today') return 'today'
  if (range === '7d') return 'last-7'
  return 'last-30'
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

export function useRevenue(range: string) {
  return useQuery({
    queryKey: queryKeys.revenue(range),
    staleTime: freshness.revenue,
    queryFn: () =>
      withFallback<RevenueShape>(
        async () => {
          const body = (await analyticsApi.revenue({ preset: presetFor(range) })) as {
            summary: { received: number; due: number; expected: number }
            trend: { key: string; label: string; revenue: number }[]
          }
          return {
            points: body.trend.map((t) => ({ day: t.label, revenue: t.revenue, date: t.key })),
            received: body.summary.received,
            due: body.summary.due,
            expected: body.summary.expected,
          }
        },
        () => tick(mockRevenue(range)),
      ),
  })
}

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers,
    staleTime: freshness.customers,
    queryFn: () =>
      withFallback<Customer[]>(
        () =>
          customersApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Customer>(r.data)),
        () => tick([...store.customers]),
      ),
  })
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
export function fetchCustomer(id: string) {
  return withFallback(
    () =>
      customersApi.get(id) as Promise<{
        customer: Customer
        memberships: Membership[]
        payments: Payment[]
        renewals: Renewal[]
        activities: Activity[]
      }>,
    () => {
      const c = store.customers.find((x) => x.customer_id === id)
      if (!c) throw new Error('Customer not found')
      return tick({
        customer: c,
        memberships: store.memberships.filter((m) => m.customer_id === id),
        payments: store.payments.filter((p) => p.customer_id === id),
        renewals: store.renewals.filter((r) => r.customer_id === id),
        activities: store.activities.filter((a) => a.customer_id === id),
      })
    },
  )
}

export function useMemberships() {
  return useQuery({
    queryKey: queryKeys.memberships,
    staleTime: freshness.memberships,
    queryFn: () =>
      withFallback<Membership[]>(
        () =>
          membershipsApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Membership>(r.data)),
        () => tick([...store.memberships]),
      ),
  })
}

export function useRenewals() {
  return useQuery({
    queryKey: queryKeys.renewals,
    staleTime: freshness.renewals,
    queryFn: () =>
      withFallback<Renewal[]>(
        () => renewalsApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Renewal>(r.data)),
        () => tick([...store.renewals]),
      ),
  })
}

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments,
    staleTime: freshness.payments,
    queryFn: () =>
      withFallback<Payment[]>(
        () => paymentsApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Payment>(r.data)),
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
          activitiesApi.list({ page: 1, page_size: 8 }).then((r) => itemsOf<Activity>(r.data)),
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
          const o = (await analyticsApi.overview()) as {
            customers_total: number
            renewals_due_7d: number
            bookings_today: number
            tasks_overdue: number
            leads_new: number
          }
          const [pay, tasks] = await Promise.all([
            paymentsApi.list({ page: 1, page_size: 100 }).then((r) => r.data).catch(() => null),
            tasksApi.list({ page: 1, page_size: 100 }).then((r) => r.data).catch(() => null),
          ])
          const payments = pay ? itemsOf<Payment>(pay) : []
          return {
            admissionsToday: o.customers_total,
            renewalsToday: o.renewals_due_7d,
            expired: 0,
            pendingPayments: payments.filter((p) => p.status !== 'paid').length,
            bookingsToday: o.bookings_today,
            followUps: o.leads_new,
            tasksOverdue: o.tasks_overdue,
            tasks: tasks ? itemsOf<Task>(tasks).length : 0,
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

function toAdmissionPayload(input: AdmissionInput) {
  return {
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    plan: input.plan,
    start_at: new Date(input.start_at).toISOString(),
    amount: input.amount,
    paid: input.paid,
    method: input.method,
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
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useRenewMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RenewInput & { customer_id: string }) =>
      withFallback(
        () =>
          customersApi.renew(input.customer_id, {
            plan: input.plan,
            start_at: new Date(input.start_at).toISOString(),
            amount: input.amount,
            paid: input.paid,
            method: input.method,
          }),
        () => renewMembership(input),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.customers })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentInput) =>
      withFallback(() => paymentsApi.record(input), () => recordPayment(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments })
      qc.invalidateQueries({ queryKey: queryKeys.memberships })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useMarkContacted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(() => renewalsApi.markContacted(id), () => markContacted(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.renewals })
      qc.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useAddCustomerNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      withFallback(
        () => customersApi.addNote(id, note),
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
        () => leadsApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Lead>(r.data)),
        () => tick([...store.leads]),
      ),
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lead(id ?? 'none'),
    staleTime: freshness.leads,
    enabled: Boolean(id),
    queryFn: () =>
      withFallback(
        () => leadsApi.get(id as string),
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
      withFallback(() => leadsApi.create(input), () => createLead(input)),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useUpdateLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) =>
      withFallback(() => leadsApi.update(id, { stage }), () => updateLeadStage(id, stage)),
    onSuccess: () => invalidateLead(qc),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateLead>[1] }) =>
      withFallback(() => leadsApi.update(id, patch), () => updateLead(id, patch)),
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
            plan: input.plan,
            start_at: new Date(input.start_at).toISOString(),
            amount: input.amount,
            paid: input.paid,
            method: input.method,
          }),
        () => convertLead(input),
      ),
    onSuccess: () => {
      invalidateLead(qc)
      qc.invalidateQueries({ queryKey: queryKeys.customers })
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
        () => bookingsApi.list({ page: 1, page_size: 100 }).then((r) => itemsOf<Booking>(r.data)),
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

function toBookingPayload(input: BookingInput) {
  const date = input.date.includes('T') ? input.date.slice(0, 10) : input.date
  return {
    title: input.title,
    service: input.service,
    customer_id: input.customer_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    staff: input.staff,
    starts_at: `${date}T${input.start_time}:00`,
    ends_at: `${date}T${input.end_time}:00`,
    notes: input.notes,
  }
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, allowOverlap }: { input: BookingInput; allowOverlap?: boolean }) =>
      withFallback(
        () => bookingsApi.create({ ...toBookingPayload(input), allow_overlap: allowOverlap }),
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
        () => bookingsApi.update(id, { ...patch, allow_overlap: allowOverlap }),
        () => updateBooking(id, patch, { allowOverlap }),
      ),
    onSuccess: () => invalidateBooking(qc),
  })
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      withFallback(() => bookingsApi.update(id, { status }), () => updateBookingStatus(id, status)),
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
            .list({ page: 1, page_size: 100 })
            .then((r) => itemsOf<Task>(r.data).map(adaptTask)),
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
      withFallback(() => tasksApi.create(input), () => createTask(input)),
    onSuccess: () => invalidateTask(qc),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTask>[1] }) =>
      withFallback(() => tasksApi.update(id, patch), () => updateTask(id, patch)),
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
      withFallback(() => tasksApi.update(id, { status: 'archived' }), () => archiveTask(id)),
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
            .list({ page: 1, page_size: 30 })
            .then((r) => itemsOf<NotificationItem>(r.data).map(adaptNotification)),
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
  return useQuery({
    queryKey: ['search', query, limit],
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
    queryFn: (): Promise<GlobalSearchResults> =>
      withFallback(
        () => searchApi.global(query.trim(), limit),
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

/* ---------------- Realtime (SSE with graceful fallback) ---------------- */

const EVENT_INVALIDATION: Record<string, string[][]> = {
  admission: [Array.from(queryKeys.customers), Array.from(queryKeys.dashboard)],
  payment: [Array.from(queryKeys.payments), Array.from(queryKeys.dashboard)],
  renewal: [Array.from(queryKeys.renewals), Array.from(queryKeys.dashboard)],
  lead: [Array.from(queryKeys.leads), Array.from(queryKeys.dashboard)],
  lead_updated: [Array.from(queryKeys.leads)],
  lead_converted: [
    Array.from(queryKeys.leads),
    Array.from(queryKeys.customers),
    Array.from(queryKeys.dashboard),
  ],
  booking: [Array.from(queryKeys.bookings), Array.from(queryKeys.dashboard)],
  booking_updated: [Array.from(queryKeys.bookings)],
  task: [Array.from(queryKeys.tasks)],
  task_updated: [Array.from(queryKeys.tasks)],
  notification: [Array.from(queryKeys.notifications)],
  note: [Array.from(queryKeys.activities)],
  settings: [Array.from(queryKeys.settings)],
  customer: [Array.from(queryKeys.customers)],
  whatsapp: [Array.from(queryKeys.notifications)],
  payment_refunded: [Array.from(queryKeys.payments), Array.from(queryKeys.dashboard)],
}

/** Subscribes to SSE realtime events; silently degrades to query refetching offline. */
export function useRealtimeEvents(enabled = true) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['realtime', 'subscription'],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () =>
      new Promise<never>((_resolve, reject) => {
        if (typeof EventSource === 'undefined') {
          reject(new Error('SSE unsupported'))
          return
        }
        try {
          const es = new EventSource(`${apiClient.defaults.baseURL}/realtime/events`, {
            withCredentials: true,
          })
          es.addEventListener('update', (ev) => {
            try {
              const data = JSON.parse((ev as MessageEvent).data) as { type?: string }
              const keys = (data.type && EVENT_INVALIDATION[data.type]) || [
                Array.from(queryKeys.dashboard),
              ]
              for (const k of keys) qc.invalidateQueries({ queryKey: k })
            } catch {
              // ignore malformed events
            }
          })
          es.onerror = () => {
            es.close()
            reject(new Error('SSE disconnected'))
          }
        } catch {
          reject(new Error('SSE unavailable'))
        }
      }),
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
