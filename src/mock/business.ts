import type {
  Activity,
  Booking,
  BusinessSettings,
  Customer,
  Lead,
  Membership,
  MembershipPlan,
  MembershipStatus,
  NotificationItem,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Renewal,
  StaffMember,
  Task,
} from '@/types/domain'
import { PLAN_AMOUNTS } from '@/types/domain'

const BIZ = 'nest-library-001'

type SeedCustomer = {
  id: string
  name: string
  phone: string
  email?: string
  joined: string
  plan: MembershipPlan
  expires: string
  status: MembershipStatus
  paidRatio: number // 1 = fully paid
  method: PaymentMethod
}

const SEEDS: SeedCustomer[] = [
  {
    id: 'c-101',
    name: 'Aarav Mehta',
    phone: '+91 98211 22334',
    email: 'aarav.m@gmail.com',
    joined: '2025-08-12',
    plan: 'yearly',
    expires: '2026-08-11',
    status: 'expired',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-102',
    name: 'Diya Sharma',
    phone: '+91 99301 44556',
    joined: '2025-11-02',
    plan: 'quarterly',
    expires: '2026-09-28',
    status: 'expiring',
    paidRatio: 1,
    method: 'card',
  },
  {
    id: 'c-103',
    name: 'Kabir Rao',
    phone: '+91 98111 90876',
    joined: '2026-02-14',
    plan: 'half-yearly',
    expires: '2026-12-20',
    status: 'active',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-104',
    name: 'Ananya Iyer',
    phone: '+91 97690 11223',
    joined: '2026-05-30',
    plan: 'monthly',
    expires: '2026-10-12',
    status: 'active',
    paidRatio: 0.6,
    method: 'cash',
  },
  {
    id: 'c-105',
    name: 'Rohan Verma',
    phone: '+91 98901 33445',
    joined: '2026-06-18',
    plan: 'monthly',
    expires: '2026-09-27',
    status: 'expiring',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-106',
    name: 'Sneha Kulkarni',
    phone: '+91 97020 55667',
    joined: '2026-07-04',
    plan: 'quarterly',
    expires: '2026-11-15',
    status: 'active',
    paidRatio: 1,
    method: 'card',
  },
  {
    id: 'c-107',
    name: 'Vikram Joshi',
    phone: '+91 98110 44321',
    joined: '2026-03-11',
    plan: 'yearly',
    expires: '2027-03-10',
    status: 'active',
    paidRatio: 1,
    method: 'netbanking',
  },
  {
    id: 'c-108',
    name: 'Pooja Nair',
    phone: '+91 98200 77889',
    joined: '2026-08-02',
    plan: 'monthly',
    expires: '2026-09-26',
    status: 'expiring',
    paidRatio: 0.5,
    method: 'upi',
  },
  {
    id: 'c-109',
    name: 'Aditya Khan',
    phone: '+91 98300 11223',
    joined: '2026-01-20',
    plan: 'half-yearly',
    expires: '2026-09-24',
    status: 'expired',
    paidRatio: 1,
    method: 'cash',
  },
  {
    id: 'c-110',
    name: 'Neha Gupta',
    phone: '+91 98400 33445',
    joined: '2026-08-19',
    plan: 'quarterly',
    expires: '2026-11-18',
    status: 'active',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-111',
    name: 'Karan Malhotra',
    phone: '+91 98500 55667',
    joined: '2026-09-02',
    plan: 'monthly',
    expires: '2026-10-01',
    status: 'active',
    paidRatio: 1,
    method: 'card',
  },
  {
    id: 'c-112',
    name: 'Riya Patel',
    phone: '+91 98600 77889',
    joined: '2026-06-25',
    plan: 'yearly',
    expires: '2027-06-24',
    status: 'active',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-113',
    name: 'Arjun Deshmukh',
    phone: '+91 98700 99001',
    joined: '2025-12-05',
    plan: 'quarterly',
    expires: '2026-09-26',
    status: 'expiring',
    paidRatio: 0,
    method: 'cash',
  },
  {
    id: 'c-114',
    name: 'Isha Reddy',
    phone: '+91 98800 11223',
    joined: '2026-09-10',
    plan: 'monthly',
    expires: '2026-10-09',
    status: 'active',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-115',
    name: 'Nikhil Bose',
    phone: '+91 98900 33445',
    joined: '2026-04-14',
    plan: 'half-yearly',
    expires: '2026-10-13',
    status: 'active',
    paidRatio: 0.8,
    method: 'netbanking',
  },
  {
    id: 'c-116',
    name: 'Tanvi Shah',
    phone: '+91 99000 55667',
    joined: '2026-09-12',
    plan: 'monthly',
    expires: '2026-10-11',
    status: 'active',
    paidRatio: 1,
    method: 'upi',
  },
  {
    id: 'c-117',
    name: 'Sahil Kapoor',
    phone: '+91 99100 77889',
    joined: '2026-02-28',
    plan: 'yearly',
    expires: '2026-09-20',
    status: 'expired',
    paidRatio: 1,
    method: 'card',
  },
  {
    id: 'c-118',
    name: 'Meera Krishnan',
    phone: '+91 99200 99001',
    joined: '2026-07-22',
    plan: 'quarterly',
    expires: '2026-10-21',
    status: 'active',
    paidRatio: 1,
    method: 'cash',
  },
]

