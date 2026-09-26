import { addMonths } from 'date-fns'
import type {
  BookingStatus,
  LeadStage,
  MembershipPlan,
  MembershipStatus,
  PaymentMethod,
  PaymentStatus,
  StaffRole,
  StaffStatus,
  TaskPriority,
  TaskStatus,
} from '@/types/domain'
import { store } from './business'

export interface AdmissionInput {
  full_name: string
  phone: string
  email?: string
  notes?: string
  plan: MembershipPlan
  start_at: string
  amount: number
  paid: number
  method: PaymentMethod
}

export interface RenewInput {
  customer_id: string
  plan: MembershipPlan
  start_at: string
  amount: number
  paid: number
  method: PaymentMethod
}

export interface PaymentInput {
  customer_id: string
  membership_id?: string
  amount: number
  paid: number
  method: PaymentMethod
}

function receiptNo() {
  const n = store.seq + 2000
  return `NL-2026-${String(n).slice(-4)}`
}

export async function createAdmission(input: AdmissionInput) {
  const customer_id = store.next('c')
  const membership_id = store.next('m')
  const start = new Date(input.start_at)
  const months =
    input.plan === 'yearly'
      ? 12
      : input.plan === 'half-yearly'
        ? 6
        : input.plan === 'quarterly'
          ? 3
          : 1
  const expires = input.plan === 'day-pass' ? start : addMonths(start, months)
  const balance = input.amount - input.paid
  const status: PaymentStatus = balance <= 0 ? 'paid' : input.paid > 0 ? 'partial' : 'pending'

  const customer = {
    customer_id,
    business_id: 'nest-library-001',
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    joined_at: input.start_at,
    status: 'active' as const,
    plan: input.plan,
    expires_at: expires.toISOString().slice(0, 10),
  }
  store.customers.unshift(customer)

  const membership = {
    membership_id,
    business_id: 'nest-library-001',
    customer_id,
    customer_name: input.full_name,
    customer_phone: input.phone,
    plan: input.plan,
    status: 'active' as const,
    start_at: input.start_at,
    expires_at: expires.toISOString().slice(0, 10),
    amount: input.amount,
    paid: input.paid,
    balance,
    payment_state: (balance <= 0 ? 'paid' : input.paid > 0 ? 'partial' : 'pending') as
      'paid' | 'partial' | 'pending',
  }
  store.memberships.unshift(membership)

  const payment = {
    payment_id: store.next('p'),
    business_id: 'nest-library-001',
    customer_id,
    customer_name: input.full_name,
    membership_id,
    plan: input.plan,
    amount: input.amount,
    paid: input.paid,
    balance,
    method: input.method,
    status,
    received_at: new Date().toISOString(),
    receipt_no: receiptNo(),
  }
  store.payments.unshift(payment)

  const renewal = {
    renewal_id: store.next('r'),
    business_id: 'nest-library-001',
    customer_id,
    customer_name: input.full_name,
    customer_phone: input.phone,
    plan: input.plan,
    due_at: expires.toISOString().slice(0, 10),
    amount: input.amount,
    paid: input.paid,
    balance,
    status: 'upcoming' as const,
    days_remaining: Math.round((expires.getTime() - Date.now()) / 86400000),
    contact_status: 'pending' as const,
  }
  store.renewals.unshift(renewal)

  store.log({
    actor: 'Priya (Front desk)',
    action: 'created admission',
    detail: `${input.full_name} — ${input.plan}`,
    kind: 'admission',
    customer_id,
    customer_name: input.full_name,
  })

  return { customer, membership, payment, renewal }
}

