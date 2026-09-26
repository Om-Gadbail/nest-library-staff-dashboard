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
    can: (action: string) => permissions.includes(action),
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