function paymentStatusFor(ratio: number): PaymentStatus {
  if (ratio >= 1) return 'paid'
  if (ratio <= 0) return 'pending'
  return 'partial'
}

function toCustomers(): Customer[] {
  return SEEDS.map((s) => ({
    customer_id: s.id,
    business_id: BIZ,
    full_name: s.name,
    phone: s.phone,
    email: s.email,
    joined_at: s.joined,
    status: s.status,
    plan: s.plan,
    expires_at: s.expires,
  }))
}

function toMemberships(): Membership[] {
  return SEEDS.map((s, i) => {
    const amount = PLAN_AMOUNTS[s.plan]
    const paid = Math.round(amount * s.paidRatio)
    return {
      membership_id: `m-${101 + i}`,
      business_id: BIZ,
      customer_id: s.id,
      customer_name: s.name,
      customer_phone: s.phone,
      plan: s.plan,
      status: s.status,
      start_at: s.joined,
      expires_at: s.expires,
      amount,
      paid,
      balance: amount - paid,
      payment_state: s.paidRatio >= 1 ? 'paid' : s.paidRatio <= 0 ? 'pending' : 'partial',
    }
  })
}

function toPayments(): Payment[] {
  const rows: Payment[] = []
  SEEDS.forEach((s, i) => {
    const amount = PLAN_AMOUNTS[s.plan]
    const paid = Math.round(amount * s.paidRatio)
    if (paid <= 0) {
      rows.push({
        payment_id: `p-${900 + i}`,
        business_id: BIZ,
        customer_id: s.id,
        customer_name: s.name,
        membership_id: `m-${101 + i}`,
        plan: s.plan,
        amount,
        paid: 0,
        balance: amount,
        method: s.method,
        status: 'pending',
        received_at: `${s.joined}T10:00:00`,
        receipt_no: `NL-2026-${String(800 + i).padStart(4, '0')}`,
      })
      return
    }
    rows.push({
      payment_id: `p-${900 + i}`,
      business_id: BIZ,
      customer_id: s.id,
      customer_name: s.name,
      membership_id: `m-${101 + i}`,
      plan: s.plan,
      amount,
      paid,
      balance: amount - paid,
      method: s.method,
      status: paymentStatusFor(s.paidRatio),
      received_at: `${s.joined}T10:00:00`,
      receipt_no: `NL-2026-${String(800 + i).padStart(4, '0')}`,
    })
  })
  // Recent front-desk receipts (September)
  rows.push(
    {
      payment_id: 'p-931',
      business_id: BIZ,
      customer_id: 'c-104',
      customer_name: 'Ananya Iyer',
      membership_id: 'm-104',
      plan: 'monthly',
      amount: 2000,
      paid: 2000,
      balance: 0,
      method: 'upi',
      status: 'paid',
      received_at: '2026-09-25T10:20:00',
      receipt_no: 'NL-2026-0901',
    },
    {
      payment_id: 'p-932',
      business_id: BIZ,
      customer_id: 'c-106',
      customer_name: 'Sneha Kulkarni',
      membership_id: 'm-106',
      plan: 'quarterly',
      amount: 5500,
      paid: 5500,
      balance: 0,
      method: 'card',
      status: 'paid',
      received_at: '2026-09-24T16:05:00',
      receipt_no: 'NL-2026-0898',
    },
    {
      payment_id: 'p-933',
      business_id: BIZ,
      customer_id: 'c-115',
      customer_name: 'Nikhil Bose',
      membership_id: 'm-115',
      plan: 'half-yearly',
      amount: 10000,
      paid: 8000,
      balance: 2000,
      method: 'netbanking',
      status: 'partial',
      received_at: '2026-09-23T12:40:00',
      receipt_no: 'NL-2026-0891',
    },
    {
      payment_id: 'p-934',
      business_id: BIZ,
      customer_id: 'c-113',
      customer_name: 'Arjun Deshmukh',
      membership_id: 'm-113',
      plan: 'quarterly',
      amount: 5500,
      paid: 0,
      balance: 5500,
      method: 'cash',
      status: 'pending',
      received_at: '2026-09-22T11:00:00',
      receipt_no: 'NL-2026-0885',
    },
  )
  return rows.sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at))
}