export async function renewMembership(input: RenewInput) {
  const customer = store.customers.find((c) => c.customer_id === input.customer_id)
  if (!customer) throw new Error('Customer not found')
  const start = new Date(input.start_at)
  const months =
    input.plan === 'yearly'
      ? 12
      : input.plan === 'half-yearly'
        ? 6
        : input.plan === 'quarterly'
          ? 3
          : 1
  const expires = input.plan === 'day-pass' ? start : addMonths(start, months)
  const balance = input.amount - input.paid
  const membership_id = store.next('m')
  const membership = {
    membership_id,
    business_id: 'nest-library-001',
    customer_id: customer.customer_id,
    customer_name: customer.full_name,
    customer_phone: customer.phone,
    plan: input.plan,
    status: 'active' as const,
    start_at: input.start_at,
    expires_at: expires.toISOString().slice(0, 10),
    amount: input.amount,
    paid: input.paid,
    balance,
    payment_state: (balance <= 0 ? 'paid' : input.paid > 0 ? 'partial' : 'pending') as
      'paid' | 'partial' | 'pending',
  }
  store.memberships.unshift(membership)
  customer.plan = input.plan
  customer.status = 'active'
  customer.expires_at = expires.toISOString().slice(0, 10)

  const payment = {
    payment_id: store.next('p'),
    business_id: 'nest-library-001',
    customer_id: customer.customer_id,
    customer_name: customer.full_name,
    membership_id,
    plan: input.plan,
    amount: input.amount,
    paid: input.paid,
    balance,
    method: input.method,
    status: (balance <= 0 ? 'paid' : input.paid > 0 ? 'partial' : 'pending') as PaymentStatus,
    received_at: new Date().toISOString(),
    receipt_no: receiptNo(),
  }
  store.payments.unshift(payment)

  const renewal = store.renewals.find((r) => r.customer_id === customer.customer_id)
  if (renewal) {
    renewal.contact_status = 'renewed'
    renewal.status = 'upcoming'
    renewal.due_at = expires.toISOString().slice(0, 10)
  }

  store.log({
    actor: 'Priya (Front desk)',
    action: 'renewed membership',
    detail: `${customer.full_name} — ${input.plan}`,
    kind: 'renewal',
    customer_id: customer.customer_id,
    customer_name: customer.full_name,
  })
  return { membership, payment, customer }
}

export async function recordPayment(input: PaymentInput) {
  const customer = store.customers.find((c) => c.customer_id === input.customer_id)
  const membership =
    store.memberships.find((m) => m.membership_id === input.membership_id) ??
    store.memberships.find((m) => m.customer_id === input.customer_id)
  const balance = input.amount - input.paid
  const payment = {
    payment_id: store.next('p'),
    business_id: 'nest-library-001',
    customer_id: input.customer_id,
    customer_name: customer?.full_name ?? 'Walk-in',
    membership_id: membership?.membership_id,
    plan: membership?.plan,
    amount: input.amount,
    paid: input.paid,
    balance,
    method: input.method,
    status: (balance <= 0 ? 'paid' : input.paid > 0 ? 'partial' : 'pending') as PaymentStatus,
    received_at: new Date().toISOString(),
    receipt_no: receiptNo(),
  }
  store.payments.unshift(payment)
  if (membership) {
    membership.paid += input.paid
    membership.balance = Math.max(0, membership.amount - membership.paid)
    membership.payment_state =
      membership.balance <= 0 ? 'paid' : membership.paid > 0 ? 'partial' : 'pending'
  }
  store.log({
    actor: 'Priya (Front desk)',
    action: 'recorded payment',
    detail: `Rs ${input.paid} from ${customer?.full_name ?? 'Walk-in'}`,
    kind: 'payment',
    customer_id: input.customer_id,
    customer_name: customer?.full_name,
  })
  return payment
}

export async function markContacted(renewal_id: string) {
  const r = store.renewals.find((x) => x.renewal_id === renewal_id)
  if (r) {
    r.contact_status = 'contacted'
    store.log({
      actor: 'Priya (Front desk)',
      action: 'marked contacted',
      detail: `${r.customer_name} — renewal follow-up`,
      kind: 'contact',
      customer_id: r.customer_id,
      customer_name: r.customer_name,
    })
  }
  return r
}

/* ---------------- Leads ---------------- */

export interface LeadInput {
  full_name: string
  phone: string
  email?: string
  source: string
  interested_plan?: MembershipPlan
  assigned_to?: string
  notes?: string
  follow_up_at?: string
}

export async function createLead(input: LeadInput) {
  const lead = {
    lead_id: store.next('l'),
    business_id: 'nest-library-001',
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    stage: 'new' as LeadStage,
    source: input.source,
    interested_plan: input.interested_plan,
    assigned_to: input.assigned_to ?? 'Priya Sharma',
    notes: input.notes,
    created_at: new Date().toISOString().slice(0, 10),
    follow_up_at: input.follow_up_at,
    last_activity: 'Lead created',
    last_activity_at: new Date().toISOString(),
  }
  store.leads.unshift(lead)
  store.log({
    actor: input.assigned_to ?? 'Front desk',
    action: 'added lead',
    detail: `${input.full_name} — ${input.source}`,
    kind: 'lead',
  })
  store.notify({
    title: `New lead: ${input.full_name}`,
    body: `${input.source} enquiry${input.follow_up_at ? ` · follow-up ${input.follow_up_at}` : ''}.`,
    kind: 'lead',
  })
  return lead
}

