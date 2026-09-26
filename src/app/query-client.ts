import { QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/api/client'
import { notify } from '@/lib/notify'

/**
 * Central QueryClient.
 * Calm defaults: no aggressive polling; refetch on window focus is fine for ops tool.
 * Freshness is tuned per query key (see queryKeys + feature hooks):
 * - dashboard: 30s, notifications: 60s, customers: 2min, static config: 10min.
 * Mutations should surface errors via notify.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
      onError: (error) => {
        const e = toApiError(error)
        notify.error('Something went wrong', e.message)
      },
    },
  },
})

export const freshness = {
  dashboard: 30_000,
  notifications: 60_000,
  customers: 120_000,
  customer: 60_000,
  memberships: 60_000,
  renewals: 45_000,
  payments: 30_000,
  revenue: 60_000,
  activities: 30_000,
  leads: 45_000,
  bookings: 30_000,
  tasks: 30_000,
  analytics: 60_000,
  staff: 300_000,
  settings: 300_000,
  config: 600_000,
} as const
