/** Domain types shared by the dashboard and the FastAPI backend contract. */

export type BusinessType = 'library' | 'gym' | 'multi'

export interface Business {
  business_id: string
  business_name: string
  business_type: BusinessType
  logo?: string
  tagline?: string
  phone?: string
  email?: string
  address?: string
}

export type Role = 'owner' | 'manager' | 'staff' | 'viewer'

export interface User {
  user_id: string
  business_id: string
  full_name: string
  email: string
  role: Role
  avatar_url?: string
}

export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'frozen' | 'cancelled'
export type MembershipPlan = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'day-pass'

export interface Customer {
  customer_id: string
  business_id: string
  full_name: string
  phone: string
  email?: string
  notes?: string
  joined_at: string
  status: MembershipStatus
  plan: MembershipPlan
  expires_at: string
  avatar_url?: string
}

export type PaymentState = 'paid' | 'partial' | 'pending'

export interface Membership {
  membership_id: string
  business_id: string
  customer_id: string
  customer_name: string
  customer_phone?: string
  plan: MembershipPlan
  status: MembershipStatus
  start_at: string
  expires_at: string
  amount: number
  paid: number
  balance: number
  payment_state: PaymentState
}

export type RenewalBucket = 'today' | 'tomorrow' | 'week' | 'month' | 'expired'
export type ContactStatus = 'pending' | 'contacted' | 'renewed'

export interface Renewal {
  renewal_id: string
  business_id: string
  customer_id: string
  customer_name: string
  customer_phone?: string
  plan: MembershipPlan
  due_at: string
  amount: number
  paid?: number
  balance?: number
  status: 'due-today' | 'upcoming' | 'overdue'
  bucket?: RenewalBucket
  days_remaining?: number
  contact_status?: ContactStatus
}

export type PaymentMethod = 'upi' | 'cash' | 'card' | 'netbanking' | 'bank-transfer' | 'other'
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'failed' | 'refunded'

export interface Payment {
  payment_id: string
  business_id: string
  customer_id: string
  customer_name: string
  membership_id?: string
  plan?: MembershipPlan
  amount: number
  paid: number
  balance: number
  method: PaymentMethod
  status: PaymentStatus
  received_at: string
  receipt_no: string
}

export type LeadStage = 'new' | 'contacted' | 'interested' | 'follow-up' | 'converted' | 'lost'

export type LeadSource = 'Walk-in' | 'Instagram' | 'Google' | 'Referral' | 'Phone' | 'Other'

export interface Lead {
  lead_id: string
  business_id: string
  full_name: string
  phone: string
  email?: string
  stage: LeadStage
  source: string
  interested_plan?: MembershipPlan
  assigned_to?: string
  notes?: string
  created_at: string
  updated_at?: string
  follow_up_at?: string
  last_activity_at?: string
  last_activity?: string
  converted_customer_id?: string
}

export type BookingStatus =
  'scheduled' | 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no-show'

export interface Booking {
  booking_id: string
  business_id: string
  title: string
  service?: string
  customer_id?: string
  customer_name: string
  customer_phone?: string
  staff?: string
  starts_at: string
  ends_at: string
  status: BookingStatus
  notes?: string
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus =
  'todo' | 'open' | 'in-progress' | 'waiting' | 'done' | 'completed' | 'archived'

export interface Task {
  task_id: string
  business_id: string
  title: string
  assignee?: string
  assigned_to?: string
  customer_id?: string
  customer_name?: string
  lead_id?: string
  due_at?: string
  priority: TaskPriority
  status: TaskStatus
  notes?: string
  created_at?: string
  completed_at?: string
}

export type NotificationKind =
  'admission' | 'payment' | 'renewal' | 'lead' | 'booking' | 'task' | 'whatsapp' | 'system'

export interface NotificationItem {
  notification_id: string
  business_id: string
  title: string
  body: string
  created_at: string
  read: boolean
  dismissed?: boolean
  kind: NotificationKind | 'renewal' | 'payment' | 'lead' | 'system'
  link?: string
  customer_id?: string
  customer_name?: string
}

export type ActivityKind =
  | 'admission'
  | 'payment'
  | 'renewal'
  | 'lead'
  | 'booking'
  | 'note'
  | 'notification'
  | 'contact'
  | 'call'
  | 'whatsapp'
  | 'task'
  | 'membership'
  | 'follow-up'
  | 'conversion'
  | 'system'

export interface Activity {
  activity_id: string
  business_id: string
  actor: string
  action: string
  detail?: string
  created_at: string
  kind?: ActivityKind
  customer_id?: string
  customer_name?: string
}

export interface RevenuePoint {
  label: string
  date: string
  revenue: number
  expected?: number
}

export interface RevenueSummary {
  received: number
  due: number
  expected: number
}

export interface PlanMixItem {
  name: string
  value: number
  amount: number
}

export const PLAN_LABELS: Record<MembershipPlan, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
  'day-pass': 'Day pass',
}

export const PLAN_AMOUNTS: Record<MembershipPlan, number> = {
  monthly: 2000,
  quarterly: 5500,
  'half-yearly': 10000,
  yearly: 18000,
  'day-pass': 200,
}

export const PLAN_MONTHS: Record<MembershipPlan, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
  'day-pass': 0,
}

/* ---------- staff / settings ---------- */

export type StaffRole = 'owner' | 'admin' | 'staff'
export type StaffStatus = 'active' | 'invited' | 'inactive'

export interface StaffMember {
  staff_id: string
  business_id: string
  full_name: string
  email: string
  phone?: string
  role: StaffRole
  status: StaffStatus
  last_active_at?: string
  assigned_count?: number
  avatar_url?: string
}

export interface BusinessSettings {
  business_id: string
  name: string
  phone?: string
  email?: string
  address?: string
  opening_hours?: string
  renewal_reminders: boolean
  payment_reminders: boolean
  lead_followups: boolean
  booking_reminders: boolean
  whatsapp_connected: boolean
  whatsapp_templates: string[]
  reminder_timing: string
}

export const LEAD_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'interested',
  'follow-up',
  'converted',
  'lost',
]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  'follow-up': 'Follow-up',
  converted: 'Converted',
  lost: 'Lost',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
  completed: 'Completed',
  'no-show': 'No-show',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  open: 'To Do',
  'in-progress': 'In Progress',
  waiting: 'Waiting',
  done: 'Completed',
  completed: 'Completed',
  archived: 'Archived',
}