export async function updateLeadStage(lead_id: string, stage: LeadStage) {
  const lead = store.leads.find((l) => l.lead_id === lead_id)
  if (!lead) throw new Error('Lead not found')
  lead.stage = stage
  lead.updated_at = new Date().toISOString()
  lead.last_activity = `Moved to ${stage}`
  lead.last_activity_at = new Date().toISOString()
  store.log({
    actor: 'Front desk',
    action: `lead → ${stage}`,
    detail: `${lead.full_name}`,
    kind: 'lead',
  })
  return lead
}

export async function updateLead(
  lead_id: string,
  patch: Partial<LeadInput> & { stage?: LeadStage },
) {
  const lead = store.leads.find((l) => l.lead_id === lead_id)
  if (!lead) throw new Error('Lead not found')
  Object.assign(lead, {
    ...patch,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  })
  store.log({
    actor: 'Front desk',
    action: 'updated lead',
    detail: `${lead.full_name}`,
    kind: 'lead',
  })
  return lead
}

export async function addLeadNote(lead_id: string, note: string) {
  const lead = store.leads.find((l) => l.lead_id === lead_id)
  if (!lead) throw new Error('Lead not found')
  lead.notes = lead.notes ? `${lead.notes}\n${note}` : note
  lead.last_activity = 'Note added'
  lead.last_activity_at = new Date().toISOString()
  store.log({
    actor: 'Front desk',
    action: 'added note',
    detail: `${lead.full_name} — ${note.slice(0, 80)}`,
    kind: 'note',
  })
  return lead
}

export async function scheduleLeadFollowUp(lead_id: string, follow_up_at: string) {
  const lead = store.leads.find((l) => l.lead_id === lead_id)
  if (!lead) throw new Error('Lead not found')
  lead.follow_up_at = follow_up_at
  if (lead.stage === 'new' || lead.stage === 'contacted') lead.stage = 'follow-up'
  lead.last_activity = `Follow-up scheduled for ${follow_up_at}`
  lead.last_activity_at = new Date().toISOString()
  store.log({
    actor: 'Front desk',
    action: 'scheduled follow-up',
    detail: `${lead.full_name} — ${follow_up_at}`,
    kind: 'follow-up',
  })
  store.notify({
    title: `Follow-up: ${lead.full_name}`,
    body: `Scheduled for ${follow_up_at}.`,
    kind: 'lead',
    link: `/leads/${lead.lead_id}`,
  })
  return lead
}

/** Lead → Customer → Admission conversion. Prefills known info; creates customer + membership + payment + renewal + activity. */
export async function convertLead(input: {
  lead_id: string
  plan: MembershipPlan
  start_at: string
  amount: number
  paid: number
  method: PaymentMethod
}) {
  const lead = store.leads.find((l) => l.lead_id === input.lead_id)
  if (!lead) throw new Error('Lead not found')
  const result = await createAdmission({
    full_name: lead.full_name,
    phone: lead.phone,
    email: lead.email,
    notes: lead.notes
      ? `Converted from lead (${lead.source}). ${lead.notes}`
      : `Converted from lead (${lead.source}).`,
    plan: input.plan,
    start_at: input.start_at,
    amount: input.amount,
    paid: input.paid,
    method: input.method,
  })
  lead.stage = 'converted'
  lead.converted_customer_id = result.customer.customer_id
  lead.last_activity = 'Converted to customer'
  lead.last_activity_at = new Date().toISOString()
  store.log({
    actor: 'Front desk',
    action: 'converted lead',
    detail: `${lead.full_name} → ${result.customer.customer_id}`,
    kind: 'conversion',
    customer_id: result.customer.customer_id,
    customer_name: result.customer.full_name,
  })
  store.notify({
    title: `Lead converted: ${lead.full_name}`,
    body: `${input.plan} admission created.`,
    kind: 'lead',
    link: `/customers/${result.customer.customer_id}`,
    customer_id: result.customer.customer_id,
    customer_name: result.customer.full_name,
  })
  return { lead, ...result }
}

/* ---------------- Bookings ---------------- */

export interface BookingInput {
  title: string
  service?: string
  customer_id?: string
  customer_name: string
  customer_phone?: string
  staff?: string
  date: string // yyyy-mm-dd
  start_time: string // HH:mm
  end_time: string // HH:mm
  notes?: string
}

export interface BookingConflict {
  booking_id: string
  title: string
  starts_at: string
  ends_at: string
  staff?: string
}

