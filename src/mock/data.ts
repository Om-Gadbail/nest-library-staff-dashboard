import type {
  Activity,
  Booking,
  Customer,
  Lead,
  Membership,
  NotificationItem,
  Payment,
  Renewal,
  Task,
} from '@/types/domain'

const BIZ = 'nest-library-001'

export const mockCustomers: Customer[] = [
  { customer_id: 'c-101', business_id: BIZ, full_name: 'Aarav Mehta', phone: '+91 98211 22334', joined_at: '2025-08-12', status: 'active', plan: 'yearly', expires_at: '2026-08-11' },
  { customer_id: 'c-102', business_id: BIZ, full_name: 'Diya Sharma', phone: '+91 99301 44556', joined_at: '2025-11-02', status: 'expiring', plan: 'quarterly', expires_at: '2026-09-28' },
  { customer_id: 'c-103', business_id: BIZ, full_name: 'Kabir Rao', phone: '+91 98111 90876', joined_at: '2026-02-14', status: 'active', plan: 'half-yearly', expires_at: '2026-12-20' },
  { customer_id: 'c-104', business_id: BIZ, full_name: 'Ananya Iyer', phone: '+91 97690 11223', joined_at: '2026-05-30', status: 'active', plan: 'monthly', expires_at: '2026-10-12' },
  { customer_id: 'c-105', business_id: BIZ, full_name: 'Rohan Verma', phone: '+91 98901 33445', joined_at: '2026-06-18', status: 'expiring', plan: 'monthly', expires_at: '2026-09-27' },
  { customer_id: 'c-106', business_id: BIZ, full_name: 'Sneha Kulkarni', phone: '+91 97020 55667', joined_at: '2026-07-04', status: 'active', plan: 'quarterly', expires_at: '2026-11-15' },
]

function amountFor(plan: string): number {
  return plan === 'yearly' ? 18000 : plan === 'half-yearly' ? 10000 : plan === 'quarterly' ? 5500 : 2000
}

export const mockMemberships: Membership[] = mockCustomers.map((c, i) => {
  const amount = amountFor(c.plan)
  return {
    membership_id: `m-${101 + i}`,
    business_id: BIZ,
    customer_id: c.customer_id,
    customer_name: c.full_name,
    plan: c.plan,
    status: c.status,
    start_at: c.joined_at,
    expires_at: c.expires_at,
    amount,
    paid: amount,
    balance: 0,
    payment_state: 'paid' as const,
  }
})

export const mockRenewals: Renewal[] = [
  { renewal_id: 'r-1', business_id: BIZ, customer_id: 'c-105', customer_name: 'Rohan Verma', plan: 'monthly', due_at: '2026-09-27', amount: 2000, paid: 2000, balance: 0, status: 'upcoming', days_remaining: 1, contact_status: 'pending' },
  { renewal_id: 'r-2', business_id: BIZ, customer_id: 'c-102', customer_name: 'Diya Sharma', plan: 'quarterly', due_at: '2026-09-28', amount: 5500, paid: 5500, balance: 0, status: 'upcoming', days_remaining: 2, contact_status: 'pending' },
  { renewal_id: 'r-3', business_id: BIZ, customer_id: 'c-104', customer_name: 'Ananya Iyer', plan: 'monthly', due_at: '2026-10-12', amount: 2000, paid: 1200, balance: 800, status: 'upcoming', days_remaining: 16, contact_status: 'pending' },
  { renewal_id: 'r-4', business_id: BIZ, customer_id: 'c-106', customer_name: 'Sneha Kulkarni', plan: 'quarterly', due_at: '2026-11-15', amount: 5500, paid: 5500, balance: 0, status: 'upcoming', days_remaining: 50, contact_status: 'pending' },
]

export const mockPayments: Payment[] = [
  { payment_id: 'p-901', business_id: BIZ, customer_id: 'c-104', customer_name: 'Ananya Iyer', amount: 2000, paid: 2000, balance: 0, method: 'upi', status: 'paid', received_at: '2026-09-25T10:20:00', receipt_no: 'NL-2026-0901' },
  { payment_id: 'p-902', business_id: BIZ, customer_id: 'c-106', customer_name: 'Sneha Kulkarni', amount: 5500, paid: 5500, balance: 0, method: 'card', status: 'paid', received_at: '2026-09-24T16:05:00', receipt_no: 'NL-2026-0898' },
  { payment_id: 'p-903', business_id: BIZ, customer_id: 'c-103', customer_name: 'Kabir Rao', amount: 10000, paid: 10000, balance: 0, method: 'upi', status: 'paid', received_at: '2026-09-23T12:40:00', receipt_no: 'NL-2026-0891' },
  { payment_id: 'p-904', business_id: BIZ, customer_id: 'c-101', customer_name: 'Aarav Mehta', amount: 18000, paid: 18000, balance: 0, method: 'netbanking', status: 'paid', received_at: '2026-09-20T11:12:00', receipt_no: 'NL-2026-0877' },
]

