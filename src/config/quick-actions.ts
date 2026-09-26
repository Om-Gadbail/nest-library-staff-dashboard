import {
  CalendarPlus,
  ClipboardList,
  CreditCard,
  RefreshCcw,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'

/**
 * Unified quick-action registry — single source of truth.
 * Desktop: command palette / quick-action panel. Mobile: center + button → bottom sheet.
 * Each action opens the correct workflow; logic lives here, not duplicated per screen.
 */

export interface QuickAction {
  key: string
  label: string
  hint: string
  icon: typeof UserCheck
  to: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'admission',
    label: 'New Admission',
    hint: 'Customer + membership + payment',
    icon: UserCheck,
    to: '/admissions',
  },
  {
    key: 'customer',
    label: 'New Customer',
    hint: 'Quick profile via admission',
    icon: UserPlus,
    to: '/admissions',
  },
  {
    key: 'lead',
    label: 'New Lead',
    hint: 'Capture enquiry in seconds',
    icon: UsersRound,
    to: '/leads?new=1',
  },
  {
    key: 'payment',
    label: 'Record Payment',
    hint: 'UPI / cash / card',
    icon: CreditCard,
    to: '/payments',
  },
  {
    key: 'renewal',
    label: 'Renew Membership',
    hint: 'Extend expiry + receipt',
    icon: RefreshCcw,
    to: '/renewals',
  },
  {
    key: 'booking',
    label: 'New Booking',
    hint: 'Rooms & pods',
    icon: CalendarPlus,
    to: '/bookings?new=1',
  },
  {
    key: 'task',
    label: 'New Task',
    hint: 'Assign follow-up work',
    icon: ClipboardList,
    to: '/tasks?new=1',
  },
]

export function runQuickAction(
  navigate: (to: string) => void,
  setOpen: (v: boolean) => void,
  to: string,
) {
  setOpen(false)
  navigate(to)
}
