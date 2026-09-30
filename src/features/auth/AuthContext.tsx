/* eslint-disable react-refresh/only-export-components -- provider + hook live together by design */
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, type MeResponse } from '@/api/services'
import { setUnauthorizedHandler } from '@/api/client'

interface AuthState {
  user: MeResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  activeBusiness: MeResponse['businesses'][number] | null
  activeRole: string | null
  permissions: string[]
  can: (action: string) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => void
}

const AuthContext = React.createContext<AuthState | null>(null)

/**
 * Legacy frontend permission names (mock-era `.view` vocabulary) mapped to
 * the canonical backend permission keys (`.read` vocabulary, see backend
 * app/models/rbac.py ALL_PERMISSIONS). Server-side RBAC stays authoritative:
 * this only lets the UI *show* what the backend actually granted — every API
 * call is still authorized server-side.
 */
const PERMISSION_ALIASES: Record<string, string[]> = {
  'dashboard.view': ['dashboard.read'],
  'customers.view': ['customers.read'],
  'customers.manage': ['customers.read', 'customers.create', 'customers.update'],
  'members.view': ['members.read'],
  'memberships.view': ['memberships.read'],
  'memberships.manage': ['memberships.read', 'memberships.create', 'memberships.update'],
  'leads.view': ['leads.read'],
  'leads.manage': ['leads.read', 'leads.create', 'leads.update'],
  'leads.convert': ['leads.update'],
  'admissions.create': ['members.create', 'customers.create'],
  'bookings.view': ['bookings.read'],
  'bookings.manage': ['bookings.read', 'bookings.create', 'bookings.update'],
  'bookings.override': ['bookings.update'],
  'attendance.view': ['attendance.read'],
  'attendance.manage': ['attendance.read', 'attendance.create', 'attendance.update'],
  'payments.view': ['payments.read'],
  'payments.manage': ['payments.read', 'payments.create', 'payments.update'],
  'renewals.view': ['renewals.read'],
  'renewals.manage': ['renewals.read', 'renewals.create', 'renewals.update'],
  'tasks.view': ['tasks.read'],
  'tasks.manage': ['tasks.read', 'tasks.create', 'tasks.update'],
  'notifications.view': ['notifications.read'],
  'notifications.manage': ['notifications.read'],
  'analytics.view': ['growth.read', 'analytics.read', 'reports.read'],
  'reports.view': ['reports.read'],
  'settings.view': ['settings.read'],
  'settings.manage': ['settings.update'],
  'settings.limited': ['settings.read'],
  'staff.view': ['users.read'],
  'staff.invite': ['users.create'],
  'staff.role': ['users.update'],
  'staff.status': ['users.update'],
  'whatsapp.view': ['whatsapp.manage', 'communications.read'],
  'whatsapp.manage': ['whatsapp.manage'],
  'whatsapp.send': ['whatsapp.manage'],
  'jobs.run': ['automation.manage'],
}

export function canWithAliases(permissions: string[], action: string): boolean {
  if (permissions.includes(action)) return true
  const fallbacks = PERMISSION_ALIASES[action]
  if (!fallbacks) return false
  return fallbacks.some((p) => permissions.includes(p))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me() as Promise<MeResponse>,
    retry: false,
    staleTime: 60_000,
  })

  const logout = React.useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // logout cleanup must always run, even if the session already expired
    }
    qc.setQueryData(['auth', 'me'], null)
    await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
  }, [qc])

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(['auth', 'me'], null)
    })
    return () => setUnauthorizedHandler(null)
  }, [qc])

  const user = (meQuery.data ?? null) as MeResponse | null
  // Business context comes from the server (memberships), never from env/headers.
  const activeBusiness = user?.businesses?.[0] ?? null
  const activeRole = activeBusiness?.role ?? null
  const permissions = user?.permissions ?? []

  const value: AuthState = {
    user,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(user),
    activeBusiness,
    activeRole,
    permissions,
    can: (action: string) => canWithAliases(permissions, action),
    login: async (email: string, password: string) => {
      await authApi.login(email, password)
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      await meQuery.refetch()
    },
    logout,
    refresh: () => {
      void meQuery.refetch()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
