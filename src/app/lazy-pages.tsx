import * as React from 'react'

export const DashboardPage = React.lazy(() => import('@/features/dashboard/DashboardPage'))
export const CustomersPage = React.lazy(() => import('@/features/customers/CustomersPage'))
export const CustomerProfilePage = React.lazy(
  () => import('@/features/customers/CustomerProfilePage'),
)
export const AdmissionsPage = React.lazy(() => import('@/features/admissions/AdmissionsPage'))
export const MembershipsPage = React.lazy(() => import('@/features/memberships/MembershipsPage'))
export const RenewalsPage = React.lazy(() => import('@/features/renewals/RenewalsPage'))
export const PaymentsPage = React.lazy(() => import('@/features/payments/PaymentsPage'))
export const LeadsPage = React.lazy(() => import('@/features/leads/LeadsPage'))
export const LeadDetailPage = React.lazy(() => import('@/features/leads/LeadDetailPage'))
export const BookingsPage = React.lazy(() => import('@/features/bookings/BookingsPage'))
export const TasksPage = React.lazy(() => import('@/features/tasks/TasksPage'))
export const NotificationsPage = React.lazy(
  () => import('@/features/notifications/NotificationsPage'),
)
export const AnalyticsPage = React.lazy(() => import('@/features/analytics/AnalyticsPage'))
export const StaffPage = React.lazy(() => import('@/features/staff/StaffPage'))
export const SettingsPage = React.lazy(() => import('@/features/settings/SettingsPage'))
export const NotFoundPage = React.lazy(() => import('@/features/placeholder/NotFoundPage'))
export const LoginPage = React.lazy(() => import('@/features/auth/LoginPage'))

export function Lazy({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={<RouteFallback />}>{children}</React.Suspense>
}

export function RouteFallback() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="skeleton-shimmer h-8 w-48 rounded-md" />
      <div className="mt-3 skeleton-shimmer h-4 w-72 rounded" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
