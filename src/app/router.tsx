import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import {
  AdmissionsPage,
  AnalyticsPage,
  BookingsPage,
  CustomerProfilePage,
  CustomersPage,
  DashboardPage,
  Lazy,
  LeadDetailPage,
  LeadsPage,
  LoginPage,
  MembershipsPage,
  NotFoundPage,
  NotificationsPage,
  PaymentsPage,
  RenewalsPage,
  SettingsPage,
  StaffPage,
  TasksPage,
} from './lazy-pages'

function guard(permission: string | undefined, el: React.ReactNode) {
  return <ProtectedRoute permission={permission}>{el}</ProtectedRoute>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
  },
  {
    path: '/',
    element: guard(undefined, <AppShell />),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Lazy>
            <DashboardPage />
          </Lazy>
        ),
      },
      {
        path: 'customers',
        element: guard('customers.view', <Lazy><CustomersPage /></Lazy>),
      },
      {
        path: 'customers/:id',
        element: guard('customers.view', <Lazy><CustomerProfilePage /></Lazy>),
      },
      {
        path: 'admissions',
        element: guard('admissions.create', <Lazy><AdmissionsPage /></Lazy>),
      },
      {
        path: 'memberships',
        element: guard('memberships.view', <Lazy><MembershipsPage /></Lazy>),
      },
      {
        path: 'renewals',
        element: guard('memberships.view', <Lazy><RenewalsPage /></Lazy>),
      },
      {
        path: 'payments',
        element: guard('payments.view', <Lazy><PaymentsPage /></Lazy>),
      },
      {
        path: 'leads',
        element: guard('leads.view', <Lazy><LeadsPage /></Lazy>),
      },
      {
        path: 'leads/:id',
        element: guard('leads.view', <Lazy><LeadDetailPage /></Lazy>),
      },
      {
        path: 'bookings',
        element: guard('bookings.view', <Lazy><BookingsPage /></Lazy>),
      },
      {
        path: 'analytics',
        element: guard('analytics.view', <Lazy><AnalyticsPage /></Lazy>),
      },
      {
        path: 'tasks',
        element: guard('tasks.view', <Lazy><TasksPage /></Lazy>),
      },
      {
        path: 'notifications',
        element: guard('notifications.view', <Lazy><NotificationsPage /></Lazy>),
      },
      {
        path: 'staff',
        element: guard('staff.view', <Lazy><StaffPage /></Lazy>),
      },
      {
        path: 'settings',
        element: guard('settings.view', <Lazy><SettingsPage /></Lazy>),
      },
      {
        path: '*',
        element: (
          <Lazy>
            <NotFoundPage />
          </Lazy>
        ),
      },
    ],
  },
])