export const mockLeads: Lead[] = [
  { lead_id: 'l-21', business_id: BIZ, full_name: 'Ishaan Patel', phone: '+91 98111 00021', stage: 'new', source: 'Walk-in', created_at: '2026-09-25' },
  { lead_id: 'l-22', business_id: BIZ, full_name: 'Myra Nair', phone: '+91 98200 00022', stage: 'follow-up', source: 'Instagram', created_at: '2026-09-24', follow_up_at: '2026-09-26' },
  { lead_id: 'l-23', business_id: BIZ, full_name: 'Arjun Singh', phone: '+91 98300 00023', stage: 'interested', source: 'Referral', created_at: '2026-09-22' },
  { lead_id: 'l-24', business_id: BIZ, full_name: 'Sara Khan', phone: '+91 98400 00024', stage: 'contacted', source: 'Google', created_at: '2026-09-21' },
]

export const mockBookings: Booking[] = [
  { booking_id: 'b-11', business_id: BIZ, title: 'Discussion Room A', customer_name: 'Kabir Rao', starts_at: '2026-09-26T10:00:00', ends_at: '2026-09-26T12:00:00', status: 'confirmed' },
  { booking_id: 'b-12', business_id: BIZ, title: 'Silent Pod 3', customer_name: 'Diya Sharma', starts_at: '2026-09-26T14:00:00', ends_at: '2026-09-26T17:00:00', status: 'pending' },
]

export const mockTasks: Task[] = [
  { task_id: 't-1', business_id: BIZ, title: 'Call back 3 expiring members', assignee: 'Front desk', priority: 'high', status: 'open', due_at: '2026-09-26' },
  { task_id: 't-2', business_id: BIZ, title: 'Verify UPI settlement for Sept 24', assignee: 'Accounts', priority: 'medium', status: 'in-progress' },
  { task_id: 't-3', business_id: BIZ, title: 'Restock visitor passes', assignee: 'Front desk', priority: 'low', status: 'open' },
]

export const mockNotifications: NotificationItem[] = [
  { notification_id: 'n-1', business_id: BIZ, title: '2 renewals due this weekend', body: 'Rohan Verma and Diya Sharma expire within 3 days.', created_at: '2026-09-25T09:00:00', read: false, kind: 'renewal' },
  { notification_id: 'n-2', business_id: BIZ, title: 'Payment received - Rs 5,500', body: 'Sneha Kulkarni renewed quarterly via card.', created_at: '2026-09-24T16:06:00', read: false, kind: 'payment' },
  { notification_id: 'n-3', business_id: BIZ, title: 'New lead: Myra Nair', body: 'Follow-up scheduled for tomorrow.', created_at: '2026-09-24T11:30:00', read: true, kind: 'lead' },
  { notification_id: 'n-4', business_id: BIZ, title: 'Settlement pending review', body: 'Sept 24 UPI batch needs verification.', created_at: '2026-09-24T09:15:00', read: true, kind: 'system' },
]

export const mockActivities: Activity[] = [
  { activity_id: 'a-1', business_id: BIZ, actor: 'Priya (Front desk)', action: 'recorded payment', detail: 'Rs 2,000 from Ananya Iyer', created_at: '2026-09-25T10:21:00', kind: 'payment' },
  { activity_id: 'a-2', business_id: BIZ, actor: 'Rahul (Manager)', action: 'added lead', detail: 'Ishaan Patel - Walk-in', created_at: '2026-09-25T09:12:00', kind: 'lead' },
  { activity_id: 'a-3', business_id: BIZ, actor: 'System', action: 'flagged renewal', detail: 'Rohan Verma expires Sept 27', created_at: '2026-09-25T08:00:00', kind: 'renewal' },
  { activity_id: 'a-4', business_id: BIZ, actor: 'Priya (Front desk)', action: 'confirmed booking', detail: 'Discussion Room A - Kabir Rao', created_at: '2026-09-24T17:44:00', kind: 'booking' },
]

export const mockRevenueSeries = [
  { day: 'Mon', revenue: 8200 },
  { day: 'Tue', revenue: 12400 },
  { day: 'Wed', revenue: 9800 },
  { day: 'Thu', revenue: 15200 },
  { day: 'Fri', revenue: 11600 },
  { day: 'Sat', revenue: 18900 },
  { day: 'Sun', revenue: 7400 },
]

export const mockPlanDistribution = [
  { name: 'Monthly', value: 42 },
  { name: 'Quarterly', value: 68 },
  { name: 'Half-yearly', value: 35 },
  { name: 'Yearly', value: 51 },
]

export const dashboardMetrics = {
  todayRevenue: 18400,
  revenueDelta: '+12.4%',
  totalMembers: 196,
  membersDelta: '+6 this week',
  newLeads: 14,
  leadsDelta: '+3 today',
  expiringSoon: 12,
  expiringDelta: 'next 7 days',
}