function toRenewals(): Renewal[] {
  const pick = [
    'c-105',
    'c-102',
    'c-108',
    'c-113',
    'c-104',
    'c-111',
    'c-106',
    'c-109',
    'c-101',
    'c-117',
  ]
  return pick.map((id, i) => {
    const seed = SEEDS.find((s) => s.id === id)!
    const due = seed.expires
    const days = Math.round((new Date(due).getTime() - new Date('2026-09-26').getTime()) / 86400000)
    const status = days < 0 ? 'overdue' : days === 0 ? 'due-today' : 'upcoming'
    return {
      renewal_id: `r-${i + 1}`,
      business_id: BIZ,
      customer_id: id,
      customer_name: seed.name,
      customer_phone: seed.phone,
      plan: seed.plan,
      due_at: due,
      amount: PLAN_AMOUNTS[seed.plan],
      paid: Math.round(PLAN_AMOUNTS[seed.plan] * seed.paidRatio),
      balance: PLAN_AMOUNTS[seed.plan] - Math.round(PLAN_AMOUNTS[seed.plan] * seed.paidRatio),
      status,
      days_remaining: days,
      contact_status: i < 2 ? 'pending' : i < 4 ? 'contacted' : 'pending',
    }
  })
}

/** Mutable in-memory business store — dev/test mock adapter (see mock/handlers). */
class BusinessStore {
  customers = toCustomers()
  memberships = toMemberships()
  payments = toPayments()
  renewals = toRenewals()
  activities: Activity[] = [
    {
      activity_id: 'a-1',
      business_id: BIZ,
      actor: 'Priya (Front desk)',
      action: 'recorded payment',
      detail: 'Rs 2,000 from Ananya Iyer',
      created_at: '2026-09-25T10:21:00',
      kind: 'payment',
      customer_id: 'c-104',
      customer_name: 'Ananya Iyer',
    },
    {
      activity_id: 'a-2',
      business_id: BIZ,
      actor: 'Rahul (Manager)',
      action: 'added lead',
      detail: 'Ishaan Patel — Walk-in',
      created_at: '2026-09-25T09:12:00',
      kind: 'lead',
    },
    {
      activity_id: 'a-3',
      business_id: BIZ,
      actor: 'System',
      action: 'flagged renewal',
      detail: 'Rohan Verma expires Sept 27',
      created_at: '2026-09-25T08:00:00',
      kind: 'renewal',
      customer_id: 'c-105',
      customer_name: 'Rohan Verma',
    },
    {
      activity_id: 'a-4',
      business_id: BIZ,
      actor: 'Priya (Front desk)',
      action: 'confirmed booking',
      detail: 'Discussion Room A — Kabir Rao',
      created_at: '2026-09-24T17:44:00',
      kind: 'booking',
    },
    {
      activity_id: 'a-5',
      business_id: BIZ,
      actor: 'Priya (Front desk)',
      action: 'recorded payment',
      detail: 'Rs 5,500 from Sneha Kulkarni',
      created_at: '2026-09-24T16:06:00',
      kind: 'payment',
      customer_id: 'c-106',
      customer_name: 'Sneha Kulkarni',
    },
    {
      activity_id: 'a-6',
      business_id: BIZ,
      actor: 'System',
      action: 'flagged expiry',
      detail: 'Aditya Khan expired Sept 24',
      created_at: '2026-09-24T08:00:00',
      kind: 'renewal',
      customer_id: 'c-109',
      customer_name: 'Aditya Khan',
    },
  ]
  leads: Lead[] = [
    {
      lead_id: 'l-21',
      business_id: BIZ,
      full_name: 'Ishaan Patel',
      phone: '+91 98111 00021',
      stage: 'new',
      source: 'Walk-in',
      created_at: '2026-09-25',
      interested_plan: 'monthly',
      assigned_to: 'Priya Sharma',
      last_activity: 'Enquiry captured at front desk',
      last_activity_at: '2026-09-25T09:12:00',
    },
    {
      lead_id: 'l-22',
      business_id: BIZ,
      full_name: 'Myra Nair',
      phone: '+91 98200 00022',
      stage: 'follow-up',
      source: 'Instagram',
      created_at: '2026-09-24',
      follow_up_at: '2026-09-26',
      interested_plan: 'quarterly',
      assigned_to: 'Rahul Verma',
      notes: 'Wants evening slot tour',
      last_activity: 'Follow-up scheduled',
      last_activity_at: '2026-09-24T11:30:00',
    },
    {
      lead_id: 'l-23',
      business_id: BIZ,
      full_name: 'Arjun Singh',
      phone: '+91 98300 00023',
      stage: 'interested',
      source: 'Referral',
      created_at: '2026-09-22',
      interested_plan: 'half-yearly',
      assigned_to: 'Priya Sharma',
      notes: 'Referred by Kabir Rao',
      last_activity: 'Called — asked for pricing',
      last_activity_at: '2026-09-23T15:00:00',
    },
    {
      lead_id: 'l-24',
      business_id: BIZ,
      full_name: 'Sara Khan',
      phone: '+91 98400 00024',
      stage: 'contacted',
      source: 'Google',
      created_at: '2026-09-21',
      interested_plan: 'monthly',
      assigned_to: 'Rahul Verma',
      last_activity: 'WhatsApp sent with plans',
      last_activity_at: '2026-09-22T10:00:00',
    },
    {
      lead_id: 'l-25',
      business_id: BIZ,
      full_name: 'Dev Malhotra',
      phone: '+91 98500 00025',
      stage: 'new',
      source: 'Phone',
      created_at: '2026-09-26',
      interested_plan: 'yearly',
      assigned_to: 'Priya Sharma',
      last_activity: 'Phone enquiry',
      last_activity_at: '2026-09-26T08:30:00',
    },
    {
      lead_id: 'l-26',
      business_id: BIZ,
      full_name: 'Anvi Desai',
      phone: '+91 98600 00026',
      stage: 'lost',
      source: 'Walk-in',
      created_at: '2026-09-18',
      interested_plan: 'monthly',
      assigned_to: 'Rahul Verma',
      notes: 'Chose competitor — price',
      last_activity: 'Marked lost',
      last_activity_at: '2026-09-20T12:00:00',
    },
  ]
  bookings: Booking[] = [
    {
      booking_id: 'b-11',
      business_id: BIZ,
      title: 'Discussion Room A',
      service: 'Discussion Room',
      customer_id: 'c-103',
      customer_name: 'Kabir Rao',
      customer_phone: '+91 98111 90876',
      staff: 'Priya Sharma',
      starts_at: '2026-09-26T10:00:00',
      ends_at: '2026-09-26T12:00:00',
      status: 'confirmed',
      notes: 'Group study — 4 seats',
    },
    {
      booking_id: 'b-12',
      business_id: BIZ,
      title: 'Silent Pod 3',
      service: 'Silent Pod',
      customer_id: 'c-102',
      customer_name: 'Diya Sharma',
      customer_phone: '+91 99301 44556',
      staff: 'Rahul Verma',
      starts_at: '2026-09-26T14:00:00',
      ends_at: '2026-09-26T17:00:00',
      status: 'pending',
      notes: 'Trial session',
    },
    {
      booking_id: 'b-13',
      business_id: BIZ,
      title: 'Reading Hall — Evening',
      service: 'Reading Hall',
      customer_id: 'c-114',
      customer_name: 'Isha Reddy',
      customer_phone: '+91 98800 11223',
      staff: 'Priya Sharma',
      starts_at: '2026-09-26T17:00:00',
      ends_at: '2026-09-26T20:00:00',
      status: 'confirmed',
    },
    {
      booking_id: 'b-14',
      business_id: BIZ,
      title: 'Discussion Room B',
      service: 'Discussion Room',
      customer_id: 'c-106',
      customer_name: 'Sneha Kulkarni',
      staff: 'Rahul Verma',
      starts_at: '2026-09-27T11:00:00',
      ends_at: '2026-09-27T13:00:00',
      status: 'scheduled',
    },
    {
      booking_id: 'b-15',
      business_id: BIZ,
      title: 'Silent Pod 1',
      service: 'Silent Pod',
      customer_id: 'c-111',
      customer_name: 'Karan Malhotra',
      staff: 'Priya Sharma',
      starts_at: '2026-09-24T10:00:00',
      ends_at: '2026-09-24T12:00:00',
      status: 'completed',
    },
  ]
  tasks: Task[] = [
    {
      task_id: 't-1',
      business_id: BIZ,
      title: 'Call back 3 expiring members',
      assignee: 'Priya Sharma',
      assigned_to: 'Priya Sharma',
      customer_name: 'Rohan Verma',
      customer_id: 'c-105',
      priority: 'high',
      status: 'open',
      due_at: '2026-09-26',
      notes: 'Rohan, Diya, Pooja expire this week',
      created_at: '2026-09-25T08:00:00',
    },
    {
      task_id: 't-2',
      business_id: BIZ,
      title: 'Verify UPI settlement for Sept 24',
      assignee: 'Rahul Verma',
      assigned_to: 'Rahul Verma',
      priority: 'medium',
      status: 'in-progress',
      due_at: '2026-09-26',
      created_at: '2026-09-24T09:15:00',
    },
    {
      task_id: 't-3',
      business_id: BIZ,
      title: 'Restock visitor passes',
      assignee: 'Priya Sharma',
      assigned_to: 'Priya Sharma',
      priority: 'low',
      status: 'open',
      due_at: '2026-09-28',
      created_at: '2026-09-23T10:00:00',
    },
    {
      task_id: 't-4',
      business_id: BIZ,
      title: 'Follow up with Myra Nair',
      assignee: 'Rahul Verma',
      assigned_to: 'Rahul Verma',
      lead_id: 'l-22',
      priority: 'urgent',
      status: 'open',
      due_at: '2026-09-26',
      notes: 'Interested in quarterly plan',
      created_at: '2026-09-24T11:30:00',
    },
    {
      task_id: 't-5',
      business_id: BIZ,
      title: 'Confirm weekend room bookings',
      assignee: 'Priya Sharma',
      assigned_to: 'Priya Sharma',
      priority: 'medium',
      status: 'waiting',
      due_at: '2026-09-27',
      created_at: '2026-09-25T14:00:00',
    },
    {
      task_id: 't-6',
      business_id: BIZ,
      title: 'Collect balance from Ananya Iyer',
      assignee: 'Priya Sharma',
      assigned_to: 'Priya Sharma',
      customer_id: 'c-104',
      customer_name: 'Ananya Iyer',
      priority: 'high',
      status: 'done',
      due_at: '2026-09-23',
      completed_at: '2026-09-25T10:21:00',
      created_at: '2026-09-22T09:00:00',
    },
  ]
  staff: StaffMember[] = [
    {
      staff_id: 's-1',
      business_id: BIZ,
      full_name: 'Aarav Owner',
      email: 'owner@nestlibrary.in',
      phone: '+91 98000 11111',
      role: 'owner',
      status: 'active',
      last_active_at: '2026-09-26T09:00:00',
      assigned_count: 4,
    },
    {
      staff_id: 's-2',
      business_id: BIZ,
      full_name: 'Rahul Verma',
      email: 'rahul@nestlibrary.in',
      phone: '+91 98000 22222',
      role: 'admin',
      status: 'active',
      last_active_at: '2026-09-26T08:40:00',
      assigned_count: 9,
    },
    {
      staff_id: 's-3',
      business_id: BIZ,
      full_name: 'Priya Sharma',
      email: 'priya@nestlibrary.in',
      phone: '+91 98000 33333',
      role: 'staff',
      status: 'active',
      last_active_at: '2026-09-26T09:15:00',
      assigned_count: 12,
    },
    {
      staff_id: 's-4',
      business_id: BIZ,
      full_name: 'Kavya Nair',
      email: 'kavya@nestlibrary.in',
      role: 'staff',
      status: 'invited',
      assigned_count: 0,
    },
  ]
  settings: BusinessSettings = {
    business_id: BIZ,
    name: 'Nest Library',
    phone: '+91 98000 44444',
    email: 'hello@nestlibrary.in',
    address: '2nd Floor, MG Road, Pune 411001',
    opening_hours: 'Mon–Sun · 7:00 AM – 10:00 PM',
    renewal_reminders: true,
    payment_reminders: true,
    lead_followups: true,
    booking_reminders: true,
    whatsapp_connected: false,
    whatsapp_templates: [
      'Renewal reminder',
      'Payment receipt',
      'Lead follow-up',
      'Booking confirmation',
    ],
    reminder_timing: '1 day before',
  }
  notifications: NotificationItem[] = [
    {
      notification_id: 'n-1',
      business_id: BIZ,
      title: '2 renewals due this weekend',
      body: 'Rohan Verma and Diya Sharma expire within 3 days.',
      created_at: '2026-09-25T09:00:00',
      read: false,
      kind: 'renewal',
    },
    {
      notification_id: 'n-2',
      business_id: BIZ,
      title: 'Payment received — Rs 5,500',
      body: 'Sneha Kulkarni renewed quarterly via card.',
      created_at: '2026-09-24T16:06:00',
      read: false,
      kind: 'payment',
    },
    {
      notification_id: 'n-3',
      business_id: BIZ,
      title: 'New lead: Myra Nair',
      body: 'Follow-up scheduled for tomorrow.',
      created_at: '2026-09-24T11:30:00',
      read: true,
      kind: 'lead',
    },
    {
      notification_id: 'n-4',
      business_id: BIZ,
      title: 'Settlement pending review',
      body: 'Sept 24 UPI batch needs verification.',
      created_at: '2026-09-24T09:15:00',
      read: true,
      kind: 'system',
    },
  ]
  revenue30 = [
    { label: '28 Aug', date: '2026-08-28', revenue: 8200 },
    { label: '29 Aug', date: '2026-08-29', revenue: 12400 },
    { label: '30 Aug', date: '2026-08-30', revenue: 9800 },
    { label: '31 Aug', date: '2026-08-31', revenue: 15200 },
    { label: '1 Sep', date: '2026-09-01', revenue: 11600 },
    { label: '2 Sep', date: '2026-09-02', revenue: 18900 },
    { label: '3 Sep', date: '2026-09-03', revenue: 7400 },
    { label: '4 Sep', date: '2026-09-04', revenue: 9200 },
    { label: '5 Sep', date: '2026-09-05', revenue: 14100 },
    { label: '6 Sep', date: '2026-09-06', revenue: 10800 },
    { label: '7 Sep', date: '2026-09-07', revenue: 13400 },
    { label: '8 Sep', date: '2026-09-08', revenue: 16700 },
    { label: '9 Sep', date: '2026-09-09', revenue: 8900 },
    { label: '10 Sep', date: '2026-09-10', revenue: 12300 },
    { label: '11 Sep', date: '2026-09-11', revenue: 15800 },
    { label: '12 Sep', date: '2026-09-12', revenue: 17600 },
    { label: '13 Sep', date: '2026-09-13', revenue: 6900 },
    { label: '14 Sep', date: '2026-09-14', revenue: 10200 },
    { label: '15 Sep', date: '2026-09-15', revenue: 13900 },
    { label: '16 Sep', date: '2026-09-16', revenue: 14700 },
    { label: '17 Sep', date: '2026-09-17', revenue: 11800 },
    { label: '18 Sep', date: '2026-09-18', revenue: 16200 },
    { label: '19 Sep', date: '2026-09-19', revenue: 19400 },
    { label: '20 Sep', date: '2026-09-20', revenue: 18300 },
    { label: '21 Sep', date: '2026-09-21', revenue: 8100 },
    { label: '22 Sep', date: '2026-09-22', revenue: 9600 },
    { label: '23 Sep', date: '2026-09-23', revenue: 15500 },
    { label: '24 Sep', date: '2026-09-24', revenue: 17100 },
    { label: '25 Sep', date: '2026-09-25', revenue: 18450 },
    { label: '26 Sep', date: '2026-09-26', revenue: 18400 },
  ]
  seq = 1000