/** Client-side pre-check for instant UX. The backend re-validates authoritatively. */
export function findBookingConflicts(input: {
  staff?: string
  starts_at: string
  ends_at: string
  ignore_id?: string
}): BookingConflict[] {
  if (!input.staff) return []
  const s = new Date(input.starts_at).getTime()
  const e = new Date(input.ends_at).getTime()
  return store.bookings
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        b.booking_id !== input.ignore_id &&
        (b.staff ?? '') === input.staff,
    )
    .filter((b) => {
      const bs = new Date(b.starts_at).getTime()
      const be = new Date(b.ends_at).getTime()
      return s < be && e > bs
    })
    .map((b) => ({
      booking_id: b.booking_id,
      title: b.title,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      staff: b.staff,
    }))
}

export async function createBooking(input: BookingInput, opts?: { allowOverlap?: boolean }) {
  const starts_at = `${input.date}T${input.start_time}:00`
  const ends_at = `${input.date}T${input.end_time}:00`
  if (new Date(ends_at) <= new Date(starts_at)) throw new Error('End time must be after start time')
  const conflicts = findBookingConflicts({ staff: input.staff, starts_at, ends_at })
  if (conflicts.length > 0 && !opts?.allowOverlap) {
    const err = new Error(
      `Staff member is already booked during this time (${conflicts[0].title}).`,
    )
    ;(err as Error & { conflicts?: BookingConflict[] }).conflicts = conflicts
    throw err
  }
  const booking = {
    booking_id: store.next('b'),
    business_id: 'nest-library-001',
    title: input.title,
    service: input.service,
    customer_id: input.customer_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    staff: input.staff,
    starts_at,
    ends_at,
    status: 'scheduled' as BookingStatus,
    notes: input.notes,
  }
  store.bookings.unshift(booking)
  store.log({
    actor: 'Front desk',
    action: 'created booking',
    detail: `${input.title} — ${input.customer_name}`,
    kind: 'booking',
  })
  store.notify({
    title: `Booking: ${input.title}`,
    body: `${input.customer_name} · ${input.date} ${input.start_time}–${input.end_time}.`,
    kind: 'booking',
    link: '/bookings',
  })
  return booking
}

export async function updateBookingStatus(booking_id: string, status: BookingStatus) {
  const b = store.bookings.find((x) => x.booking_id === booking_id)
  if (!b) throw new Error('Booking not found')
  b.status = status
  store.log({
    actor: 'Front desk',
    action: `booking → ${status}`,
    detail: `${b.title} — ${b.customer_name}`,
    kind: 'booking',
  })
  return b
}

export async function updateBooking(
  booking_id: string,
  patch: Partial<BookingInput>,
  opts?: { allowOverlap?: boolean },
) {
  const b = store.bookings.find((x) => x.booking_id === booking_id)
  if (!b) throw new Error('Booking not found')
  const date = patch.date ?? b.starts_at.slice(0, 10)
  const starts_at = `${date}T${patch.start_time ?? b.starts_at.slice(11, 16)}:00`
  const ends_at = `${date}T${patch.end_time ?? b.ends_at.slice(11, 16)}:00`
  const staff = patch.staff ?? b.staff
  const conflicts = findBookingConflicts({ staff, starts_at, ends_at, ignore_id: booking_id })
  if (conflicts.length > 0 && !opts?.allowOverlap) {
    const err = new Error(
      `Staff member is already booked during this time (${conflicts[0].title}).`,
    )
    ;(err as Error & { conflicts?: BookingConflict[] }).conflicts = conflicts
    throw err
  }
  Object.assign(b, {
    title: patch.title ?? b.title,
    service: patch.service ?? b.service,
    customer_id: patch.customer_id ?? b.customer_id,
    customer_name: patch.customer_name ?? b.customer_name,
    customer_phone: patch.customer_phone ?? b.customer_phone,
    staff,
    starts_at,
    ends_at,
    notes: patch.notes ?? b.notes,
  })
  store.log({
    actor: 'Front desk',
    action: 'updated booking',
    detail: `${b.title} — ${b.customer_name}`,
    kind: 'booking',
  })
  return b
}

/* ---------------- Tasks ---------------- */

export interface TaskInput {
  title: string
  assigned_to?: string
  customer_id?: string
  lead_id?: string
  priority?: TaskPriority
  due_at?: string
  notes?: string
}

