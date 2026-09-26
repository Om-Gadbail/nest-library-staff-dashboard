import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
  /** Backend permission required to see this item. Frontend hiding is UX only. */
  permission?: string
}

export const primaryNav: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
  { to: '/admissions', label: 'Admissions', icon: UserPlus, permission: 'admissions.create' },
  { to: '/memberships', label: 'Memberships', icon: BookOpenCheck, permission: 'memberships.view' },
  { to: '/renewals', label: 'Renewals', icon: ArrowLeftRight, permission: 'memberships.view' },
  { to: '/leads', label: 'Leads', icon: UsersRound, permission: 'leads.view' },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays, permission: 'bookings.view' },
  { to: '/payments', label: 'Payments', icon: Wallet, permission: 'payments.view' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList, permission: 'tasks.view' },
  { to: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.view' },
]

export const secondaryNav: NavItem[] = [
  { to: '/staff', label: 'Staff', icon: CreditCard, permission: 'staff.view' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
]

export const allNav = [...primaryNav, ...secondaryNav]