  next(prefix: string) {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  log(
    activity: Omit<Activity, 'activity_id' | 'business_id' | 'created_at'> & {
      created_at?: string
    },
  ) {
    const row: Activity = {
      activity_id: this.next('a'),
      business_id: BIZ,
      created_at: new Date().toISOString(),
      ...activity,
    }
    this.activities.unshift(row)
    return row
  }

  /** Push a notification (mock adapter). Production uses FastAPI + realtime events. */
  notify(
    item: Omit<NotificationItem, 'notification_id' | 'business_id' | 'created_at' | 'read'> & {
      created_at?: string
    },
  ) {
    const row: NotificationItem = {
      notification_id: this.next('n'),
      business_id: BIZ,
      created_at: new Date().toISOString(),
      read: false,
      ...item,
    }
    this.notifications.unshift(row)
    return row
  }
}

export const store = new BusinessStore()

export function resetStore() {
  const fresh = new BusinessStore()
  store.customers = fresh.customers
  store.memberships = fresh.memberships
  store.payments = fresh.payments
  store.renewals = fresh.renewals
  store.activities = fresh.activities
  store.leads = fresh.leads
  store.bookings = fresh.bookings
  store.tasks = fresh.tasks
  store.staff = fresh.staff
  store.settings = fresh.settings
  store.notifications = fresh.notifications
}