export async function createTask(input: TaskInput) {
  const customer = input.customer_id
    ? store.customers.find((c) => c.customer_id === input.customer_id)
    : undefined
  const task = {
    task_id: store.next('t'),
    business_id: 'nest-library-001',
    title: input.title,
    assignee: input.assigned_to,
    assigned_to: input.assigned_to,
    customer_id: input.customer_id,
    customer_name: customer?.full_name,
    lead_id: input.lead_id,
    priority: input.priority ?? ('medium' as TaskPriority),
    status: 'open' as TaskStatus,
    due_at: input.due_at,
    notes: input.notes,
    created_at: new Date().toISOString(),
  }
  store.tasks.unshift(task)
  store.log({
    actor: input.assigned_to ?? 'Front desk',
    action: 'created task',
    detail: input.title,
    kind: 'task',
  })
  return task
}

export async function updateTask(
  task_id: string,
  patch: Partial<TaskInput> & { status?: TaskStatus; priority?: TaskPriority },
) {
  const t = store.tasks.find((x) => x.task_id === task_id)
  if (!t) throw new Error('Task not found')
  if (patch.title !== undefined) t.title = patch.title
  if (patch.assigned_to !== undefined) {
    t.assigned_to = patch.assigned_to
    t.assignee = patch.assigned_to
  }
  if (patch.customer_id !== undefined) {
    t.customer_id = patch.customer_id
    t.customer_name = store.customers.find((c) => c.customer_id === patch.customer_id)?.full_name
  }
  if (patch.lead_id !== undefined) t.lead_id = patch.lead_id
  if (patch.priority !== undefined) t.priority = patch.priority
  if (patch.status !== undefined) {
    t.status = patch.status
    if (patch.status === 'done' || patch.status === 'completed')
      t.completed_at = new Date().toISOString()
  }
  if (patch.due_at !== undefined) t.due_at = patch.due_at
  if (patch.notes !== undefined) t.notes = patch.notes
  store.log({ actor: 'Front desk', action: 'updated task', detail: t.title, kind: 'task' })
  return t
}

export async function completeTask(task_id: string) {
  return updateTask(task_id, { status: 'done' })
}

export async function archiveTask(task_id: string) {
  return updateTask(task_id, { status: 'archived' })
}

/* ---------------- Notifications ---------------- */

export async function markNotificationRead(notification_id: string) {
  const n = store.notifications.find((x) => x.notification_id === notification_id)
  if (n) n.read = true
  return n
}

export async function markAllNotificationsRead() {
  store.notifications.forEach((n) => {
    n.read = true
  })
  return store.notifications
}

export async function dismissNotification(notification_id: string) {
  const n = store.notifications.find((x) => x.notification_id === notification_id)
  if (n) n.dismissed = true
  return n
}

/* ---------------- Staff (mock adapter; the API enforces RBAC server-side) ---------------- */

export async function createStaff(input: {
  full_name: string
  email: string
  phone?: string
  role: StaffRole
}) {
  const member = {
    staff_id: store.next('s'),
    business_id: 'nest-library-001',
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    status: 'invited' as StaffStatus,
    assigned_count: 0,
  }
  store.staff.unshift(member)
  store.log({
    actor: 'Owner',
    action: 'invited staff',
    detail: `${input.full_name} — ${input.role}`,
    kind: 'system',
  })
  return member
}

export async function updateStaffRole(staff_id: string, role: StaffRole) {
  const m = store.staff.find((x) => x.staff_id === staff_id)
  if (!m) throw new Error('Staff not found')
  m.role = role
  store.log({
    actor: 'Owner',
    action: 'updated role',
    detail: `${m.full_name} → ${role}`,
    kind: 'system',
  })
  return m
}

export async function updateStaffStatus(staff_id: string, status: StaffStatus) {
  const m = store.staff.find((x) => x.staff_id === staff_id)
  if (!m) throw new Error('Staff not found')
  m.status = status
  return m
}

/* ---------------- Settings (mock) ---------------- */

export async function updateSettings(patch: Partial<typeof store.settings>) {
  Object.assign(store.settings, patch)
  store.log({
    actor: 'Owner',
    action: 'updated settings',
    detail: 'Business settings saved',
    kind: 'system',
  })
  return store.settings
}

/* ---------------- Customer timeline helpers ---------------- */

export async function addCustomerNote(customer_id: string, note: string) {
  const c = store.customers.find((x) => x.customer_id === customer_id)
  if (!c) throw new Error('Customer not found')
  store.log({
    actor: 'Front desk',
    action: 'added note',
    detail: `${c.full_name} — ${note.slice(0, 80)}`,
    kind: 'note',
    customer_id,
    customer_name: c.full_name,
  })
  return true
}

export function customerStatusFor(expiryIso: string, now = new Date()): MembershipStatus {
  const days = Math.round((new Date(expiryIso).getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return 'expired'
  if (days <= 7) return 'expiring'
  return 'active'
}
